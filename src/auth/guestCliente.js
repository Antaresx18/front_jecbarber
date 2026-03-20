/** sessionStorage: cliente navega sin cuenta Supabase */
export const GUEST_CLIENTE_STORAGE_KEY = 'jecbarber_cliente_invitado';

/** Usuario sintético para /cliente sin sesión Auth */
export function createGuestClienteUser() {
  return {
    isGuest: true,
    rol: 'CLIENTE',
    nombre: 'Invitado',
    email: '',
  };
}
