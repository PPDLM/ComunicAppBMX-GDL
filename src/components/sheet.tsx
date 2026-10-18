import DateTimePicker from '@expo/ui/community/datetime-picker';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, C, Muted, Text } from './ui';

/** Bottom sheet: dimmed backdrop, grab handle, rounded top. Tap outside or back button closes it. */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(46, 46, 46, 0.45)' }} onPress={onClose} accessibilityLabel="Cerrar" />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            maxHeight: '92%',
          }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.borderStrong }} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 16) + 14, gap: 16 }}>
            {title ? (
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.3 }}>{title}</Text>
                {subtitle ? <Muted>{subtitle}</Muted> : null}
              </View>
            ) : null}
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One row in an action sheet (admin "Más acciones", account sheet). */
export function SheetAction({
  title,
  onPress,
  danger,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 56,
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: C.divider,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: danger ? C.redText : C.ink }}>{title}</Text>
    </Pressable>
  );
}

/**
 * Native date / time picker (@expo/ui). Android opens its own dialog; iOS has no dialog,
 * so the inline picker goes inside a sheet with a "Listo" button.
 */
export function DatePicker({
  visible,
  mode = 'date',
  value,
  title,
  minimumDate,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  mode?: 'date' | 'time';
  value: Date;
  title: string;
  minimumDate?: Date;
  onConfirm: (d: Date) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  if (Platform.OS === 'android') {
    if (!visible) return null;
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        is24Hour
        minimumDate={minimumDate}
        accentColor={C.red}
        positiveButton={{ label: 'Listo' }}
        negativeButton={{ label: 'Cancelar' }}
        onValueChange={(_, d) => onConfirm(d)}
        onDismiss={onClose}
      />
    );
  }
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <DateTimePicker
        value={draft}
        mode={mode}
        display={mode === 'date' ? 'inline' : 'spinner'}
        locale="es_MX"
        minimumDate={minimumDate}
        accentColor={C.red}
        themeVariant="light"
        onValueChange={(_, d) => setDraft(d)}
        style={{ alignSelf: 'stretch', minHeight: mode === 'date' ? 340 : 200 }}
      />
      <Button size="lg" title="Listo" icon="check" onPress={() => onConfirm(draft)} />
    </Sheet>
  );
}
