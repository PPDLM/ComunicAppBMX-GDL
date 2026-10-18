import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { ProductEditor, REASON_LABEL, emptyDraft, validateDrafts } from '@/components/item-editor';
import {
  type ReviewDraft,
  type ReviewItem,
  ReviewItemCard,
  lineKg,
  needsReason,
  reviewDraftKey,
  toItemDrafts,
} from '@/components/review-editor';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/undo';
import { Button, C, Disclosure, ErrorBox, Field, InlineError, Loading, Muted, StatTile, Text, Title, haptic } from '@/components/ui';
import { MAX, cleanText, fmtKg, uuid } from '@/lib/format';
import { cacheGet, cacheSet, enqueue } from '@/lib/offline';
import { donationDetail, type DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Inspection review, product by product. Everything starts as "Todo útil": only what came wrong
 * needs a tap. Saved through the offline queue; closes the donation.
 */
export default function ReviewForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const toast = useToast();
  const [detail, setDetail] = useState<DonationDetail | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      let d: DonationDetail | null = null;
      try {
        d = await donationDetail(id);
      } catch {
        d = (await cacheGet<DonationDetail>(`donation:${id}`))?.data ?? null;
      }
      if (!d) {
        setLoadError('No se pudo cargar la donación. Ábrela con conexión al menos una vez.');
        return;
      }
      const stated = d.items.filter((i) => i.stage === 'STATED');
      const saved = (await cacheGet<ReviewDraft | null>(reviewDraftKey(id)))?.data;
      // Resume a saved draft only if it still matches the driver's lines.
      const usable = saved && stated.every((s) => saved.items.some((x) => x.sourceItemId === s.id));
      setDetail(d);
      if (usable) {
        setItems(saved.items);
        setNotes(saved.notes);
        setNotesOpen(!!saved.notes);
      } else {
        setItems(
          stated.map((i) => ({
            id: uuid(),
            sourceItemId: i.id,
            name: i.name,
            category: i.category,
            customCategory: i.customCategory ?? '',
            quantity: String(i.quantity),
            unit: i.unit,
            kg: String(i.kg),
            discardedKg: '',
            discardReason: '',
            expiryDate: '',
            mode: 'all',
            declaredKg: i.kg,
            touched: false,
          })),
        );
      }
      loaded.current = true;
    })();
  }, [id]);

  // Keep the draft in the device cache so closing the app doesn't lose the review.
  useEffect(() => {
    if (loaded.current) void cacheSet<ReviewDraft>(reviewDraftKey(id), { items, notes });
  }, [id, items, notes]);

  if (loadError) return <Screen><ErrorBox text={loadError} /></Screen>;
  if (!detail) return <Loading />;

  const declared = items.filter((i) => i.sourceItemId).reduce((s, i) => s + i.declaredKg, 0);
  const totals = items.reduce(
    (acc, it) => {
      const k = lineKg(it);
      return { useful: acc.useful + k.useful, discarded: acc.discarded + k.discarded };
    },
    { useful: 0, discarded: 0 },
  );
  const missing = items.filter(needsReason).length;
  const upd = (i: number, it: ReviewItem) => {
    setErrors([]);
    setItems(items.map((x, j) => (j === i ? it : x)));
  };

  const onClose = () => {
    const { errors: errs } = validateDrafts(toItemDrafts(items), 'REVIEWED');
    setErrors(errs);
    if (!errs.length) setConfirm(true);
  };

  const save = async () => {
    const { items: input, errors: errs } = validateDrafts(toItemDrafts(items), 'REVIEWED');
    if (errs.length) {
      setConfirm(false);
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await enqueue({
        kind: 'revision',
        id: uuid(),
        donationId: id,
        driverId: detail.donation.driverId ?? null,
        at: new Date().toISOString(),
        by: { id: user.sub, name: user.name || user.email },
        attempts: 0,
        items: input,
        inspectionNotes: cleanText(notes, MAX.long) || undefined,
      });
      await cacheSet(reviewDraftKey(id), null);
      haptic.success();
      setConfirm(false);
      toast.show({ text: 'Revisión guardada. Se enviará sola.' });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const discards = items.filter((it) => lineKg(it).discarded > 0);
  const pct = declared > 0 ? Math.round((totals.useful / declared) * 100) : 0;

  return (
    <Screen
      footer={
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.greenText }}>Útil {r1(totals.useful)} kg</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.redText }}>Descartado {r1(totals.discarded)} kg</Text>
          </View>
          {missing ? (
            <Text style={{ fontSize: 14, fontWeight: '600', color: C.redText }}>Falta el motivo en {missing} producto(s)</Text>
          ) : null}
          {errors.slice(0, 3).map((e) => (
            <InlineError key={e} text={e} />
          ))}
          <Button size="lg" title="Cerrar revisión" disabled={missing > 0} onPress={onClose} />
        </>
      }>
      <View style={{ gap: 4, paddingHorizontal: 2 }}>
        <Title style={{ letterSpacing: -0.3 }}>{detail.donation.donorName}</Title>
        <Muted>
          {detail.donation.driverName || 'Sin chofer'} · {r1(declared)} kg declarados
        </Muted>
        <Text style={{ marginTop: 8, padding: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: C.card, fontSize: 14, lineHeight: 20, fontWeight: '600' }}>
          Todo empieza como útil. Solo toca lo que venga mal.
        </Text>
      </View>

      {items.map((it, i) =>
        it.sourceItemId ? (
          <ReviewItemCard key={it.id} it={it} onChange={(n) => upd(i, n)} />
        ) : (
          <ProductEditor
            key={it.id}
            mode="REVIEWED"
            draft={it}
            onChange={(d) => upd(i, { ...it, ...d, touched: true })}
            actions={<Button kind="danger" icon="trash" title="Quitar producto" onPress={() => setItems(items.filter((_, j) => j !== i))} />}
          />
        ),
      )}

      <Button
        kind="secondary"
        icon="plus"
        title="Producto que no venía en la nota"
        onPress={() => setItems([...items, { ...emptyDraft(), mode: 'all', declaredKg: 0, touched: true }])}
        style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: C.dashed, backgroundColor: 'transparent', borderRadius: 16 }}
      />
      <Disclosure title="Agregar nota de inspección" hint="opcional" open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}>
        <Field maxLength={MAX.long} value={notes} onChangeText={setNotes} multiline placeholder="Observaciones de la revisión" accessibilityLabel="Nota de inspección" />
      </Disclosure>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title="¿Cerrar la revisión?" subtitle={`${detail.donation.donorName} · ya no se podrá editar`}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile label="Declarado" value={String(Math.round(declared))} unit="kg" />
          <StatTile label="Útil" value={String(Math.round(totals.useful))} unit="kg" tone="green" />
          <StatTile label="Descartado" value={String(Math.round(totals.discarded))} unit="kg" tone="red" />
        </View>
        <View style={{ gap: 6 }}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: C.redSoft, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: C.green }} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700' }}>{pct} % útil</Text>
        </View>
        {discards.length ? (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.gray, marginBottom: 4 }}>Descartes</Text>
            {discards.map((it, i) => (
              <View
                key={it.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: i === discards.length - 1 ? 0 : 1,
                  borderBottomColor: C.divider,
                }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600' }}>
                  {it.name}
                  <Text style={{ fontWeight: '500', color: C.gray }}>
                    {' '}
                    · {REASON_LABEL[it.discardReason as keyof typeof REASON_LABEL] ?? it.discardReason}
                  </Text>
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700' }}>{fmtKg(lineKg(it).discarded)}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ gap: 10 }}>
          <Button size="lg" icon="check" title="Guardar y cerrar" loading={saving} onPress={save} />
          <Button kind="secondary" title="Seguir revisando" onPress={() => setConfirm(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}
