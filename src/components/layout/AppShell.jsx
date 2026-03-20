import { Link, useNavigate } from 'react-router-dom';
import { Scissors, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center">
      <nav className="glass-panel w-full sticky top-0 z-50 rounded-none border-x-0 border-t-0 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-brand-gold hover:opacity-90 transition-opacity">
          <Scissors size={28} aria-hidden />
          <span className="text-xl font-bold tracking-tight text-white">JEC Barber</span>
        </Link>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 mr-2 sm:mr-4">
            <span className="text-sm text-slate-400">
              Hola, <span className="text-white font-bold">{user?.nombre}</span>
            </span>
            <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs font-black rounded border border-slate-700/50">
              {user?.isGuest ? 'Invitado' : user?.rol}
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-red-500/10 text-slate-300 hover:text-red-400"
          >
            <LogOut size={18} aria-hidden />
            Salir
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
