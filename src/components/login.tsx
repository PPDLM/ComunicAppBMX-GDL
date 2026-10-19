import { confirmSignIn, signIn } from 'aws-amplify/auth';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/lib/session';
import { BrandHeader } from './header';
import { Icon, type IconName } from './icons';

const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** BAMX logo palette. */
const L = {
  orange: '#DE860B',
  red: '#CF1226',
  gray: '#5C5C5C',
  ink: '#2E2E2E',
  bg: '#F6F6F6',
  border: '#E2E2E2',
  white: '#FFFFFF',
  disabledBg: '#E4E4E4',
  placeholder: '#9A9A9A',
};

// Emails never contain spaces; Cognito passwords can't start or end with one.
const cleanEmail = (v: string) => v.replace(/\s/g, '').toLowerCase();
const cleanPassword = (v: string) => v.trim();

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as Error)?.message ?? String(e);
  if (/disabled/i.test(msg)) return 'Tu cuenta está deshabilitada. Contacta al administrador.';
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException')
    return 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
  if (name === 'InvalidPasswordException')
    return 'La contraseña debe tener al menos 10 caracteres, mayúscula, minúscula, número y símbolo.';
  if (name.startsWith('Empty')) return 'Completa todos los campos.';
  if (name === 'InvalidParameterException') return 'Revisa que el correo y la contraseña estén bien escritos.';
  if (/network/i.test(msg)) return 'Sin conexión. Necesitas internet para iniciar sesión la primera vez.';
  return msg;
}

/** Login without sign-up: accounts are created by the admin. Handles the first-login password change. */
export function LoginScreen() {
  const { refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'signIn' | 'newPassword'>('signIn');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const f: Fonts = fonts; // loaded once in the root layout

  const handleStep = async (signInStep: string) => {
    if (signInStep === 'DONE') return refresh();
    if (signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setStep('newPassword');
      return;
    }
    setError(`Paso de inicio de sesión no soportado: ${signInStep}. Contacta al administrador.`);
  };

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signIn({
        username: cleanEmail(email),
        password: cleanPassword(password),
        options: inExpoGo ? { authFlowType: 'USER_PASSWORD_AUTH' } : undefined,
      });
      await handleStep(res.nextStep.signInStep);
    } catch (e) {
      if ((e as { name?: string })?.name === 'UserAlreadyAuthenticatedException') await refresh();
      else setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const onNewPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await confirmSignIn({ challengeResponse: cleanPassword(newPassword) });
      await handleStep(res.nextStep.signInStep);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  // Typing again clears the error state.
  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    if (error) setError(null);
  };

  const signInDisabled = !cleanEmail(email) || !cleanPassword(password);
  const newPasswordDisabled = cleanPassword(newPassword).length < 10;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: L.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled">
        <BrandHeader />

        <View style={s.titleBlock}>
          <Text style={[s.title, f.bold]}>ComunicApp</Text>
          <Text style={[s.subtitle, f.medium]}>Banco de Alimentos de Guadalajara</Text>
        </View>

        <View style={s.card}>
          {step === 'signIn' ? (
            <>
              <InputField
                label="Correo"
                icon="mail"
                fonts={f}
                value={email}
                onChangeText={edit(setEmail)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                placeholder="nombre@bamx.org.mx"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <InputField
                ref={passwordRef}
                label="Contraseña"
                icon="lock"
                password
                fonts={f}
                error={error}
                value={password}
                onChangeText={edit(setPassword)}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!signInDisabled && !busy) void onSignIn();
                }}
              />
              <PrimaryButton
                title={busy ? 'Entrando…' : 'Iniciar sesión'}
                onPress={onSignIn}
                loading={busy}
                disabled={signInDisabled}
                fonts={f}
              />
              <Text style={[s.note, f.regular]}>
                Las cuentas las crea el administrador. Si olvidaste tu contraseña, pídele que la restablezca.
              </Text>
            </>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Text style={[s.stepTitle, f.bold]}>Crea tu contraseña</Text>
                <Text style={[s.note, f.regular, { textAlign: 'left' }]}>
                  Es tu primer inicio de sesión. Mínimo 10 caracteres con mayúscula, minúscula, número y símbolo.
                </Text>
              </View>
              <InputField
                label="Nueva contraseña"
                icon="lock"
                password
                fonts={f}
                error={error}
                value={newPassword}
                onChangeText={edit(setNewPassword)}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!newPasswordDisabled && !busy) void onNewPassword();
                }}
              />
              <PrimaryButton
                title={busy ? 'Guardando…' : 'Guardar y entrar'}
                onPress={onNewPassword}
                loading={busy}
                disabled={newPasswordDisabled}
                fonts={f}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Each weight is its own family; fontWeight is reset so Android doesn't fall back or fake-bold it.
