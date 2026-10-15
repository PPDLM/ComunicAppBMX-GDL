import 'react-native-get-random-values';
import { Amplify } from 'aws-amplify';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import outputs from '../../amplify_outputs.json';
import { LoginScreen } from '@/components/login';
import { Button, C, H1, Loading, Muted } from '@/components/ui';
import { ROLE_LABEL } from '@/lib/domain';
import { startSyncEngine, useQueue } from '@/lib/offline';
import { SessionProvider, useSession } from '@/lib/session';

Amplify.configure(outputs);

function SignOutButton() {
  const session = useSession();
  const q = useQueue();
  if (session.status !== 'signedIn') return null;
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
    <Pressable onPress={doSignOut} hitSlop={10}>
      <Text style={{ color: C.primaryDark, fontWeight: '600' }}>Salir</Text>
    </Pressable>
  );
}

function Gate() {
  const session = useSession();
  const role = session.status === 'signedIn' ? session.user.role : null;

  useEffect(() => {
    if (role && role !== 'ADMIN') startSyncEngine();
  }, [role]);

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedOut') return <LoginScreen />;
  if (!role) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <H1>Sin rol asignado</H1>
        <Muted style={{ marginBottom: 16 }}>
          Tu cuenta ({session.user.email}) no tiene un rol. Pide al administrador que te asigne uno.
        </Muted>
        <Button title="Reintentar" onPress={() => void session.refresh()} />
        <Button kind="secondary" title="Cerrar sesión" onPress={() => void session.signOut()} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: C.text,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <SignOutButton />,
        contentStyle: { backgroundColor: C.bg },
      }}>
      <Stack.Screen name="index" options={{ title: 'ComunicApp' }} />
      <Stack.Screen name="admin/index" options={{ title: `Donaciones · ${ROLE_LABEL.ADMIN}` }} />
      <Stack.Screen name="admin/form" options={{ title: 'Donación' }} />
      <Stack.Screen name="admin/users" options={{ title: 'Usuarios' }} />
      <Stack.Screen name="admin/reports" options={{ title: 'Reportes' }} />
      <Stack.Screen name="driver/index" options={{ title: 'Mis recolecciones' }} />
      <Stack.Screen name="driver/pickup/[id]" options={{ title: 'Nota de recolección' }} />
      <Stack.Screen name="warehouse/index" options={{ title: 'Almacén' }} />
      <Stack.Screen name="inspection/index" options={{ title: 'Inspección' }} />
      <Stack.Screen name="inspection/review/[id]" options={{ title: 'Revisión' }} />
      <Stack.Screen name="donation/[id]" options={{ title: 'Detalle de donación' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Gate />
    </SessionProvider>
  );
}
