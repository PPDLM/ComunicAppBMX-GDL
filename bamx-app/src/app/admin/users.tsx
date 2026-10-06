import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, C, Card, Chips, ErrorBox, Field, H2, Loading, Muted } from '@/components/ui';
import {
  type AdminUser,
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  listUsers,
  setUserRole,
} from '@/lib/admin';
import { errorMessage } from '@/lib/client';
import { ROLES, ROLE_LABEL, type Role, isRole } from '@/lib/domain';
import { MAX, cleanText } from '@/lib/format';
import { useUser } from '@/lib/session';

/** Temporary password that meets Cognito's default policy (upper, lower, number, symbol). */
function tempPassword() {
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = Array.from({ length: 6 }, () => pick('abcdefghjkmnpqrstuvwxyz23456789')).join('');
  return `Bamx-${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${base}${pick('23456789')}`;
}

export default function UsersScreen() {
  const me = useUser();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('DRIVER');
  const [password, setPassword] = useState(tempPassword());
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await fn();
      if (done) Alert.alert(done);
      await load();
    } catch (e) {
      Alert.alert('Error', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const onCreate = () =>
    act(
      'create',
      async () => {
        await createUser(email.trim().toLowerCase(), cleanText(name, MAX.short), role, password);
        setShowForm(false);
        setName('');
        setEmail('');
        setPassword(tempPassword());
      },
      `Usuario creado.\n\nEntrégale estos datos:\nCorreo: ${email.trim().toLowerCase()}\nContraseña temporal: ${password}\n\nAl entrar por primera vez deberá crear su propia contraseña.`,
    );

  if (!users && !error) return <Loading />;

  return (
    <Screen onRefresh={load}>
      {error ? <ErrorBox text={error} /> : null}

      {showForm ? (
        <Card>
          <H2>Nuevo usuario</H2>
          <Field label="Nombre completo" value={name} onChangeText={setName} />
          <Field label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Rol</Text>
          <Chips options={ROLES} value={role} onChange={setRole} labels={ROLE_LABEL} />
          <Field
            label="Contraseña temporal"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            hint="Mínimo 10 caracteres con mayúscula, minúscula, número y símbolo. Caduca en 3 días."
          />
          <Button
            title="Crear usuario"
            onPress={onCreate}
            loading={busy === 'create'}
            disabled={!name.trim() || !email.includes('@') || password.length < 10}
          />
          <Button kind="ghost" title="Cancelar" onPress={() => setShowForm(false)} />
        </Card>
      ) : (
        <Button title="+ Nuevo usuario" onPress={() => setShowForm(true)} style={{ marginBottom: 12 }} />
      )}

      {(users ?? []).map((u) => {
        const isMe = u.sub === me.sub;
        return (
          <Card key={u.username} style={!u.enabled ? { opacity: 0.6 } : undefined}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: C.text }}>
              {u.name || u.email}
              {isMe ? ' (tú)' : ''}
            </Text>
            <Muted>{u.email}</Muted>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <Badge text={isRole(u.role) ? ROLE_LABEL[u.role] : 'Sin rol'} color={u.role ? C.green : C.danger} />
              {!u.enabled ? <Badge text="Deshabilitado" color={C.danger} /> : null}
              {u.status === 'FORCE_CHANGE_PASSWORD' ? <Badge text="Aún no entra" color={C.muted} /> : null}
            </View>

            {editing === u.username ? (
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontWeight: '600', marginBottom: 6 }}>Cambiar rol</Text>
                <Chips
                  options={ROLES}
                  value={isRole(u.role) ? u.role : null}
                  onChange={(r) => act(u.username, () => setUserRole(u.email, r))}
                  labels={ROLE_LABEL}
                />
                {!isMe ? (
                  <>
                    <Button
                      kind="secondary"
                      title={u.enabled ? 'Deshabilitar (recomendado en vez de borrar)' : 'Habilitar'}
                      loading={busy === u.username}
                      onPress={() => act(u.username, () => (u.enabled ? disableUser(u.email) : enableUser(u.email)))}
                    />
                    <Button
                      kind="danger"
                      title="Eliminar cuenta"
                      onPress={() =>
                        Alert.alert(
                          'Eliminar cuenta',
                          `¿Eliminar a ${u.name || u.email}? Su nombre se conserva en el historial de donaciones, pero no podrá volver a entrar. Considera deshabilitarla.`,
                          [
                            { text: 'No', style: 'cancel' },
                            { text: 'Eliminar', style: 'destructive', onPress: () => void act(u.username, () => deleteUser(u.email)) },
                          ],
                        )
                      }
                    />
                  </>
                ) : (
                  <Muted>No puedes deshabilitar ni eliminar tu propia cuenta.</Muted>
                )}
                <Button kind="ghost" title="Listo" onPress={() => setEditing(null)} />
              </View>
            ) : (
              <Button kind="ghost" title="Administrar" onPress={() => setEditing(u.username)} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
