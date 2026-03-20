/**
 * Valores del esquema SaaS (ENUM en Postgres) ↔ textos UI del mock actual.
 * Cuando el API devuelva BRONCE / PENDIENTE, normaliza aquí antes de pintar.
 */

export const rangoApiToUi = {
  BRONCE: 'Bronce',
  PLATA: 'Plata',
  ORO: 'Oro',
};

export const rangoUiToApi = {
  Bronce: 'BRONCE',
  Plata: 'PLATA',
  Oro: 'ORO',
};

export const estadoCitaApiToUi = {
  PENDIENTE: 'Pendiente',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
};

export const estadoCitaUiToApi = {
  Pendiente: 'PENDIENTE',
  Completada: 'COMPLETADA',
  Cancelada: 'CANCELADA',
  'No asistió': 'NO_ASISTIO',
};

export const metodoPagoApiToUi = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  OTRO: 'Otro',
};

export const metodoPagoUiLabel = Object.entries(metodoPagoApiToUi).map(([value, label]) => ({
  value,
  label,
}));
