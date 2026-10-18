import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { num } from '@/lib/format';
import { Icon } from './icons';
import { type ItemDraft, ReasonChips } from './item-editor';
import { DatePicker } from './sheet';
import { C, ChoiceGrid, Stepper, Text } from './ui';

export type ReviewMode = 'all' | 'part' | 'none';

/** A reviewed line: the driver's product + how much of it is useful. Added products have no source. */
export type ReviewItem = ItemDraft & { mode: ReviewMode; declaredKg: number; touched: boolean };

/** Saved in the offline cache on every change so a closed app doesn't lose the review. */
export type ReviewDraft = { items: ReviewItem[]; notes: string };
export const reviewDraftKey = (donationId: string) => `review-draft:${donationId}`;

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Useful / discarded kg of a line. */
export function lineKg(it: ReviewItem) {
  if (!it.sourceItemId) {
    return { useful: num(it.kg) ?? 0, discarded: num(it.discardedKg) ?? 0 };
  }
  const useful = it.mode === 'all' ? it.declaredKg : it.mode === 'none' ? 0 : Math.min(it.declaredKg, num(it.kg) ?? 0);
  return { useful, discarded: r1(Math.max(0, it.declaredKg - useful)) };
}

export function needsReason(it: ReviewItem) {
  return lineKg(it).discarded > 0 && !it.discardReason;
}

/** Converts the review lines to the existing draft format so validateDrafts / enqueue stay the same. */
export function toItemDrafts(items: ReviewItem[]): ItemDraft[] {
  return items.map((it) => {
    if (!it.sourceItemId) return it;
    const { useful, discarded } = lineKg(it);
    return {
      ...it,
      kg: String(r1(useful)),
      discardedKg: discarded > 0 ? String(discarded) : '',
      discardReason: discarded > 0 ? it.discardReason : '',
    };
  });
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** One declared product: three big choices, a stepper for "Una parte", discard reason and expiry. */
export function ReviewItemCard({ it, onChange }: { it: ReviewItem; onChange: (it: ReviewItem) => void }) {
  const [dateOpen, setDateOpen] = useState(false);
  const set = (patch: Partial<ReviewItem>) => onChange({ ...it, ...patch, touched: true });
  const { discarded } = lineKg(it);
  const expiry = it.expiryDate ? new Date(`${it.expiryDate}T12:00:00`) : null;

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 12, boxShadow: '0 2px 10px rgba(46, 46, 46, 0.05)' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800' }}>{it.name}</Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: C.gray, textAlign: 'right' }}>
          {it.quantity} {it.unit} · {r1(it.declaredKg)} kg
        </Text>
      </View>
      <ChoiceGrid<ReviewMode>
        label={`Estado de ${it.name}`}
        height={52}
        value={it.mode}
        onChange={(m) =>
          set({ mode: m, kg: m === 'part' ? String(Math.max(0, Math.round(it.declaredKg * 0.8))) : it.kg })
        }
        options={[
          { value: 'all', label: 'Todo útil', tone: 'green' },
          { value: 'part', label: 'Una parte', tone: 'orange' },
          { value: 'none', label: 'Nada sirve', tone: 'red' },
        ]}
      />
      {it.mode === 'part' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700' }}>Kg útiles</Text>
            <Stepper label="Kg útiles" size={52} value={it.kg} max={it.declaredKg} onChange={(v) => set({ kg: v })} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.redText }}>Descartado: {discarded} kg</Text>
        </>
      ) : null}
      {discarded > 0 ? <ReasonChips value={it.discardReason} onChange={(v) => set({ discardReason: v })} /> : null}
      <Pressable
        onPress={() => setDateOpen(true)}
        accessibilityRole="button"
        style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 12, marginLeft: -12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="calendar" size={18} color={C.gray} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.gray }}>
          {expiry ? `Caduca ${expiry.getDate()} ${MONTHS[expiry.getMonth()]}` : 'Agregar caducidad'}
        </Text>
      </Pressable>
      {expiry ? (
        <Pressable onPress={() => set({ expiryDate: '' })} accessibilityRole="button" style={{ marginTop: -12, alignSelf: 'flex-start', height: 36, justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: C.gray, textDecorationLine: 'underline' }}>Quitar caducidad</Text>
        </Pressable>
      ) : null}
      <DatePicker
        visible={dateOpen}
        title="Fecha de caducidad"
        value={expiry ?? new Date()}
        onClose={() => setDateOpen(false)}
        onConfirm={(d) => {
          setDateOpen(false);
          set({ expiryDate: ymd(d) });
        }}
      />
    </View>
  );
}
