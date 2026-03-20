import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../auth/homePathForRole';
import { supabase } from '../supabase';
import { fetchSessionUser, mapAuthErrorMessage, toProfileLoadError } from '../auth/supabaseProfile';
import { isValidEmail } from '../utils/validations';
import LoadingSpinner from './ui/LoadingSpinner';

export default function Login() {
  const { user, login, authReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null });

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <LoadingSpinner label="Comprobando sesión…" className="text-brand-gold" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={homePathForRole(user.rol)} replace />;
  }

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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(mapAuthErrorMessage(authError));
        return;
      }

      if (!data.user) {
        setError('No se pudo obtener el usuario. Vuelve a intentarlo.');
        return;
      }

      let sessionUser;
      try {
        sessionUser = await fetchSessionUser(data.user);
      } catch (profileErr) {
        await supabase.auth.signOut();
        setError(toProfileLoadError(profileErr).message);
        return;
      }

      login(sessionUser);
      navigate(homePathForRole(sessionUser.rol), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-1000">
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 bg-brand-gold/15" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 bg-brand-accent/10" />
      </div>

      <div className="glass-panel max-w-md w-full p-8 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-full border border-slate-700/50 mb-4 transition-transform hover:scale-105 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Shield size={40} className="text-brand-gold" aria-hidden />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">JEC Barber</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">Inicia sesión con tu cuenta Supabase</p>
        </div>

        {error && (
          <p
            className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            role="alert"
          >
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
              El rol (admin, barbero o cliente) lo define tu fila en la tabla{' '}
              <span className="text-slate-400 font-mono">perfiles</span> en Supabase.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 text-brand-dark font-black text-lg py-4 rounded-xl transition-all disabled:opacity-70 disabled:hover:translate-y-0 shadow-lg hover:-translate-y-1 bg-brand-gold hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={24} aria-hidden />
                Verificando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
