import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setInfo('Contraseña actualizada. Ya puedes iniciar sesión.');
    setTimeout(() => navigate('/auth', { replace: true }), 1500);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background-50">
        <i className="ri-loader-4-line animate-spin text-4xl text-primary-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-background-200 bg-background-50/90 p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-background-50">
            <i className="ri-lock-password-line text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-foreground-950">Nueva contraseña</h1>
        </div>

        {!hasSession ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-foreground-700">
              Tu enlace de recuperación expiró o no es válido. Solicita uno nuevo desde la pantalla
              de acceso.
            </p>
            <button
              type="button"
              onClick={() => navigate('/auth', { replace: true })}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600"
            >
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground-800">Nueva contraseña</span>
              <div className="flex items-center gap-2 rounded-md border border-background-300 bg-background-50 px-3 py-2.5 focus-within:border-primary-400">
                <i className="ri-lock-line text-base text-foreground-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-foreground-950 outline-none placeholder:text-foreground-400"
                />
              </div>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <i className="ri-loader-4-line animate-spin" />}
              Guardar contraseña
            </button>
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