import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { createEmployee } from '../functions/create-employee/resource';

const schema = a.schema({
  Role: a.enum(['admin', 'camioneros', 'procuracion', 'almacen']),

  Employee: a
    .model({
      employeeId: a.string().required(),
      email: a.string().required(),
      role: a.ref('Role').required(),
    })
    .identifier(['employeeId'])
    .authorization((allow) => [allow.group('admin')]),

  createEmployeeAccount: a
    .mutation()
    .arguments({
      email: a.string().required(),
      role: a.ref('Role').required(),
    })
    .returns(a.json())
    .authorization((allow) => [allow.group('admin')])
    .handler(a.handler.function(createEmployee)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});