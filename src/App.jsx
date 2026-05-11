import { Navigate, Route, Routes } from 'react-router-dom';
import OperativaDashboard from './components/admin/OperativaDashboard';
import GestionServicios from './components/admin/GestionServicios';
import GestionBarberos from './components/admin/GestionBarberos';
import GestionClientes from './components/admin/GestionClientes';
import AdminVentasDashboard from './components/admin/AdminVentasDashboard';
import AdminCajaDashboard from './components/admin/AdminCajaDashboard';
import AdminInicioDashboard from './components/admin/AdminInicioDashboard';
import Agenda from './components/admin/Agenda';
import Login from './components/Login';
import ClientView from './components/ClientView';
import BarberDashboard from './components/BarberDashboard';
import AppShell from './components/layout/AppShell';
import AdminLayout from './components/layout/AdminLayout';
import RequireAuth from './components/RequireAuth';
import { adminReadOnly } from './config/adminEnv';
import { homePathForRole } from './auth/homePathForRole';
import { useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/ui/LoadingSpinner';

/** `/` y `/login`: acceso con roles; si ya hay sesión (o invitado), redirige al panel. */
function RootEntry() {
  const { user, authReady } = useAuth();
  if (!authReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <LoadingSpinner label="Cargando sesión…" className="text-brand-gold" />
      </div>
    );
  }
  if (user) return <Navigate to={homePathForRole(user.rol)} replace />;
  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootEntry />} />
      <Route path="/login" element={<RootEntry />} />

      <Route
        path="/admin"
        element={
          <RequireAuth roles={['ADMIN']}>
            <AppShell>
              <AdminLayout />
            </AppShell>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<AdminInicioDashboard />} />
        <Route path="operativa" element={<OperativaDashboard readOnly={adminReadOnly} />} />
        <Route path="agenda" element={<Agenda readOnly={adminReadOnly} />} />
        <Route path="ventas" element={<AdminVentasDashboard readOnly={adminReadOnly} />} />
        <Route path="caja" element={<AdminCajaDashboard readOnly={adminReadOnly} />} />
        <Route path="barberos" element={<GestionBarberos readOnly={adminReadOnly} />} />
        <Route path="clientes" element={<GestionClientes readOnly={adminReadOnly} />} />
        <Route path="servicios" element={<GestionServicios readOnly={adminReadOnly} />} />
      </Route>
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
