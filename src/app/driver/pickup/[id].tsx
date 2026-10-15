import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ItemsEditor, emptyDraft, validateDrafts, type ItemDraft } from '@/components/item-editor';
import { PhotoField, PhotoList } from '@/components/photo';
import { Screen } from '@/components/screen';
import { Button, Card, ErrorBox, Field, H2, Loading, Muted } from '@/components/ui';
import { MAX, cleanText, uuid } from '@/lib/format';
import { cacheGet, enqueue } from '@/lib/offline';
import type { DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';
import { useEffect } from 'react';

/**
 * Driver pickup note. Always required, even if the donor gave a written note:
 * typed list of items + photo of the donor's signature (+ optional photo of their written list).
 * Saved to the offline queue; pickup date/time is set automatically.
 */
export default function PickupForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const [donorName, setDonorName] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ItemDraft[]>([emptyDraft()]);
  const [signature, setSignature] = useState<string | null>(null);
  const [listPhoto, setListPhoto] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Works offline: the detail screen already cached this donation.
    cacheGet<DonationDetail>(`donation:${id}`).then((c) => setDonorName(c?.data.donation.donorName ?? ''));
  }, [id]);

  const submit = async () => {
    const { items, errors: errs } = validateDrafts(drafts, 'STATED');
    if (!signature) errs.push('Falta la foto de la firma del donante.');
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try {
      await enqueue({
        kind: 'pickup',
        id: uuid(),
        donationId: id,
        driverId: user.sub,
        at: new Date().toISOString(),
        by: { id: user.sub, name: user.name || user.email },
        attempts: 0,
        items,
        signatureUri: signature!,
        listUri: listPhoto,
        extraUris: extra,
        driverNotes: cleanText(notes, MAX.long) || undefined,
      });
      Alert.alert('Recolección registrada', 'Se enviará automáticamente (si no hay señal, en cuanto vuelva).');
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  if (donorName === null) return <Loading />;

  return (
    <Screen>
      <Card>
        <H2>{donorName || 'Recolección'}</H2>
        <Muted>
          Registra lo que el donante dice que entrega, aunque te haya dado una nota escrita. La fecha y hora de
          recolección se guardan automáticamente.
        </Muted>
      </Card>

      <H2>Productos declarados</H2>
      <ItemsEditor drafts={drafts} onChange={setDrafts} mode="STATED" />

      <Card style={{ marginTop: 12 }}>
        <H2>Evidencia</H2>
        <PhotoField
          label="Firma del donante (en papel)"
          hint="Toma una foto de la firma del donante sobre la nota o comprobante."
          uri={signature}
          onChange={setSignature}
          required
        />
        <PhotoField
          label="Lista escrita del donante (si te dio una)"
          uri={listPhoto}
          onChange={setListPhoto}
        />
        <PhotoList uris={extra} onChange={setExtra} />
        <Field label="Notas (opcional)" maxLength={MAX.long} value={notes} onChangeText={setNotes} multiline placeholder="Observaciones de la recolección" />
      </Card>

      {errors.length ? <ErrorBox text={errors.join('\n')} /> : null}
      <Button title="Registrar recolección" onPress={submit} loading={saving} />
    </Screen>
  );
}
