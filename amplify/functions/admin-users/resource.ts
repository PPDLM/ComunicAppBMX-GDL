import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda behind the `adminUsers` custom mutation (ADMIN group only).
 * Lives in the auth stack: auth grants it Cognito permissions and it only talks to Cognito,
 * so data/storage can depend on auth without auth depending back on them (circular stacks).
 */
export const adminUsers = defineFunction({
  name: 'admin-users',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'auth',
});
