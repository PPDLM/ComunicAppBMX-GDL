export type Order = {
  id: string;
  date: string;
  pickupLocation: string;
  food: string;
  routeNumber: number;
  quantityKg: number;
  productType: string;
};

export const MOCK_ORDERS: Order[] = [
  {
    id: 'PED-001',
    date: '2026-10-05',
    pickupLocation: 'Almacén Central',
    food: 'Frijol',
    routeNumber: 12,
    quantityKg: 250,
    productType: 'Granos',
  },
  {
    id: 'PED-002',
    date: '2026-10-06',
    pickupLocation: 'Centro de Acopio Norte',
    food: 'Arroz',
    routeNumber: 8,
    quantityKg: 180,
    productType: 'Granos',
  },
  {
    id: 'PED-003',
    date: '2026-10-07',
    pickupLocation: 'Mercado de Abastos',
    food: 'Avena',
    routeNumber: 4,
    quantityKg: 90,
    productType: 'Cereal',
  },
];
