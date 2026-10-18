import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { errorMessage, type Donation, type DonationEvent, type DonationItem } from '@/lib/client';
import { STATUS_LABEL, TRANSITIONS, isStatus, type Status } from '@/lib/domain';
import { fmtKg, isToday, uuid } from '@/lib/format';
import { cacheGet, discardOp, enqueue, pendingStatus, useQueue } from '@/lib/offline';
import type { DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';
import { clearOptimistic, optimisticStatus, setOptimistic, useOptimistic, useToast } from './undo';
import { Button, C, Disclosure, Muted, Text, hhmm, haptic } from './ui';

/** What the screen should show: optimistic (undo window) → queued → server. */
export function effectiveStatus(d: Donation): Status {
  return (optimisticStatus(d.id) ?? pendingStatus(d.id) ?? d.status) as Status;
}

/** Re-render on queue and optimistic changes (use in list screens). */
export function useLiveStatus() {
  useQueue();
  useOptimistic();
}

// ───────────────────────────── time labels ─────────────────────────────

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function isTomorrow(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.toDateString() === t.toDateString();
}

/** "17:30" today, "Mañana 9:00", otherwise "Lun 20 oct 9:00". */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  if (isToday(iso)) return hhmm(iso);
  if (isTomorrow(iso)) return `Mañana ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${hhmm(iso)}`;
}

/** Orange time pill text for a card / detail. */
export function timePillText(d: Donation, status: Status): string {
  if (status === 'PICKED_UP') return `Salió ${hhmm(d.pickedUpAt)}`;
  if (status === 'AREA_READY') return `Lista ${hhmm(d.areaReadyAt ?? new Date().toISOString())}`;
  if (status === 'UNLOADED') return `Bajó ${hhmm(d.unloadedAt ?? new Date().toISOString())}`;
  if (status === 'CLOSED') return `Cerrada ${hhmm(d.closedAt)}`;
  return isToday(d.scheduledAt) ? `HOY ${hhmm(d.scheduledAt)}` : whenLabel(d.scheduledAt);
}

// ───────────────────────────── load summary ─────────────────────────────

/** Items of a donation from the offline cache (filled by prefetchDetails / the detail screen). */
export function useCachedItems(id: string, version = 0) {
  const [items, setItems] = useState<DonationItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    cacheGet<DonationDetail>(`donation:${id}`).then((c) => alive && setItems(c?.data.items ?? null));
    return () => {
      alive = false;
    };
  }, [id, version]);
  return items;
}

export function statedSummary(d: Donation, items: DonationItem[] | null) {
  const stated = (items ?? []).filter((i) => i.stage === 'STATED');
  const kg = d.statedKgTotal ?? (stated.length ? stated.reduce((s, i) => s + (i.kg || 0), 0) : null);
  return { kg, count: stated.length };
}

/** "≈118 kg · 6 productos" or "Contenido por confirmar". */
export function loadText(d: Donation, items: DonationItem[] | null, suffix = '') {
  const { kg, count } = statedSummary(d, items);
  if (kg == null && !count) return 'Contenido por confirmar';
  const parts = [];
  if (kg != null) parts.push(`${suffix ? '' : '≈'}${Math.round(kg)} kg${suffix}`);
  if (count) parts.push(`${count} producto${count === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

// ───────────────────────────── role action ─────────────────────────────

const LABEL: Partial<Record<Status, string>> = {
  PICKED_UP: 'Área de llegada lista',
  AREA_READY: 'Marcar descargada',
  UNLOADED: 'Revisar ahora',
  IN_REVISION: 'Continuar revisión',
  ASSIGNED: 'Registrar recolección',
};

/**
 * The signed-in role's next step on a donation (TRANSITIONS stays the source of truth).
 * - Almacén: instant + 6 s undo, then queued.
 * - Inspección: "Revisar ahora" queues UNLOADED → IN_REVISION and opens the review in one tap.
 * - Chofer: opens the pickup note.
 * - Admin: keeps its confirmation.
 */
export function useRoleAction(d: Donation, onDone?: () => unknown) {
  const user = useUser();
  const toast = useToast();
  const q = useQueue();
  useOptimistic();
  const [busy, setBusy] = useState(false);
  const status = effectiveStatus(d);
  const queued = !!pendingStatus(d.id) || !!optimisticStatus(d.id);
  const transition = TRANSITIONS.find((t) => t.from === status && t.role === user.role);
  // A queued change blocks further steps, except inspection continuing its own revision.
  const allowed = transition && (!queued || (user.role === 'INSPECTION' && status === 'IN_REVISION'));

  const op = (to: Status) => ({
    kind: 'transition' as const,
    id: uuid(),
    donationId: d.id,
    from: status,
    to,
    at: new Date().toISOString(),
    by: { id: user.sub, name: user.name || user.email },
    attempts: 0,
  });

  const undoable = (to: Status) => {
    const o = op(to);
    setOptimistic(d.id, to);
    haptic.success();
    const text = !q.online
      ? 'Guardado. Se enviará al volver la señal'
      : to === 'AREA_READY'
        ? `Área lista · ${d.donorName}`
        : 'Descargada · pasa a Inspección';
    toast.show({
      text,
      icon: q.online ? 'check' : 'wifiOff',
      commit: async () => {
        try {
          await enqueue(o);
        } finally {
          clearOptimistic(d.id);
          void onDone?.();
        }
      },
      undo: () => clearOptimistic(d.id),
      revert: () => void discardOp(o.id),
    });
  };

  const run = async () => {
    if (!allowed || !transition) return;
    const to = transition.to;
    if (to === 'PICKED_UP') {
      router.push({ pathname: '/driver/pickup/[id]', params: { id: d.id } });
    } else if (to === 'CLOSED') {
      router.push({ pathname: '/inspection/review/[id]', params: { id: d.id } });
    } else if (user.role === 'WAREHOUSE') {
      undoable(to);
    } else if (to === 'IN_REVISION') {
      setBusy(true);
      try {
        await enqueue(op(to));
        router.push({ pathname: '/inspection/review/[id]', params: { id: d.id } });
      } catch (e) {
        Alert.alert('Error', errorMessage(e));
      } finally {
        setBusy(false);
      }
    } else {
      Alert.alert(transition.action, `¿Confirmas: ${STATUS_LABEL[to]}?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setBusy(true);
            try {
              await enqueue(op(to));
              await onDone?.();
            } catch (e) {
              Alert.alert('Error', errorMessage(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    }
  };

  return {
    transition: allowed ? transition : undefined,
    label: allowed && transition ? (LABEL[status] ?? transition.action) : '',
    /** Secondary style for "Continuar revisión". */
    secondary: status === 'IN_REVISION',
    pending: queued,
    busy,
    run,
  };
}

// ───────────────────────────── shared blocks ─────────────────────────────

export function MapButtons({ address }: { address: string }) {
  const q = encodeURIComponent(address);
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir la aplicación de mapas');
    }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button
        kind="secondary"
        icon="mapPin"
        title="Google Maps"
        style={{ flex: 1 }}
        onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${q}`)}
      />
      <Button
        kind="secondary"
        icon="navigation"
        title="Waze"
        style={{ flex: 1 }}
        onPress={() => open(`https://waze.com/ul?q=${q}&navigate=yes`)}
      />
    </View>
  );
}

