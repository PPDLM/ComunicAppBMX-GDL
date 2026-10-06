import { defineAuth } from '@aws-amplify/backend';
import { adminUsers } from '../functions/admin-users/resource';

/**
 * Cognito user pool.
 * - Email + password login.
 * - One group per role. Each user belongs to exactly one group (enforced by the admin-users function).
 * - Self sign-up is disabled in backend.ts (allowAdminCreateUserOnly).
 * - The admin-users function gets only the Cognito permissions it needs.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['ADMIN', 'DRIVER', 'WAREHOUSE', 'INSPECTION'],
  access: (allow) => [
    allow
      .resource(adminUsers)
      .to([
        'createUser',
        'deleteUser',
        'disableUser',
        'enableUser',
        'addUserToGroup',
        'removeUserFromGroup',
        'listUsers',
        'listGroupsForUser',
      ]),
  ],
});
