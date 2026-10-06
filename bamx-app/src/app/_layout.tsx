import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: 'Inicio',
          }}
        />

        <Stack.Screen
          name="forms"
          options={{
            title: 'Forms',
          }}
        />

        <Stack.Screen
          name="forms2"
          options={{
            title: 'Forms2',
          }}
        />

        <Stack.Screen
          name="explore"
          options={{
            title: 'Explore',
          }}
        />
        
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/crear-cuenta" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}