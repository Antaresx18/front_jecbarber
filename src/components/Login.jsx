import { useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';


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
  UserPlus,
  CheckCircle2,
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
import { isTimeoutLikeError, promiseWithTimeout } from '../utils/promiseWithTimeout';
import LoadingSpinner from './ui/LoadingSpinner';

/** Evita spinner infinito si Supabase va lento o la red falla. */
const AUTH_SIGNIN_MS = 22000;
const AUTH_PROFILE_MS = 22000;

const MSG_RED_LENTA =
  'La conexión con el servidor tardó demasiado. Comprueba tu red o vuelve a intentar en unos minutos.';

/** @typedef {'roles' | 'cliente-menu' | 'login' | 'register' | 'register-ok'} LoginFlow */
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
  const [showPasswordReg, setShowPasswordReg] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(/** @type {LoginErrorState} */ (null));
  const [fieldErrors, setFieldErrors] = useState({ email: null, password: null });
  const [captchaToken, setCaptchaToken] = useState(/** @type {string | null} */ (null));
  const turnstileRef = useRef(null);


  // Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regErrors, setRegErrors] = useState({});
  const [registeredEmail, setRegisteredEmail] = useState('');

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
    setRegErrors({});
  };

  const goClienteMenu = () => {
    setFlow('cliente-menu');
    setLoginHint(null);
    setError(null);
    setRegErrors({});
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    const errs = {};
    const nombre = regNombre.trim();
    if (!nombre) errs.nombre = 'El nombre es obligatorio.';
    if (!isValidEmail(regEmail)) errs.email = 'Introduce un correo válido.';
    if (regPassword.length < 6) errs.password = 'Mínimo 6 caracteres.';
    if (regPassword !== regPassword2) errs.password2 = 'Las contraseñas no coinciden.';
    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsLoading(true);
    try {
      let signUpResult;
      try {
        signUpResult = await promiseWithTimeout(
          supabase.auth.signUp({
            email: regEmail.trim(),
            password: regPassword,
            options: {
              data: { rol: 'CLIENTE', nombre },
            },
          }),
          AUTH_SIGNIN_MS,
          'AUTH_SIGNIN_TIMEOUT'
        );
      } catch (signUpNetErr) {
        if (isTimeoutLikeError(signUpNetErr)) {
          setError({ message: MSG_RED_LENTA });
          return;
        }
        throw signUpNetErr;
      }

      const { data, error: signUpError } = signUpResult;

      if (signUpError) {
        const msg = signUpError.message ?? '';
        if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already been registered')) {
          setError({ message: 'Ya existe una cuenta con ese correo. Usa «Ya tengo cuenta».' });
        } else {
          setError({ message: mapAuthErrorMessage(signUpError) || 'No se pudo crear la cuenta.' });
        }
        return;
      }

      // Si email confirmation desactivado en Supabase → hay sesión directa
      if (data?.session && data?.user) {
        const loadProfile = () =>
          promiseWithTimeout(fetchSessionUser(data.user), AUTH_PROFILE_MS, 'PROFILE_TIMEOUT');

        let sessionUser;
        try {
          sessionUser = await loadProfile();
        } catch (first) {
          if (isTimeoutLikeError(first)) {
            await supabase.auth.signOut();
            setError({ message: MSG_RED_LENTA });
            return;
          }
          await new Promise((r) => setTimeout(r, 1200));
          try {
            sessionUser = await loadProfile();
          } catch (second) {
            if (isTimeoutLikeError(second)) {
              await supabase.auth.signOut();
              setError({ message: MSG_RED_LENTA });
              return;
            }
          }
        }
        if (sessionUser) {
          login(sessionUser);
          navigate(homePathForRole(sessionUser.rol), { replace: true });
          return;
        }
      }

      // Email confirmation activa → mostrar pantalla de éxito
      setRegisteredEmail(regEmail.trim());
      setFlow('register-ok');
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Error al registrarse.' });
    } finally {
      setIsLoading(false);
    }
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
      // 1. Verify reCAPTCHA token via Edge Function
      if (!captchaToken) {
        setError({ message: 'Por favor, completa el captcha.' });
        setIsLoading(false);
        return;
      }

      const { data: verificationData, error: verificationError } = await supabase.functions.invoke(
        'verify-captcha',
        {
          body: { token: captchaToken },
        }
      );

      if (verificationError || !verificationData.success) {
        setError({ message: 'La verificación del captcha falló. Inténtalo de nuevo.' });
        setIsLoading(false);
        turnstileRef.current?.reset();
        setCaptchaToken(null);
        return;
      }

      let signInResult;

      try {
        signInResult = await promiseWithTimeout(
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
            options: {
              captchaToken: captchaToken || undefined,
            },
          }),

          AUTH_SIGNIN_MS,
          'AUTH_SIGNIN_TIMEOUT'
        );
      } catch (netErr) {
        if (isTimeoutLikeError(netErr)) {
          setError({ message: MSG_RED_LENTA });
          return;
        }
        throw netErr;
      }

      const { data, error: authError } = signInResult;

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
        sessionUser = await promiseWithTimeout(
          fetchSessionUser(data.user),
          AUTH_PROFILE_MS,
          'PROFILE_TIMEOUT'
        );
      } catch (profileErr) {
        await supabase.auth.signOut();
        if (isTimeoutLikeError(profileErr)) {
          setError({ message: MSG_RED_LENTA });
        } else if (profileErr instanceof ProfileMissingError) {
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
      // Reset captcha after attempt
      turnstileRef.current?.reset();
      setCaptchaToken(null);
    }
  };

  const loginTitle =
    flow === 'register'
      ? 'Crear cuenta cliente'
      : flow === 'register-ok'
        ? '¡Cuenta creada!'
        : loginHint === 'admin'
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

      <div className="glass-panel max-w-lg w-full p-6 sm:p-8 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-slate-900 rounded-full border border-slate-700/50 mb-4 transition-transform hover:scale-105 duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Scissors size={40} className="text-brand-gold" aria-hidden />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">JEC Barber</h1>
          <p className="text-slate-400 mt-2 text-sm font-medium">
            {flow === 'roles'
            ? '¿Cómo quieres entrar?'
            : flow === 'cliente-menu'
              ? 'Acceso cliente'
              : loginTitle}
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
          <div className="space-y-3">
            <button
              type="button"
              onClick={goRoles}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300 mb-2"
            >
              <ChevronLeft size={16} aria-hidden />
              Volver
            </button>

            {/* Crear cuenta nueva */}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRegErrors({});
                setFlow('register');
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-all group"
            >
              <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                <UserPlus className="text-emerald-400" size={22} aria-hidden />
              </div>
              <div>
                <p className="font-black text-white">Crear cuenta</p>
                <p className="text-xs text-slate-400 mt-0.5">Nombre, correo y contraseña — acumulas rango y cortes</p>
              </div>
            </button>

            {/* Ya tengo cuenta */}
            <button
              type="button"
              onClick={() => {
                setLoginHint('cliente');
                setFlow('login');
              }}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/70 text-left transition-all"
            >
              <div className="p-3 rounded-lg bg-slate-700/30 border border-slate-600/50">
                <Lock className="text-slate-300" size={22} aria-hidden />
              </div>
              <div>
                <p className="font-black text-white">Ya tengo cuenta</p>
                <p className="text-xs text-slate-400 mt-0.5">Iniciar sesión con correo y contraseña</p>
              </div>
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-700/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wide">
                <span className="bg-slate-900/80 px-2 text-slate-500">o sin cuenta</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGuestCliente}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm text-slate-300 border border-slate-700/60 hover:bg-slate-800/50 transition-colors"
            >
              <Sparkles size={18} className="text-emerald-400" aria-hidden />
              Continuar sin cuenta
            </button>
            <p className="text-xs text-center text-slate-500">
              Reserva sin registrarte; este navegador guarda la referencia. Sin historial de rango.
            </p>
          </div>
        )}

        {/* ───── FORMULARIO REGISTRO ───── */}
        {flow === 'register' && (
          <>
            <button
              type="button"
              onClick={goClienteMenu}
              className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-300 mb-4"
            >
              <ChevronLeft size={16} aria-hidden />
              Volver
            </button>

            {error && (
              <div
                className="mb-4 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                role="alert"
              >
                <p className="text-red-100">{error.message}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4" noValidate>
              {/* Nombre */}
              <div>
                <label htmlFor="reg-nombre" className="block text-sm font-bold text-slate-400 mb-1.5">
                  Tu nombre
                </label>
                <input
                  id="reg-nombre"
                  type="text"
                  autoComplete="name"
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  placeholder="Ej. Jorge Pérez"
                  className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 ${
                    regErrors.nombre ? 'border-red-500/60' : 'border-slate-700'
                  }`}
                />
                {regErrors.nombre && <p className="text-xs text-red-400 mt-1">{regErrors.nombre}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="reg-email" className="block text-sm font-bold text-slate-400 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 ${
                    regErrors.email ? 'border-red-500/60' : 'border-slate-700'
                  }`}
                />
                {regErrors.email && <p className="text-xs text-red-400 mt-1">{regErrors.email}</p>}
              </div>

              {/* Contraseña */}
              <div>
                <label htmlFor="reg-password" className="block text-sm font-bold text-slate-400 mb-1.5">
                  Contraseña <span className="text-slate-500 font-normal">(mínimo 6 caracteres)</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPasswordReg ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 pl-4 pr-11 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 tracking-wide ${
                      regErrors.password ? 'border-red-500/60' : 'border-slate-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordReg((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    aria-label={showPasswordReg ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPasswordReg ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {regErrors.password && <p className="text-xs text-red-400 mt-1">{regErrors.password}</p>}
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label htmlFor="reg-password2" className="block text-sm font-bold text-slate-400 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="reg-password2"
                  type={showPasswordReg ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={regPassword2}
                  onChange={(e) => setRegPassword2(e.target.value)}
                  className={`w-full bg-slate-900/50 border text-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 tracking-wide ${
                    regErrors.password2 ? 'border-red-500/60' : 'border-slate-700'
                  }`}
                />
                {regErrors.password2 && <p className="text-xs text-red-400 mt-1">{regErrors.password2}</p>}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-brand-dark font-black text-base py-3.5 rounded-xl transition-all disabled:opacity-70 shadow-lg bg-emerald-500 hover:bg-emerald-400"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} aria-hidden />
                    Creando cuenta…
                  </>
                ) : (
                  <>
                    <UserPlus size={20} aria-hidden />
                    Crear cuenta
                  </>
                )}
              </button>

              <p className="text-xs text-center text-slate-500">
                Al registrarte aceptas el uso de tus datos para la gestión de citas en el salón.
              </p>
            </form>
          </>
        )}

        {/* ───── REGISTRO OK ───── */}
        {flow === 'register-ok' && (
          <div className="text-center space-y-5">
            <div className="inline-flex items-center justify-center p-5 bg-emerald-500/10 rounded-full border border-emerald-500/30">
              <CheckCircle2 size={48} className="text-emerald-400" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">¡Cuenta creada!</h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                Enviamos un correo de confirmación a{' '}
                <strong className="text-slate-200">{registeredEmail}</strong>. Haz clic en el enlace para
                activar tu cuenta y luego inicia sesión.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoginHint('cliente');
                setFlow('login');
              }}
              className="w-full py-3 rounded-xl bg-brand-gold text-brand-dark font-black text-sm hover:brightness-110 transition-all"
            >
              Ir a iniciar sesión
            </button>
            <button
              type="button"
              onClick={goRoles}
              className="text-xs text-slate-500 hover:text-slate-300 font-bold"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {flow === 'login' && (
          <>
            <button
              type="button"
              onClick={() => {
                if (loginHint === 'cliente') {
                  goClienteMenu();
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

              <div className="flex justify-center my-4 overflow-hidden rounded-xl">
                <ReCAPTCHA
                  ref={turnstileRef}
                  sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
                  onChange={(token) => setCaptchaToken(token)}
                  onExpired={() => setCaptchaToken(null)}
                  theme="dark"
                />
              </div>


              <button
                type="submit"
                disabled={isLoading || !captchaToken}
                className="w-full flex items-center justify-center gap-2 text-brand-dark font-black text-lg py-4 rounded-xl transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed shadow-lg hover:-translate-y-1 bg-brand-gold hover:shadow-[0_0_30px_rgba(234,179,8,0.4)]"
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
