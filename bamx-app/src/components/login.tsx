import { confirmSignIn, signIn } from 'aws-amplify/auth';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { useSession } from '@/lib/session';
import { Button, C, Card, ErrorBox, Field, Muted } from './ui';

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  const msg = (e as Error)?.message ?? String(e);
  if (/disabled/i.test(msg)) return 'Tu cuenta está deshabilitada. Contacta al administrador.';
  if (name === 'NotAuthorizedException' || name === 'UserNotFoundException')
    return 'Correo o contraseña incorrectos.';
  if (name === 'InvalidPasswordException')
    return 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo.';
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
      const res = await signIn({ username: email.trim().toLowerCase(), password });
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
      const res = await confirmSignIn({ challengeResponse: newPassword });
      await handleStep(res.nextStep.signInStep);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: C.primary }}>ComunicApp</Text>
          <Muted>Banco de Alimentos de Guadalajara</Muted>
        </View>
        <Card>
          {step === 'signIn' ? (
            <>
              <Field
                label="Correo"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="nombre@bamx.org.mx"
              />
              <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
              <Button title="Iniciar sesión" onPress={onSignIn} loading={busy} disabled={!email || !password} />
              <Muted style={{ marginTop: 8, textAlign: 'center' }}>
                Las cuentas las crea el administrador. Si olvidaste tu contraseña, pídele que la restablezca.
              </Muted>
            </>
          ) : (
            <>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Crea tu contraseña</Text>
              <Muted style={{ marginBottom: 12 }}>
                Es tu primer inicio de sesión. Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo.
              </Muted>
              <Field label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
              <Button title="Guardar y entrar" onPress={onNewPassword} loading={busy} disabled={newPassword.length < 8} />
            </>
          )}
        </Card>
        {error ? <ErrorBox text={error} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
