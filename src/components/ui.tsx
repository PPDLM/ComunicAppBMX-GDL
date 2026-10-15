/** Minimal UI kit used by every screen (light theme, large touch targets for field use). */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { STATUS_COLOR, STATUS_LABEL, type Status, isStatus } from '@/lib/domain';
import { fmtDateTime } from '@/lib/format';

export const C = {
  bg: '#F4F5F2',
  card: '#FFFFFF',
  text: '#1C1F1A',
  muted: '#6B7065',
  border: '#DADDD4',
  primary: '#E2711D', // BAMX orange
  primaryDark: '#B8570F',
  green: '#2F7D32',
  danger: '#B91C1C',
  warn: '#B45309',
};

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={s.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={s.h2}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' || value == null ? (
        <Text style={s.rowValue}>{value ?? '—'}</Text>
      ) : (
        <View style={{ flex: 1 }}>{value}</View>
      )}
    </View>
  );
}

type BtnKind = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    kind === 'primary' ? C.primary : kind === 'danger' ? C.danger : kind === 'secondary' ? '#FFFFFF' : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? '#FFFFFF' : kind === 'secondary' ? C.text : C.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: C.border },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9AA095"
        {...props}
        style={[s.input, props.multiline && { minHeight: 80, textAlignVertical: 'top' }, error ? { borderColor: C.danger } : null, props.style]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Muted>{hint}</Muted> : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && s.chipTextOn]}>{labels?.[o] ?? o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusBadge({ status, pending }: { status: string; pending?: boolean }) {
  const st: Status | null = isStatus(status) ? status : null;
  const color = st ? STATUS_COLOR[st] : C.muted;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <View style={[s.badge, { backgroundColor: color + '1A', borderColor: color }]}>
        <Text style={[s.badgeText, { color }]}>{st ? STATUS_LABEL[st] : status}</Text>
      </View>
      {pending ? (
        <View style={[s.badge, { borderColor: C.warn, backgroundColor: '#FEF3C7' }]}>
          <Text style={[s.badgeText, { color: C.warn }]}>Pendiente de sincronizar</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Badge({ text, color = C.warn }: { text: string; color?: string }) {
  return (
    <View style={[s.badge, { borderColor: color, backgroundColor: color + '1A', alignSelf: 'flex-start' }]}>
      <Text style={[s.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator size="large" color={C.primary} />
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ padding: 32, alignItems: 'center' }}>
      <Muted>{text}</Muted>
    </View>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <Card style={{ borderColor: C.danger, borderWidth: 1 }}>
      <Text style={{ color: C.danger }}>{text}</Text>
    </Card>
  );
}

export function CacheNotice({ fromCache, savedAt }: { fromCache: boolean; savedAt: string | null }) {
  if (!fromCache) return null;
  return (
    <View style={s.cache}>
      <Text style={{ color: C.warn, fontWeight: '600' }}>
        Sin conexión — mostrando datos guardados del {fmtDateTime(savedAt)}
      </Text>
    </View>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  h1: { fontSize: 24, fontWeight: '700', color: C.text, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 8, marginTop: 4 },
  muted: { color: C.muted, fontSize: 14 },
  row: { flexDirection: 'row', paddingVertical: 4, gap: 12 },
  rowLabel: { width: 120, color: C.muted, fontSize: 14 },
  rowValue: { flex: 1, color: C.text, fontSize: 15 },
  btn: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: C.text,
  },
  error: { color: C.danger, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.text, fontSize: 14 },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  cache: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginBottom: 12 },
  screen: { padding: 16, paddingBottom: 48 },
});
