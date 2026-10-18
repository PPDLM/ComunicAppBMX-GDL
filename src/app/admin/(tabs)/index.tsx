import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { whenLabel } from '@/components/donation';
import { AppHeader, todayLong } from '@/components/header';
import { Screen } from '@/components/screen';
import { Button, C, Chips, Empty, ErrorBox, Fab, Field, Loading, Pill, StatusProgress, Text } from '@/components/ui';
import type { Donation } from '@/lib/client';
import { isToday } from '@/lib/format';
import { useCachedQuery } from '@/lib/offline';
import { allDonations } from '@/lib/queries';

type Filter = 'ACTIVE' | 'NO_DRIVER' | 'REVIEW' | 'TODAY' | 'PICKED_UP' | 'IN_REVISION' | 'CLOSED' | 'CANCELLED' | 'ALL';
const MORE: Filter[] = ['TODAY', 'PICKED_UP', 'IN_REVISION', 'CLOSED', 'CANCELLED', 'ALL'];
const MORE_LABEL: Partial<Record<Filter, string>> = {
  TODAY: 'Hoy',
  PICKED_UP: 'En camino',
  IN_REVISION: 'En revisión',
  CLOSED: 'Cerradas',
  CANCELLED: 'Canceladas',
  ALL: 'Todas',
};

const isActive = (d: Donation) => d.status !== 'CLOSED' && d.status !== 'CANCELLED';
const noDriver = (d: Donation) => d.status === 'REQUESTED' && !d.driverId;

function matches(d: Donation, f: Filter) {
  switch (f) {
    case 'ACTIVE':
      return isActive(d);
    case 'NO_DRIVER':
      return noDriver(d);
    case 'REVIEW':
      return !!d.needsReview;
    case 'TODAY':
      return isToday(d.scheduledAt);
    case 'ALL':
      return true;
    default:
      return d.status === f;
  }
}

export default function AdminHome() {
  const q = useCachedQuery('admin:donations', allDonations);
  const [filter, setFilter] = useState<Filter>('ACTIVE');
  const [search, setSearch] = useState('');

  // Reload when coming back from the form or the detail screen.
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const all = useMemo(() => q.data ?? [], [q.data]);
  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((d) => matches(d, filter))
      .filter((d) => !term || `${d.donorName} ${d.pickupAddress} ${d.driverName ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => Number(noDriver(b)) - Number(noDriver(a)) || a.scheduledAt.localeCompare(b.scheduledAt));
  }, [all, filter, search]);

  const counts = {
    ACTIVE: all.filter(isActive).length,
    NO_DRIVER: all.filter(noDriver).length,
    REVIEW: all.filter((d) => d.needsReview).length,
  };

  return (
    <Screen
      header={<AppHeader title="Donaciones" subtitle={todayLong()} />}
      adminOffline={q.fromCache}
      onRefresh={q.refresh}
      refreshing={q.loading && !!q.data}
      bottomSpace={70}
      overlay={<Fab title="Nueva donación" onPress={() => router.push('/admin/form')} />}
      top={
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <FilterTile label="Activas" count={counts.ACTIVE} on={filter === 'ACTIVE'} onPress={() => setFilter('ACTIVE')} />
            <FilterTile label="Sin chofer" count={counts.NO_DRIVER} on={filter === 'NO_DRIVER'} onPress={() => setFilter('NO_DRIVER')} />
            {counts.REVIEW > 0 ? (
              <FilterTile alert label="Conflicto" count={counts.REVIEW} on={filter === 'REVIEW'} onPress={() => setFilter('REVIEW')} />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
          <Field
            icon="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Donante, dirección o chofer"
            accessibilityLabel="Buscar donaciones"
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            style={{ minHeight: 48 }}
          />
          <Chips scroll height={40} options={MORE} value={MORE.includes(filter) ? filter : null} onChange={setFilter} labels={MORE_LABEL} />
        </>
      }>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !list.length ? <Empty title="Nada por aquí" icon="search" text="No hay donaciones con este filtro." /> : null}
      {list.map((d) => (
        <AdminCard key={d.id} d={d} />
      ))}
    </Screen>
  );
}

function FilterTile({
  label,
  count,
  on,
  alert,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  alert?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        borderWidth: on ? 2 : 1.5,
        borderColor: on ? C.ink : alert ? C.redBorder : C.border,
        backgroundColor: alert ? C.redSoft : C.card,
      }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: alert ? C.redText : C.ink }}>{count}</Text>
      <Text style={{ fontSize: 13, fontWeight: '700', color: alert ? C.redText : C.gray }}>{label}</Text>
    </Pressable>
  );
}

function AdminCard({ d }: { d: Donation }) {
  const missingDriver = noDriver(d);
  const kg = d.statedKgTotal;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: C.card,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 8,
        borderWidth: missingDriver ? 1.5 : 0,
        borderColor: C.redBorder,
        opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '800' }}>{d.donorName}</Text>
        {missingDriver ? <Pill small text="Sin chofer" variant="alert" /> : null}
        {d.needsReview ? <Pill small text="Conflicto" variant="alert" /> : null}
        {!missingDriver ? <Text style={{ fontSize: 14, fontWeight: '700' }}>{whenLabel(d.scheduledAt)}</Text> : null}
      </View>
      <Text style={{ fontSize: 14, color: C.gray }} numberOfLines={1}>
        {missingDriver
          ? `${whenLabel(d.scheduledAt)} · ${d.pickupAddress}`
          : `${d.driverName || 'Sin chofer'}${kg != null ? ` · ≈${Math.round(kg)} kg` : ''}`}
      </Text>
      {missingDriver ? (
        <Button
          kind="dark"
          size="sm"
          title="Asignar chofer"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => router.push({ pathname: '/admin/form', params: { id: d.id, focus: 'driver' } })}
        />
      ) : (
        <StatusProgress size="compact" status={d.status} />
      )}
    </Pressable>
  );
}
