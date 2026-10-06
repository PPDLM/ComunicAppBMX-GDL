import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { ItemsEditor, validateDrafts, type ItemDraft } from '@/components/item-editor';
import { Screen } from '@/components/screen';
import { Button, Card, ErrorBox, Field, H2, Loading, Muted, Row } from '@/components/ui';
import { categoryLabel } from '@/lib/domain';
import { fmtKg, uuid } from '@/lib/format';
import { cacheGet, enqueue } from '@/lib/offline';
import { donationDetail, type DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';

/**
 * Inspection revision note, item by item. Prefilled with the driver's stated items;
 * inspection sets useful kg, discarded kg + reason and expiry dates, and can add items.
 * Saved through the offline queue; closes the donation.
 */
export default function ReviewForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const [detail, setDetail] = useState<DonationDetail | null>(null);
  const [drafts, setDrafts] = useState<ItemDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      setDetail(d);
      setDrafts(
        d.items
          .filter((i) => i.stage === 'STATED')
          .map((i) => ({
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
            statedHint: `${i.quantity} ${i.unit} · ${categoryLabel(i)} · ${fmtKg(i.kg)}`,
          })),
      );
    })();
  }, [id]);

  if (loadError) return <Screen><ErrorBox text={loadError} /></Screen>;
  if (!detail) return <Loading />;

  const stated = detail.items.filter((i) => i.stage === 'STATED').reduce((s, i) => s + i.kg, 0);

  const submit = async () => {
    const { items, errors: errs } = validateDrafts(drafts, 'REVIEWED');
    setErrors(errs);
    if (errs.length) return;
    const useful = items.reduce((s, i) => s + i.kg, 0);
    const discarded = items.reduce((s, i) => s + (i.discardedKg ?? 0), 0);
    Alert.alert(
      'Cerrar revisión',
      `Declarado: ${fmtKg(stated)}\nÚtil: ${fmtKg(useful)}\nDescartado: ${fmtKg(discarded)}\n\n¿Guardar y cerrar la donación?`,
      [
        { text: 'Revisar de nuevo', style: 'cancel' },
        {
          text: 'Guardar',
          onPress: async () => {
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
                items,
                inspectionNotes: notes.trim() || undefined,
              });
              router.back();
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Card>
        <H2>{detail.donation.donorName}</H2>
        <Row label="Chofer" value={detail.donation.driverName || '—'} />
        <Row label="Declarado" value={fmtKg(stated)} />
        <Muted style={{ marginTop: 6 }}>
          Para cada producto indica los kg útiles y, si aplica, los kg descartados con su motivo y la caducidad.
          Puedes agregar productos que no venían en la nota.
        </Muted>
      </Card>
      <ItemsEditor drafts={drafts} onChange={setDrafts} mode="REVIEWED" />
      <Card style={{ marginTop: 12 }}>
        <Field label="Notas de inspección (opcional)" value={notes} onChangeText={setNotes} multiline />
      </Card>
      {errors.length ? <ErrorBox text={errors.join('\n')} /> : null}
      <Button title="Guardar revisión y cerrar" onPress={submit} loading={saving} />
    </Screen>
  );
}
