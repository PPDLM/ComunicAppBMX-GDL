/**
 * Undo toast + optimistic status (design 01 · UndoToast, 02 · Almacén).
 *
 * Reversible actions don't ask "¿Confirmas?": the card changes at once, a toast offers DESHACER
 * for 6 s, and only then is the operation queued. Leaving the screen or sending the app to the
 * background commits it right away, so nothing is lost.
 */
import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Status } from '@/lib/domain';
import { Icon, type IconName } from './icons';
import { C, haptic, Text } from './ui';

const UNDO_MS = 6000;

// ───────────────────────── optimistic status ─────────────────────────

const optimistic = new Map<string, Status>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function setOptimistic(donationId: string, status: Status) {
  optimistic.set(donationId, status);
  notify();
}
export function clearOptimistic(donationId: string) {
  if (optimistic.delete(donationId)) notify();
}
export function optimisticStatus(donationId: string): Status | null {
  return optimistic.get(donationId) ?? null;
}
/** Re-renders the caller whenever an optimistic status changes. */
export function useOptimistic() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  }, []);
}

// ───────────────────────────── toast ─────────────────────────────

type ToastInput = {
  text: string;
  icon?: IconName;
  /** Runs when the 6 s pass or the action is forced (blur / background). Omit for info-only toasts. */
  commit?: () => void | Promise<void>;
  /** Shown as DESHACER when present. */
  undo?: () => void;
  /** DESHACER after the commit already ran (e.g. the screen was left): drop the queued op if not sent yet. */
  revert?: () => void;
};
type Toast = ToastInput & { id: number };

type Ctx = { show: (t: ToastInput) => void; commitNow: () => void };
const UndoContext = createContext<Ctx | null>(null);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const current = useRef<Toast | null>(null);
  const committed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitCurrent = useCallback(() => {
    const t = current.current;
    if (t && !committed.current) {
      committed.current = true;
      void t.commit?.();
    }
  }, []);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    current.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (t: ToastInput) => {
      commitCurrent(); // a new action finalizes the previous one
      if (timer.current) clearTimeout(timer.current);
      const next = { ...t, id: Date.now() };
      current.current = next;
      committed.current = false;
      setToast(next);
      timer.current = setTimeout(() => {
        commitCurrent();
        hide();
      }, UNDO_MS);
    },
    [commitCurrent, hide],
  );

  const commitNow = useCallback(() => {
    commitCurrent();
  }, [commitCurrent]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && commitCurrent());
    return () => sub.remove();
  }, [commitCurrent]);

  const onUndo = () => {
    const t = current.current;
    if (!t) return;
    haptic.tap();
    if (!committed.current) t.undo?.();
    else t.revert?.();
    hide();
  };

  return (
    <UndoContext.Provider value={{ show, commitNow }}>
      {children}
      {toast ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 28 + insets.bottom,
            minHeight: 60,
            borderRadius: 14,
            backgroundColor: C.ink,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingLeft: 16,
            paddingRight: 8,
            boxShadow: '0 8px 24px rgba(46, 46, 46, 0.28)',
          }}>
          <Icon name={toast.icon ?? 'check'} size={22} color={toast.icon === 'wifiOff' ? C.undoAccent : C.green} strokeWidth={2.6} />
          <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600', paddingVertical: 10 }}>{toast.text}</Text>
          {toast.undo ? (
            <Pressable
              onPress={onUndo}
              accessibilityRole="button"
              hitSlop={6}
              style={{ height: 44, paddingHorizontal: 14, justifyContent: 'center' }}>
              <Text style={{ color: C.undoAccent, fontSize: 15, fontWeight: '800' }}>DESHACER</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </UndoContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useToast outside UndoProvider');
  return ctx;
}

/** Commits any pending undoable action when the screen loses focus. */
export function useCommitOnBlur() {
  const { commitNow } = useToast();
  useFocusEffect(useCallback(() => () => commitNow(), [commitNow]));
}
