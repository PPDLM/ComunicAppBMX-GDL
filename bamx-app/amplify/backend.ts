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
