import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { History, ItemsTable, MapButtons, effectiveStatus } from '@/components/donation';
import { RemotePhoto } from '@/components/photo';
import { Screen } from '@/components/screen';
import {
  Badge,
  Button,
  C,
  CacheNotice,
  Card,
  Chips,
  ErrorBox,
  Field,
  H1,
  H2,
  Loading,
  Muted,
  Row,
  StatusBadge,
} from '@/components/ui';
import { cancelDonation, clearReview, deleteDonation, forceStatus } from '@/lib/admin';
import { errorMessage } from '@/lib/client';
import { STATUSES, STATUS_LABEL, TRANSITIONS, type Status } from '@/lib/domain';
import { MAX, cleanText, fmtDateTime, fmtKg, uuid } from '@/lib/format';
import { enqueue, pendingStatus, useCachedQuery, useQueue } from '@/lib/offline';
import { donationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';

export default function DonationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const q = useCachedQuery(`donation:${id}`, () => donationDetail(id));
  useQueue(); // re-render when pending operations change
  const [busy, setBusy] = useState(false);
  const [forceTo, setForceTo] = useState<Status | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  if (q.loading && !q.data) return <Loading />;
  if (!q.data) return <Screen onRefresh={q.refresh}>{q.error ? <ErrorBox text={q.error} /> : null}</Screen>;

  const { donation: d, items, events } = q.data;
  const status = effectiveStatus(d) as Status;
  const pending = !!pendingStatus(d.id);
  const stated = items.filter((i) => i.stage === 'STATED');
  const reviewed = items.filter((i) => i.stage === 'REVIEWED');
  const isAdmin = user.role === 'ADMIN';
  const transition = TRANSITIONS.find((t) => t.from === status && t.role === user.role);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) Alert.alert(done);
      await q.refresh();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /** Simple role transitions (warehouse, start revision) go through the offline queue. */
  const queueTransition = (to: Status) =>
    run(async () => {
      await enqueue({
        kind: 'transition',
        id: uuid(),
        donationId: d.id,
        from: status,
        to,
        at: new Date().toISOString(),
        by: { id: user.sub, name: user.name || user.email },
        attempts: 0,
      });
    });

  const onRoleAction = () => {
    if (!transition) return;
    if (transition.to === 'PICKED_UP') {
      router.push({ pathname: '/driver/pickup/[id]', params: { id: d.id } });
    } else if (transition.to === 'CLOSED') {
      router.push({ pathname: '/inspection/review/[id]', params: { id: d.id } });
    } else {
      Alert.alert(transition.action, `¿Confirmas: ${STATUS_LABEL[transition.to]}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void queueTransition(transition.to) },
      ]);
    }
  };

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading}>
      <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />

      <Card>
        <H1>{d.donorName}</H1>
        <View style={{ gap: 6, marginBottom: 8 }}>
          <StatusBadge status={status} pending={pending} />
          {d.needsReview ? <Badge text="Revisar: conflicto de sincronización" color={C.danger} /> : null}
        </View>
        <Row label="Dirección" value={d.pickupAddress} />
        <MapButtons address={d.pickupAddress} />
        <Row label="Programada" value={fmtDateTime(d.scheduledAt)} />
        <Row label="Chofer" value={d.driverName || 'Sin asignar'} />
        {d.requestedContents ? <Row label="Contenido reportado" value={d.requestedContents} /> : null}
        {d.adminNotes ? <Row label="Notas admin" value={d.adminNotes} /> : null}
        {d.driverNotes ? <Row label="Notas chofer" value={d.driverNotes} /> : null}
        {d.inspectionNotes ? <Row label="Notas inspección" value={d.inspectionNotes} /> : null}
        {d.cancelReason ? <Row label="Motivo cancelación" value={d.cancelReason} /> : null}
        {d.pickedUpAt ? <Row label="Recolectada" value={fmtDateTime(d.pickedUpAt)} /> : null}
        {d.closedAt ? <Row label="Cerrada" value={fmtDateTime(d.closedAt)} /> : null}
      </Card>

      {transition && !pending ? (
        <Button title={transition.action} onPress={onRoleAction} loading={busy} style={{ marginBottom: 12 }} />
      ) : null}
      {pending ? (
        <Muted style={{ marginBottom: 12 }}>
          Tu último cambio se enviará en cuanto haya conexión. No necesitas hacer nada más.
        </Muted>
      ) : null}

      {(d.statedKgTotal != null || d.usefulKgTotal != null) && (
        <Card>
          <H2>Resumen</H2>
          <Row label="Declarado" value={fmtKg(d.statedKgTotal)} />
          <Row label="Útil" value={fmtKg(d.usefulKgTotal)} />
          <Row label="Descartado" value={fmtKg(d.discardedKgTotal)} />
          {d.statedKgTotal && d.usefulKgTotal != null ? (
            <Row label="% útil" value={`${Math.round((d.usefulKgTotal / d.statedKgTotal) * 100)} %`} />
          ) : null}
        </Card>
      )}

      <Card>
        <H2>Declarado por el chofer</H2>
        <ItemsTable items={stated} mode="STATED" />
      </Card>

      {reviewed.length ? (
        <Card>
          <H2>Revisión de inspección</H2>
          <ItemsTable items={reviewed} mode="REVIEWED" />
        </Card>
      ) : null}

      {d.signaturePhotoKey || d.listPhotoKey || d.extraPhotoKeys?.length ? (
        <Card>
          <H2>Fotos</H2>
          {d.signaturePhotoKey ? <RemotePhoto path={d.signaturePhotoKey} label="Firma del donante" /> : null}
          {d.listPhotoKey ? <RemotePhoto path={d.listPhotoKey} label="Lista escrita del donante" /> : null}
          {(d.extraPhotoKeys ?? [])
            .filter((p): p is string => !!p)
            .map((p, i) => (
              <RemotePhoto key={p} path={p} label={`Foto ${i + 1}`} />
            ))}
        </Card>
      ) : null}

      <Card>
        <H2>Historial</H2>
        <History events={events} />
      </Card>

      {isAdmin ? (
        <Card>
          <H2>Acciones de administrador</H2>
          <Button
            kind="secondary"
            title="Editar / asignar chofer"
            onPress={() => router.push({ pathname: '/admin/form', params: { id: d.id } })}
          />
          {d.needsReview ? (
            <Button kind="secondary" title="Marcar conflicto como revisado" loading={busy} onPress={() => run(() => clearReview(d, user))} />
          ) : null}

          <Text style={{ fontWeight: '600', marginTop: 12, marginBottom: 6 }}>Forzar estado</Text>
          <Chips options={STATUSES.filter((x) => x !== 'CANCELLED')} value={forceTo} onChange={setForceTo} labels={STATUS_LABEL} />
          {forceTo && forceTo !== d.status ? (
            <Button
              kind="secondary"
              title={`Cambiar a "${STATUS_LABEL[forceTo]}"`}
              loading={busy}
              onPress={() =>
                Alert.alert('Forzar estado', `¿Cambiar a "${STATUS_LABEL[forceTo]}"?`, [
                  { text: 'No', style: 'cancel' },
                  { text: 'Sí', onPress: () => void run(() => forceStatus(d, forceTo, user)).then(() => setForceTo(null)) },
                ])
              }
            />
          ) : null}

          {d.status !== 'CANCELLED' && d.status !== 'CLOSED' ? (
            showCancel ? (
              <View style={{ marginTop: 12 }}>
                <Field label="Motivo de cancelación" value={cancelReason} onChangeText={setCancelReason} />
                <Button
                  kind="danger"
                  title="Confirmar cancelación"
                  disabled={!cancelReason.trim()}
                  loading={busy}
                  onPress={() => run(() => cancelDonation(d, cleanText(cancelReason, MAX.long), user), 'Donación cancelada')}
                />
              </View>
            ) : (
              <Button kind="secondary" title="Cancelar donación" onPress={() => setShowCancel(true)} style={{ marginTop: 12 }} />
            )
          ) : null}

          <Button
            kind="danger"
            title="Eliminar definitivamente"
            style={{ marginTop: 12 }}
            loading={busy}
            onPress={() =>
              Alert.alert(
                'Eliminar donación',
                'Se borrarán la donación, sus productos, historial y fotos. Esto no se puede deshacer. Si solo ya no va, usa "Cancelar donación".',
                [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                      setBusy(true);
                      try {
                        await deleteDonation(d);
                        router.back();
                      } catch (e) {
                        Alert.alert('Error', errorMessage(e));
                      } finally {
                        setBusy(false);
                      }
                    },
                  },
                ],
              )
            }
          />
        </Card>
      ) : null}
    </Screen>
  );
}
