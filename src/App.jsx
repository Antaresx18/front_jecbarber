import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ClientView from './components/ClientView';
import BarberDashboard from './components/BarberDashboard';
import AppShell from './components/layout/AppShell';
import RequireAuth from './components/RequireAuth';
import { homePathForRole } from './auth/homePathForRole';
import { useAuth } from './hooks/useAuth';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(user.rol)} replace />;
}

export default function App() {
  return (
    <Routes>
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

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
