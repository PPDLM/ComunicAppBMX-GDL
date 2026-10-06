import { defineFunction } from '@aws-amplify/backend';

export const createEmployee = defineFunction({
  name: 'create-employee',
  entry: './handler.ts',
  resourceGroupName: 'auth',
});