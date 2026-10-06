import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import '@/lib/amplify';

const client = generateClient<Schema>();

type Rol = NonNullable<Schema['Employee']['type']['role']>;

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'admin', etiqueta: 'Administrador' },
  { valor: 'camioneros', etiqueta: 'Camioneros' },
  { valor: 'procuracion', etiqueta: 'Procuración' },
  { valor: 'almacen', etiqueta: 'Almacén' },
];

const mensajeCuenta = (m?: string) => {
  if (!m) return 'No se pudo crear la cuenta.';
  if (m.includes('already exists')) return 'Ya existe una cuenta con ese correo.';
  return m;
};

export default function CrearCuenta() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol | null>(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [cargando, setCargando] = useState(false);

  const crear = async () => {
    setError('');
    setExito('');

    const id = employeeId.trim();
    const correo = email.trim().toLowerCase();

    if (!id) return setError('Escribe el ID de empleado.');
    if (!/^\S+@\S+\.\S+$/.test(correo)) {
        return setError('Escribe un correo válido.');
    }
    if (!rol) return setError('Elige un rol.');

    setCargando(true);
    try {
      // 1) Registro en la tabla: falla rápido si el ID ya existe
      const { errors: errRegistro } = await client.models.Employee.create({
        employeeId: id,
        email: correo,
        role: rol,
      });
      if (errRegistro) {
        const m = errRegistro[0]?.message ?? '';
        return setError(
          m.toLowerCase().includes('conditional')
            ? 'Ya existe un empleado con ese ID.'
            : `No se pudo guardar el empleado: ${m}`
        );
      }

      // 2) Cuenta en Cognito (la contraseña temporal le llega por correo)
      const { errors: errCuenta } = await client.mutations.createEmployeeAccount({
        email: correo,
        role: rol,
      });
      if (errCuenta) {
        // Deshacer el registro para no dejar datos a medias
        await client.models.Employee.delete({ employeeId: id });
        return setError(mensajeCuenta(errCuenta[0]?.message));
      }

      setExito(`Cuenta creada. Se envió una contraseña temporal a ${correo}.`);
      setEmployeeId('');
      setEmail('');
      setRol(null);
    } catch (e: any) {
      setError(e?.message ?? 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  return (
    <ScrollView style={styles.fondo} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.volver}>← Volver</Text>
      </Pressable>

      <Text style={styles.title}>Crear cuenta</Text>

      <Text style={styles.label}>ID de empleado</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. 10234"
        placeholderTextColor="#888"
        autoCapitalize="none"
        value={employeeId}
        onChangeText={setEmployeeId}
      />

      <Text style={styles.label}>Correo</Text>
      <TextInput
        style={styles.input}
        placeholder="correo@ejemplo.com"
        placeholderTextColor="#888"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text style={styles.label}>Rol</Text>
      <View style={styles.roles}>
        {ROLES.map((r) => (
          <Pressable
            key={r.valor}
            onPress={() => setRol(r.valor)}
            style={[styles.chip, rol === r.valor && styles.chipActivo]}
          >
            <Text style={styles.chipTexto}>{r.etiqueta}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={crear} disabled={cargando}>
        {cargando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Crear cuenta</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {exito ? <Text style={styles.exito}>{exito}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#000' },
  container: { padding: 24, paddingTop: 60 },
  volver: { color: '#2f95f3', marginBottom: 16, fontSize: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  label: { color: '#aaa', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#555', borderRadius: 8, padding: 12, color: '#fff' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { borderWidth: 1, borderColor: '#555', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActivo: { backgroundColor: '#2f95f3', borderColor: '#2f95f3' },
  chipTexto: { color: '#fff' },
  button: { backgroundColor: '#2f95f3', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  error: { color: '#ff6b6b', marginTop: 16 },
  exito: { color: '#5fd38d', marginTop: 16 },
});