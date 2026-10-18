import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import {
  History,
  ItemLines,
  MapButtons,
  ReviewedLines,
  effectiveStatus,
  statedSummary,
  timePillText,
  useLiveStatus,
  useRoleAction,
} from '@/components/donation';
import { Icon } from '@/components/icons';
import { PhotoGrid } from '@/components/photo';
import { Screen } from '@/components/screen';
import { Sheet, SheetAction } from '@/components/sheet';
import { useCommitOnBlur } from '@/components/undo';
import {
  Button,
  C,
  CacheNotice,
  Card,
  Chips,
  ErrorBox,
  Field,
  Label,
  Loading,
  Muted,
  Pill,
  SectionTitle,
  StatTile,
  StatusProgress,
  Text,
  Title,
} from '@/components/ui';
import { cancelDonation, clearReview, deleteDonation, forceStatus } from '@/lib/admin';
import { errorMessage } from '@/lib/client';
import { STATUSES, STATUS_LABEL, type Status } from '@/lib/domain';
import { MAX, cleanText, fmtKg } from '@/lib/format';
import { useCachedQuery } from '@/lib/offline';
import { donationDetail, type DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';

type Q = { refresh: () => Promise<unknown>; loading: boolean; fromCache: boolean; savedAt: string | null };

export default function DonationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCachedQuery(`donation:${id}`, () => donationDetail(id));
  useLiveStatus();
  useCommitOnBlur();

  if (q.loading && !q.data) return <Loading />;
  if (!q.data) return <Screen onRefresh={q.refresh}>{q.error ? <ErrorBox text={q.error} /> : null}</Screen>;
  return <Detail data={q.data} q={q} />;
}

function Detail({ data, q }: { data: DonationDetail; q: Q }) {
  const user = useUser();
  const { donation: d, items, events } = data;
  const action = useRoleAction(d, q.refresh);
  const status = effectiveStatus(d);
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = user.role === 'ADMIN';
  const driverView = user.role === 'DRIVER' && (status === 'ASSIGNED' || status === 'REQUESTED');

  const footer = (
    <>
      {action.transition ? (
        <Button
          size="lg"
          kind={action.secondary ? 'secondary' : 'primary'}
          icon={action.secondary ? 'clipboardCheck' : status === 'ASSIGNED' ? 'clipboardList' : 'check'}
          title={action.label}
          onPress={action.run}
          loading={action.busy}
        />
      ) : action.pending ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 48 }}>
          <Icon name="refresh" size={20} color={C.orangeText} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.orangeText }}>
            Tu último cambio se enviará en cuanto haya conexión.
          </Text>
        </View>
      ) : null}
      {isAdmin ? <Button kind="secondary" icon="more" title="Más acciones" onPress={() => setMoreOpen(true)} /> : null}
    </>
  );
  const hasFooter = !!action.transition || action.pending || isAdmin;

  return (
    <Screen onRefresh={q.refresh} refreshing={q.loading} footer={hasFooter ? footer : undefined}>
      <CacheNotice fromCache={q.fromCache} savedAt={q.savedAt} />
      {/* plain render helpers (no hooks inside), called as functions so nothing remounts */}
      {driverView ? DriverView({ data }) : CommonView({ data, admin: isAdmin })}
      {!driverView ? <History events={events} /> : null}
      {isAdmin ? <AdminActions data={data} open={moreOpen} onClose={() => setMoreOpen(false)} refresh={q.refresh} /> : null}
    </Screen>
  );

  function CommonView({ data: { donation: d }, admin }: { data: DonationDetail; admin: boolean }) {
    const stated = items.filter((i) => i.stage === 'STATED');
    const reviewed = items.filter((i) => i.stage === 'REVIEWED');
    const { kg, count } = statedSummary(d, items);
    const photos = [
      ...(d.signaturePhotoKey ? [{ path: d.signaturePhotoKey, label: 'Firma' }] : []),
      ...(d.listPhotoKey ? [{ path: d.listPhotoKey, label: 'Lista' }] : []),
      ...(d.extraPhotoKeys ?? []).filter((p): p is string => !!p).map((p, i) => ({ path: p, label: `Foto ${i + 1}` })),
    ];
    return (
      <>
        <Card style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {action.pending ? <Pill text="Por enviar" variant="neutral" /> : <Pill text={timePillText(d, status)} />}
            {d.needsReview ? <Pill text="Conflicto" variant="alert" /> : null}
          </View>
          <Title style={{ letterSpacing: -0.3 }}>{d.donorName}</Title>
          {admin ? <Muted>{d.pickupAddress}</Muted> : null}
          <StatusProgress status={status} size="detail" viewer={user.role} />
          {status !== 'REQUESTED' && status !== 'ASSIGNED' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <StatTile label="Declarado" value={kg != null ? `${Math.round(kg)} kg` : '—'} />
              <StatTile label="Productos" value={String(count)} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="truck" size={20} color={C.ink} />
            <Text style={{ fontSize: 15, fontWeight: '600' }}>{d.driverName || 'Sin chofer asignado'}</Text>
          </View>
        </Card>

        {d.requestedContents || d.adminNotes || d.cancelReason || d.inspectionNotes ? (
          <Card style={{ padding: 18, gap: 14 }}>
            {d.requestedContents ? <Note title="Lo que dijo el donante al llamar" text={d.requestedContents} /> : null}
            {d.adminNotes ? <Note title="Nota del administrador" text={d.adminNotes} /> : null}
            {d.inspectionNotes ? <Note title="Nota de inspección" text={d.inspectionNotes} /> : null}
            {d.cancelReason ? <Note title="Motivo de cancelación" text={d.cancelReason} danger /> : null}
          </Card>
        ) : null}

        {stated.length ? (
          <Card style={{ padding: 18, gap: 4 }}>
            <SectionTitle style={{ marginBottom: 6 }}>Qué trae</SectionTitle>
            <ItemLines items={stated} />
          </Card>
        ) : null}

        {reviewed.length ? (
          <Card style={{ padding: 18, gap: 4 }}>
            <SectionTitle style={{ marginBottom: 6 }}>Revisión de inspección</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
              <StatTile label="Útil" value={fmtKg(d.usefulKgTotal)} tone="green" />
              <StatTile label="Descartado" value={fmtKg(d.discardedKgTotal)} tone="red" />
            </View>
            <ReviewedLines items={reviewed} />
          </Card>
        ) : null}

        {d.driverNotes || photos.length ? (
          <Card style={{ padding: 18, gap: 10 }}>
            <SectionTitle>Nota del chofer</SectionTitle>
            {d.driverNotes ? <Text style={{ fontSize: 16, lineHeight: 24 }}>{d.driverNotes}</Text> : null}
            {photos.length ? <PhotoGrid photos={photos} /> : null}
          </Card>
        ) : null}
      </>
    );
  }

  function DriverView({ data: { donation: d } }: { data: DonationDetail }) {
    return (
      <>
        <Card style={{ padding: 18 }}>
          <Pill text={timePillText(d, status)} />
          <Title style={{ letterSpacing: -0.3 }}>{d.donorName}</Title>
          <StatusProgress status={status} size="detail" viewer="DRIVER" />
        </Card>
        <Card style={{ padding: 18 }}>
          <Label style={{ color: C.gray }}>Dirección</Label>
          <Text style={{ fontSize: 19, lineHeight: 27, fontWeight: '700' }}>{d.pickupAddress}</Text>
          <MapButtons address={d.pickupAddress} />
        </Card>
        {d.requestedContents || d.adminNotes ? (
          <Card style={{ padding: 18, gap: 14 }}>
            {d.requestedContents ? <Note title="Lo que dijo el donante al llamar" text={d.requestedContents} /> : null}
            {d.adminNotes ? <Note title="Nota del administrador" text={d.adminNotes} /> : null}
          </Card>
        ) : null}
        <Muted style={{ fontSize: 14 }}>
          Esta información queda guardada en el teléfono: puedes registrar la nota aunque no haya señal.
        </Muted>
      </>
    );
  }
}

