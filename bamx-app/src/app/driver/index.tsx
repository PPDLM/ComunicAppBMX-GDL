import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { DonationCard, effectiveStatus } from '@/components/donation';
import { Screen } from '@/components/screen';
import { CacheNotice, Empty, ErrorBox, H2, Loading, Muted } from '@/components/ui';
import { isToday } from '@/lib/format';
import { useCachedQuery, useQueue } from '@/lib/offline';
import { donationsForDriver, prefetchDetails } from '@/lib/queries';
import { useUser } from '@/lib/session';

export default function DriverHome() {
  const user = useUser();
  const q = useCachedQuery(`driver:${user.sub}`, async () => {
    const list = await donationsForDriver(user.sub);
    // Save details of pending pickups so they can be opened and filled without signal.
    void prefetchDetails(list.filter((d) => d.status === 'ASSIGNED').map((d) => d.id));
    return list;
  });
  useQueue();
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const all = q.data ?? [];
  const toPick = all.filter((d) => effectiveStatus(d) === 'ASSIGNED');
  const doneToday = all.filter(
    (d) => effectiveStatus(d) !== 'ASSIGNED' && d.status !== 'CANCELLED' && (isToday(d.pickedUpAt) || effectiveStatus(d) === 'PICKED_UP'),
  );

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading}>
      <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}

      <H2>Por recolectar ({toPick.length})</H2>
      <Muted style={{ marginBottom: 8 }}>Abre una recolección para ver la dirección y registrar la nota.</Muted>
      {q.data && !toPick.length ? <Empty text="No tienes recolecciones pendientes." /> : null}
      {toPick.map((d) => (
        <DonationCard key={d.id} d={d} showDriver={false} />
      ))}

      {doneToday.length ? (
        <>
          <H2>Recolectadas hoy</H2>
          {doneToday.map((d) => (
            <DonationCard key={d.id} d={d} showDriver={false} />
          ))}
        </>
      ) : null}
      <Muted style={{ marginTop: 12 }}>Desliza hacia abajo para actualizar.</Muted>
    </Screen>
  );
}
