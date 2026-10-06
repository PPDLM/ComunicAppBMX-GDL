import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DonationCard, effectiveStatus } from '@/components/donation';
import { Screen } from '@/components/screen';
import { CacheNotice, Chips, Empty, ErrorBox, Loading, Muted } from '@/components/ui';
import { isToday } from '@/lib/format';
import { useCachedQuery, useQueue } from '@/lib/offline';
import { donationsByStatuses } from '@/lib/queries';

const FILTERS = ['DEFAULT', 'TODAY', 'ON_THE_WAY', 'IN_WAREHOUSE', 'ALL'] as const;
type Filter = (typeof FILTERS)[number];
const LABEL: Record<Filter, string> = {
  DEFAULT: 'En camino + hoy',
  TODAY: 'Programadas hoy',
  ON_THE_WAY: 'En camino',
  IN_WAREHOUSE: 'En almacén',
  ALL: 'Todas activas',
};

export default function WarehouseHome() {
  const q = useCachedQuery('warehouse', () =>
    donationsByStatuses(['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'AREA_READY']),
  );
  useQueue();
  const [filter, setFilter] = useState<Filter>('DEFAULT');
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const list = (q.data ?? []).filter((d) => {
    const st = effectiveStatus(d);
    const onTheWay = st === 'PICKED_UP';
    const inWarehouse = st === 'AREA_READY';
    switch (filter) {
      case 'DEFAULT':
        return onTheWay || inWarehouse || (isToday(d.scheduledAt) && ['REQUESTED', 'ASSIGNED'].includes(st));
      case 'TODAY':
        return isToday(d.scheduledAt);
      case 'ON_THE_WAY':
        return onTheWay;
      case 'IN_WAREHOUSE':
        return inWarehouse;
      case 'ALL':
        return ['REQUESTED', 'ASSIGNED', 'PICKED_UP', 'AREA_READY'].includes(st);
    }
  });

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading}>
      <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
      <Chips options={FILTERS} value={filter} onChange={setFilter} labels={LABEL} />
      <Muted style={{ marginBottom: 8 }}>
        Cuando un camión venga en camino, prepara el área de llegada; al terminar de bajar la carga, márcala como
        descargada (pasa a Inspección).
      </Muted>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !list.length ? <Empty text="Nada por ahora." /> : null}
      {list.map((d) => (
        <DonationCard key={d.id} d={d} />
      ))}
    </Screen>
  );
}
