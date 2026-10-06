/**
 * Offline support for DRIVER, WAREHOUSE and INSPECTION (Amplify Gen 2 has no DataStore).
 *
 * 1. Read cache: every list/detail fetched successfully is stored in AsyncStorage and shown
 *    when there is no connection.
 * 2. Write queue: notes and status changes are stored as operations in AsyncStorage and sent
 *    in order when there is connection (on app start, when connectivity returns, every minute).
 *    Every record gets a client-generated id, so retrying an operation never duplicates data.
 * 3. Conflicts: notes, items and photos are never lost. If the donation's status changed on the
 *    server meanwhile, the status change is skipped, the donation is flagged `needsReview`, and a
 *    CONFLICT event is written so the admin can resolve it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { uploadData } from 'aws-amplify/storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api, errorMessage, isAlreadyExists, must } from './client';
import { STATUS_LABEL, STATUS_TIMESTAMP, type Status, isStatus } from './domain';

// ───────────────────────────── types ─────────────────────────────

export type ItemInput = {
  id: string;
  stage: 'STATED' | 'REVIEWED';
  name: string;
  category: string;
  customCategory?: string | null;
  quantity: number;
  unit: string;
  kg: number;
  discardedKg?: number | null;
  discardReason?: string | null;
  expiryDate?: string | null;
  sourceItemId?: string | null;
};

type By = { id: string; name: string };
type Base = { id: string; donationId: string; at: string; by: By; attempts: number; lastError?: string };

export type Op =
  | (Base & { kind: 'transition'; from: Status; to: Status; note?: string })
  | (Base & {
      kind: 'pickup';
      driverId: string;
      items: ItemInput[];
      signatureUri: string;
      listUri?: string | null;
      extraUris: string[];
      driverNotes?: string;
      uploaded?: Record<string, string>; // local uri → S3 path, filled as uploads finish
    })
  | (Base & {
      kind: 'revision';
      driverId?: string | null;
      items: ItemInput[];
      inspectionNotes?: string;
    });

// ───────────────────────────── cache ─────────────────────────────

type Cached<T> = { data: T; savedAt: string };

export async function cacheSet<T>(key: string, data: T) {
  try {
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify({ data, savedAt: new Date().toISOString() }));
  } catch {
    // cache is best effort
  }
}

export async function cacheGet<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    return raw ? (JSON.parse(raw) as Cached<T>) : null;
  } catch {
    return null;
  }
}

/**
 * Fetches data online and caches it; falls back to the cache when the fetch fails.
 * `fromCache` + `savedAt` let the screen show "sin conexión — datos de HH:MM".
 */
export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetcherRef.current();
      setData(fresh);
      setFromCache(false);
      setError(null);
      setSavedAt(new Date().toISOString());
      await cacheSet(key, fresh);
    } catch (e) {
      const cached = await cacheGet<T>(key);
      if (cached) {
        setData(cached.data);
        setSavedAt(cached.savedAt);
        setFromCache(true);
        setError(null);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when the queue finishes syncing so the screen shows server state.
  useEffect(() => onQueueChange((s) => s.justSynced && refresh()), [refresh]);

  return { data, loading, error, fromCache, savedAt, refresh };
}

// ───────────────────────────── queue ─────────────────────────────

const QUEUE_KEY = 'queue:v1';

type QueueState = { ops: Op[]; syncing: boolean; online: boolean; justSynced: boolean };
let state: QueueState = { ops: [], syncing: false, online: true, justSynced: false };
let loaded = false;
const listeners = new Set<(s: QueueState) => void>();

function emit(patch: Partial<QueueState>) {
  state = { ...state, justSynced: false, ...patch };
  listeners.forEach((l) => l(state));
}

export function onQueueChange(fn: (s: QueueState) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function load() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    state.ops = raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    state.ops = [];
  }
  loaded = true;
}

