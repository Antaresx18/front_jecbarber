/**
 * @typedef {'ADMIN' | 'CLIENTE' | 'BARBERO'} RolUsuario
 */

/**
 * @typedef {Object} UsuarioSesion
 * @property {RolUsuario} rol
 * @property {string} nombre
 * @property {string} [email]
 * @property {number} [barberoId] — mock BARBERO: id del profesional en datos admin
 */

/**
 * @typedef {Object} CitaAdmin
 * @property {number} id
 * @property {number} clienteId
 * @property {number} barberoId
 * @property {string} clienteNombre
 * @property {string} barberoNombre
 * @property {string} servicio
 * @property {string} hora
 * @property {'Pendiente' | 'Completada'} estado
 * @property {number} monto
 */

/**
 * @typedef {Object} ClienteRecord
 * @property {number} id
 * @property {string} nombre
 * @property {'Bronce' | 'Plata' | 'Oro'} rango
 * @property {number} cortes
 * @property {number} proximos
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
