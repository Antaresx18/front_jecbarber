/** Datos mock locales; más adelante sustituir por API. */

export const INITIAL_BARBEROS = [
  { id: 1, nombre: 'Kevin Barbero', porcentaje: 50, cortesRealizados: 45 },
  { id: 2, nombre: 'Luis Master', porcentaje: 40, cortesRealizados: 60 },
  { id: 3, nombre: 'Andrés Fade', porcentaje: 60, cortesRealizados: 30 },
];

export const INITIAL_GASTOS = [
  { id: 1, concepto: 'Alquiler Local', monto: 1200.0, categoria: 'Fijo', fecha: '2026-03-01' },
  { id: 2, concepto: 'Publicidad Facebook', monto: 150.0, categoria: 'Marketing', fecha: '2026-03-10' },
  { id: 3, concepto: 'Suministros', monto: 89.5, categoria: 'Operativo', fecha: '2026-02-15' },
];

export const INITIAL_CLIENTES = [
  {
    id: 1,
    nombre: 'Jorge Villanueva',
    rango: 'Plata',
    cortes: 8,
    proximos: 10,
    notas: 'Prefiere fade bajo',
  },
  {
    id: 2,
    nombre: 'Carlos Mendez',
    rango: 'Oro',
    cortes: 15,
    proximos: 20,
    notas: '',
  },
  {
    id: 3,
    nombre: 'Miguel Torres',
    rango: 'Bronce',
    cortes: 2,
    proximos: 5,
    notas: 'Alergia a ciertos productos',
  },
];

export const INITIAL_SERVICIOS = [
  { id: 1, nombre: 'Corte Fade VIP', precio: 25.0, duracion: 45, activo: true },
  { id: 2, nombre: 'Arreglo de Barba', precio: 15.0, duracion: 30, activo: true },
  { id: 3, nombre: 'Limpieza Facial', precio: 20.0, duracion: 25, activo: true },
];

/** Citas enlazadas por ID (no por nombre) para alinear con futuro backend. */
export const INITIAL_CITAS = [
  {
    id: 1,
    clienteId: 1,
    barberoId: 1,
    clienteNombre: 'Jorge Villanueva',
    barberoNombre: 'Kevin Barbero',
    servicio: 'Corte Fade VIP',
    hora: '10:30 AM',
    estado: 'Pendiente',
    monto: 25.0,
    notas: '',
  },
  {
    id: 2,
    clienteId: 2,
    barberoId: 2,
    clienteNombre: 'Carlos Mendez',
    barberoNombre: 'Luis Master',
    servicio: 'Arreglo de Barba',
    hora: '11:15 AM',
    estado: 'Pendiente',
    monto: 15.0,
    notas: 'Cliente VIP',
  },
];

/** Citas pasadas (historial) — mock. */
export const INITIAL_HISTORIAL_CITAS = [
  {
    id: 101,
    fecha: '2026-03-08',
    hora: '09:00 AM',
    clienteId: 1,
    barberoId: 1,
    clienteNombre: 'Jorge Villanueva',
    barberoNombre: 'Kevin Barbero',
    servicio: 'Corte Fade VIP',
    estado: 'Completada',
    monto: 25.0,
  },
  {
    id: 102,
    fecha: '2026-03-07',
    hora: '04:00 PM',
    clienteId: 3,
    barberoId: 3,
    clienteNombre: 'Miguel Torres',
    barberoNombre: 'Andrés Fade',
    servicio: 'Corte Fade VIP',
    estado: 'Completada',
    monto: 25.0,
  },
  {
    id: 103,
    fecha: '2026-03-05',
    hora: '02:30 PM',
    clienteId: 2,
    barberoId: 2,
    clienteNombre: 'Carlos Mendez',
    barberoNombre: 'Luis Master',
    servicio: 'Arreglo de Barba',
    estado: 'Cancelada',
    monto: 0,
  },
];

export const INITIAL_INVENTARIO = [
  { id: 1, nombre: 'Cera Mate Texturizante', precio: 15.0, stock: 2, stockMinimo: 3 },
  { id: 2, nombre: 'Tónico Capilar Crecimiento', precio: 25.5, stock: 1, stockMinimo: 2 },
  { id: 3, nombre: 'Afeitadora de Precisión', precio: 12.0, stock: 5, stockMinimo: 2 },
];

export const INITIAL_STATS = {
  ingresosTotales: 15450.0,
  cortesMesActual: 120,
};

/** Mock mes anterior para comparativas en resumen. */
export const STATS_MES_ANTERIOR_MOCK = {
  ingresosTotales: 13820.0,
  cortesMesActual: 105,
};

export const CHART_DAY_REVENUE_USD = [1180, 1420, 980, 2050, 1680, 2320, 2510];