function Note({ title, text, danger }: { title: string; text: string; danger?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Label style={{ color: danger ? C.redText : C.gray }}>{title}</Label>
      <Text style={{ fontSize: 16, lineHeight: 24 }}>{text}</Text>
    </View>
  );
}

/** "Más acciones" sheet: each action keeps its previous confirmation. */
function AdminActions({
  data: { donation: d },
  open,
  onClose,
  refresh,
}: {
  data: DonationDetail;
  open: boolean;
  onClose: () => void;
  refresh: () => Promise<unknown>;
}) {
  const user = useUser();
  const [view, setView] = useState<'menu' | 'force' | 'cancel'>('menu');
  const [forceTo, setForceTo] = useState<Status | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setView('menu');
    setForceTo(null);
    onClose();
  };

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      close();
      if (done) Alert.alert(done);
      await refresh();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const open_ = d.status !== 'CANCELLED' && d.status !== 'CLOSED';

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={view === 'force' ? 'Forzar estado' : view === 'cancel' ? 'Cancelar donación' : 'Más acciones'}
      subtitle={d.donorName}>
      {view === 'menu' ? (
        <View>
          <SheetAction
            title="Editar / asignar chofer"
            onPress={() => {
              close();
              router.push({ pathname: '/admin/form', params: { id: d.id } });
            }}
          />
          {d.needsReview ? (
            <SheetAction title="Marcar conflicto como revisado" onPress={() => void run(() => clearReview(d, user))} />
          ) : null}
          <SheetAction title="Forzar estado" onPress={() => setView('force')} />
          {open_ ? <SheetAction title="Cancelar donación" onPress={() => setView('cancel')} /> : null}
          <SheetAction
            danger
            title="Eliminar definitivamente"
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
                        close();
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
        </View>
      ) : view === 'force' ? (
        <>
          <Chips options={STATUSES.filter((x) => x !== 'CANCELLED')} value={forceTo} onChange={setForceTo} labels={STATUS_LABEL} />
          <Button
            title={forceTo ? `Cambiar a "${STATUS_LABEL[forceTo]}"` : 'Elige un estado'}
            disabled={!forceTo || forceTo === d.status}
            loading={busy}
            onPress={() =>
              forceTo &&
              Alert.alert('Forzar estado', `¿Cambiar a "${STATUS_LABEL[forceTo]}"?`, [
                { text: 'No', style: 'cancel' },
                { text: 'Sí', onPress: () => void run(() => forceStatus(d, forceTo, user)) },
              ])
            }
          />
          <Button kind="secondary" title="Volver" onPress={() => setView('menu')} />
        </>
      ) : (
        <>
          <Field label="Motivo de cancelación" value={cancelReason} onChangeText={setCancelReason} autoFocus multiline />
          <Button
            title="Confirmar cancelación"
            disabled={!cancelReason.trim()}
            loading={busy}
            onPress={() => run(() => cancelDonation(d, cleanText(cancelReason, MAX.long), user), 'Donación cancelada')}
          />
          <Button kind="secondary" title="Volver" onPress={() => setView('menu')} />
        </>
      )}
    </Sheet>
  );
}
