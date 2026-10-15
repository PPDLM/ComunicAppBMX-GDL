/** ADMIN-only operations. These run online (no offline queue). */
import { remove } from 'aws-amplify/storage';

import { api, must, type Donation } from './client';
import { STATUS_LABEL, STATUS_TIMESTAMP, type Status, isStatus } from './domain';
import { uuid } from './format';
import { eventsOf, itemsOf } from './queries';
import type { SessionUser } from './session';

export type AdminUser = {
  username: string;
  sub: string;
  email: string;
  name: string;
  role: string | null;
  enabled: boolean;
  status: string;
  createdAt: string | null;
};

async function event(
  d: { id: string; driverId?: string | null },
  by: SessionUser,
  kind: string,
  from: string | null,
  to: string | null,
  note?: string,
) {
  must(
    await api().models.DonationEvent.create({
      id: uuid(),
      donationId: d.id,
      driverId: d.driverId ?? null,
      kind,
      fromStatus: from,
      toStatus: to,
      byUserId: by.sub,
      byName: by.name || by.email,
      at: new Date().toISOString(),
      note: note ?? null,
    }),
  );
}

export type DonationInput = {
  donorName: string;
  pickupAddress: string;
  scheduledAt: string;
  requestedContents: string | null;
  adminNotes: string | null;
  driverId: string | null;
  driverName: string | null;
};

export async function createDonation(input: DonationInput, by: SessionUser) {
  const now = new Date().toISOString();
  const status: Status = input.driverId ? 'ASSIGNED' : 'REQUESTED';
  const d = must(
    await api().models.Donation.create({
      ...input,
      status,
      needsReview: false,
      assignedAt: input.driverId ? now : null,
    }),
  );
  if (!d) throw new Error('No se pudo crear la donación');
  await event(d, by, 'STATUS', null, 'REQUESTED', 'Donación registrada');
  if (input.driverId) await event(d, by, 'REASSIGN', 'REQUESTED', 'ASSIGNED', `Asignada a ${input.driverName}`);
  return d;
}

export async function updateDonation(prev: Donation, input: DonationInput, by: SessionUser) {
  const driverChanged = (prev.driverId ?? null) !== (input.driverId ?? null);
  let status = prev.status;
  const extra: { assignedAt?: string } = {};
  if (driverChanged && input.driverId && prev.status === 'REQUESTED') {
    status = 'ASSIGNED';
    extra.assignedAt = new Date().toISOString();
  }
  if (driverChanged && !input.driverId && prev.status === 'ASSIGNED') status = 'REQUESTED';

  const d = must(await api().models.Donation.update({ id: prev.id, ...input, ...extra, status }));
  if (!d) throw new Error('No se pudo guardar');
  if (driverChanged) {
    await event(
      d,
      by,
      'REASSIGN',
      prev.status,
      status,
      input.driverId
        ? `Chofer: ${prev.driverName || 'sin asignar'} → ${input.driverName}`
        : `Se quitó al chofer ${prev.driverName ?? ''}`,
    );
  }
  const changed = (['donorName', 'pickupAddress', 'scheduledAt', 'requestedContents', 'adminNotes'] as const).filter(
    (k) => (prev[k] ?? null) !== (input[k] ?? null),
  );
  if (changed.length) await event(d, by, 'EDIT', null, null, `Campos editados: ${changed.join(', ')}`);
  return d;
}

export async function forceStatus(d: Donation, to: Status, by: SessionUser, note?: string) {
  const ts = STATUS_TIMESTAMP[to];
  must(
    await api().models.Donation.update({
      id: d.id,
      status: to,
      ...(ts ? { [ts]: new Date().toISOString() } : {}),
    }),
  );
  const from = isStatus(d.status) ? STATUS_LABEL[d.status] : d.status;
  await event(d, by, 'STATUS', d.status, to, note || `Cambio forzado por administrador (antes: ${from})`);
}

export async function cancelDonation(d: Donation, reason: string, by: SessionUser) {
  must(
    await api().models.Donation.update({
      id: d.id,
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledAt: new Date().toISOString(),
    }),
  );
  await event(d, by, 'STATUS', d.status, 'CANCELLED', `Cancelada: ${reason}`);
}

export async function clearReview(d: Donation, by: SessionUser) {
  must(await api().models.Donation.update({ id: d.id, needsReview: false }));
  await event(d, by, 'NOTE', null, null, 'Conflicto revisado por el administrador');
}

/** Hard delete: photos, items, events and the donation itself. */
export async function deleteDonation(d: Donation) {
  const paths = [d.signaturePhotoKey, d.listPhotoKey, ...(d.extraPhotoKeys ?? [])].filter(
    (p): p is string => !!p,
  );
  for (const path of paths) {
    try {
      await remove({ path });
    } catch {
      // already gone
    }
  }
  for (const i of await itemsOf(d.id)) must(await api().models.DonationItem.delete({ id: i.id }));
  for (const e of await eventsOf(d.id)) must(await api().models.DonationEvent.delete({ id: e.id }));
  must(await api().models.Donation.delete({ id: d.id }));
}

// ───────────── users (Cognito, via the admin-users function) ─────────────

async function adminUsers(args: {
  action: string;
  email?: string;
  name?: string;
  role?: string;
  temporaryPassword?: string;
}) {
  const data = must(await api().mutations.adminUsers(args));
  // a.json() can arrive as a string or as an object depending on the client version
  return (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown>;
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await adminUsers({ action: 'list' });
  return (res.users as AdminUser[]) ?? [];
}

export async function createUser(email: string, name: string, role: string, temporaryPassword: string) {
  return adminUsers({ action: 'create', email, name, role, temporaryPassword });
}

export const setUserRole = (email: string, role: string) => adminUsers({ action: 'setRole', email, role });
export const disableUser = (email: string) => adminUsers({ action: 'disable', email });
export const enableUser = (email: string) => adminUsers({ action: 'enable', email });
export const deleteUser = (email: string) => adminUsers({ action: 'delete', email });
