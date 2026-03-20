/**
 * Estado inicial vacío: los datos reales vendrán de Supabase / API.
 * MOCK_HOY se fija al cargar el módulo (refresca la página para actualizar el “hoy” del filtro).
 */

import { addDaysIso } from '../../utils/adminFilters';

export const MOCK_HOY = new Date().toISOString().slice(0, 10);
export const MOCK_AGENDA_2SEM_FIN = addDaysIso(MOCK_HOY, 13);

export const INITIAL_BARBEROS = [];
export const INITIAL_GASTOS = [];
export const INITIAL_CLIENTES = [];
export const INITIAL_SERVICIOS = [];

export const CITAS_AGENDA_COMPLETA = [];

/** Citas del día MOCK_HOY (panel Resumen). */
export const INITIAL_CITAS = CITAS_AGENDA_COMPLETA.filter((c) => c.fecha === MOCK_HOY);

export const INITIAL_HISTORIAL_CITAS = [];

export const INITIAL_INVENTARIO = [];
export const INITIAL_INVENTARIO_BARBERO = [];

export const INITIAL_STATS = {
  ingresosTotales: 0,
  cortesMesActual: 0,
};

export const STATS_MES_ANTERIOR_MOCK = {
  ingresosTotales: 0,
  cortesMesActual: 0,
};

export const CHART_DAY_REVENUE_USD = [0, 0, 0, 0, 0, 0, 0];
