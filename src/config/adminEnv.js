/** Solo lectura: oculta acciones destructivas o de edición (demo / rol restringido). */
export const adminReadOnly = import.meta.env.VITE_ADMIN_READONLY === 'true';

export const enableHistorialTab = import.meta.env.VITE_ENABLE_HISTORIAL !== 'false';
