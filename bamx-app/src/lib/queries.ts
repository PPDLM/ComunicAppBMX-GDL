import { getUrl } from 'aws-amplify/storage';

import { api, listAll, must, type Donation, type DonationEvent, type DonationItem } from './client';
import type { Status } from './domain';
import { cacheSet } from './offline';

const byScheduled = (a: Donation, b: Donation) => a.scheduledAt.localeCompare(b.scheduledAt);

export async function donationsByStatuses(statuses: Status[]): Promise<Donation[]> {
  const lists = await Promise.all(
    statuses.map((status) =>
      listAll<Donation>((nextToken) =>
        api().models.Donation.donationsByStatus({ status }, { nextToken, limit: 200 }),
      ),
    ),
  );
  return lists.flat().sort(byScheduled);
}

export async function donationsForDriver(driverId: string): Promise<Donation[]> {
  const list = await listAll<Donation>((nextToken) =>
    api().models.Donation.donationsByDriver({ driverId }, { nextToken, limit: 200 }),
  );
  return list.sort(byScheduled);
}

export async function allDonations(): Promise<Donation[]> {
  const list = await listAll<Donation>((nextToken) =>
    api().models.Donation.list({ nextToken, limit: 500 }),
  );
  return list.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export async function itemsOf(donationId: string): Promise<DonationItem[]> {
  return listAll<DonationItem>((nextToken) =>
    api().models.DonationItem.itemsByDonation({ donationId }, { nextToken, limit: 500 }),
  );
}

export async function eventsOf(donationId: string): Promise<DonationEvent[]> {
  const list = await listAll<DonationEvent>((nextToken) =>
    api().models.DonationEvent.eventsByDonation({ donationId }, { nextToken, limit: 500 }),
  );
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

export type DonationDetail = {
  donation: Donation;
  items: DonationItem[];
  events: DonationEvent[];
};

export async function donationDetail(id: string): Promise<DonationDetail> {
  const donation = must(await api().models.Donation.get({ id }));
  if (!donation) throw new Error('Donación no encontrada o sin acceso');
  const [items, events] = await Promise.all([itemsOf(id), eventsOf(id)]);
  return { donation, items, events };
}

/** Stores details in the offline cache (same key the detail screen uses). Best effort. */
export async function prefetchDetails(ids: string[]) {
  for (const id of ids) {
    try {
      await cacheSet(`donation:${id}`, await donationDetail(id));
    } catch {
      // ignore: offline or no access
    }
  }
}

export async function photoUrl(path: string): Promise<string> {
  const { url } = await getUrl({ path, options: { expiresIn: 3600 } });
  return url.toString();
}
