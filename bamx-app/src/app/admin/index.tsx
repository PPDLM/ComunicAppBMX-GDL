import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DonationCard } from '@/components/donation';
import { Screen } from '@/components/screen';
import { Button, Chips, Empty, ErrorBox, Field, Loading, Muted } from '@/components/ui';
import { STATUS_LABEL, type Status } from '@/lib/domain';
import { isToday } from '@/lib/format';
import { useCachedQuery } from '@/lib/offline';
import { allDonations } from '@/lib/queries';

const FILTERS = ['ACTIVE', 'TODAY', 'REVIEW', 'REQUESTED', 'ASSIGNED', 'PICKED_UP', 'AREA_READY', 'UNLOADED', 'IN_REVISION', 'CLOSED', 'CANCELLED', 'ALL'] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = {
  ...(STATUS_LABEL as Record<Status, string>),
  ACTIVE: 'Activas',
  TODAY: 'Hoy',
  REVIEW: 'Con conflicto',
  ALL: 'Todas',
};

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

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((d) => {
      if (term && !`${d.donorName} ${d.pickupAddress} ${d.driverName ?? ''}`.toLowerCase().includes(term)) return false;
      switch (filter) {
        case 'ALL':
          return true;
        case 'ACTIVE':
          return d.status !== 'CLOSED' && d.status !== 'CANCELLED';
        case 'TODAY':
          return isToday(d.scheduledAt);
        case 'REVIEW':
          return !!d.needsReview;
        default:
          return d.status === filter;
      }
    });
  }, [q.data, filter, search]);

  const conflicts = (q.data ?? []).filter((d) => d.needsReview).length;

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <Button title="+ Nueva donación" onPress={() => router.push('/admin/form')} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button kind="secondary" title="Usuarios" onPress={() => router.push('/admin/users')} style={{ flex: 1 }} />
        <Button kind="secondary" title="Reportes" onPress={() => router.push('/admin/reports')} style={{ flex: 1 }} />
      </View>

      {q.fromCache ? <ErrorBox text="Sin conexión. Las funciones de administrador requieren internet." /> : null}
      {conflicts ? <Muted style={{ marginBottom: 8 }}>⚠ {conflicts} donación(es) con conflicto de sincronización.</Muted> : null}

      <Field label="Buscar" value={search} onChangeText={setSearch} placeholder="Donante, dirección o chofer" />
      <Chips options={FILTERS} value={filter} onChange={setFilter} labels={FILTER_LABEL} />

      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !list.length ? <Empty text="No hay donaciones con este filtro." /> : null}
      {list.map((d) => (
        <DonationCard key={d.id} d={d} />
      ))}
    </Screen>
  );
}
