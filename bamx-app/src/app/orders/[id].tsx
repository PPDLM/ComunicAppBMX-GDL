import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MOCK_ORDERS } from '@/components/orders-data';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const order = MOCK_ORDERS.find((item) => item.id === id);

  if (!order) {
    return (
      <View style={styles.notFoundScreen}>
        <Text style={styles.notFoundTitle}>No encontramos ese pedido</Text>
        <Text style={styles.notFoundText}>Revisa el identificador e inténtalo de nuevo.</Text>
        <Pressable onPress={() => router.replace('/orders/index')}>
          <Text style={styles.backLink}>Volver a pedidos</Text>
        </Pressable>
      </View>
    );
  }

  const openDeliveryNoteForm = () => {
    // Cambia /forms2 cuando el formulario de tu compañero tenga su ruta definitiva.
    router.push({ pathname: '/forms2', params: { orderId: order.id } });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>PEDIDO</Text>
      <Text style={styles.title}>{order.id}</Text>
      <Text style={styles.subtitle}>Información de la recolección</Text>

      <View style={styles.card}>
        <DetailRow label="Lugar de recogida" value={order.pickupLocation} />
        <DetailRow label="Fecha" value={order.date} />
        <DetailRow label="Alimento" value={order.food} />
        <DetailRow label="No. de ruta" value={String(order.routeNumber)} />
        <DetailRow label="Cantidad" value={`${order.quantityKg} KG`} />
        <DetailRow label="Tipo de producto" value={order.productType} last />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={openDeliveryNoteForm}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Llenar Nota</Text>
      </Pressable>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.lastDetailRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  eyebrow: {
    color: '#42816D',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    color: '#172B25',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 5,
  },
  subtitle: {
    color: '#66766F',
    fontSize: 15,
    marginTop: 5,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3EAE6',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 2,
    elevation: 3,
    shadowColor: '#1C332A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  detailRow: {
    borderBottomColor: '#EAF0EC',
    borderBottomWidth: 1,
    paddingVertical: 15,
  },
  lastDetailRow: {
    borderBottomWidth: 0,
  },
  label: {
    color: '#718078',
    fontSize: 13,
    marginBottom: 5,
  },
  value: {
    color: '#263A32',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#146B52',
    borderRadius: 13,
    marginTop: 20,
    paddingHorizontal: 18,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  notFoundScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F6',
    padding: 24,
  },
  notFoundTitle: {
    color: '#172B25',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  notFoundText: {
    color: '#66766F',
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  backLink: {
    color: '#146B52',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
  },
});
