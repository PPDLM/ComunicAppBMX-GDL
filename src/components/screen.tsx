import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/lib/session';
import { SyncBar } from './sync-bar';
import { C } from './ui';

/**
 * Page wrapper (20 side margin):
 *   header  – AppHeader on role homes (inner screens get BackHeader from the Stack)
 *   top     – fixed area under the header (sync bar, tabs, hints); doesn't scroll
 *   footer  – BottomActionBar with the screen's main action, always in thumb reach
 *   overlay – floating button (admin)
 */
export function Screen({
  children,
  header,
  top,
  footer,
  overlay,
  onRefresh,
  refreshing = false,
  adminOffline,
  scrollRef,
  bottomSpace,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  top?: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  adminOffline?: boolean;
  scrollRef?: React.Ref<ScrollView>;
  /** Extra free space at the end of the list (e.g. under a floating button). */
  bottomSpace?: number;
}) {
  const session = useSession();
  const insets = useSafeAreaInsets();
  const isAdmin = session.status === 'signedIn' && session.user.role === 'ADMIN';
  const sync = isAdmin ? (adminOffline ? <SyncBar adminOffline /> : null) : <SyncBar />;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 10 }}>
        {sync}
        {top}
      </View>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: (bottomSpace ?? 0) + (footer ? 24 : 40 + insets.bottom),
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.red]} tintColor={C.red} /> : undefined
        }>
        {children}
      </ScrollView>
      {footer ? <BottomActionBar>{footer}</BottomActionBar> : null}
      {overlay}
    </KeyboardAvoidingView>
  );
}

export function BottomActionBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: C.card,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 14) + 2,
        gap: 10,
        boxShadow: '0 -6px 20px rgba(46, 46, 46, 0.08)',
      }}>
      {children}
    </View>
  );
}
