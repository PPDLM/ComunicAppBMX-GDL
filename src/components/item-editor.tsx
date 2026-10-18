import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { CATEGORIES, DISCARD_REASONS, UNITS } from '@/lib/domain';
import { MAX, cleanText, num, parseDateOnly, uuid } from '@/lib/format';
import type { ItemInput } from '@/lib/offline';
import { Icon } from './icons';
import { Button, C, ChoiceGrid, Chips, Field, InlineError, Label, Stepper, Text } from './ui';

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

export const isKgUnit = isKg;

/** "No apto para consumo" → "No apto" on screen; the full value is what gets saved. */
export const REASON_LABEL: Partial<Record<(typeof DISCARD_REASONS)[number], string>> = {
  'No apto para consumo': 'No apto',
};

const TOP_CATEGORIES: readonly string[] = ['Abarrotes', 'Frutas y verduras', 'Lácteos', 'Panadería'];

/** Estimated kg of a draft line (what the driver declares). */
export function draftKg(d: ItemDraft) {
  return (isKg(d.unit) ? num(d.quantity) : num(d.kg)) ?? 0;
}

/** Compact saved product (64 high) with an edit button. */
export function ProductRow({ d, onEdit }: { d: ItemDraft; onEdit: () => void }) {
  const cat = d.category === 'Otro' ? d.customCategory || 'Otro' : d.category;
  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 16,
        paddingLeft: 16,
        paddingRight: 6,
        paddingVertical: 4,
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800' }}>{d.name}</Text>
        <Text style={{ fontSize: 14, color: C.gray }}>
          {d.quantity} {d.unit} · ≈{Math.round(draftKg(d) * 10) / 10} kg · {cat}
        </Text>
      </View>
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${d.name}`}
        style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="edit" size={22} color={C.gray} />
      </Pressable>
    </View>
  );
}

/**
 * One product being added or edited (orange border). Same fields as before, faster controls:
 * suggestion chips, top categories + "Más…", a stepper for quantity and a unit grid.
 * In REVIEWED mode (product inspection adds) it also asks useful / discarded kg.
 */
export function ProductEditor({
  draft,
  onChange,
  mode,
  suggestions = [],
  errors = [],
  actions,
}: {
  draft: ItemDraft;
  onChange: (d: ItemDraft) => void;
  mode: 'STATED' | 'REVIEWED';
  suggestions?: string[];
  errors?: string[];
  actions?: ReactNode;
}) {
  const [allCats, setAllCats] = useState(false);
  const set = (patch: Partial<ItemDraft>) => onChange({ ...draft, ...patch });
  const customUnit = !(UNITS as readonly string[]).includes(draft.unit);
  const cats = allCats || !TOP_CATEGORIES.includes(draft.category) ? [...CATEGORIES] : [...TOP_CATEGORIES, 'more'];
  const sugg = suggestions.filter((s) => s.toLowerCase() !== draft.name.trim().toLowerCase()).slice(0, 6);
  const discarded = num(draft.discardedKg) ?? 0;

  return (
    <View
      accessibilityLabel="Producto"
      style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 16, borderWidth: 2, borderColor: C.orange }}>
      <View style={{ gap: 8 }}>
        <Field label="Producto" maxLength={MAX.short} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Ej. Arroz" style={{ fontSize: 17 }} />
        {sugg.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {sugg.map((s) => (
              <Pressable
                key={s}
                onPress={() => set({ name: s })}
                accessibilityRole="button"
                accessibilityLabel={`Usar ${s}`}
                style={{ height: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: C.borderStrong, justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{s}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Categoría</Label>
        <Chips
          options={cats}
          value={draft.category}
          labels={{ more: 'Más…' }}
          onChange={(v) => (v === 'more' ? setAllCats(true) : set({ category: v }))}
        />
        {draft.category === 'Otro' ? (
          <Field
            label="Categoría personalizada"
            value={draft.customCategory}
            onChangeText={(v) => set({ customCategory: v })}
            placeholder="Ej. Alimento para mascotas"
          />
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Label>Cantidad</Label>
        <View style={{ flexDirection: 'row' }}>
          <Stepper boxed label="Cantidad" value={draft.quantity} onChange={(v) => set({ quantity: v })} />
        </View>
        <ChoiceGrid
          label="Unidad"
          columns={3}
          height={48}
          options={[...UNITS, 'otra'].map((u) => ({ value: u, label: u }))}
          value={customUnit ? 'otra' : draft.unit}
          onChange={(v) => set({ unit: v === 'otra' ? '' : v })}
        />
        {customUnit ? (
          <Field label="Unidad personalizada" value={draft.unit} onChangeText={(v) => set({ unit: v })} placeholder="Ej. tarimas" />
        ) : null}
      </View>

      {mode === 'STATED' && !isKg(draft.unit) ? (
        <Field
          label="Kg aproximados (para reportes)"
          keyboardType="decimal-pad"
          value={draft.kg}
          onChangeText={(v) => set({ kg: v })}
          placeholder="0"
        />
      ) : null}

      {mode === 'REVIEWED' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field
              containerStyle={{ flex: 1 }}
              label="Kg útiles"
              keyboardType="decimal-pad"
              value={draft.kg}
              onChangeText={(v) => set({ kg: v })}
              placeholder="0"
            />
            <Field
              containerStyle={{ flex: 1 }}
              label="Kg descartados"
              keyboardType="decimal-pad"
              value={draft.discardedKg}
              onChangeText={(v) => set({ discardedKg: v })}
              placeholder="0"
            />
          </View>
          {discarded > 0 ? (
            <ReasonChips value={draft.discardReason} onChange={(v) => set({ discardReason: v })} />
          ) : null}
        </>
      ) : null}

      {errors.length ? (
        <View style={{ gap: 4 }}>
          {errors.map((e) => (
            <InlineError key={e} text={e} />
          ))}
        </View>
      ) : null}
      {actions}
    </View>
  );
}

export function ReasonChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>¿Por qué se descarta?</Label>
      <Chips options={DISCARD_REASONS} value={(value || null) as (typeof DISCARD_REASONS)[number] | null} onChange={onChange} labels={REASON_LABEL} />
    </View>
  );
}

/** Editor button row: dark "Guardar y agregar otro" (new) or save / remove (editing). */
export function EditorActions({
  editing,
  onSave,
  onRemove,
  onCancel,
}: {
  editing: boolean;
  onSave: () => void;
  onRemove?: () => void;
  onCancel?: () => void;
}) {
  if (!editing) return <Button kind="dark" icon="plus" title="Guardar y agregar otro" onPress={onSave} />;
  return (
    <View style={{ gap: 8 }}>
      <Button kind="dark" icon="check" title="Guardar cambios" onPress={onSave} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onCancel ? <Button kind="secondary" title="Cancelar" onPress={onCancel} style={{ flex: 1 }} /> : null}
        {onRemove ? <Button kind="danger" icon="trash" title="Quitar" onPress={onRemove} style={{ flex: 1 }} /> : null}
      </View>
    </View>
  );
}
