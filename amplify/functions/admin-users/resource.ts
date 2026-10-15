import { defineFunction } from '@aws-amplify/backend';

/**
 * Lambda behind the `adminUsers` custom mutation (ADMIN group only).
 * Lives in the data stack to avoid a circular dependency between auth and data.
 */
export const adminUsers = defineFunction({
  name: 'admin-users',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data',
});
