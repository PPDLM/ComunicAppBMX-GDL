/**
 * Design system: BAMX logo palette, Plus Jakarta Sans, large touch targets.
 * Red = the one main action, orange = brand / progress / selection, green = success only.
 */
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { STATUS_LABEL, type Status, isStatus } from '@/lib/domain';
import { Icon, type IconName } from './icons';

export const C = {
  // Brand
  orange: '#DE860B',
  orangeSoft: '#FCEFD9',
  orangeText: '#8A4B00',
  red: '#CF1226',
  redSoft: '#FDE8EA',
  redText: '#A30E1F',
  redBorder: '#F3B6BE',
  green: '#7DB52C',
  greenSoft: '#EEF6E3',
  greenText: '#3D6B12',
  // Neutrals
  ink: '#2E2E2E',
  gray: '#5C5C5C',
  placeholder: '#8A8A8A',
  border: '#E2E2E2',
  borderStrong: '#D6D6D6',
  dashed: '#CFCFCF',
  divider: '#EFEFEF',
  neutralSoft: '#F0F0F0',
  track: '#EAEAEA',
  bg: '#F6F6F6',
  card: '#FFFFFF',
  disabledBg: '#E4E4E4',
  undoAccent: '#FFC966',
};

// ───────────────────────────── type ─────────────────────────────

/** Each weight is its own font family; fontWeight is reset so Android doesn't fall back or fake-bold it. */
export const FONT_FAMILY: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  '900': 'PlusJakartaSans_800ExtraBold',
};

export function font(weight: TextStyle['fontWeight'] = '500'): TextStyle {
  const w = weight === 'bold' ? '700' : weight === 'normal' ? '400' : String(weight);
  return { fontFamily: FONT_FAMILY[w] ?? FONT_FAMILY['500'], fontWeight: 'normal' };
}

/** Drop-in for RN Text: ink color by default, fontWeight mapped to the matching font file. */
export function Text({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  return <RNText {...props} style={[{ color: C.ink }, flat, font(flat.fontWeight)]} />;
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.title, style]}>{children}</Text>;
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.section, style]}>{children}</Text>;
}

/** Small uppercase group label ("SIGUIENTE", "DESPUÉS"). */
export function Overline({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.overline, style]}>{children}</Text>;
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.label, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

// ───────────────────────────── haptics ─────────────────────────────

export const haptic = {
  tap: () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
};

// ───────────────────────────── surfaces ─────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Full-width white row that opens/closes a section ("Historial (3 movimientos)", "Agregar nota · opcional"). */
export function Disclosure({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={[s.disclosure, open && { paddingBottom: 16 }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={s.disclosureHead}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        {hint ? <Text style={{ fontSize: 14, fontWeight: '600', color: C.gray }}>{hint}</Text> : null}
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevronDown" size={20} color={C.gray} />
        </View>
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 18 }}>{children}</View> : null}
    </View>
  );
}

// ───────────────────────────── buttons ─────────────────────────────

