import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { adminUsers } from './functions/admin-users/resource';
import { storage } from './storage/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  adminUsers,
});

cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
};

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;
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
