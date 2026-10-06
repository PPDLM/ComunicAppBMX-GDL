import { Pressable, Text, View } from 'react-native';

import { CATEGORIES, DISCARD_REASONS, UNITS } from '@/lib/domain';
import { MAX, cleanText, num, parseDateOnly, uuid } from '@/lib/format';
import type { ItemInput } from '@/lib/offline';
import { Button, C, Card, Chips, Field, Muted } from './ui';

/** Editable item as strings (form state). */
export type ItemDraft = {
  id: string;
  sourceItemId: string | null;
  name: string;
  category: string;
  customCategory: string;
  quantity: string;
  unit: string;
  kg: string; // STATED: estimated kg; REVIEWED: useful kg
  discardedKg: string;
  discardReason: string;
  expiryDate: string;
  statedHint?: string; // read-only summary of the driver's line (review mode)
};

export function emptyDraft(): ItemDraft {
  return {
    id: uuid(),
    sourceItemId: null,
    name: '',
    category: 'Abarrotes',
    customCategory: '',
    quantity: '',
    unit: 'kg',
    kg: '',
    discardedKg: '',
    discardReason: '',
    expiryDate: '',
  };
}

const isKg = (unit: string) => unit.trim().toLowerCase() === 'kg';

/** Validates drafts → items ready to save, or a list of human-readable errors. */
export function validateDrafts(
  drafts: ItemDraft[],
  stage: 'STATED' | 'REVIEWED',
): { items: ItemInput[]; errors: string[] } {
  const errors: string[] = [];
  const items: ItemInput[] = [];
  if (!drafts.length) errors.push('Agrega al menos un producto.');
  drafts.forEach((d, i) => {
    const n = `Producto ${i + 1}`;
    const qty = num(d.quantity);
    const unit = cleanText(d.unit, 30);
    const name = cleanText(d.name, MAX.short);
    const customCategory = cleanText(d.customCategory, 60);
    const LIMIT = 100000; // kg / units per line: rejects absurd or negative values
    const kg = isKg(unit) && stage === 'STATED' ? qty : num(d.kg);
    const discarded = d.discardedKg.trim() ? num(d.discardedKg) : 0;
    if (!name) errors.push(`${n}: falta el nombre.`);
    if (d.category === 'Otro' && !customCategory) errors.push(`${n}: escribe la categoría.`);
    if (qty === null || qty <= 0 || qty > LIMIT) errors.push(`${n}: cantidad inválida.`);
    if (!unit) errors.push(`${n}: falta la unidad.`);
    if (kg === null || kg < 0 || kg > LIMIT) errors.push(`${n}: ${stage === 'STATED' ? 'kg estimados' : 'kg útiles'} inválidos.`);
    if (stage === 'REVIEWED') {
      if (discarded === null || discarded < 0 || discarded > LIMIT) errors.push(`${n}: kg descartados inválidos.`);
      if ((discarded ?? 0) > 0 && !d.discardReason) errors.push(`${n}: indica el motivo del descarte.`);
      if (d.expiryDate.trim() && !parseDateOnly(d.expiryDate)) errors.push(`${n}: caducidad debe ser AAAA-MM-DD.`);
    }
    if (errors.length) return;
    items.push({
      id: d.id,
      stage,
      name,
      category: d.category,
      customCategory: d.category === 'Otro' ? customCategory : null,
      quantity: qty!,
      unit,
      kg: kg!,
      discardedKg: stage === 'REVIEWED' ? discarded : null,
      discardReason: stage === 'REVIEWED' && (discarded ?? 0) > 0 ? d.discardReason : null,
      expiryDate: stage === 'REVIEWED' && d.expiryDate.trim() ? d.expiryDate.trim() : null,
      sourceItemId: d.sourceItemId,
    });
  });
  return { items, errors };
}

export function ItemsEditor({
  drafts,
  onChange,
  mode,
}: {
  drafts: ItemDraft[];
  onChange: (d: ItemDraft[]) => void;
  mode: 'STATED' | 'REVIEWED';
}) {
  const set = (i: number, patch: Partial<ItemDraft>) =>
    onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <View>
      {drafts.map((d, i) => {
        const customUnit = !(UNITS as readonly string[]).includes(d.unit);
        return (
          <Card key={d.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>
                Producto {i + 1}
                {mode === 'REVIEWED' && !d.sourceItemId ? ' (agregado en revisión)' : ''}
              </Text>
              <Pressable onPress={() => onChange(drafts.filter((_, j) => j !== i))} hitSlop={10}>
                <Text style={{ color: C.danger, fontWeight: '600' }}>Quitar</Text>
              </Pressable>
            </View>
            {d.statedHint ? <Muted style={{ marginBottom: 8 }}>Declarado por chofer: {d.statedHint}</Muted> : null}

            <Field label="Nombre" maxLength={MAX.short} value={d.name} onChangeText={(v) => set(i, { name: v })} placeholder="Ej. Arroz" />

            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Categoría</Text>
            <Chips options={CATEGORIES} value={d.category as (typeof CATEGORIES)[number]} onChange={(v) => set(i, { category: v })} />
            {d.category === 'Otro' ? (
              <Field
                label="Categoría personalizada"
                value={d.customCategory}
                onChangeText={(v) => set(i, { customCategory: v })}
                placeholder="Ej. Alimento para mascotas"
              />
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Cantidad"
                  keyboardType="decimal-pad"
                  value={d.quantity}
                  onChangeText={(v) => set(i, { quantity: v })}
                  placeholder="20"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={mode === 'STATED' ? 'Kg estimados' : 'Kg útiles'}
                  keyboardType="decimal-pad"
                  value={mode === 'STATED' && isKg(d.unit) ? d.quantity : d.kg}
                  editable={!(mode === 'STATED' && isKg(d.unit))}
                  onChangeText={(v) => set(i, { kg: v })}
                  placeholder="0"
                />
              </View>
            </View>

            <Text style={{ fontWeight: '600', marginBottom: 6 }}>Unidad</Text>
            <Chips
              options={[...UNITS, 'otra'] as readonly string[]}
              value={customUnit ? 'otra' : d.unit}
              onChange={(v) => set(i, { unit: v === 'otra' ? '' : v })}
            />
            {customUnit ? (
              <Field label="Unidad personalizada" value={d.unit} onChangeText={(v) => set(i, { unit: v })} placeholder="Ej. tarimas" />
            ) : null}
            {!isKg(d.unit) && mode === 'STATED' ? (
              <Muted>Como la unidad no es kg, escribe un estimado en kg para los reportes.</Muted>
            ) : null}

            {mode === 'REVIEWED' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Kg descartados"
                      keyboardType="decimal-pad"
                      value={d.discardedKg}
                      onChangeText={(v) => set(i, { discardedKg: v })}
                      placeholder="0"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Caducidad"
                      value={d.expiryDate}
                      onChangeText={(v) => set(i, { expiryDate: v })}
                      placeholder="AAAA-MM-DD"
                    />
                  </View>
                </View>
                {num(d.discardedKg) ? (
                  <>
                    <Text style={{ fontWeight: '600', marginBottom: 6 }}>Motivo del descarte</Text>
                    <Chips
                      options={DISCARD_REASONS}
                      value={(d.discardReason || null) as (typeof DISCARD_REASONS)[number] | null}
                      onChange={(v) => set(i, { discardReason: v })}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        );
      })}
      <Button kind="secondary" title="+ Agregar producto" onPress={() => onChange([...drafts, emptyDraft()])} />
    </View>
  );
}
