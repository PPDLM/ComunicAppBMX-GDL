import AsyncStorage from '@react-native-async-storage/async-storage';
import { Hub } from 'aws-amplify/utils';
import { fetchAuthSession, getCurrentUser, signOut as amplifySignOut } from 'aws-amplify/auth';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type Role, isRole } from './domain';
import { clearCache } from './offline';

/** ADMIN sessions are closed after this much time in the background (MASVS-AUTH-2/3). */
const ADMIN_IDLE_MS = 15 * 60 * 1000;

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  role: Role | null;
};

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: SessionUser };

type Ctx = SessionState & {
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);
const CACHE_KEY = 'session:user:v1';

/**
 * Reads the signed-in user and their role (Cognito group) from the ID token.
 * Works offline: getCurrentUser() reads local tokens, and if the token can't be refreshed
 * without network we fall back to the last known user info stored on the device.
 */
async function loadUser(): Promise<SessionUser | null> {
  let current;
  try {
    current = await getCurrentUser();
  } catch {
    return null; // not signed in
  }

  try {
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    if (payload) {
      const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
      const role = groups.find(isRole) ?? null;
      const user: SessionUser = {
        sub: String(payload.sub ?? current.userId),
        email: String(payload.email ?? current.signInDetails?.loginId ?? ''),
        name: String(payload.name ?? payload.email ?? current.signInDetails?.loginId ?? ''),
        role: role as Role | null,
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(user));
      return user;
    }
  } catch {
    // offline with an expired token → use cache below
  }

  const cached = await AsyncStorage.getItem(CACHE_KEY);
  if (cached) {
    const user = JSON.parse(cached) as SessionUser;
    if (user.sub === current.userId) return user;
  }
  return {
    sub: current.userId,
    email: current.signInDetails?.loginId ?? '',
    name: current.signInDetails?.loginId ?? '',
    role: null,
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  const refresh = useCallback(async () => {
    const user = await loadUser();
    setState(user ? { status: 'signedIn', user } : { status: 'signedOut' });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await amplifySignOut();
    } finally {
      await AsyncStorage.removeItem(CACHE_KEY);
      await clearCache(); // pending (unsent) operations are kept so field work is never lost
      setState({ status: 'signedOut' });
    }
  }, []);

  // Auto sign-out of an ADMIN session left in the background for 15+ minutes.
  // Field roles are exempt: they may be offline and could not sign back in without signal.
  const backgroundSince = useRef<number | null>(null);
  const role = state.status === 'signedIn' ? state.user.role : null;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        backgroundSince.current ??= Date.now();
        return;
      }
      const since = backgroundSince.current;
      backgroundSince.current = null;
      if (role === 'ADMIN' && since && Date.now() - since > ADMIN_IDLE_MS) void signOut();
    });
    return () => sub.remove();
  }, [role, signOut]);

  useEffect(() => {
    refresh();
    const stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'signedOut') refresh();
    });
    return stop;
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ ...state, refresh, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** For screens that only render when signed in. */
export function useUser(): SessionUser {
  const s = useSession();
  if (s.status !== 'signedIn') throw new Error('Not signed in');
  return s.user;
}
