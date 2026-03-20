/**
 * @typedef {'ADMIN' | 'CLIENTE' | 'BARBERO'} RolUsuario
 */

/**
 * @typedef {Object} UsuarioSesion
 * @property {RolUsuario} rol
 * @property {string} nombre
 * @property {string} [email]
 * @property {number|string} [barberoId] — UUID (Supabase) o número en datos locales
 * @property {number|string} [clienteId] — UUID (Supabase) o número en datos locales
 */

/**
 * @typedef {Object} CitaAdmin
 * @property {number|string} id — número en mock; UUID string cuando venga del API
 * @property {string} fecha YYYY-MM-DD
 * @property {number|string} [clienteId]
 * @property {number|string} [barberoId]
 * @property {string} clienteNombre
 * @property {string} barberoNombre
 * @property {string} servicio
 * @property {string} [pedidoCliente] — lo que el cliente indicó al reservar (si vacío, se muestra el servicio)
 * @property {string} hora
 * @property {'Pendiente' | 'Completada' | 'Cancelada' | 'No asistió'} estado
 * @property {number} monto
 * @property {string} [nombreInvitado] — walk-in / reserva sin cuenta (modelo SaaS)
 * @property {string} [metodoPago] — EFECTIVO | TRANSFERENCIA | TARJETA | OTRO (API) o etiqueta UI
 * @property {number} [propina]
 * @property {number} [comisionMonto]
 * @property {string} [rangoTiempoPreview] — literal tstzrange o nota para depuración contra Postgres
 */

/**
 * @typedef {Object} ClienteRecord
 * @property {number|string} id
 * @property {string} nombre
 * @property {'Bronce' | 'Plata' | 'Oro'} rango
 * @property {number} cortes
 * @property {number} proximos
 * @property {number} [ausencias] — strikes / no asistió (BD SaaS)
 */

/**
 * @typedef {Object} GastoRecord
 * @property {number} id
 * @property {string} concepto
 * @property {number} monto
 * @property {string} categoria
 * @property {string} fecha ISO o YYYY-MM-DD
 */

export {};
