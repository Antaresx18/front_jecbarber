import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Shield, Loader2, Scissors, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../auth/homePathForRole';
import { loginWithMock } from '../services/api';
import { isValidEmail } from '../utils/validations';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('ADMIN');
  const [email, setEmail] = useState('admin@barberia.com');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null });

  const roleConfig = {
    ADMIN: {
      title: 'Acceso VIP',
      subtitle: 'Portal de Administración',
      icon: <Shield size={40} className="text-brand-gold" aria-hidden />,
      defaultEmail: 'admin@barberia.com',
      buttonText: 'Entrar al Dashboard',
    },
    BARBERO: {
      title: 'Soy Barbero',
      subtitle: 'Revisa tu agenda y comisiones',
      icon: <Scissors size={40} className="text-brand-accent" aria-hidden />,
      defaultEmail: 'barbero@barberia.com',
      buttonText: 'Entrar a mi Agenda',
    },
    CLIENTE: {
      title: 'Soy Cliente',
      subtitle: 'Mira tus estadísticas y citas',
      icon: <User size={40} className="text-emerald-400" aria-hidden />,
      defaultEmail: 'cliente@barberia.com',
      buttonText: 'Ver mi Perfil',
    },
  };

  const current = roleConfig[role];

  if (user) {
    return <Navigate to={homePathForRole(user.rol)} replace />;
  }

  const handleRoleChange = (r) => {
    setRole(r);
    setError(null);
    setFieldErrors({ email: null, password: null });
    setEmail(roleConfig[r].defaultEmail);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const fe = { email: null, password: null };
    if (!isValidEmail(email)) fe.email = 'Introduce un correo válido.';
    if (!password.trim()) fe.password = 'La contraseña es obligatoria.';
    setFieldErrors(fe);
    if (fe.email || fe.password) return;

    setIsLoading(true);
    try {
      const session = await loginWithMock(email, password, role);
      login(session);
      navigate(homePathForRole(session.rol), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-1000">
        <div
          className={`absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 ${role === 'ADMIN' ? 'bg-brand-gold/15' : role === 'BARBERO' ? 'bg-brand-accent/15' : 'bg-emerald-500/15'}`}
        />
        <div
          className={`absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 ${role === 'ADMIN' ? 'bg-brand-accent/10' : role === 'BARBERO' ? 'bg-brand-gold/10' : 'bg-brand-accent/10'}`}
        />
      </div>

      <div className="glass-panel max-w-md w-full p-8 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="flex justify-between bg-slate-900/80 p-1.5 rounded-xl border border-slate-700/50 mb-8">
          {['ADMIN', 'BARBERO', 'CLIENTE'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
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
          <h1 className="text-3xl font-black text-white tracking-tight">{current.title}</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">{current.subtitle}</p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-bold text-slate-400 mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon size={18} className="text-slate-500" aria-hidden />
                </div>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 ${
                    fieldErrors.email ? 'border-red-500/60' : 'border-slate-700'
                  }`}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-err' : undefined}
                />
              </div>
              {fieldErrors.email && (
                <p id="email-err" className="text-xs text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-bold text-slate-400 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={18} className="text-slate-500" aria-hidden />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 tracking-wide ${
                    fieldErrors.password ? 'border-red-500/60' : 'border-slate-700'
                  }`}
                  aria-invalid={!!fieldErrors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>
              )}
            </div>
            <p className="text-xs text-center text-slate-500">
              Demo: contraseña <span className="text-slate-400 font-mono">12345678</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-2 text-brand-dark font-black text-lg py-4 rounded-xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 shadow-lg hover:-translate-y-1 ${
              role === 'ADMIN'
                ? 'bg-brand-gold hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]'
                : role === 'BARBERO'
                  ? 'bg-brand-accent hover:shadow-[0_0_30px_rgba(56,189,248,0.4)]'
                  : 'bg-emerald-400 hover:shadow-[0_0_30px_rgba(52,211,153,0.4)]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={24} aria-hidden />
                Verificando…
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
