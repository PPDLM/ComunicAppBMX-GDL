import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { C, FONT_FAMILY } from '@/components/ui';

/** Admin sections as bottom tabs; the form and donation detail stack on top (root Stack). */
export default function AdminTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.red,
        tabBarInactiveTintColor: C.gray,
        tabBarStyle: {
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          backgroundColor: '#FFFFFF',
          borderTopColor: '#ECECEC',
        },
        tabBarLabelStyle: { fontSize: 12, fontFamily: FONT_FAMILY['700'] },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Donaciones', tabBarIcon: ({ color }) => <Icon name="box" size={24} color={color as string} /> }}
      />
      <Tabs.Screen
        name="users"
        options={{ title: 'Usuarios', tabBarIcon: ({ color }) => <Icon name="users" size={24} color={color as string} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: 'Reportes', tabBarIcon: ({ color }) => <Icon name="chart" size={24} color={color as string} /> }}
      />
    </Tabs>
  );
}
