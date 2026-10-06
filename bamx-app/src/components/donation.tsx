import { router } from 'expo-router';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

import type { Donation, DonationEvent, DonationItem } from '@/lib/client';
import { STATUS_LABEL, categoryLabel, isStatus } from '@/lib/domain';
import { fmtDate, fmtDateTime, fmtKg, isToday } from '@/lib/format';
import { pendingStatus } from '@/lib/offline';
import { Badge, Button, C, Card, Muted, StatusBadge } from './ui';

export function effectiveStatus(d: Donation) {
  return pendingStatus(d.id) ?? d.status;
}

export function DonationCard({ d, showDriver = true }: { d: Donation; showDriver?: boolean }) {
  const pending = pendingStatus(d.id);
  return (
    <Pressable onPress={() => router.push({ pathname: '/donation/[id]', params: { id: d.id } })}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', flex: 1, color: C.text }}>{d.donorName}</Text>
          {isToday(d.scheduledAt) ? <Badge text="HOY" color={C.primary} /> : null}
        </View>
        <Muted>{d.pickupAddress}</Muted>
        <Muted>Recolección: {fmtDateTime(d.scheduledAt)}</Muted>
        {showDriver ? <Muted>Chofer: {d.driverName || 'Sin asignar'}</Muted> : null}
        <View style={{ marginTop: 8, gap: 6 }}>
          <StatusBadge status={pending ?? d.status} pending={!!pending} />
          {d.needsReview ? <Badge text="Revisar: conflicto de sincronización" color={C.danger} /> : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function MapButtons({ address }: { address: string }) {
  const q = encodeURIComponent(address);
  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('No se pudo abrir la aplicación de mapas');
    }
  };
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Button
        kind="secondary"
        title="Google Maps"
        style={{ flex: 1 }}
        onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${q}`)}
      />
      <Button kind="secondary" title="Waze" style={{ flex: 1 }} onPress={() => open(`https://waze.com/ul?q=${q}&navigate=yes`)} />
    </View>
  );
}

export function ItemsTable({ items, mode }: { items: DonationItem[]; mode: 'STATED' | 'REVIEWED' }) {
  if (!items.length) return <Muted>Sin productos registrados.</Muted>;
  const total = items.reduce((s, i) => s + (i.kg || 0), 0);
  const discarded = items.reduce((s, i) => s + (i.discardedKg || 0), 0);
  return (
    <View>
      {items.map((i) => (
        <View key={i.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EA' }}>
          <Text style={{ fontWeight: '600', color: C.text }}>
            {i.name} · {i.quantity} {i.unit}
          </Text>
          <Muted>
            {categoryLabel(i)} · {mode === 'STATED' ? 'estimado' : 'útil'} {fmtKg(i.kg)}
            {mode === 'REVIEWED' && i.discardedKg ? ` · descartado ${fmtKg(i.discardedKg)} (${i.discardReason ?? '—'})` : ''}
            {i.expiryDate ? ` · caduca ${fmtDate(i.expiryDate + 'T12:00:00')}` : ''}
            {mode === 'REVIEWED' && !i.sourceItemId ? ' · agregado en revisión' : ''}
          </Muted>
        </View>
      ))}
      <Text style={{ marginTop: 8, fontWeight: '700' }}>
        Total {mode === 'STATED' ? 'declarado' : 'útil'}: {fmtKg(total)}
        {mode === 'REVIEWED' ? ` · descartado: ${fmtKg(discarded)}` : ''}
      </Text>
    </View>
  );
}

export function History({ events }: { events: DonationEvent[] }) {
  if (!events.length) return <Muted>Sin movimientos.</Muted>;
  return (
    <View>
      {events.map((e) => {
        const to = isStatus(e.toStatus) ? STATUS_LABEL[e.toStatus] : e.toStatus;
        const title =
          e.kind === 'STATUS'
            ? `→ ${to}`
            : e.kind === 'CONFLICT'
              ? '⚠ Conflicto de sincronización'
              : e.kind === 'REASSIGN'
                ? 'Chofer asignado'
                : e.kind === 'EDIT'
                  ? 'Datos editados'
                  : e.kind;
        return (
          <View key={e.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EA' }}>
            <Text style={{ fontWeight: '600', color: e.kind === 'CONFLICT' ? C.danger : C.text }}>{title}</Text>
            <Muted>
              {fmtDateTime(e.at)} · {e.byName}
            </Muted>
            {e.note ? <Text style={{ color: C.text }}>{e.note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
