import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Lock,
  User as UserIcon,
  Shield,
  Loader2,
  Eye,
  EyeOff,
  Scissors,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { homePathForRole } from '../auth/homePathForRole';
import { supabase } from '../supabase';
import {
  fetchSessionUser,
  mapAuthErrorMessage,
  ProfileMissingError,
  toProfileLoadError,
} from '../auth/supabaseProfile';
import { isValidEmail } from '../utils/validations';
import LoadingSpinner from './ui/LoadingSpinner';

/** @typedef {'roles' | 'cliente-menu' | 'login'} LoginFlow */
/** @typedef {{ message: string, sql?: string } | null} LoginErrorState */

export default function Login() {
  const { login, enterAsGuestCliente, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [flow, setFlow] = useState(/** @type {LoginFlow} */ ('roles'));
  /** Contexto del formulario: staff (admin/barbero) o cliente con cuenta */
  const [loginHint, setLoginHint] = useState(/** @type {'admin' | 'barbero' | 'cliente' | null} */ (null));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(/** @type {LoginErrorState} */ (null));
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null });

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
        <LoadingSpinner label="Comprobando sesión…" className="text-brand-gold" />
      </div>
    );
  }

  const goRoles = () => {
    setFlow('roles');
    setLoginHint(null);
    setError(null);
    setFieldErrors({ email: null, password: null });
  };

  const handleGuestCliente = () => {
    enterAsGuestCliente();
    navigate(from && String(from).startsWith('/cliente') ? from : '/cliente', { replace: true });
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError({ message: mapAuthErrorMessage(authError) });
        return;
      }

      if (!data.user) {
        setError({ message: 'No se pudo obtener el usuario. Vuelve a intentarlo.' });
        return;
      }

      let sessionUser;
      try {
        sessionUser = await fetchSessionUser(data.user);
      } catch (profileErr) {
        await supabase.auth.signOut();
        if (profileErr instanceof ProfileMissingError) {
          setError({ message: profileErr.message, sql: profileErr.sqlSuggestion });
        } else {
          setError({ message: toProfileLoadError(profileErr).message });
        }
        return;
      }

      if (loginHint === 'admin' && sessionUser.rol !== 'ADMIN') {
        await supabase.auth.signOut();
        setError({
          message:
            'Esta cuenta no es de administrador. Elige «Barbero» o «Cliente» según tu perfil.',
        });
        return;
      }
      if (loginHint === 'barbero' && sessionUser.rol !== 'BARBERO') {
        await supabase.auth.signOut();
        setError({
          message: 'Esta cuenta no es de barbero. Prueba «Admin» o «Cliente» si corresponde.',
        });
        return;
      }
      if (loginHint === 'cliente' && sessionUser.rol !== 'CLIENTE') {
        await supabase.auth.signOut();
        setError({ message: 'Esta cuenta no está registrada como cliente.' });
        return;
      }

      login(sessionUser);
      navigate(homePathForRole(sessionUser.rol), { replace: true });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Error al iniciar sesión.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loginTitle =
    loginHint === 'admin'
      ? 'Administración'
      : loginHint === 'barbero'
        ? 'Panel barbero'
        : loginHint === 'cliente'
          ? 'Cliente — con cuenta'
          : 'Acceso';

  const loginSubtitle =
    loginHint === 'admin'
      ? 'Correo y contraseña del usuario con rol ADMIN en «perfiles».'
      : loginHint === 'barbero'
        ? 'Correo del barbero vinculado en «perfiles».'
        : loginHint === 'cliente'
          ? 'Tu cuenta debe tener rol CLIENTE en «perfiles».'
          : '';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-slate-950">
      <div className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-1000">
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 bg-brand-gold/15" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full blur-[100px] transition-colors duration-1000 bg-brand-accent/10" />
      </div>

      <div className="glass-panel max-w-lg w-full p-8 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-full border border-slate-700/50 mb-4 transition-transform hover:scale-105 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Scissors size={40} className="text-brand-gold" aria-hidden />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">JEC Barber</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            {flow === 'roles' ? '¿Cómo quieres entrar?' : loginTitle}
          </p>
        </div>

        {flow === 'roles' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 text-center mb-4">
              Elige tu tipo de acceso. Admin y barbero usan cuenta Supabase; el cliente puede entrar sin
              registrarse.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoginHint('admin');
                setFlow('login');
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-brand-gold/40 text-left transition-all group"
            >
              <div className="p-3 rounded-lg bg-brand-gold/10 border border-brand-gold/25 group-hover:bg-brand-gold/15">
                <Shield className="text-brand-gold" size={24} aria-hidden />
              </div>
              <div>
                <p className="font-black text-white">Administrador</p>
                <p className="text-xs text-slate-500 mt-0.5">Panel completo, agenda, operativa, caja…</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setLoginHint('barbero');
                setFlow('login');
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-amber-500/30 text-left transition-all group"
            >
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:bg-amber-500/15">
                <Scissors className="text-amber-400" size={24} aria-hidden />
              </div>
              <div>
                <p className="font-black text-white">Barbero</p>
                <p className="text-xs text-slate-500 mt-0.5">Tu agenda y herramientas de trabajo</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFlow('cliente-menu')}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/70 hover:border-emerald-500/30 text-left transition-all group"
            >
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 group-hover:bg-emerald-500/15">
                <UserIcon className="text-emerald-400" size={24} aria-hidden />
              </div>
              <div>
                <p className="font-black text-white">Cliente</p>
                <p className="text-xs text-slate-500 mt-0.5">Reservar o ver la app sin cuenta obligatoria</p>
              </div>
            </button>
          </div>
        )}

        {flow === 'cliente-menu' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={goRoles}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300 mb-2"
            >
              <ChevronLeft size={16} aria-hidden />
              Volver
            </button>
            <button
              type="button"
              onClick={handleGuestCliente}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl font-black text-brand-dark bg-emerald-400 hover:bg-emerald-300 transition-colors shadow-lg shadow-emerald-900/20"
            >
              <Sparkles size={20} aria-hidden />
              Continuar sin cuenta
            </button>
            <p className="text-xs text-center text-slate-500">
              Modo invitado: reservas y datos locales en este navegador. Para historial ligado a tu perfil, usa
              cuenta.
            </p>
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-slate-900/80 px-2 text-slate-500">o</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoginHint('cliente');
                setFlow('login');
              }}
              className="w-full py-3 rounded-xl border border-slate-600 text-slate-200 font-bold text-sm hover:bg-slate-800/80 transition-colors"
            >
              Ya tengo cuenta — iniciar sesión
            </button>
          </div>
        )}

        {flow === 'login' && (
          <>
            <button
              type="button"
              onClick={() => {
                if (loginHint === 'cliente') {
                  setFlow('cliente-menu');
                  setLoginHint(null);
                } else {
                  goRoles();
                }
                setError(null);
              }}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300 mb-4"
            >
              <ChevronLeft size={16} aria-hidden />
              Volver
            </button>

            {error && (
              <div
                className="mb-4 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 leading-relaxed"
                role="alert"
              >
                <p className="text-red-100">{error.message}</p>
                {error.sql ? (
                  <details className="mt-3 rounded-lg border border-slate-600/50 bg-slate-950/90 text-left">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-amber-400 hover:text-amber-300 select-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
                      <span className="text-slate-500 font-normal">▶</span>
                      Ver SQL sugerido (Supabase → SQL Editor)
                    </summary>
                    <div className="px-3 pb-3 border-t border-slate-700/60">
                      <pre className="mt-2 max-h-52 overflow-auto rounded-md bg-black/50 p-2 text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all">
                        {error.sql}
                      </pre>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(error.sql);
                          } catch {
                            /* ignore */
                          }
                        }}
                        className="mt-2 text-xs font-bold text-brand-gold hover:underline"
                      >
                        Copiar SQL al portapapeles
                      </button>
                    </div>
                  </details>
                ) : null}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-4">{loginSubtitle}</p>

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
          </>
        )}
      </div>
    </div>
  );
}
