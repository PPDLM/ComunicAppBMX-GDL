/** Domain constants shared by every screen. Code in English, labels in Spanish. */

export const ROLES = ['ADMIN', 'DRIVER', 'WAREHOUSE', 'INSPECTION'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  DRIVER: 'Chofer',
  WAREHOUSE: 'Almacén',
  INSPECTION: 'Inspección',
};

export const STATUSES = [
  'REQUESTED',
  'ASSIGNED',
  'PICKED_UP',
  'AREA_READY',
  'UNLOADED',
  'IN_REVISION',
  'CLOSED',
  'CANCELLED',
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  REQUESTED: 'Solicitada',
  ASSIGNED: 'Asignada',
  PICKED_UP: 'Recolectada / en camino',
  AREA_READY: 'Área de llegada lista',
  UNLOADED: 'Descargada',
  IN_REVISION: 'En revisión',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
};

export const STATUS_COLOR: Record<Status, string> = {
  REQUESTED: '#6B7280',
  ASSIGNED: '#2563EB',
  PICKED_UP: '#D97706',
  AREA_READY: '#7C3AED',
  UNLOADED: '#0891B2',
  IN_REVISION: '#DB2777',
  CLOSED: '#15803D',
  CANCELLED: '#B91C1C',
};

/** Timestamp field written when a donation enters each status. */
export const STATUS_TIMESTAMP: Partial<Record<Status, string>> = {
  ASSIGNED: 'assignedAt',
  PICKED_UP: 'pickedUpAt',
  AREA_READY: 'areaReadyAt',
  UNLOADED: 'unloadedAt',
  IN_REVISION: 'revisionStartedAt',
  CLOSED: 'closedAt',
  CANCELLED: 'cancelledAt',
};

/** Normal (non-admin) transitions: which role moves a donation from → to. */
export const TRANSITIONS: { from: Status; to: Status; role: Role; action: string }[] = [
  { from: 'REQUESTED', to: 'ASSIGNED', role: 'ADMIN', action: 'Asignar chofer' },
  { from: 'ASSIGNED', to: 'PICKED_UP', role: 'DRIVER', action: 'Registrar recolección' },
  { from: 'PICKED_UP', to: 'AREA_READY', role: 'WAREHOUSE', action: 'Área de llegada preparada' },
  { from: 'AREA_READY', to: 'UNLOADED', role: 'WAREHOUSE', action: 'Marcar como descargada' },
  { from: 'UNLOADED', to: 'IN_REVISION', role: 'INSPECTION', action: 'Iniciar revisión' },
  { from: 'IN_REVISION', to: 'CLOSED', role: 'INSPECTION', action: 'Cerrar revisión' },
];

export const ACTIVE_STATUSES: Status[] = [
  'REQUESTED',
  'ASSIGNED',
  'PICKED_UP',
  'AREA_READY',
  'UNLOADED',
  'IN_REVISION',
];

export const CATEGORIES = [
  'Abarrotes',
  'Frutas y verduras',
  'Lácteos',
  'Carnes y proteína',
  'Panadería',
  'Bebidas',
  'Medicamentos',
  'Higiene personal',
  'Limpieza',
  'Otro',
] as const;

export const UNITS = ['kg', 'cajas', 'piezas', 'litros', 'bolsas', 'costales'] as const;

export const DISCARD_REASONS = [
  'Caducado',
  'Dañado',
  'Contaminado',
  'No apto para consumo',
  'Otro',
] as const;

export function isStatus(s: string | null | undefined): s is Status {
  return !!s && (STATUSES as readonly string[]).includes(s);
}

export function isRole(s: string | null | undefined): s is Role {
  return !!s && (ROLES as readonly string[]).includes(s);
}

export function categoryLabel(item: { category: string; customCategory?: string | null }) {
  return item.category === 'Otro' && item.customCategory ? item.customCategory : item.category;
}
