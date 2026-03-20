import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, Award, Scissors } from 'lucide-react';

const itemClass = (active) =>
  `flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all rounded-lg whitespace-nowrap shrink-0 border ${
    active
      ? 'bg-brand-gold text-brand-dark border-amber-400/50 shadow-lg shadow-amber-900/25'
      : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-800/80 hover:border-slate-600/50'
  }`;

/**
 * Navegación principal del área admin: resumen / barberos (pestañas en /admin) y página de servicios.
 */
export default function AdminSubNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'resumen';

  const onAdminRoot = location.pathname === '/admin' || location.pathname === '/admin/';
  const resumenActive = onAdminRoot && tab !== 'barberos';
  const barberosActive = onAdminRoot && tab === 'barberos';
  const serviciosActive = location.pathname.endsWith('/admin/servicios');

  return (
    <nav
      aria-label="Módulos de administración"
      className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50"
    >
      <Link to="/admin?tab=resumen" className={itemClass(resumenActive)}>
        <LayoutDashboard size={16} aria-hidden />
        Resumen
      </Link>
      <Link to="/admin?tab=barberos" className={itemClass(barberosActive)}>
        <Award size={16} aria-hidden />
        Barberos
      </Link>
      <Link to="/admin/servicios" className={itemClass(serviciosActive)}>
        <Scissors size={16} aria-hidden />
        Servicios
      </Link>
    </nav>
  );
}
