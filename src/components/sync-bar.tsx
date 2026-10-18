import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { discardOp, flush, useQueue } from '@/lib/offline';
import { Icon } from './icons';
import { C, Text } from './ui';

/**
 * Connection + pending-operations bar under the header (field roles). Hidden when online with
 * nothing pending. `adminOffline` shows the admin variant (admin works online only).
 */
export function SyncBar({ adminOffline }: { adminOffline?: boolean }) {
  const q = useQueue();

  if (adminOffline) {
    return (
      <View style={[bar, { backgroundColor: C.ink }]} accessibilityRole="alert">
        <Icon name="wifiOff" size={20} color="#FFFFFF" />
        <Text style={[txt, { color: '#FFFFFF' }]}>Sin conexión. Las funciones de administrador requieren internet.</Text>
      </View>
    );
  }

  const pending = q.ops.length;
  if (q.online && pending === 0) return null;
  const failing = q.ops.filter((o) => o.attempts > 0);

  const onPress = () => {
    if (!failing.length) {
      void flush();
      return;
    }
    const op = failing[0];
    Alert.alert('Operación con error', `${op.lastError ?? 'Error desconocido'}\n\nIntentos: ${op.attempts}`, [
      { text: 'Reintentar', onPress: () => void flush() },
      ...(op.attempts >= 3
        ? [
            {
              text: 'Descartar',
              style: 'destructive' as const,
              onPress: () =>
                Alert.alert('¿Descartar?', 'La información de esta operación se perderá.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Descartar', style: 'destructive', onPress: () => void discardOp(op.id) },
                ]),
            },
          ]
        : []),
      { text: 'Cerrar', style: 'cancel' },
    ]);
  };

  const plural = (n: number) => (n === 1 ? 'cambio' : 'cambios');
  let content;
  if (!q.online) {
    content = (
      <View style={[bar, { backgroundColor: C.ink }]}>
        <Icon name="wifiOff" size={20} color="#FFFFFF" />
        <Text style={[txt, { color: '#FFFFFF' }]}>Sin conexión{pending ? ` · ${pending} por enviar` : ''}</Text>
      </View>
    );
  } else if (failing.length && !q.syncing) {
    content = (
      <View style={[bar, { backgroundColor: C.redSoft }]}>
        <Icon name="alert" size={20} color={C.redText} />
        <Text style={[txt, { color: C.redText }]}>
          {failing.length} {plural(failing.length)} no se {failing.length === 1 ? 'pudo' : 'pudieron'} enviar
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.redText, textDecorationLine: 'underline' }}>Reintentar</Text>
      </View>
    );
  } else {
    content = (
      <View style={[bar, { backgroundColor: C.orangeSoft }]}>
        {q.syncing ? <ActivityIndicator size="small" color={C.orangeText} /> : <Icon name="refresh" size={20} color={C.orangeText} />}
        <Text style={[txt, { color: C.orangeText }]}>
          {q.syncing ? `Enviando ${pending} ${plural(pending)}…` : `${pending} ${plural(pending)} por enviar · toca para enviar`}
        </Text>
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLiveRegion="polite">
      {content}
    </Pressable>
  );
}

const bar = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  minHeight: 48,
  paddingHorizontal: 16,
  paddingVertical: 10,
  borderRadius: 14,
};
const txt = { flex: 1, fontSize: 15, fontWeight: '600' as const };