/** Line list: "Arroz · 20 bolsas ........ 20 kg" */
export function ItemLines({ items }: { items: DonationItem[] }) {
  if (!items.length) return <Muted>Sin productos registrados.</Muted>;
  return (
    <View>
      {items.map((i, idx) => (
        <View
          key={i.id}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 10,
            paddingVertical: 12,
            borderBottomWidth: idx === items.length - 1 ? 0 : 1,
            borderBottomColor: C.divider,
          }}>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>
            {i.name}
            <Text style={{ fontWeight: '500', color: C.gray }}>
              {' '}
              · {i.quantity} {i.unit}
            </Text>
          </Text>
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{fmtKg(i.kg)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Inspection result per product: useful / discarded + reason. */
export function ReviewedLines({ items }: { items: DonationItem[] }) {
  return (
    <View>
      {items.map((i, idx) => (
        <View
          key={i.id}
          style={{ paddingVertical: 12, gap: 2, borderBottomWidth: idx === items.length - 1 ? 0 : 1, borderBottomColor: C.divider }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>
              {i.name}
              {!i.sourceItemId ? <Text style={{ fontWeight: '500', color: C.gray }}> · agregado</Text> : null}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.greenText }}>{fmtKg(i.kg)}</Text>
          </View>
          {i.discardedKg ? (
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.redText }}>
              Descartado {fmtKg(i.discardedKg)} · {i.discardReason ?? 'sin motivo'}
            </Text>
          ) : null}
          {i.expiryDate ? <Muted style={{ fontSize: 14 }}>Caduca {i.expiryDate}</Muted> : null}
        </View>
      ))}
    </View>
  );
}

export function History({ events }: { events: DonationEvent[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure
      title={`Historial (${events.length} ${events.length === 1 ? 'movimiento' : 'movimientos'})`}
      open={open}
      onToggle={() => setOpen((v) => !v)}>
      {events.map((e, idx) => {
        const to = isStatus(e.toStatus) ? STATUS_LABEL[e.toStatus] : e.toStatus;
        const conflict = e.kind === 'CONFLICT';
        const title =
          e.kind === 'STATUS'
            ? `→ ${to}`
            : conflict
              ? 'Conflicto de sincronización'
              : e.kind === 'REASSIGN'
                ? 'Chofer asignado'
                : e.kind === 'EDIT'
                  ? 'Datos editados'
                  : e.kind;
        return (
          <View key={e.id} style={{ paddingVertical: 10, borderTopWidth: idx ? 1 : 0, borderTopColor: C.divider }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: conflict ? C.redText : C.ink }}>{title}</Text>
            <Muted style={{ fontSize: 14 }}>
              {whenLabel(e.at)} · {e.byName}
            </Muted>
            {e.note ? <Text style={{ fontSize: 15, marginTop: 2 }}>{e.note}</Text> : null}
          </View>
        );
      })}
      {!events.length ? <Muted>Sin movimientos.</Muted> : null}
    </Disclosure>
  );
}
