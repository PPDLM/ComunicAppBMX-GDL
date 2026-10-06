import { defineAuth } from '@aws-amplify/backend';
import { createEmployee } from '../functions/create-employee/resource';

export const auth = defineAuth({
  loginWith: { email: true },
  groups: ['admin', 'camioneros', 'procuracion', 'almacen'],
  access: (allow) => [
    allow.resource(createEmployee).to(['createUser', 'addUserToGroup']),
  ],
});