import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { effectiveStatus, loadText, timePillText, useCachedItems, useLiveStatus, useRoleAction } from '@/components/donation';
import { AppHeader, todayLong } from '@/components/header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { useCommitOnBlur } from '@/components/undo';
import { Button, C, CacheNotice, Empty, ErrorBox, Loading, Pill, SegmentedTabs, StatusProgress, Text, UpdatedAt } from '@/components/ui';
import type { Donation } from '@/lib/client';
import { isToday } from '@/lib/format';
import { pendingStatus, useCachedQuery } from '@/lib/offline';
import { donationsByStatuses, prefetchDetails } from '@/lib/queries';

type Tab = 'way' | 'here' | 'today';
const TABS: Tab[] = ['way', 'here', 'today'];
const TAB_LABEL: Record<Tab, string> = { way: 'En camino', here: 'Llegó', today: 'Hoy' };
const HINT: Record<Tab, string> = {
  way: 'Prepara el área antes de que llegue el camión',
  here: 'Al terminar de bajar la carga, márcala',
  today: 'Programadas para hoy, aún sin salir',
};

function inTab(d: Donation, t: Tab) {
  const st = effectiveStatus(d);
  if (t === 'way') return st === 'PICKED_UP';
  if (t === 'here') return st === 'AREA_READY';
  return (st === 'REQUESTED' || st === 'ASSIGNED') && isToday(d.scheduledAt);
}

export default function WarehouseHome() {
  const q = useCachedQuery('warehouse', () => donationsByStatuses(['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'AREA_READY']));
  useLiveStatus();
  useCommitOnBlur();
  const [picked, setPicked] = useState<Tab | null>(null);
  const [detailsVersion, setDetailsVersion] = useState(0);
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  // Cache the products of trucks on the way / arrived, for "≈N kg · M productos" and offline detail.
  useEffect(() => {
    if (!q.data || q.fromCache) return;
    const ids = q.data.filter((d) => d.status === 'PICKED_UP' || d.status === 'AREA_READY').map((d) => d.id);
    if (ids.length) void prefetchDetails(ids).then(() => setDetailsVersion((v) => v + 1));
  }, [q.data, q.fromCache]);

  const all = q.data ?? [];
  const counts = Object.fromEntries(TABS.map((t) => [t, all.filter((d) => inTab(d, t)).length])) as Record<Tab, number>;
  // Start on the first tab that has work, in order.
  const tab = picked ?? TABS.find((t) => counts[t] > 0) ?? 'way';
  const list = all.filter((d) => inTab(d, tab));

  return (
    <Screen
      header={<AppHeader title="Almacén" subtitle={todayLong()} />}
      onRefresh={q.refresh}
      refreshing={q.loading && !!q.data}
      top={
        <>
          <SegmentedTabs
            tabs={TABS.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts[t] }))}
            value={tab}
            onChange={setPicked}
          />
          {q.fromCache ? (
            <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.gray }}>{HINT[tab]}</Text>
              <UpdatedAt fromCache={q.fromCache} savedAt={q.savedAt} />
            </View>
          )}
        </>
      }>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !list.length ? <Empty text="No hay donaciones en esta pestaña." /> : null}
      {list.map((d) => (
        <WarehouseCard key={d.id} d={d} version={detailsVersion} onDone={q.refresh} />
      ))}
    </Screen>
  );
}

function WarehouseCard({ d, version, onDone }: { d: Donation; version: number; onDone: () => unknown }) {
  const items = useCachedItems(d.id, version);
  const action = useRoleAction(d, onDone);
  const status = effectiveStatus(d);
  const queued = !!pendingStatus(d.id);
  const scheduled = status === 'REQUESTED' || status === 'ASSIGNED';
  return (
    <View style={card}>
      <Pressable
        onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}
        accessibilityRole="button"
        accessibilityHint="Abre el detalle"
        style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '800' }}>{d.donorName}</Text>
          {queued ? <Pill text="Por enviar" variant="neutral" /> : <Pill text={timePillText(d, status)} />}
        </View>
        <Text style={{ fontSize: 15, color: C.gray }}>{d.pickupAddress}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="truck" size={18} color={C.ink} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>
            {d.driverName || 'Sin chofer'} · {loadText(d, items)}
          </Text>
        </View>
      </Pressable>
      <StatusProgress status={status} />
      {action.transition ? (
        <Button size="md" title={action.label} icon="check" onPress={action.run} loading={action.busy} style={{ minHeight: 58 }} />
      ) : scheduled ? (
        <Text style={{ padding: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.bg, fontSize: 14, fontWeight: '600', color: C.gray }}>
          Aún no sale a recolectar. Aparecerá en «En camino» cuando el chofer registre la nota.
        </Text>
      ) : null}
    </View>
  );
}

const card = {
  backgroundColor: C.card,
  borderRadius: 18,
  padding: 16,
  gap: 12,
  boxShadow: '0 2px 10px rgba(46, 46, 46, 0.05)',
};
