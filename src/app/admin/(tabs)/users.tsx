import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';

import { AppHeader } from '@/components/header';
import { Icon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { useToast } from '@/components/undo';
import { Avatar, Button, C, ChoiceGrid, Chips, Empty, ErrorBox, Fab, Field, Label, Loading, Muted, Pill, Text, haptic } from '@/components/ui';
import { type AdminUser, createUser, deleteUser, disableUser, enableUser, listUsers, setUserRole } from '@/lib/admin';
import { errorMessage } from '@/lib/client';
import { ROLE_LABEL, type Role, isRole } from '@/lib/domain';
import { MAX, cleanText } from '@/lib/format';
import { useUser } from '@/lib/session';

/** Temporary password that meets Cognito's default policy (upper, lower, number, symbol). */
function tempPassword() {
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = Array.from({ length: 6 }, () => pick('abcdefghjkmnpqrstuvwxyz23456789')).join('');
  return `Bamx-${pick('ABCDEFGHJKLMNPQRSTUVWXYZ')}${base}${pick('23456789')}`;
}

type RoleFilter = 'ALL' | Role;
const ROLE_ORDER: Role[] = ['DRIVER', 'WAREHOUSE', 'INSPECTION', 'ADMIN'];
const roleChoices = ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

export default function UsersScreen() {
  const me = useUser();
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<RoleFilter>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  /** Role changes apply at once; DESHACER puts the previous role back. */
  const changeRole = (u: AdminUser, r: Role) => {
    if (u.role === r) return;
    const prevRole = u.role;
    setUsers((list) => list?.map((x) => (x.username === u.username ? { ...x, role: r } : x)) ?? null);
    void act(u.username, () => setUserRole(u.email, r));
    toast.show({
      text: `${u.name || u.email} ahora es ${ROLE_LABEL[r]}`,
      undo: isRole(prevRole) ? () => void act(u.username, () => setUserRole(u.email, prevRole)) : undefined,
    });
  };

  if (!users && !error) return <Loading />;

  const all = users ?? [];
  const pendingFirst = all.filter((u) => u.status === 'FORCE_CHANGE_PASSWORD').length;
  const list = all
    .filter((u) => filter === 'ALL' || u.role === filter)
    .sort((a, b) => Number(!a.enabled) - Number(!b.enabled) || (a.name || a.email).localeCompare(b.name || b.email));
  const filters: RoleFilter[] = ['ALL', ...ROLE_ORDER];
  const labels = Object.fromEntries(
    filters.map((f) => [f, `${f === 'ALL' ? 'Todos' : ROLE_LABEL[f]} ${f === 'ALL' ? all.length : all.filter((u) => u.role === f).length}`]),
  ) as Record<RoleFilter, string>;

  return (
    <Screen
      header={<AppHeader title="Usuarios" subtitle={`${all.length} cuentas · ${pendingFirst} aún no ${pendingFirst === 1 ? 'entra' : 'entran'}`} />}
      onRefresh={load}
      bottomSpace={70}
      overlay={<Fab title="Nuevo usuario" onPress={() => setCreating(true)} />}
      top={<Chips scroll height={40} options={filters} value={filter} onChange={setFilter} labels={labels} />}>
      {error ? <ErrorBox text={error} /> : null}
      {users && !list.length ? <Empty title="Sin cuentas" icon="users" text="No hay usuarios con este rol." /> : null}

      {list.map((u) => {
        const isMe = u.sub === me.sub;
        const name = u.name || u.email;
        const expanded = open === u.username;
        const pill = !u.enabled ? (
          <Pill small text="Deshabilitado" variant="alert" />
        ) : u.status === 'FORCE_CHANGE_PASSWORD' ? (
          <Pill small text="Aún no entra" variant="neutral" />
        ) : null;
        if (!expanded) {
          return (
            <Pressable
              key={u.username}
              onPress={() => setOpen(u.username)}
              accessibilityRole="button"
              accessibilityState={{ expanded: false }}
              style={({ pressed }) => [row, !u.enabled && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}>
              <Avatar name={name} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800' }}>
                  {name}
                  {isMe ? <Text style={{ fontWeight: '600', color: C.gray }}> (tú)</Text> : null}
                </Text>
                <Text style={{ fontSize: 14, color: isRole(u.role) ? C.gray : C.redText }}>
                  {isRole(u.role) ? ROLE_LABEL[u.role] : 'Sin rol'}
                </Text>
              </View>
              {pill}
            </Pressable>
          );
        }
        return (
          <View key={u.username} style={[row, { flexDirection: 'column', alignItems: 'stretch', gap: 14, paddingVertical: 14, borderWidth: 2, borderColor: C.ink }]}>
            <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityState={{ expanded: true }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={name} tone="orange" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800' }}>
                  {name}
                  {isMe ? <Text style={{ fontWeight: '600', color: C.gray }}> (tú)</Text> : null}
                </Text>
                <Text style={{ fontSize: 14, color: C.gray }}>{u.email}</Text>
              </View>
              <Icon name="chevronDown" size={20} color={C.gray} />
            </Pressable>
            {pill}
            <View style={{ gap: 8 }}>
              <Label>Rol</Label>
              <ChoiceGrid<Role> label={`Rol de ${name}`} columns={2} height={48} options={roleChoices} value={isRole(u.role) ? u.role : null} onChange={(r) => changeRole(u, r)} />
            </View>
            {!isMe ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  kind="secondary"
                  title={u.enabled ? 'Deshabilitar' : 'Habilitar'}
                  loading={busy === u.username}
                  style={{ flex: 1, minHeight: 52 }}
                  onPress={() => act(u.username, () => (u.enabled ? disableUser(u.email) : enableUser(u.email)))}
                />
                <Button
                  kind="danger"
                  title="Eliminar"
                  style={{ flex: 1, minHeight: 52 }}
                  onPress={() =>
                    Alert.alert(
                      'Eliminar cuenta',
                      `¿Eliminar a ${name}? Su nombre se conserva en el historial de donaciones, pero no podrá volver a entrar. Considera deshabilitarla.`,
                      [
                        { text: 'No', style: 'cancel' },
                        { text: 'Eliminar', style: 'destructive', onPress: () => void act(u.username, () => deleteUser(u.email)) },
                      ],
                    )
                  }
                />
              </View>
            ) : (
              <Muted style={{ fontSize: 14 }}>No puedes deshabilitar ni eliminar tu propia cuenta.</Muted>
            )}
          </View>
        );
      })}

      <NewUserSheet visible={creating} onClose={() => setCreating(false)} onCreated={load} />
    </Screen>
  );
}

function NewUserSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('DRIVER');
  const [password, setPassword] = useState(tempPassword());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    if (done) {
      setName('');
      setEmail('');
      setPassword(tempPassword());
      setDone(null);
    }
    setCopied(false);
    onClose();
  };

  const create = async () => {
    setBusy(true);
    try {
      const e = email.trim().toLowerCase();
      await createUser(e, cleanText(name, MAX.short), role, password);
      haptic.success();
      setDone({ email: e, password, name: cleanText(name, MAX.short) });
      onCreated();
    } catch (err) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const message = done
    ? `Hola ${done.name}, ya tienes cuenta en ComunicApp.\nCorreo: ${done.email}\nContraseña temporal: ${done.password}\nAl entrar por primera vez deberás crear tu propia contraseña.`
    : '';

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={done ? 'Usuario creado' : 'Nuevo usuario'}
      subtitle={done ? 'Entrégale estos datos. Al entrar por primera vez creará su propia contraseña.' : undefined}>
      {done ? (
        <>
          <View style={{ backgroundColor: C.bg, borderRadius: 14, padding: 14, gap: 6 }}>
            <Muted style={{ fontSize: 14 }}>Correo</Muted>
            <Text style={{ fontSize: 17, fontWeight: '700' }} selectable>
              {done.email}
            </Text>
            <Muted style={{ fontSize: 14, marginTop: 6 }}>Contraseña temporal</Muted>
            <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: 0.5 }} selectable>
              {done.password}
            </Text>
          </View>
          <Button size="lg" icon="share" title="Compartir" onPress={() => void Share.share({ message })} />
          <Button kind="secondary" title="Listo" onPress={close} />
        </>
      ) : (
        <>
          <Field label="Nombre completo" icon="user" value={name} onChangeText={setName} />
          <Field
            label="Correo"
            icon="mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="nombre@bamx.org.mx"
          />
          <View style={{ gap: 8 }}>
            <Label>Rol</Label>
            <ChoiceGrid<Role> label="Rol" columns={2} height={48} options={roleChoices} value={role} onChange={setRole} />
          </View>
          <View style={{ gap: 8 }}>
            <Field
              label="Contraseña temporal"
              icon="lock"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              hint="Mínimo 10 caracteres con mayúscula, minúscula, número y símbolo. Caduca en 3 días."
            />
            <Button
              kind="secondary"
              size="sm"
              icon={copied ? 'check' : 'copy'}
              title={copied ? 'Copiada' : 'Copiar'}
              style={{ alignSelf: 'flex-start' }}
              onPress={async () => {
                await Clipboard.setStringAsync(password);
                setCopied(true);
              }}
            />
          </View>
          <Button
            size="lg"
            title="Crear usuario"
            onPress={create}
            loading={busy}
            disabled={!name.trim() || !email.includes('@') || password.length < 10}
          />
        </>
      )}
    </Sheet>
  );
}

const row = {
  minHeight: 72,
  backgroundColor: C.card,
  borderRadius: 16,
  paddingHorizontal: 16,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
};