async function save(ops: Op[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  emit({ ops });
}

/** Adds an operation and tries to send it right away. */
export async function enqueue(op: Op) {
  await load();
  await save([...state.ops, op]);
  void flush();
}

export async function discardOp(id: string) {
  await load();
  await save(state.ops.filter((o) => o.id !== id));
}

/** Status the donation will have once its pending operations sync (for optimistic UI). */
export function pendingStatus(donationId: string): Status | null {
  let s: Status | null = null;
  for (const op of state.ops) {
    if (op.donationId !== donationId) continue;
    if (op.kind === 'transition') s = op.to;
    if (op.kind === 'pickup') s = 'PICKED_UP';
    if (op.kind === 'revision') s = 'CLOSED';
  }
  return s;
}

export function useQueue() {
  const [s, setS] = useState(state);
  useEffect(() => {
    void load().then(() => setS(state));
    return onQueueChange(setS);
  }, []);
  return s;
}

async function isOnline() {
  const n = await NetInfo.fetch();
  return !!n.isConnected && n.isInternetReachable !== false;
}

let flushing: Promise<void> | null = null;

/** Sends pending operations in order. Safe to call any time. */
export function flush(): Promise<void> {
  if (!flushing) {
    flushing = doFlush().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush() {
  await load();
  if (!state.ops.length) return;
  if (!(await isOnline())) {
    emit({ online: false });
    return;
  }
  emit({ syncing: true, online: true });
  let sentAny = false;
  const blocked = new Set<string>(); // donations with a failed op: keep their later ops in order

  for (const op of [...state.ops]) {
    if (blocked.has(op.donationId)) continue;
    try {
      await process(op);
      sentAny = true;
      await save(state.ops.filter((o) => o.id !== op.id));
    } catch (e) {
      const offline = !(await isOnline());
      const updated = state.ops.map((o) =>
        o.id === op.id ? { ...o, attempts: o.attempts + 1, lastError: errorMessage(e) } : o,
      );
      await save(updated);
      if (offline) {
        emit({ online: false });
        break;
      }
      blocked.add(op.donationId);
    }
  }
  emit({ syncing: false, justSynced: sentAny });
}

let started = false;
/** Call once at app start. */
export function startSyncEngine() {
  if (started) return;
  started = true;
  void flush();
  NetInfo.addEventListener((n) => {
    const online = !!n.isConnected && n.isInternetReachable !== false;
    if (online !== state.online) emit({ online });
    if (online) void flush();
  });
  AppState.addEventListener('change', (s) => s === 'active' && void flush());
  setInterval(() => void flush(), 60_000);
}

export async function clearQueue() {
  await save([]);
}

// ───────────────────────────── processing ─────────────────────────────

async function getDonation(id: string) {
  return must(await api().models.Donation.get({ id }));
}

async function createEvent(e: {
  id: string;
  donationId: string;
  driverId?: string | null;
  kind: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  by: By;
  at: string;
  note?: string;
}) {
  try {
    must(
      await api().models.DonationEvent.create({
        id: e.id,
        donationId: e.donationId,
        driverId: e.driverId ?? null,
        kind: e.kind,
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        byUserId: e.by.id,
        byName: e.by.name,
        at: e.at,
        note: e.note ?? null,
      }),
    );
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
}

async function createItem(donationId: string, driverId: string | null | undefined, item: ItemInput) {
  try {
    must(
      await api().models.DonationItem.create({
        ...item,
        donationId,
        driverId: driverId ?? null,
        customCategory: item.customCategory ?? null,
        discardedKg: item.discardedKg ?? null,
        discardReason: item.discardReason ?? null,
        expiryDate: item.expiryDate ?? null,
        sourceItemId: item.sourceItemId ?? null,
      }),
    );
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
}

async function markConflict(op: Op, currentStatus: string | null, driverId?: string | null, extra = '') {
  try {
    must(await api().models.Donation.update({ id: op.donationId, needsReview: true }));
  } catch {
    // the user may no longer have access (e.g. reassigned) — the event still records it
  }
  const label = isStatus(currentStatus) ? STATUS_LABEL[currentStatus] : (currentStatus ?? 'eliminada');
  await createEvent({
    id: op.id,
    donationId: op.donationId,
    driverId,
    kind: 'CONFLICT',
    by: op.by,
    at: op.at,
    note: `Sincronización fuera de línea: la donación estaba "${label}" en el servidor. ${extra}`.trim(),
  });
}

async function uploadPhoto(op: Extract<Op, { kind: 'pickup' }>, uri: string, name: string) {
  if (op.uploaded?.[uri]) return op.uploaded[uri];
  const path = `donation-photos/${op.donationId}/${op.id}-${name}.jpg`;
  const blob = await (await fetch(uri)).blob();
  await uploadData({ path, data: blob, options: { contentType: 'image/jpeg' } }).result;
  op.uploaded = { ...(op.uploaded ?? {}), [uri]: path };
  await save(state.ops.map((o) => (o.id === op.id ? op : o)));
  return path;
}

async function process(op: Op) {
  if (op.kind === 'transition') {
    const d = await getDonation(op.donationId);
    if (!d) throw new Error('La donación ya no existe');
    if (d.status === op.to) return; // already applied (retry)
    if (d.status !== op.from) return markConflict(op, d.status, d.driverId);
    const tsField = STATUS_TIMESTAMP[op.to];
    must(
      await api().models.Donation.update({
        id: op.donationId,
        status: op.to,
        ...(tsField ? { [tsField]: op.at } : {}),
      }),
    );
    await createEvent({
      id: op.id,
      donationId: op.donationId,
      driverId: d.driverId,
      kind: 'STATUS',
      fromStatus: op.from,
      toStatus: op.to,
      by: op.by,
      at: op.at,
      note: op.note,
    });
    return;
  }

  if (op.kind === 'pickup') {
    const signatureKey = await uploadPhoto(op, op.signatureUri, 'firma');
    const listKey = op.listUri ? await uploadPhoto(op, op.listUri, 'lista') : null;
    const extraKeys: string[] = [];
    for (let i = 0; i < op.extraUris.length; i++) {
      extraKeys.push(await uploadPhoto(op, op.extraUris[i], `foto-${i + 1}`));
    }
    for (const item of op.items) await createItem(op.donationId, op.driverId, item);

    const statedKgTotal = op.items.reduce((s, i) => s + (i.kg || 0), 0);
    const fields = {
      signaturePhotoKey: signatureKey,
      listPhotoKey: listKey,
      extraPhotoKeys: extraKeys,
      driverNotes: op.driverNotes || null,
      statedKgTotal,
    };

    let d;
    try {
      d = await getDonation(op.donationId);
    } catch {
      d = null; // no longer readable (reassigned to another driver)
    }
    if (!d || d.status !== 'ASSIGNED') {
      if (d && d.status === 'PICKED_UP' && d.pickedUpAt === op.at) return; // retry
      try {
        must(await api().models.Donation.update({ id: op.donationId, ...fields }));
      } catch {
        // keep going: items, photos and the event are saved anyway
      }
      return markConflict(op, d?.status ?? null, op.driverId, 'Se guardó la nota del chofer.');
    }
    must(
      await api().models.Donation.update({
        id: op.donationId,
        ...fields,
        status: 'PICKED_UP',
        pickedUpAt: op.at,
      }),
    );
    await createEvent({
      id: op.id,
      donationId: op.donationId,
      driverId: op.driverId,
      kind: 'STATUS',
      fromStatus: 'ASSIGNED',
      toStatus: 'PICKED_UP',
      by: op.by,
      at: op.at,
      note: `Nota de recolección: ${op.items.length} producto(s), ${Math.round(statedKgTotal * 10) / 10} kg declarados`,
    });
    return;
  }

  // revision
  for (const item of op.items) await createItem(op.donationId, op.driverId, item);
  const usefulKgTotal = op.items.reduce((s, i) => s + (i.kg || 0), 0);
  const discardedKgTotal = op.items.reduce((s, i) => s + (i.discardedKg || 0), 0);
  const d = await getDonation(op.donationId);
  if (!d) throw new Error('La donación ya no existe');
  const fields = { inspectionNotes: op.inspectionNotes || null, usefulKgTotal, discardedKgTotal };
  if (d.status === 'CLOSED' && d.closedAt === op.at) return; // retry
  if (d.status !== 'IN_REVISION') {
    must(await api().models.Donation.update({ id: op.donationId, ...fields }));
    return markConflict(op, d.status, d.driverId, 'Se guardó la revisión.');
  }
  must(
    await api().models.Donation.update({
      id: op.donationId,
      ...fields,
      status: 'CLOSED',
      closedAt: op.at,
    }),
  );
  await createEvent({
    id: op.id,
    donationId: op.donationId,
    driverId: d.driverId,
    kind: 'STATUS',
    fromStatus: 'IN_REVISION',
    toStatus: 'CLOSED',
    by: op.by,
    at: op.at,
    note: `Revisión: ${Math.round(usefulKgTotal * 10) / 10} kg útiles, ${Math.round(discardedKgTotal * 10) / 10} kg descartados`,
  });
}
