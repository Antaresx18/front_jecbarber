import { useCallback, useMemo, useState } from 'react';
import { AuthContext } from './authContextInstance';

const STORAGE_KEY = 'jecbarber_session';

function readStoredUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (u && typeof u.rol === 'string' && typeof u.nombre === 'string') return u;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const login = useCallback((nextUser) => {
    setUser(nextUser);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
