import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../auth/homePathForRole';
import LoadingSpinner from './ui/LoadingSpinner';

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {Array<'ADMIN' | 'CLIENTE' | 'BARBERO'>} [props.roles]
 */
export default function RequireAuth({ children, roles }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <LoadingSpinner label="Cargando sesión…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.rol)) {
    return <Navigate to={homePathForRole(user.rol)} replace />;
  }

  return children;
}
