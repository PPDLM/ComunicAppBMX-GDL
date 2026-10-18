import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { effectiveStatus, loadText, timePillText, useCachedItems, useLiveStatus, useRoleAction } from '@/components/donation';
import { AppHeader, todayLong } from '@/components/header';
import { Icon } from '@/components/icons';
import { type ReviewDraft, reviewDraftKey } from '@/components/review-editor';
import { Screen } from '@/components/screen';
import { Button, C, CacheNotice, Empty, ErrorBox, Loading, Pill, SegmentedTabs, Text, UpdatedAt } from '@/components/ui';
import type { Donation } from '@/lib/client';
import { cacheGet, pendingStatus, useCachedQuery } from '@/lib/offline';
import { donationsByStatuses, prefetchDetails } from '@/lib/queries';

type Tab = 'review' | 'coming';

export default function InspectionHome() {
  const [detailsVersion, setDetailsVersion] = useState(0);
  const q = useCachedQuery('inspection', async () => {
    const list = await donationsByStatuses(['AREA_READY', 'UNLOADED', 'IN_REVISION']);
    // items needed to review offline
    void prefetchDetails(list.map((d) => d.id)).then(() => setDetailsVersion((v) => v + 1));
    return list;
  });
  useLiveStatus();
  const [picked, setPicked] = useState<Tab | null>(null);
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
      setDetailsVersion((v) => v + 1); // re-read review drafts when coming back
    }, [refresh]),
  );

  const all = q.data ?? [];
  const toReview = all.filter((d) => ['UNLOADED', 'IN_REVISION'].includes(effectiveStatus(d)));
  const coming = all.filter((d) => effectiveStatus(d) === 'AREA_READY');
  const tab = picked ?? (toReview.length || !coming.length ? 'review' : 'coming');
  const list = tab === 'review' ? toReview : coming;

  return (
    <Screen
      header={<AppHeader title="Inspección" subtitle={todayLong()} />}
      onRefresh={q.refresh}
      refreshing={q.loading && !!q.data}
      top={
        <>
          <SegmentedTabs
            tabs={[
              { value: 'review' as const, label: 'Por revisar', count: toReview.length },
              { value: 'coming' as const, label: 'Llegando', count: coming.length },
            ]}
            value={tab}
            onChange={setPicked}
          />
          {q.fromCache ? (
            <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
          ) : (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.gray }}>
                {tab === 'review' ? 'Ya descargadas en el almacén' : 'En el área de llegada, aún sin bajar'}
              </Text>
              <UpdatedAt fromCache={q.fromCache} savedAt={q.savedAt} />
            </View>
          )}
        </>
      }>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !list.length ? <Empty text="No hay donaciones en esta pestaña." /> : null}
      {list.map((d) => (
        <InspectionCard key={d.id} d={d} version={detailsVersion} />
      ))}
    </Screen>
  );
}

function useDraft(id: string, version: number) {
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  useEffect(() => {
    let alive = true;
    cacheGet<ReviewDraft>(reviewDraftKey(id)).then((c) => alive && setDraft(c?.data ?? null));
    return () => {
      alive = false;
    };
  }, [id, version]);
  return draft;
}

function InspectionCard({ d, version }: { d: Donation; version: number }) {
  const items = useCachedItems(d.id, version);
  const draft = useDraft(d.id, version);
  const action = useRoleAction(d);
  const status = effectiveStatus(d);
  const queued = !!pendingStatus(d.id);
  const halfway = status === 'IN_REVISION';
  const reviewedCount = draft ? draft.items.filter((i) => i.touched).length : 0;
  const total = draft?.items.filter((i) => i.sourceItemId).length ?? 0;

  return (
    <View style={card}>
      <Pressable
        onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}
        accessibilityRole="button"
        accessibilityHint="Abre el detalle"
        style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '800' }}>{d.donorName}</Text>
          {halfway ? (
            <Pill text="A medias" variant="neutral" />
          ) : queued ? (
            <Pill text="Por enviar" variant="neutral" />
          ) : (
            <Pill text={timePillText(d, status)} />
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="truck" size={18} color={C.ink} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600' }}>
            {d.driverName || 'Sin chofer'} · {loadText(d, items, ' declarados')}
          </Text>
        </View>
      </Pressable>
      {halfway && draft && total ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: C.border, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round((reviewedCount / total) * 100)}%`, height: '100%', backgroundColor: C.orange }} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700' }}>
            {reviewedCount} de {total} productos revisados
          </Text>
        </View>
      ) : null}
      {action.transition ? (
        <Button
          title={action.label}
          kind={action.secondary ? 'secondary' : 'primary'}
          icon={action.secondary ? undefined : 'clipboardCheck'}
          onPress={action.run}
          loading={action.busy}
          style={{ minHeight: 58 }}
        />
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
