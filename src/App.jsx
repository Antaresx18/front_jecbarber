import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ClientView from './components/ClientView';
import BarberDashboard from './components/BarberDashboard';
import AppShell from './components/layout/AppShell';
import RequireAuth from './components/RequireAuth';
import { homePathForRole } from './auth/homePathForRole';
import { useAuth } from './hooks/useAuth';
import { supabase } from './supabase';

function BarberosSupabaseMvp() {
  const [barberos, setBarberos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchBarberos() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase.from('barberos').select('*');

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setBarberos([]);
      } else {
        setBarberos(data ?? []);
      }
      setLoading(false);
    }

    fetchBarberos();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 py-10 text-zinc-100">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Jec Barber</h1>
        <p className="mt-1 text-sm text-zinc-400">Barberos (Supabase)</p>
      </header>

      {loading && (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
          Cargando…
        </p>
      )}

      {!loading && error && (
        <div
          className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <p className="font-medium">No se pudieron cargar los barberos</p>
          <p className="mt-1 text-red-300/90">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/50">
          {barberos.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">
              No hay barberos en la base de datos.
            </li>
          ) : (
            barberos.map((b) => (
              <li key={b.id} className="px-4 py-3 text-sm">
                <span className="font-medium text-zinc-100">{b.nombre ?? '(sin nombre)'}</span>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="text-xs text-zinc-600">
        Panel completo:{' '}
        <a href="/login" className="text-amber-500/90 underline-offset-2 hover:underline">
          /login
        </a>
      </p>
    </main>
  );
}

/** MVP Supabase en `/`; si ya hay sesión mock, entra directo al panel. */
function HomeOrMvp() {
  const { user } = useAuth();
  if (user) return <Navigate to={homePathForRole(user.rol)} replace />;
  return <BarberosSupabaseMvp />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeOrMvp />} />

      <Route path="/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AppShell>
              <AdminDashboard />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/cliente"
        element={
          <RequireAuth roles={['CLIENTE']}>
            <AppShell>
              <ClientView />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/barbero"
        element={
          <RequireAuth roles={['BARBERO']}>
            <AppShell>
              <BarberDashboard />
            </AppShell>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
