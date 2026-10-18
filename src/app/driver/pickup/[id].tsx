import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Icon } from '@/components/icons';
import {
  EditorActions,
  type ItemDraft,
  ProductEditor,
  ProductRow,
  draftKg,
  emptyDraft,
  validateDrafts,
} from '@/components/item-editor';
import { PhotoTile, extraPhotoTiles } from '@/components/photo';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/undo';
import { Button, C, Disclosure, Field, Loading, Muted, SectionTitle, Text, Title, haptic } from '@/components/ui';
import { MAX, cleanText, uuid } from '@/lib/format';
import { cacheGet, cacheSet, enqueue } from '@/lib/offline';
import type { DonationDetail } from '@/lib/queries';
import { useUser } from '@/lib/session';

const FALLBACK_SUGGESTIONS = ['Arroz', 'Frijol', 'Tortilla', 'Leche', 'Pan', 'Verdura mixta'];
const LAST_UNIT_KEY = 'pref:lastUnit';

/** Most used product names in the donations cached on this phone (fixed short list if none). */
function useSuggestions() {
  const [list, setList] = useState<string[]>(FALLBACK_SUGGESTIONS);
  useEffect(() => {
    (async () => {
      try {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('cache:donation:')).slice(0, 40);
        const counts = new Map<string, number>();
        for (const [, raw] of await AsyncStorage.multiGet(keys)) {
          const detail = raw ? (JSON.parse(raw).data as DonationDetail | null) : null;
          for (const i of detail?.items ?? []) {
            if (i.stage !== 'STATED') continue;
            const n = i.name.trim();
            if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
          }
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
        if (top.length >= 3) setList(top.slice(0, 8));
      } catch {
        // keep the fixed list
      }
    })();
  }, []);
  return list;
}

const isBlank = (d: ItemDraft) => !d.name.trim() && !d.quantity.trim() && !d.kg.trim();

/**
 * Driver pickup note. Always required, even if the donor gave a written note:
 * typed list of items + photo of the donor's signature (+ optional photo of their written list).
 * Saved to the offline queue; pickup date/time is set automatically.
 */
