import { useState } from 'react';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ClientView from './components/ClientView';
import BarberDashboard from './components/BarberDashboard';
import { Scissors, LogOut } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null); // { rol: 'ADMIN', nombre: 'Admin' }

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center">
      <nav className="glass-panel w-full sticky top-0 z-50 rounded-none border-x-0 border-t-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-brand-gold">
          <Scissors size={28} />
          <h1 className="text-xl font-bold tracking-tight text-white">BarberMVP</h1>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-slate-400">Hola, <span className="text-white font-bold">{user.nombre}</span></span>
            <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs font-black rounded border border-slate-700/50">{user.rol}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:bg-red-500/10 text-slate-300 hover:text-red-400"
          >
            <LogOut size={18} /> Salir
          </button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl px-6 py-8">
        {user.rol === 'ADMIN' && <AdminDashboard />}
        {user.rol === 'CLIENTE' && <ClientView />}
        {user.rol === 'BARBERO' && <BarberDashboard />}
      </main>
    </div>
  );
}

export default App;
