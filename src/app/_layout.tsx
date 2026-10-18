import 'react-native-get-random-values';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Amplify } from 'aws-amplify';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import outputs from '../../amplify_outputs.json';
import { BackHeader, BrandHeader } from '@/components/header';
import { LoginScreen } from '@/components/login';
import { Button, C, Loading, Muted, Text } from '@/components/ui';
import { UndoProvider } from '@/components/undo';
import { startSyncEngine } from '@/lib/offline';
import { SessionProvider, useSession } from '@/lib/session';

Amplify.configure(outputs);

// Keep the splash until the bundled fonts are ready (no network involved).
void SplashScreen.preventAutoHideAsync();

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
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
        <StatusBar style="light" />
        <BrandHeader />
        <View
          style={{
            marginTop: 24,
            marginHorizontal: 20,
            padding: 20,
            gap: 12,
            backgroundColor: C.card,
            borderRadius: 20,
            boxShadow: '0 8px 24px rgba(46, 46, 46, 0.07)',
          }}>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>Sin rol asignado</Text>
          <Muted>Tu cuenta ({session.user.email}) no tiene un rol. Pide al administrador que te asigne uno.</Muted>
          <Button icon="refresh" title="Reintentar" onPress={() => void session.refresh()} />
          <Button kind="secondary" icon="logOut" title="Cerrar sesión" onPress={() => void session.signOut()} />
        </View>
      </ScrollView>
    );
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: C.bg },
        header: ({ back, navigation }) => <BackHeader label={back?.title} onBack={navigation.goBack} />,
      }}>
      {/* Role homes draw their own AppHeader; `title` is what inner screens show as "back to". */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="admin/(tabs)" options={{ headerShown: false, title: 'Donaciones' }} />
      <Stack.Screen
        name="admin/form"
        options={({ route }) => ({
          title: 'Donación',
          header: ({ back, navigation }) => (
            <BackHeader
              label={back?.title}
              onBack={navigation.goBack}
              close={!(route.params as { id?: string } | undefined)?.id}
            />
          ),
        })}
      />
      <Stack.Screen name="driver/index" options={{ headerShown: false, title: 'Mis recolecciones' }} />
      <Stack.Screen name="driver/pickup/[id]" options={{ title: 'Nota de recolección' }} />
      <Stack.Screen name="warehouse/index" options={{ headerShown: false, title: 'Almacén' }} />
      <Stack.Screen name="inspection/index" options={{ headerShown: false, title: 'Inspección' }} />
      <Stack.Screen name="inspection/review/[id]" options={{ title: 'Revisión' }} />
      <Stack.Screen name="donation/[id]" options={{ title: 'Detalle' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError; // on error continue with the system font

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  if (!ready) return null;
  return (
    <SessionProvider>
      <UndoProvider>
        <StatusBar style="dark" />
        <Gate />
      </UndoProvider>
    </SessionProvider>
  );
}
