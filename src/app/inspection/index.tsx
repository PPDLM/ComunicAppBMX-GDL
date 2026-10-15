import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { DonationCard, effectiveStatus } from '@/components/donation';
import { Screen } from '@/components/screen';
import { CacheNotice, Empty, ErrorBox, H2, Loading, Muted } from '@/components/ui';
import { useCachedQuery, useQueue } from '@/lib/offline';
import { donationsByStatuses, prefetchDetails } from '@/lib/queries';

export default function InspectionHome() {
  const q = useCachedQuery('inspection', async () => {
    const list = await donationsByStatuses(['AREA_READY', 'UNLOADED', 'IN_REVISION']);
    void prefetchDetails(list.map((d) => d.id)); // items needed to review offline
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
  const toReview = all.filter((d) => ['UNLOADED', 'IN_REVISION'].includes(effectiveStatus(d)));
  const coming = all.filter((d) => effectiveStatus(d) === 'AREA_READY');

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading}>
      <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}

      <H2>Por revisar ({toReview.length})</H2>
      <Muted style={{ marginBottom: 8 }}>
        Compara lo declarado por el chofer contra lo que realmente es útil, producto por producto.
      </Muted>
      {q.data && !toReview.length ? <Empty text="No hay donaciones descargadas por revisar." /> : null}
      {toReview.map((d) => (
        <DonationCard key={d.id} d={d} />
      ))}

      {coming.length ? (
        <>
          <H2>Llegando al almacén</H2>
          {coming.map((d) => (
            <DonationCard key={d.id} d={d} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
