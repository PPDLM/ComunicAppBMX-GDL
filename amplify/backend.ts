import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { adminUsers } from './functions/admin-users/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  adminUsers,
});

// No self sign-up: only ADMIN creates accounts (through the admin-users function).
const { cfnUserPool } = backend.auth.resources.cfnResources;
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// Password policy (MASVS-AUTH-1): stronger than the Cognito default (8 chars),
// and temporary passwords handed out by the admin expire after 3 days.
cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 10,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true,
    temporaryPasswordValidityDays: 3,
  },
};
