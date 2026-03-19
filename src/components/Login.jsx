import { useState } from 'react';
import { Lock, User as UserIcon, Shield, Loader2, Scissors, User } from 'lucide-react';

export default function Login({ onLogin }) {
  const [role, setRole] = useState('ADMIN'); // 'ADMIN', 'BARBERO', 'CLIENTE'
  const [isLoading, setIsLoading] = useState(false);

  // Configuraciones temáticas por rol
  const roleConfig = {
    ADMIN: {
      title: 'Acceso VIP',
      subtitle: 'Portal de Administración',
      icon: <Shield size={40} className="text-brand-gold" />,
      email: 'admin@barberia.com',
      buttonText: 'Entrar al Dashboard'
    },
    BARBERO: {
      title: 'Soy Barbero',
      subtitle: 'Revisa tu agenda y comisiones',
      icon: <Scissors size={40} className="text-brand-accent" />,
      email: 'barbero@barberia.com',
      buttonText: 'Entrar a mi Agenda'
    },
    CLIENTE: {
      title: 'Soy Cliente',
      subtitle: 'Mira tus estadísticas y citas',
      icon: <User size={40} className="text-emerald-400" />,
      email: 'cliente@barberia.com',
      buttonText: 'Ver mi Perfil'
    }
  };

  const current = roleConfig[role];

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulación de Auth
    setTimeout(() => {
      setIsLoading(false);
      onLogin({ 
        rol: role, 
        nombre: role === 'ADMIN' ? 'Admin Master' : role === 'BARBERO' ? 'Kevin Barbero' : 'Jorge'
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Decorativo Dinámico */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-1000">
        <div className={`absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 ${role === 'ADMIN' ? 'bg-brand-gold/15' : role === 'BARBERO' ? 'bg-brand-accent/15' : 'bg-emerald-500/15'}`} />
        <div className={`absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 ${role === 'ADMIN' ? 'bg-brand-accent/10' : role === 'BARBERO' ? 'bg-brand-gold/10' : 'bg-brand-accent/10'}`} />
      </div>

      <div className="glass-panel max-w-md w-full p-8 relative z-10 animate-in zoom-in-95 duration-500">
        
        {/* Selector de Roles */}
        <div className="flex justify-between bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50 mb-8">
          {['ADMIN', 'BARBERO', 'CLIENTE'].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`flex-1 py-2 text-sm font-bold transition-all rounded-lg hover:shadow-xl ${
                role === r 
                ? 'bg-slate-700 text-white shadow-lg shadow-black/50' 
                : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-full border border-slate-700/50 mb-4 transition-transform hover:scale-105 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            {current.icon}
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">{current.title}</h2>
          <p className="text-slate-400 mt-2 text-sm font-medium">{current.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Correo Electrónico</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon size={18} className="text-slate-500" />
                </div>
                <input
                  type="email"
                  value={current.email}
                  readOnly
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-300 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-500" />
                </div>
                <input
                  type="password"
                  value="12345678"
                  readOnly
                  className="w-full bg-slate-900/50 border border-slate-700 text-slate-300 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 cursor-not-allowed tracking-widest"
                />
              </div>
            </div>
            <p className="text-xs text-center text-slate-500 italic">*Credenciales pre-cargadas para la demostración</p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 text-brand-dark font-black text-lg py-4 rounded-xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 shadow-lg hover:-translate-y-1 ${
              role === 'ADMIN' ? 'bg-brand-gold hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]' : 
              role === 'BARBERO' ? 'bg-brand-accent hover:shadow-[0_0_30px_rgba(56,189,248,0.4)]' : 
              'bg-emerald-400 hover:shadow-[0_0_30px_rgba(52,211,153,0.4)]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Verificando...
              </>
            ) : (
              current.buttonText
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
