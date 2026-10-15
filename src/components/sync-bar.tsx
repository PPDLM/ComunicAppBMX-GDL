import { Alert, Pressable, Text, View } from 'react-native';

import { discardOp, flush, useQueue } from '@/lib/offline';
import { C } from './ui';

/** Connection + pending-operations bar shown on top of every screen for field roles. */
export function SyncBar() {
  const q = useQueue();
  const pending = q.ops.length;
  if (q.online && pending === 0) return null;

  const failing = q.ops.filter((o) => o.attempts > 0);
  const text = !q.online
    ? `Sin conexión${pending ? ` · ${pending} pendiente(s) por enviar` : ''}`
    : q.syncing
      ? `Sincronizando ${pending} operación(es)…`
      : `${pending} operación(es) pendientes${failing.length ? ` · ${failing.length} con error` : ''} — toca para reintentar`;

  const onPress = () => {
    if (!failing.length) {
      void flush();
      return;
    }
    const op = failing[0];
    Alert.alert(
      'Operación con error',
      `${op.lastError ?? 'Error desconocido'}\n\nIntentos: ${op.attempts}`,
      [
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
      ],
    );
  };

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: !q.online ? '#374151' : failing.length ? '#FEE2E2' : '#FEF3C7',
          paddingVertical: 8,
          paddingHorizontal: 16,
        }}>
        <Text style={{ color: !q.online ? '#FFFFFF' : failing.length ? C.danger : C.warn, fontWeight: '600' }}>
          {text}
        </Text>
      </View>
    </Pressable>
  );
}