type BtnKind = 'primary' | 'secondary' | 'dark' | 'ghost' | 'danger';
export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
  icon,
  size = 'md',
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  /** sm 40 · md 56 · lg 60 (bottom bars) */
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const inactive = !!disabled && !loading;
  const fg = inactive
    ? C.gray
    : kind === 'primary' || kind === 'dark'
      ? '#FFFFFF'
      : kind === 'danger'
        ? C.redText
        : kind === 'ghost'
          ? C.gray
          : C.ink;
  const height = size === 'sm' ? 40 : size === 'lg' ? 60 : 56;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        if (kind === 'primary') haptic.tap();
        onPress();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { minHeight: height, borderRadius: size === 'sm' ? 10 : 14 },
        size === 'sm' && { paddingHorizontal: 14 },
        kind === 'primary' && s.btnPrimary,
        kind === 'secondary' && s.btnSecondary,
        kind === 'dark' && { backgroundColor: C.ink },
        kind === 'danger' && { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.redBorder },
        kind === 'ghost' && { backgroundColor: 'transparent', paddingHorizontal: 12 },
        inactive && s.btnDisabled,
        pressed && { opacity: 0.85 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 22} color={fg} strokeWidth={2.2} /> : null}
          <Text
            style={{
              color: fg,
              fontWeight: '700',
              fontSize: size === 'sm' ? 14 : kind === 'primary' ? 18 : 16,
              textAlign: 'center',
            }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Icon-only button with a 48 touch area. */
export function IconButton({
  icon,
  label,
  onPress,
  color = C.gray,
  round,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        s.iconBtn,
        round && { borderRadius: 24, backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(46, 46, 46, 0.08)' },
        pressed && { opacity: 0.7 },
        style,
      ]}>
      <Icon name={icon} size={22} color={color} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Floating action button (admin lists). */
export function Fab({ title, icon = 'plus', onPress }: { title: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [s.fab, pressed && { opacity: 0.9 }]}>
      <Icon name={icon} size={22} color="#FFFFFF" strokeWidth={2.4} />
      <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

// ───────────────────────────── inputs ─────────────────────────────

export function Field({
  label,
  optional,
  hint,
  error,
  icon,
  ref,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  icon?: IconName;
  ref?: React.Ref<TextInput>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label ? (
        <Label>
          {label}
          {optional ? <Text style={{ fontWeight: '500', color: C.gray }}> · opcional</Text> : null}
        </Label>
      ) : null}
      <View
        style={[
          s.field,
          props.multiline && { alignItems: 'flex-start' },
          (focused || error) && { borderColor: C.red, backgroundColor: '#FFFFFF' },
          props.editable === false && { backgroundColor: C.disabledBg },
        ]}>
        {icon ? (
          <View style={props.multiline ? { paddingTop: 16 } : undefined}>
            <Icon name={icon} size={20} color={error ? C.red : C.gray} />
          </View>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={C.placeholder}
          selectionColor={C.red}
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            s.input,
            props.multiline && { minHeight: 76, textAlignVertical: 'top', paddingTop: 14, paddingBottom: 14 },
            props.style,
          ]}
        />
      </View>
      {error ? <InlineError text={error} /> : hint ? <Muted style={{ fontSize: 13 }}>{hint}</Muted> : null}
    </View>
  );
}

export function InlineError({ text }: { text: string }) {
  return (
    <View style={s.inlineError} accessibilityRole="alert">
      <Icon name="alert" size={16} color={C.redText} strokeWidth={2.2} />
      <Text style={s.inlineErrorText}>{text}</Text>
    </View>
  );
}

/** − value + with the number editable (decimal pad). */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  label,
  size = 56,
  boxed,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  size?: number;
  /** Number shown inside a field box that stretches (pickup form) instead of plain text. */
  boxed?: boolean;
}) {
  const n = Number(value.replace(',', '.'));
  const cur = Number.isFinite(n) ? n : 0;
  const clamp = (x: number) => Math.max(min, max != null ? Math.min(max, x) : x);
  const set = (x: number) => {
    haptic.tap();
    onChange(String(Math.round(clamp(x) * 100) / 100));
  };
  const btn = (sign: 1 | -1) => (
    <Pressable
      onPress={() => set(cur + sign * step)}
      accessibilityRole="button"
      accessibilityLabel={`${sign > 0 ? 'Sumar' : 'Restar'} ${step} · ${label}`}
      style={({ pressed }) => [s.stepBtn, { width: size, height: size }, pressed && { backgroundColor: C.bg }]}>
      <Icon name={sign > 0 ? 'plus' : 'minus'} size={24} color={C.ink} strokeWidth={2.4} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: boxed ? 1 : undefined }}>
      {btn(-1)}
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.,]/g, ''))}
        keyboardType="decimal-pad"
        selectTextOnFocus
        accessibilityLabel={label}
        selectionColor={C.red}
        placeholder="0"
        placeholderTextColor={C.placeholder}
        style={[
          { fontSize: 24, color: C.ink, textAlign: 'center', height: size, padding: 0, ...font('800') },
          boxed
            ? { flex: 1, minWidth: 0, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 14 }
            : { minWidth: 72 },
        ]}
      />
      {btn(1)}
    </View>
  );
}

export type Choice<T extends string> = { value: T; label: string; tone?: 'orange' | 'green' | 'red' };

const TONE = {
  orange: { bg: C.orangeSoft, fg: C.orangeText, border: C.orange },
  green: { bg: C.greenSoft, fg: C.greenText, border: C.green },
  red: { bg: C.redSoft, fg: C.redText, border: C.red },
};

