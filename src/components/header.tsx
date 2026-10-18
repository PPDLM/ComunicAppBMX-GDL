import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, ClipPath, Defs, G } from 'react-native-svg';

import { ROLE_LABEL, isRole } from '@/lib/domain';
import { useQueue } from '@/lib/offline';
import { useSession } from '@/lib/session';
import { Icon } from './icons';
import { Sheet } from './sheet';
import { Button, C, IconButton, Muted, Text, initials } from './ui';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "Sábado 18 de octubre" */
export function todayLong(d = new Date()) {
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/**
 * Header of each role's home: orange circle top-right, title + subtitle, and the account button
 * (initials) that opens a sheet with the user and "Cerrar sesión".
 */
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const height = top + 85;
  const cx = width - 18;
  const cy = -30;
  const btnCx = width - 44; // account button center (20 from the edge, 48 wide)
  const btnCy = top + 32;
  return (
    <View style={{ height, backgroundColor: C.bg }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <ClipPath id="app-header">
            <Circle cx={cx} cy={cy} r={130} />
          </ClipPath>
        </Defs>
        <Circle cx={cx} cy={cy} r={130} fill={C.orange} />
        <G clipPath="url(#app-header)" fill="none" stroke="#FFFFFF" strokeWidth={1.5}>
          <Circle cx={btnCx} cy={btnCy} r={40} strokeOpacity={0.24} />
          <Circle cx={btnCx} cy={btnCy} r={62} strokeOpacity={0.15} />
          <Circle cx={btnCx} cy={btnCy} r={86} strokeOpacity={0.09} />
        </G>
        <Circle cx={cx} cy={cy} r={130} fill="none" stroke={C.red} strokeWidth={3} />
      </Svg>
      <View style={{ position: 'absolute', left: 20, right: 88, top: top + 11 }}>
        <Text style={{ fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ marginTop: 2, fontSize: 14, fontWeight: '500', color: C.gray }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ position: 'absolute', right: 20, top: top + 8 }}>
        <AccountButton />
      </View>
    </View>
  );
}

/** Initials button + account sheet. Keeps the old sign-out warning about unsent operations. */
function AccountButton() {
  const session = useSession();
  const q = useQueue();
  const [open, setOpen] = useState(false);
  if (session.status !== 'signedIn') return null;
  const { user } = session;
  const name = user.name || user.email;

  const doSignOut = () => {
    if (q.ops.length) {
      Alert.alert(
        'Hay información sin enviar',
        `Tienes ${q.ops.length} operación(es) pendientes. Si cierras sesión ahora se enviarán cuando vuelvas a entrar con esta misma cuenta.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cerrar sesión', style: 'destructive', onPress: () => void session.signOut() },
        ],
      );
    } else {
      void session.signOut();
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Cuenta de ${name}`}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(46, 46, 46, 0.14)',
          opacity: pressed ? 0.85 : 1,
        })}>
        <Text style={{ fontSize: 15, fontWeight: '700' }}>{initials(name)}</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.orangeSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.orangeText }}>{initials(name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '800' }}>{name}</Text>
            <Muted>{user.email}</Muted>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.orangeText, marginTop: 2 }}>
              {isRole(user.role) ? ROLE_LABEL[user.role] : 'Sin rol'}
            </Text>
          </View>
        </View>
        {q.ops.length ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="refresh" size={18} color={C.orangeText} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.orangeText }}>
              {q.ops.length} cambio(s) por enviar
            </Text>
          </View>
        ) : null}
        <Button
          kind="secondary"
          icon="logOut"
          title="Cerrar sesión"
          onPress={() => {
            setOpen(false);
            doSignOut();
          }}
        />
      </Sheet>
    </>
  );
}

/**
 * Inner screens: small orange circle, round back button (or X on "new" forms) and the
 * previous screen's name. The big title lives in the content.
 */
export function BackHeader({ label, onBack, close }: { label?: string; onBack: () => void; close?: boolean }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = insets.top;
  const height = top + 57;
  return (
    <View style={{ height, backgroundColor: C.bg }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={width + 14} cy={-24} r={92} fill={C.orange} />
        <Circle cx={width + 14} cy={-24} r={92} fill="none" stroke={C.red} strokeWidth={3} />
      </Svg>
      <View style={{ position: 'absolute', left: 12, top: top + 3, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconButton
          round
          icon={close ? 'x' : 'chevronLeft'}
          color={C.ink}
          label={close ? 'Cerrar' : label ? `Volver a ${label}` : 'Volver'}
          onPress={onBack}
          style={{ borderRadius: 24 }}
        />
        {label ? (
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.gray }} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const BRAND_H = 300;
const RINGS = [
  { r: 104, o: 0.22 },
  { r: 144, o: 0.16 },
  { r: 188, o: 0.11 },
  { r: 236, o: 0.07 },
];

/** Login / "Sin rol": big orange half-circle with rings and the BAMX logo (DISENO_LOGIN.md). */
export function BrandHeader() {
  const { width } = useWindowDimensions();
  const cx = width / 2;
  return (
    <View style={{ height: BRAND_H }}>
      <Svg width={width} height={BRAND_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="brand-header">
            <Circle cx={cx} cy={-100} r={320} />
          </ClipPath>
        </Defs>
        <Circle cx={cx} cy={-100} r={320} fill={C.orange} />
        <G clipPath="url(#brand-header)" fill="none" stroke="#FFFFFF" strokeWidth={1.5}>
          {RINGS.map(({ r, o }) => (
            <Circle key={r} cx={cx} cy={206} r={r} strokeOpacity={o} />
          ))}
        </G>
        <Circle cx={cx} cy={-100} r={320} fill="none" stroke={C.red} strokeWidth={4} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 132,
          alignSelf: 'center',
          width: 148,
          height: 148,
          borderRadius: 74,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(46, 46, 46, 0.10)',
        }}>
        <Image
          source={require('../../assets/images/bamx-logo.png')}
          style={{ width: 116, aspectRatio: 306 / 210 }}
          contentFit="contain"
          accessibilityLabel="BAMX Guadalajara — Bancos de Alimentos de México"
        />
      </View>
    </View>
  );
}
