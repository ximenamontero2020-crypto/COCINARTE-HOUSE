import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validateOrdinaryPostAuthNext } from '@/utils/auth';

type View =
  | 'login'
  | 'register'
  | 'signup-code'
  | 'forgot'
  | 'recovery-code'
  | 'set-password';

const basePath = __BASE_PATH__ === '/' ? '' : __BASE_PATH__;
const CALLBACK_URL = `${window.location.origin}${basePath}/auth/callback`;

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const destination = () => validateOrdinaryPostAuthNext(next);

  const createProfile = async (userId: string) => {
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        name: name || null,
        phone: phone || null,
        email: email || null,
      });
    } catch {
      // el perfil es secundario; no bloqueamos el acceso
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }
    navigate(destination(), { replace: true });
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: CALLBACK_URL },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session && data.user) {
      await createProfile(data.user.id);
      navigate(destination(), { replace: true });
      return;
    }
    setView('signup-code');
  };

  const handleVerifySignup = async (token: string) => {
    setError('');
    setLoading(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    if (data.user) await createProfile(data.user.id);
    navigate(destination(), { replace: true });
  };

  const handleResendSignup = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: CALLBACK_URL },
    });
    setLoading(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setInfo('Te reenviamos el código a tu correo.');
  };

  const handleForgot = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${CALLBACK_URL}?next=/auth/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setView('recovery-code');
  };

  const handleVerifyRecovery = async (token: string) => {
    setError('');
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery',
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    setView('set-password');
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate('/auth', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background-50 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 20% 15%, oklch(var(--accent-200) / 0.5), transparent 60%), radial-gradient(50% 40% at 85% 80%, oklch(var(--primary-200) / 0.5), transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-background-200 bg-background-50/90 p-8 backdrop-blur">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50">
            <i className="ri-restaurant-2-line text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground-950">COCINARTE HOUSE</h1>
          <p className="mt-1 text-sm text-foreground-600">
            Entra para pedir, jugar y ganar descuentos
          </p>
        </div>

        {(view === 'login' || view === 'register') && (
          <div className="mb-6 flex rounded-full bg-background-100 p-1">
            <button
              type="button"
              onClick={() => {
                setView('login');
                setError('');
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium transition-colors ${
                view === 'login'
                  ? 'bg-primary-500 text-background-50'
                  : 'text-foreground-600 hover:text-foreground-900'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setView('register');
                setError('');
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium transition-colors ${
                view === 'register'
                  ? 'bg-primary-500 text-background-50'
                  : 'text-foreground-600 hover:text-foreground-900'
              }`}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field
              label="Correo electrónico"
              type="email"
              icon="ri-mail-line"
              value={email}
              onChange={setEmail}
              placeholder="tu@correo.com"
              autoComplete="email"
            />
            <Field
              label="Contraseña"
              type="password"
              icon="ri-lock-line"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => {
                setView('forgot');
                setError('');
              }}
              className="self-end text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              ¿Olvidaste tu contraseña?
            </button>
            <SubmitButton loading={loading} label="Entrar" />
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Field
              label="Nombre"
              type="text"
              icon="ri-user-line"
              value={name}
              onChange={setName}
              placeholder="Tu nombre"
              autoComplete="name"
              required
            />
            <Field
              label="Teléfono"
              type="tel"
              icon="ri-phone-line"
              value={phone}
              onChange={setPhone}
              placeholder="+52 55 1234 5678"
              autoComplete="tel"
            />
            <Field
              label="Correo electrónico"
              type="email"
              icon="ri-mail-line"
              value={email}
              onChange={setEmail}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
            <Field
              label="Contraseña"
              type="password"
              icon="ri-lock-line"
              value={password}
              onChange={setPassword}
              placeholder="Crea una contraseña"
              autoComplete="new-password"
              required
            />
            <SubmitButton loading={loading} label="Crear cuenta" />
          </form>
        )}

        {view === 'signup-code' && (
          <CodeForm
            title="Verifica tu correo"
            subtitle={`Enviamos un código de 6 dígitos a ${email}. Ingresa el código para completar tu registro.`}
            loading={loading}
            onSubmit={handleVerifySignup}
            onResend={handleResendSignup}
            onChangeEmail={() => {
              setView('register');
              setError('');
            }}
          />
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-foreground-600">
              Escribe tu correo y te enviaremos un código para restablecer tu contraseña.
            </p>
            <Field
              label="Correo electrónico"
              type="email"
              icon="ri-mail-line"
              value={email}
              onChange={setEmail}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
            <SubmitButton loading={loading} label="Enviar código" />
            <button
              type="button"
              onClick={() => {
                setView('login');
                setError('');
              }}
              className="text-sm font-medium text-foreground-600 hover:text-foreground-900"
            >
              Volver a iniciar sesión
            </button>
          </form>
        )}

        {view === 'recovery-code' && (
          <CodeForm
            title="Restablecer contraseña"
            subtitle={`Enviamos un código de 6 dígitos a ${email}. Ingrésalo para continuar.`}
            loading={loading}
            onSubmit={handleVerifyRecovery}
            onResend={handleForgot}
            onChangeEmail={() => {
              setView('forgot');
              setError('');
            }}
          />
        )}

        {view === 'set-password' && (
          <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
            <p className="text-sm text-foreground-600">
              Crea una nueva contraseña para tu cuenta.
            </p>
            <Field
              label="Nueva contraseña"
              type="password"
              icon="ri-lock-line"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
            <SubmitButton loading={loading} label="Guardar contraseña" />
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-accent-100 px-3 py-2 text-sm text-accent-900">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-md bg-primary-100 px-3 py-2 text-sm text-primary-900">
            {info}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  type: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground-800">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2.5 focus-within:border-primary-400">
        <i className={`${icon} text-base text-foreground-500`} />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="w-full bg-transparent text-sm text-foreground-950 outline-none placeholder:text-foreground-400"
        />
      </div>
    </label>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <i className="ri-loader-4-line animate-spin" />}
      {label}
    </button>
  );
}

function CodeForm({
  title,
  subtitle,
  loading,
  onSubmit,
  onResend,
  onChangeEmail,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  onSubmit: (token: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const [token, setToken] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(token);
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground-950">{title}</h2>
        <p className="mt-1 text-sm text-foreground-600">{subtitle}</p>
      </div>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={token}
        onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        autoComplete="one-time-code"
        className="w-full rounded-md border border-background-300 bg-background-50 px-3 py-3 text-center text-2xl tracking-[0.5em] text-foreground-950 outline-none focus:border-primary-400"
      />
      <SubmitButton loading={loading} label="Verificar código" />
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={loading}
          className="font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
        >
          Reenviar código
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="font-medium text-foreground-600 hover:text-foreground-900"
        >
          Cambiar correo
        </button>
      </div>
    </form>
  );
}