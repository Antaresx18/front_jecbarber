import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { fetchSessionUser } from '../auth/supabaseProfile';
import {
  createGuestClienteUser,
  GUEST_CLIENTE_STORAGE_KEY,
} from '../auth/guestCliente';
import { AuthContext } from './authContextInstance';

function readGuestFlag() {
  try {
    return sessionStorage.getItem(GUEST_CLIENTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setGuestFlag(on) {
  try {
    if (on) sessionStorage.setItem(GUEST_CLIENTE_STORAGE_KEY, '1');
    else sessionStorage.removeItem(GUEST_CLIENTE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Sincroniza sesión Supabase + fila `perfiles` con el estado `user` del front.
 * Cliente invitado: sin Auth, persistido en sessionStorage.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const cancelledRef = useRef(false);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    cancelledRef.current = false;

    async function syncSessionToUser(session) {
      if (!session?.user) {
        if (readGuestFlag()) {
          if (!cancelledRef.current) setUser(createGuestClienteUser());
        } else if (!cancelledRef.current) {
          setUser(null);
        }
        return;
      }
      setGuestFlag(false);
      try {
        const u = await fetchSessionUser(session.user);
        if (!cancelledRef.current) setUser(u);
      } catch {
        await supabase.auth.signOut();
        if (!cancelledRef.current) setUser(null);
      }
    }

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelledRef.current) return;
        await syncSessionToUser(session);
      } catch {
        /* ignore */
      } finally {
        if (!cancelledRef.current) setAuthReady(true);
      }

      if (cancelledRef.current) return;

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setTimeout(async () => {
          if (cancelledRef.current) return;
          await syncSessionToUser(session);
          if (!cancelledRef.current) setAuthReady(true);
        }, 0);
      });
      subscriptionRef.current = data.subscription;
    })();

    return () => {
      cancelledRef.current = true;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, []);

  /** Tras `signInWithPassword` en Login, actualiza el contexto al instante. */
  const login = useCallback((nextUser) => {
    setGuestFlag(false);
    setUser(nextUser);
  }, []);

  const enterAsGuestCliente = useCallback(() => {
    setGuestFlag(true);
    setUser(createGuestClienteUser());
  }, []);

  const logout = useCallback(async () => {
    setGuestFlag(false);
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, enterAsGuestCliente, authReady }),
    [user, login, logout, enterAsGuestCliente, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
