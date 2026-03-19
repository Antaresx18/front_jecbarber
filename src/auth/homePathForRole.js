const HOME_BY_ROLE = {
  ADMIN: '/admin',
  CLIENTE: '/cliente',
  BARBERO: '/barbero',
};

/** @param {string} rol */
export function homePathForRole(rol) {
  return HOME_BY_ROLE[rol] || '/login';
}
