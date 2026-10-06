import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { adminUsers } from '../functions/admin-users/resource';

/**
 * Data model (AppSync + DynamoDB).
 *
 * Donation lifecycle (status):
 *   REQUESTED → ASSIGNED → PICKED_UP → AREA_READY → UNLOADED → IN_REVISION → CLOSED
 *   + CANCELLED (admin only, from any non-closed state)
 *
 * Status is stored as a string (not an enum) so it can be used as an index key; valid values
 * and transitions live in src/lib/domain.ts.
 *
 * Authorization summary:
 *   ADMIN       full access to everything
 *   WAREHOUSE   read/update donations, read items, create/read events
 *   INSPECTION  read/update donations, full access to items, create/read events
 *   DRIVER      only donations/items/events where driverId == their Cognito sub
 *               (enforced by AppSync, not only in the UI)
 *   No guest / API-key access.
 */
const schema = a.schema({
  Donation: a
    .model({
      // Set by ADMIN
      donorName: a.string().required(),
      pickupAddress: a.string().required(),
      scheduledAt: a.datetime().required(),
      requestedContents: a.string(), // what the donor said on the phone, if applicable
      adminNotes: a.string(),
      driverId: a.string(), // Cognito sub of the assigned driver (owner field)
      driverName: a.string(),

      status: a.string().required(),
      needsReview: a.boolean(), // set when an offline sync hit a conflict
      cancelReason: a.string(),

      // Driver pickup note
      driverNotes: a.string(),
      signaturePhotoKey: a.string(),
      listPhotoKey: a.string(),
      extraPhotoKeys: a.string().array(),

      // Inspection
      inspectionNotes: a.string(),
      statedKgTotal: a.float(),
      usefulKgTotal: a.float(),
      discardedKgTotal: a.float(),

      // Timestamps per transition
      assignedAt: a.datetime(),
      pickedUpAt: a.datetime(),
      areaReadyAt: a.datetime(),
      unloadedAt: a.datetime(),
      revisionStartedAt: a.datetime(),
      closedAt: a.datetime(),
      cancelledAt: a.datetime(),
    })
    .secondaryIndexes((index) => [
      index('status').sortKeys(['scheduledAt']).queryField('donationsByStatus'),
      index('driverId').sortKeys(['scheduledAt']).queryField('donationsByDriver'),
    ])
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.groups(['WAREHOUSE', 'INSPECTION']).to(['read', 'update']),
      allow.ownerDefinedIn('driverId').identityClaim('sub').to(['read', 'update']),
    ]),

  DonationItem: a
    .model({
      donationId: a.id().required(),
      driverId: a.string(), // copied from the donation so the driver can read their own items
      stage: a.string().required(), // STATED (driver) | REVIEWED (inspection)
      name: a.string().required(),
      category: a.string().required(),
      customCategory: a.string(),
      quantity: a.float().required(),
      unit: a.string().required(),
      kg: a.float().required(), // STATED: estimated kg. REVIEWED: useful kg
      discardedKg: a.float(),
      discardReason: a.string(),
      expiryDate: a.date(),
      sourceItemId: a.id(), // REVIEWED item → the STATED item it reviews (null if added by inspection)
    })
    .secondaryIndexes((index) => [index('donationId').queryField('itemsByDonation')])
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.group('INSPECTION'),
      allow.group('WAREHOUSE').to(['read']),
      allow.ownerDefinedIn('driverId').identityClaim('sub').to(['create', 'read']),
    ]),

  DonationEvent: a
    .model({
      donationId: a.id().required(),
      driverId: a.string(),
      fromStatus: a.string(),
      toStatus: a.string(),
      kind: a.string().required(), // STATUS | REASSIGN | EDIT | CONFLICT | NOTE
      byUserId: a.string().required(),
      byName: a.string().required(),
      at: a.datetime().required(),
      note: a.string(),
    })
    .secondaryIndexes((index) => [
      index('donationId').sortKeys(['at']).queryField('eventsByDonation'),
    ])
    .authorization((allow) => [
      allow.group('ADMIN'),
      allow.groups(['WAREHOUSE', 'INSPECTION']).to(['create', 'read']),
      allow.ownerDefinedIn('driverId').identityClaim('sub').to(['create', 'read']),
    ]),

  adminUsers: a
    .mutation()
    .arguments({
      action: a.string().required(),
      email: a.string(),
      name: a.string(),
      role: a.string(),
      temporaryPassword: a.string(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.group('ADMIN')])
    .handler(a.handler.function(adminUsers)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
