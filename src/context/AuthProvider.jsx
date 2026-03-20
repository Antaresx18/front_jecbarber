import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { fetchSessionUser } from '../auth/supabaseProfile';
import { AuthContext } from './authContextInstance';

/**
 * Sincroniza sesión Supabase + fila `perfiles` con el estado `user` del front.
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
        if (!cancelledRef.current) setUser(null);
        return;
      }
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
        const { data: { session } } = await supabase.auth.getSession();
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
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, login, logout, authReady }),
    [user, login, logout, authReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
