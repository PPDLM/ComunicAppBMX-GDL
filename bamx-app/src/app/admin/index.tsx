import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'aws-amplify/auth';
import '@/lib/amplify';

export default function Admin() {
  const router = useRouter();

  const salir = async () => {
    await signOut();
    router.replace('/login' as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Panel de administrador</Text>
      <Pressable style={styles.button} onPress={() => router.push('/admin/crear-cuenta' as any)}>
        <Text style={styles.buttonText}>Crear cuenta</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={salir}>
        <Text style={styles.buttonText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  text: { color: '#aaa', marginBottom: 24 },
  button: { backgroundColor: '#333', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});