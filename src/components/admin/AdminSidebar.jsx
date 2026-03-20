import { NavLink } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Scissors,
  Receipt,
  BarChart3,
  Award,
  CalendarRange,
  Users,
} from 'lucide-react';

const linkBase =
  'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-sm font-bold whitespace-nowrap';

function linkClass(isActive) {
  return isActive
    ? `${linkBase} bg-brand-gold text-brand-dark border-amber-400/60 shadow-lg shadow-amber-900/20`
    : `${linkBase} bg-slate-900/40 text-slate-300 border-slate-700/60 hover:bg-slate-800/70 hover:border-slate-600`;
}

export default function AdminSidebar() {
  return (
    <aside
      className="w-[18rem] shrink-0 sticky top-0 self-start h-[calc(100dvh-2rem)] overflow-y-auto
      bg-brand-dark border border-slate-700/50 rounded-2xl px-3 py-4"
      aria-label="Sidebar de administración"
    >
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2">
          <Scissors size={22} className="text-brand-gold" aria-hidden />
          <span className="text-white text-base font-black tracking-tight">Panel ADMIN</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Gestión del negocio</p>
      </div>

      <nav className="space-y-2 px-2" aria-label="Secciones">
        <NavLink to="/admin/inicio" className={({ isActive }) => linkClass(isActive)} end>
          <Home size={18} className="text-brand-gold" aria-hidden />
          Inicio
        </NavLink>

        <div className="space-y-1">
          <NavLink to="/admin/operativa" className={({ isActive }) => linkClass(isActive)}>
            <LayoutDashboard size={18} className="text-brand-gold" aria-hidden />
            Gestión operativa
          </NavLink>
          <NavLink
            to="/admin/agenda"
            className={({ isActive }) =>
              `${linkClass(isActive)} ml-3 pl-3 border-l-2 border-slate-600/70 rounded-l-none`
            }
          >
            <CalendarRange size={18} className="text-brand-gold shrink-0" aria-hidden />
            Agenda diaria
          </NavLink>
        </div>

        <NavLink to="/admin/ventas" className={({ isActive }) => linkClass(isActive)}>
          <Receipt size={18} className="text-brand-gold" aria-hidden />
          Punto de venta + inventario
        </NavLink>

        <NavLink to="/admin/caja" className={({ isActive }) => linkClass(isActive)}>
          <BarChart3 size={18} className="text-brand-gold" aria-hidden />
          Cierre de caja + pagos
        </NavLink>
      </nav>

      <div className="mt-5 px-2 border-t border-slate-700/50 pt-4">
        <nav className="space-y-2" aria-label="Gestiones">
          <NavLink to="/admin/barberos" className={({ isActive }) => linkClass(isActive)}>
            <Award size={18} className="text-brand-gold" aria-hidden />
            Gestión barberos
          </NavLink>
          <NavLink to="/admin/clientes" className={({ isActive }) => linkClass(isActive)}>
            <Users size={18} className="text-brand-gold" aria-hidden />
            Gestión clientes
          </NavLink>
          <NavLink to="/admin/servicios" className={({ isActive }) => linkClass(isActive)}>
            <Scissors size={18} className="text-brand-gold" aria-hidden />
            Gestión servicios
          </NavLink>
        </nav>
      </div>
    </aside>
  );
}

