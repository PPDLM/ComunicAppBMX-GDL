import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { MapButtons, effectiveStatus, timePillText, useLiveStatus, whenLabel } from '@/components/donation';
import { AppHeader, todayLong } from '@/components/header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Button, C, CacheNotice, Empty, ErrorBox, Loading, Overline, Pill, Text } from '@/components/ui';
import type { Donation } from '@/lib/client';
import { isToday } from '@/lib/format';
import { pendingStatus, useCachedQuery } from '@/lib/offline';
import { donationsForDriver, prefetchDetails } from '@/lib/queries';
import { useUser } from '@/lib/session';

const openDetail = (id: string) => router.push({ pathname: '/donation/[id]', params: { id } });

export default function DriverHome() {
  const user = useUser();
  const q = useCachedQuery(`driver:${user.sub}`, async () => {
    const list = await donationsForDriver(user.sub);
    // Save details of pending pickups so they can be opened and filled without signal.
    void prefetchDetails(list.filter((d) => d.status === 'ASSIGNED').map((d) => d.id));
    return list;
  });
  useLiveStatus();
  const [doneOpen, setDoneOpen] = useState(false);
  const { refresh } = q;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const all = q.data ?? [];
  const toPick = all
    .filter((d) => effectiveStatus(d) === 'ASSIGNED')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const doneToday = all.filter(
    (d) => effectiveStatus(d) !== 'ASSIGNED' && d.status !== 'CANCELLED' && (isToday(d.pickedUpAt) || effectiveStatus(d) === 'PICKED_UP'),
  );
  const [next, ...later] = toPick;
  const subtitle = q.data
    ? `${toPick.length} por recolectar · ${doneToday.length} ${doneToday.length === 1 ? 'hecha' : 'hechas'} hoy`
    : todayLong();

  return (
    <Screen
      header={<AppHeader title="Mis recolecciones" subtitle={subtitle} />}
      onRefresh={q.refresh}
      refreshing={q.loading && !!q.data}
      top={q.fromCache ? <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} /> : undefined}>
      {q.loading && !q.data ? <Loading /> : null}
      {q.error ? <ErrorBox text={q.error} /> : null}
      {q.data && !next ? <Empty text="No tienes recolecciones pendientes." /> : null}

      {next ? (
        <>
          <Overline>Siguiente</Overline>
          <NextCard d={next} />
        </>
      ) : null}

      {later.length ? (
        <>
          <Overline style={{ marginTop: 6 }}>Después</Overline>
          {later.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => openDetail(d.id)}
              accessibilityRole="button"
              style={({ pressed }) => [row, pressed && { opacity: 0.8 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 17, fontWeight: '800' }}>{d.donorName}</Text>
                <Text style={{ fontSize: 14, color: C.gray }} numberOfLines={1}>
                  {d.pickupAddress}
                </Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '700' }}>{whenLabel(d.scheduledAt)}</Text>
              <Icon name="chevronRight" size={20} color={C.gray} />
            </Pressable>
          ))}
        </>
      ) : null}

      {doneToday.length ? (
        <View style={{ backgroundColor: C.greenSoft, borderRadius: 16 }}>
          <Pressable
            onPress={() => setDoneOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: doneOpen }}
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
            <Icon name="check" size={20} color={C.greenText} strokeWidth={2.6} />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: C.greenText }}>Recolectadas hoy ({doneToday.length})</Text>
            <View style={{ transform: [{ rotate: doneOpen ? '180deg' : '0deg' }] }}>
              <Icon name="chevronDown" size={20} color={C.greenText} />
            </View>
          </Pressable>
          {doneOpen
            ? doneToday.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => openDetail(d.id)}
                  accessibilityRole="button"
                  style={{ minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#DDEBC9' }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: '700' }}>{d.donorName}</Text>
                  {pendingStatus(d.id) ? <Pill small text="Por enviar" variant="neutral" /> : <Pill small text="Enviado" variant="success" />}
                </Pressable>
              ))
            : null}
        </View>
      ) : null}
    </Screen>
  );
}

function NextCard({ d }: { d: Donation }) {
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 18, gap: 14, boxShadow: '0 4px 16px rgba(46, 46, 46, 0.07)' }}>
      <Pressable onPress={() => openDetail(d.id)} accessibilityRole="button" accessibilityHint="Abre el detalle" style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 22, lineHeight: 27, fontWeight: '800' }}>{d.donorName}</Text>
          <Pill text={timePillText(d, 'ASSIGNED')} />
        </View>
        <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{d.pickupAddress}</Text>
        {d.requestedContents ? <Text style={{ fontSize: 14, color: C.gray }}>Reportado: {d.requestedContents}</Text> : null}
      </Pressable>
      <MapButtons address={d.pickupAddress} />
      <Button
        size="lg"
        icon="clipboardList"
        title="Registrar recolección"
        onPress={() => router.push({ pathname: '/driver/pickup/[id]', params: { id: d.id } })}
      />
    </View>
  );
}

const row = {
  backgroundColor: C.card,
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 16,
  minHeight: 72,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
};
