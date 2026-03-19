/**
 * @typedef {'ADMIN' | 'CLIENTE' | 'BARBERO'} RolUsuario
 */

/**
 * @typedef {Object} UsuarioSesion
 * @property {RolUsuario} rol
 * @property {string} nombre
 * @property {string} [email]
 * @property {number} [barberoId] — mock BARBERO: id del profesional en datos admin
 * @property {number} [clienteId] — mock CLIENTE: id en catálogo INITIAL_CLIENTES
 */

/**
 * @typedef {Object} CitaAdmin
 * @property {number} id
 * @property {string} fecha YYYY-MM-DD
 * @property {number} clienteId — enlaza con catálogo de clientes (p. ej. rango)
 * @property {number} barberoId
 * @property {string} clienteNombre
 * @property {string} barberoNombre
 * @property {string} servicio
 * @property {string} [pedidoCliente] — lo que el cliente indicó al reservar (si vacío, se muestra el servicio)
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
