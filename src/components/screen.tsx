import React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useSession } from '@/lib/session';
import { SyncBar } from './sync-bar';
import { C, s } from './ui';

/** Page wrapper: sync bar (field roles), scroll, pull-to-refresh. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const session = useSession();
  const isAdmin = session.status === 'signedIn' && session.user.role === 'ADMIN';
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {!isAdmin ? <SyncBar /> : null}
      <ScrollView
        contentContainerStyle={s.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
        {children}
      </ScrollView>
    </View>
  );
}
