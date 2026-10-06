import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MOCK_ORDERS, type Order } from '@/components/orders-data';

export default function OrdersListScreen() {
  const router = useRouter();

  const renderOrder = ({ item }: { item: Order }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pedido ${item.id}, ${item.pickupLocation}`}
      onPress={() =>
        router.push({ pathname: '/orders/[id]', params: { id: item.id } })
      }
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>{item.id}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>

      <Text style={styles.label}>Fecha</Text>
      <Text style={styles.value}>{item.date}</Text>

      <Text style={styles.label}>Lugar de recogida</Text>
      <Text style={styles.value}>{item.pickupLocation}</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Pedidos activos</Text>
      <Text style={styles.subtitle}>
        Selecciona un pedido para consultar sus detalles.
      </Text>

      <FlatList
        data={MOCK_ORDERS}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F6',
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  title: {
    color: '#172B25',
    fontSize: 27,
    fontWeight: '700',
  },
  subtitle: {
    color: '#66766F',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 20,
  },
  list: {
    paddingBottom: 28,
    gap: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3EAE6',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    elevation: 3,
    shadowColor: '#1C332A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderId: {
    color: '#146B52',
    fontSize: 18,
    fontWeight: '700',
  },
  chevron: {
    color: '#829089',
    fontSize: 28,
    lineHeight: 30,
  },
  label: {
    color: '#718078',
    fontSize: 13,
    marginTop: 7,
  },
  value: {
    color: '#263A32',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 3,
  },
});