export default function PickupForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const toast = useToast();
  const suggestions = useSuggestions();
  const [donorName, setDonorName] = useState<string | null>(null);
  const [saved, setSaved] = useState<ItemDraft[]>([]);
  const [editor, setEditor] = useState<ItemDraft>(emptyDraft());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editorErrors, setEditorErrors] = useState<string[]>([]);
  const [lastUnit, setLastUnit] = useState('kg');
  const [signature, setSignature] = useState<string | null>(null);
  const [listPhoto, setListPhoto] = useState<string | null>(null);
  const [extra, setExtra] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Works offline: the list / detail screens already cached this donation.
    cacheGet<DonationDetail>(`donation:${id}`).then((c) => setDonorName(c?.data.donation.donorName ?? ''));
    cacheGet<string>(LAST_UNIT_KEY).then((c) => {
      if (c?.data) {
        setLastUnit(c.data);
        setEditor((e) => (isBlank(e) ? { ...e, unit: c.data } : e));
      }
    });
  }, [id]);

  const fresh = () => ({ ...emptyDraft(), unit: lastUnit });

  /** Validates the open editor; returns the product or null (errors shown in the editor). */
  const checkEditor = (): ItemDraft | null => {
    const { errors } = validateDrafts([editor], 'STATED');
    setEditorErrors(errors.map((e) => e.replace(/^Producto 1: /, '')));
    return errors.length ? null : editor;
  };

  const saveEditor = () => {
    const ok = checkEditor();
    if (!ok) return;
    haptic.tap();
    setSaved(editingIndex != null ? saved.map((d, i) => (i === editingIndex ? ok : d)) : [...saved, ok]);
    setLastUnit(ok.unit);
    void cacheSet(LAST_UNIT_KEY, ok.unit);
    setEditingIndex(null);
    setEditor({ ...emptyDraft(), unit: ok.unit });
  };

  const edit = (i: number) => {
    if (!isBlank(editor) && editingIndex == null) {
      Alert.alert('Producto sin guardar', 'Guarda o borra el producto que estás agregando antes de editar otro.');
      return;
    }
    setEditorErrors([]);
    setEditingIndex(i);
    setEditor(saved[i]);
  };

  // Live status for the bottom bar: the open editor counts if it's complete.
  const editorValid = !isBlank(editor) && !validateDrafts([editor], 'STATED').errors.length;
  const products = editingIndex == null && editorValid ? [...saved, editor] : saved;
  const totalKg = products.reduce((s, d) => s + draftKg(d), 0);
  const editorPending = editingIndex == null && !isBlank(editor) && !editorValid;
  const missing = [
    !products.length ? 'Agrega al menos un producto' : null,
    !signature ? 'Falta la foto de la firma' : null,
    editorPending ? 'Termina o borra el producto que estás agregando' : null,
    editingIndex != null ? 'Guarda los cambios del producto' : null,
  ].filter((x): x is string => !!x);

  const submit = async () => {
    const { items, errors } = validateDrafts(products, 'STATED');
    if (errors.length || !signature) return;
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
        signatureUri: signature,
        listUri: listPhoto,
        extraUris: extra,
        driverNotes: cleanText(notes, MAX.long) || undefined,
      });
      haptic.success();
      toast.show({ text: 'Recolección guardada. Se enviará sola.' });
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  if (donorName === null) return <Loading />;

  return (
    <Screen
      footer={
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
            {products.length ? (
              <Ok text={`${products.length} producto${products.length === 1 ? '' : 's'} · ≈${Math.round(totalKg)} kg`} />
            ) : null}
            {signature ? <Ok text="Firma" /> : null}
          </View>
          {missing.map((m) => (
            <Text key={m} style={{ fontSize: 14, fontWeight: '700', color: C.redText }}>
              {m}
            </Text>
          ))}
          <Button size="lg" title="Registrar recolección" onPress={submit} loading={saving} disabled={missing.length > 0} />
        </>
      }>
      <View style={{ gap: 4, paddingHorizontal: 2 }}>
        <Title style={{ letterSpacing: -0.3 }}>{donorName || 'Recolección'}</Title>
        <Muted style={{ fontSize: 14 }}>La fecha y hora se guardan solas.</Muted>
      </View>

      <SectionTitle style={{ marginTop: 6, marginHorizontal: 2 }}>1 · Qué te entregaron</SectionTitle>
      {saved.map((d, i) =>
        i === editingIndex ? null : <ProductRow key={d.id} d={d} onEdit={() => edit(i)} />,
      )}
      <ProductEditor
        mode="STATED"
        draft={editor}
        onChange={(d) => {
          setEditorErrors([]);
          setEditor(d);
        }}
        suggestions={suggestions}
        errors={editorErrors}
        actions={
          <EditorActions
            editing={editingIndex != null}
            onSave={saveEditor}
            onCancel={() => {
              setEditingIndex(null);
              setEditorErrors([]);
              setEditor(fresh());
            }}
            onRemove={() => {
              const i = editingIndex;
              if (i == null) return;
              Alert.alert('Quitar producto', `¿Quitar "${saved[i].name}"?`, [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Quitar',
                  style: 'destructive',
                  onPress: () => {
                    setSaved(saved.filter((_, j) => j !== i));
                    setEditingIndex(null);
                    setEditor(fresh());
                  },
                },
              ]);
            }}
          />
        }
      />

      <SectionTitle style={{ marginTop: 10, marginHorizontal: 2 }}>2 · Fotos</SectionTitle>
      <View style={{ gap: 8 }}>
        {chunk3([
          <PhotoTile key="sig" label="Firma" uri={signature} onChange={setSignature} required />,
          <PhotoTile key="list" label="Lista (si hay)" uri={listPhoto} onChange={setListPhoto} />,
          ...extraPhotoTiles(extra, setExtra),
        ])}
      </View>
      <Muted style={{ fontSize: 13 }}>Toca para tomar la foto. Mantén presionado para elegir de la galería.</Muted>

      <Disclosure title="Agregar nota" hint="opcional" open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}>
        <Field maxLength={MAX.long} value={notes} onChangeText={setNotes} multiline placeholder="Observaciones de la recolección" accessibilityLabel="Nota" />
      </Disclosure>
    </Screen>
  );
}

function Ok({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="check" size={16} color={C.greenText} strokeWidth={2.6} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.greenText }}>{text}</Text>
    </View>
  );
}

/** Lays tiles in rows of 3 (keeps squares the same size). */
function chunk3(nodes: React.ReactNode[]) {
  const rows: React.ReactNode[][] = [];
  nodes.forEach((n, i) => (i % 3 ? rows[rows.length - 1].push(n) : rows.push([n])));
  return rows.map((r, i) => (
    <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
      {r}
      {Array.from({ length: 3 - r.length }, (_, j) => (
        <View key={j} style={{ flex: 1 }} />
      ))}
    </View>
  ));
}