/** Single-answer grid of big buttons (radio group). */
export function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
  columns = 3,
  height = 50,
  label,
}: {
  options: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
  height?: number;
  label?: string;
}) {
  const rows: Choice<T>[][] = [];
  options.forEach((o, i) => (i % columns ? rows[rows.length - 1].push(o) : rows.push([o])));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 6 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 6 }}>
          {row.map((o) => {
            const on = o.value === value;
            const t = TONE[o.tone ?? 'orange'];
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  haptic.tap();
                  onChange(o.value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [
                  s.choice,
                  { height },
                  on ? { backgroundColor: t.bg, borderColor: t.border, borderWidth: 2 } : pressed && { backgroundColor: C.bg },
                ]}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: on ? t.fg : C.gray, textAlign: 'center' }} numberOfLines={1}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
          {/* keep columns aligned on the last row */}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`f${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Pills for filters and multiple choices. Selected = ink. `scroll` keeps long sets on one swipeable row.
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
  scroll,
  height = 44,
  style,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
  scroll?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const chips = options.map((o) => {
    const on = o === value;
    return (
      <Pressable
        key={o}
        onPress={() => {
          haptic.tap();
          onChange(o);
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: on }}
        style={({ pressed }) => [
          s.chip,
          { height },
          on && { backgroundColor: C.ink, borderColor: C.ink },
          pressed && !on && { backgroundColor: C.bg },
        ]}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#FFFFFF' : C.ink }}>{labels?.[o] ?? o}</Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[{ marginHorizontal: -20, flexGrow: 0 }, style]}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{chips}</View>;
}

/** Tab strip with counters (Almacén, Inspección, Reportes). */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  height = 50,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  height?: number;
}) {
  return (
    <View accessibilityRole="tablist" style={s.tabs}>
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => {
              haptic.tap();
              onChange(t.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.tab, { height }, on && s.tabOn]}>
            <Text style={{ fontSize: height < 48 ? 14 : 15, fontWeight: on ? '700' : '600', color: on ? C.ink : C.gray }} numberOfLines={1}>
              {t.label}
              {t.count != null ? (
                <Text style={{ fontWeight: on ? '800' : '700', color: on ? C.red : C.gray }}> {t.count}</Text>
              ) : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────────────────────────── status ─────────────────────────────

type PillVariant = 'time' | 'neutral' | 'alert' | 'success';
const PILL: Record<PillVariant, { bg: string; fg: string }> = {
  time: { bg: C.orangeSoft, fg: C.orangeText },
  neutral: { bg: C.neutralSoft, fg: C.ink },
  alert: { bg: C.redSoft, fg: C.redText },
  success: { bg: C.greenSoft, fg: C.greenText },
};

export function Pill({ text, variant = 'time', small }: { text: string; variant?: PillVariant; small?: boolean }) {
  const p = PILL[variant];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: p.bg,
        borderRadius: 999,
        paddingVertical: small ? 4 : 6,
        paddingHorizontal: small ? 8 : 10,
      }}>
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

const STEP: Partial<Record<Status, number>> = {
  REQUESTED: 1,
  ASSIGNED: 2,
  PICKED_UP: 3,
  AREA_READY: 4,
  UNLOADED: 5,
  IN_REVISION: 6,
};

/** Short UI labels (database values don't change). */
export function statusLabel(status: string, viewer?: string | null) {
  if (status === 'PICKED_UP') return 'En camino';
  if (status === 'ASSIGNED' && viewer === 'DRIVER') return 'Asignada a ti';
  return isStatus(status) ? STATUS_LABEL[status] : status;
}

/** Donation status as a 6-step progress bar plus label (replaces the colored badge). */
export function StatusProgress({
  status,
  viewer,
  size = 'card',
}: {
  status: string;
  viewer?: string | null;
  size?: 'card' | 'detail' | 'compact';
}) {
  const label = statusLabel(status, viewer);
  if (status === 'CANCELLED') {
    return <Text style={{ fontSize: 14, fontWeight: '700', color: C.redText }}>{label}</Text>;
  }
  const closed = status === 'CLOSED';
  const step = closed ? 6 : (STEP[status as Status] ?? 0);
  const h = size === 'detail' ? 8 : size === 'compact' ? 5 : 6;
  const bar = (
    <View style={{ flexDirection: 'row', gap: size === 'compact' ? 3 : 4, flex: size === 'compact' ? 1 : undefined }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View
          key={i}
          style={{ flex: 1, height: h, borderRadius: h / 2, backgroundColor: i <= step ? (closed ? C.green : C.orange) : C.border }}
        />
      ))}
    </View>
  );
  const a11y = closed ? label : `${label}, paso ${step} de 6`;
  if (size === 'compact') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessible accessibilityLabel={a11y}>
        {bar}
        <Text style={{ fontSize: 13, fontWeight: '700', color: closed ? C.greenText : C.ink }}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={a11y}>
      {bar}
      <Text style={{ fontSize: size === 'detail' ? 15 : 14, fontWeight: '700', color: closed ? C.greenText : C.ink }}>
        {label}
        {!closed ? <Text style={{ fontWeight: '500', color: C.gray }}> · paso {step} de 6</Text> : null}
      </Text>
    </View>
  );
}

/** Big number on a tinted tile. */
export function StatTile({
  label,
  value,
  unit,
  tone = 'neutral',
  style,
  big,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'neutral' | 'white' | 'green' | 'red';
  style?: StyleProp<ViewStyle>;
  big?: boolean;
}) {
  const bg = tone === 'green' ? C.greenSoft : tone === 'red' ? C.redSoft : tone === 'white' ? C.card : C.bg;
  const fg = tone === 'green' ? C.greenText : tone === 'red' ? C.redText : C.ink;
  return (
    <View style={[{ flex: 1, backgroundColor: bg, borderRadius: big ? 16 : 14, padding: big ? 14 : 12, gap: 2 }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: tone === 'neutral' || tone === 'white' ? C.gray : fg }}>{label}</Text>
      <Text style={{ fontSize: big ? 28 : 24, fontWeight: '800', color: fg }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
        {unit ? <Text style={{ fontSize: big ? 15 : 14, fontWeight: '800', color: fg }}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export function initials(name: string) {
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function Avatar({ name, size = 44, tone = 'neutral' }: { name: string; size?: number; tone?: 'neutral' | 'orange' }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone === 'orange' ? C.orangeSoft : C.neutralSoft,
      }}>
      <Text style={{ fontSize: 15, fontWeight: '800', color: tone === 'orange' ? C.orangeText : C.ink }}>{initials(name)}</Text>
    </View>
  );
}

// ───────────────────────────── feedback ─────────────────────────────

export function Loading() {
  return (
    <View style={{ flex: 1, minHeight: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator size="large" color={C.red} />
    </View>
  );
}

export function Empty({ title = 'Todo al día', text, icon = 'check' }: { title?: string; text: string; icon?: IconName }) {
  return (
    <View style={{ paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center', gap: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color={C.greenText} strokeWidth={2.4} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '700' }}>{title}</Text>
      <Text style={{ fontSize: 15, color: C.gray, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <View style={[s.notice, { backgroundColor: C.redSoft }]} accessibilityRole="alert">
      <Icon name="alert" size={20} color={C.redText} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: C.redText }}>{text}</Text>
    </View>
  );
}

export const hhmm = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** "Actualizado HH:MM" next to the tabs while online. */
export function UpdatedAt({ fromCache, savedAt }: { fromCache: boolean; savedAt: string | null }) {
  if (!savedAt || fromCache) return null;
  return <Text style={{ fontSize: 13, color: C.gray }}>Actualizado {hhmm(savedAt)}</Text>;
}

/** Offline: what the list is showing (replaces the old yellow CacheNotice). */
export function CacheNotice({ fromCache, savedAt }: { fromCache: boolean; savedAt: string | null }) {
  if (!fromCache) return null;
  return (
    <Text style={{ fontSize: 13, lineHeight: 19, color: C.gray }}>
      Mostrando lo guardado a las {hhmm(savedAt)}. Puedes seguir trabajando: los cambios se envían solos al volver la señal.
    </Text>
  );
}

export const s = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 },
  section: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  overline: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.gray },
  label: { fontSize: 14, fontWeight: '700' },
  muted: { color: C.gray, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    boxShadow: '0 2px 10px rgba(46, 46, 46, 0.05)',
  },
  disclosure: { backgroundColor: C.card, borderRadius: 16 },
  disclosureHead: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18 },
  btn: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnPrimary: { backgroundColor: C.red, boxShadow: '0 6px 16px rgba(207, 18, 38, 0.22)' },
  btnSecondary: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: C.borderStrong },
  btnDisabled: { backgroundColor: C.disabledBg, borderWidth: 0, boxShadow: 'none' },
  iconBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    height: 58,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 18,
    backgroundColor: C.red,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 8px 20px rgba(207, 18, 38, 0.32)',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
  },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 16, color: C.ink, paddingVertical: 0, ...font('500') },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inlineErrorText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: C.redText },
  stepBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choice: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chip: {
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: C.track, borderRadius: 14 },
  tab: { flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabOn: { backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(46, 46, 46, 0.10)' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14 },
});
