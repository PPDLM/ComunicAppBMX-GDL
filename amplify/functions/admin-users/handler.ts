import type { Schema } from '../../data/resource';

/**
 * User administration for ADMIN users.
 *
 * Actions (argument `action`):
 *  - list                         → all users with their role and enabled flag
 *  - create   email,name,role,temporaryPassword
 *  - setRole  email,role
 *  - disable  email
 *  - enable   email
 *  - delete   email
 *
 * The AWS SDK v3 is provided by the Lambda Node.js runtime, so it is imported dynamically
 * (no extra npm dependency in the app's package.json / lockfile).
 */

const ROLES = ['ADMIN', 'DRIVER', 'WAREHOUSE', 'INSPECTION'] as const;
type Role = (typeof ROLES)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any;
async function cognito() {
  if (!sdk) {
    const moduleName = '@aws-sdk/client-cognito-identity-provider';
    sdk = await import(moduleName);
  }
  const client = new sdk.CognitoIdentityProviderClient({});
  return { sdk, client };
}

function poolId(): string {
  const id = process.env.AMPLIFY_AUTH_USERPOOL_ID;
  if (!id) throw new Error('AMPLIFY_AUTH_USERPOOL_ID is not set');
  return id;
}

function assertRole(role: string | null | undefined): Role {
  if (!role || !(ROLES as readonly string[]).includes(role)) {
    throw new Error(`Rol inválido: ${role}`);
  }
  return role as Role;
}

function assertEmail(email: string | null | undefined): string {
  const e = (email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Correo inválido');
  return e;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attr(user: any, name: string): string | undefined {
  const list = user.Attributes ?? user.UserAttributes ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.find((a: any) => a.Name === name)?.Value;
}

async function groupsOf(username: string): Promise<string[]> {
  const { sdk, client } = await cognito();
  const res = await client.send(
    new sdk.AdminListGroupsForUserCommand({ UserPoolId: poolId(), Username: username }),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.Groups ?? []).map((g: any) => g.GroupName as string);
}

async function setRole(username: string, role: Role) {
  const { sdk, client } = await cognito();
  const current = await groupsOf(username);
  for (const g of current) {
    if ((ROLES as readonly string[]).includes(g) && g !== role) {
      await client.send(
        new sdk.AdminRemoveUserFromGroupCommand({
          UserPoolId: poolId(),
          Username: username,
          GroupName: g,
        }),
      );
    }
  }
  if (!current.includes(role)) {
    await client.send(
      new sdk.AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: username, GroupName: role }),
    );
  }
}

async function listUsers() {
  const { sdk, client } = await cognito();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const users: any[] = [];
  let token: string | undefined;
  do {
    const res = await client.send(
      new sdk.ListUsersCommand({ UserPoolId: poolId(), Limit: 60, PaginationToken: token }),
    );
    users.push(...(res.Users ?? []));
    token = res.PaginationToken;
  } while (token);

  const out = [];
  for (const u of users) {
    const groups = await groupsOf(u.Username);
    out.push({
      username: u.Username as string,
      sub: attr(u, 'sub') ?? '',
      email: attr(u, 'email') ?? u.Username,
      name: attr(u, 'name') ?? '',
      role: groups.find((g) => (ROLES as readonly string[]).includes(g)) ?? null,
      enabled: u.Enabled !== false,
      status: u.UserStatus as string,
      createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : null,
    });
  }
  out.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  return out;
}

export const handler: Schema['adminUsers']['functionHandler'] = async (event) => {
  const { action, email, name, role, temporaryPassword } = event.arguments;
  const { sdk, client } = await cognito();

  switch (action) {
    case 'list':
      return { ok: true, users: await listUsers() };

    case 'create': {
      const e = assertEmail(email);
      const r = assertRole(role);
      if (!temporaryPassword || temporaryPassword.length < 10) {
        throw new Error('La contraseña temporal debe tener al menos 10 caracteres');
      }
      // Server-side re-validation (never trust the client): plain text name, bounded length.
      const cleanName = (name ?? '').replace(/[\u0000-\u001F\u007F<>]/g, '').trim().slice(0, 120);
      const res = await client.send(
        new sdk.AdminCreateUserCommand({
          UserPoolId: poolId(),
          Username: e,
          TemporaryPassword: temporaryPassword,
          MessageAction: 'SUPPRESS', // the admin hands the temporary password to the user
          UserAttributes: [
            { Name: 'email', Value: e },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: cleanName || e },
          ],
        }),
      );
      await setRole(e, r);
      return { ok: true, sub: attr(res.User, 'sub') ?? null };
    }

    case 'setRole': {
      await setRole(assertEmail(email), assertRole(role));
      return { ok: true };
    }

    case 'disable':
      await client.send(
        new sdk.AdminDisableUserCommand({ UserPoolId: poolId(), Username: assertEmail(email) }),
      );
      return { ok: true };

    case 'enable':
      await client.send(
        new sdk.AdminEnableUserCommand({ UserPoolId: poolId(), Username: assertEmail(email) }),
      );
      return { ok: true };

    case 'delete':
      await client.send(
        new sdk.AdminDeleteUserCommand({ UserPoolId: poolId(), Username: assertEmail(email) }),
      );
      return { ok: true };

    default:
      throw new Error(`Acción desconocida: ${action}`);
  }
};