const fonts = {
  regular: { fontFamily: 'PlusJakartaSans_400Regular', fontWeight: 'normal' },
  medium: { fontFamily: 'PlusJakartaSans_500Medium', fontWeight: 'normal' },
  semibold: { fontFamily: 'PlusJakartaSans_600SemiBold', fontWeight: 'normal' },
  bold: { fontFamily: 'PlusJakartaSans_700Bold', fontWeight: 'normal' },
} as const;
type Fonts = Partial<typeof fonts>;

type InputFieldProps = TextInputProps & {
  label: string;
  icon: IconName;
  fonts: Fonts;
  password?: boolean;
  error?: string | null;
  ref?: Ref<TextInput>;
};

function InputField({ label, icon, fonts: f, password, error, ref, onFocus, onBlur, ...input }: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const highlighted = focused || !!error;
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.label, f.semibold]}>{label}</Text>
      <View
        style={[
          s.field,
          password && { paddingRight: 4 },
          highlighted && { borderColor: L.red, backgroundColor: L.white },
        ]}>
        <Icon name={icon} size={18} color={error ? L.red : L.gray} />
        <TextInput
          ref={ref}
          {...input}
          secureTextEntry={password && !shown}
          placeholderTextColor={L.placeholder}
          selectionColor={L.red}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[s.input, f.medium]}
        />
        {password ? (
          <Pressable
            onPress={() => setShown((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            style={s.eye}>
            <Icon name={shown ? 'eyeOff' : 'eye'} size={20} color={L.gray} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={s.errorRow} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon name="alert" size={16} color={L.red} strokeWidth={2.2} />
          <Text style={[s.errorText, f.medium]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  fonts: f,
}: {
  title: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
  fonts: Fonts;
}) {
  // While loading the button keeps its active colors but ignores presses.
  const inactive = disabled && !loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [s.button, inactive ? s.buttonDisabled : s.buttonEnabled, pressed && { opacity: 0.85 }]}>
      {loading ? <ActivityIndicator color={L.white} style={{ marginRight: 8 }} /> : null}
      <Text style={[s.buttonText, f.bold, { color: inactive ? L.gray : L.white }]}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  titleBlock: { alignItems: 'center', gap: 4, paddingTop: 18, paddingHorizontal: 28 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.4, color: L.ink, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', color: L.gray, textAlign: 'center' },
  card: {
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: L.white,
    borderRadius: 20,
    gap: 16,
    boxShadow: '0 8px 24px rgba(46, 46, 46, 0.07)',
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: L.ink },
  label: { fontSize: 13, fontWeight: '600', color: L.gray },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 14,
    backgroundColor: L.bg,
    borderWidth: 1,
    borderColor: L.border,
    borderRadius: 12,
  },
  input: { flex: 1, minWidth: 0, height: '100%', fontSize: 16, fontWeight: '500', color: L.ink, paddingVertical: 0 },
  eye: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19.5, fontWeight: '500', color: L.red },
  button: {
    marginTop: 6,
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonEnabled: { backgroundColor: L.red, boxShadow: '0 6px 16px rgba(207, 18, 38, 0.24)' },
  buttonDisabled: { backgroundColor: L.disabledBg },
  buttonText: { fontSize: 18, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 19.5, color: L.gray, textAlign: 'center' },
});
