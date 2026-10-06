import { defineStorage } from '@aws-amplify/backend';

/**
 * S3 bucket for donation photos (donor signature, donor's written list, extra photos).
 * Path: donation-photos/<donationId>/<file>.jpg — private, only the app's role groups.
 */
export const storage = defineStorage({
  name: 'bamxDonationPhotos',
  access: (allow) => ({
    'donation-photos/*': [
      allow.groups(['ADMIN']).to(['read', 'write', 'delete']),
      allow.groups(['DRIVER', 'WAREHOUSE', 'INSPECTION']).to(['read', 'write']),
    ],
  }),
});
