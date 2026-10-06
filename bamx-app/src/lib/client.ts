import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export type Donation = Schema['Donation']['type'];
export type DonationItem = Schema['DonationItem']['type'];
export type DonationEvent = Schema['DonationEvent']['type'];

let _client: ReturnType<typeof generateClient<Schema>> | null = null;

/** Lazily created so Amplify.configure() always runs first. */
export function api() {
  if (!_client) _client = generateClient<Schema>();
  return _client;
}

type Res<T> = { data: T; errors?: readonly unknown[] | null };

export class ApiError extends Error {
  constructor(
    message: string,
    public errorType?: string,
  ) {
    super(message);
  }
}

/** Throws if the GraphQL response has errors; returns data otherwise. */
export function must<T>(res: Res<T>): T {
  if (res.errors && res.errors.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = res.errors[0] as any;
    throw new ApiError(e?.message ?? 'Error del servidor', e?.errorType);
  }
  return res.data;
}

/** True when a create failed only because the record already exists (safe retry). */
export function isAlreadyExists(e: unknown) {
  const msg = `${(e as ApiError)?.errorType ?? ''} ${(e as Error)?.message ?? ''}`;
  return /ConditionalCheckFailed|already exists/i.test(msg);
}

/** Follows nextToken until all pages are loaded. */
export async function listAll<T>(
  page: (nextToken?: string | null) => Promise<{
    data: T[];
    nextToken?: string | null;
    errors?: readonly unknown[] | null;
  }>,
): Promise<T[]> {
  const out: T[] = [];
  let token: string | null | undefined = undefined;
  do {
    const res = await page(token);
    out.push(...must(res));
    token = res.nextToken;
  } while (token);
  return out;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Error desconocido';
  }
}
