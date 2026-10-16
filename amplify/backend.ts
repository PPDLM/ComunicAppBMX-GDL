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

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// No self sign-up: only ADMIN creates accounts (through the admin-users function).
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

// Expo Go can't run the native SRP math, so allow plain password auth (over TLS) as well.
cfnUserPoolClient.explicitAuthFlows = [
  ...(cfnUserPoolClient.explicitAuthFlows ?? []),
  'ALLOW_USER_PASSWORD_AUTH',
];

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
