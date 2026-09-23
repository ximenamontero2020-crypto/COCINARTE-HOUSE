import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { validateOrdinaryPostAuthNext } from '@/utils/auth';

export default function CallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const finishOk = (redirectType?: string | null) => {
      if (cancelled) return;
      if (redirectType === 'recovery') {
        navigate('/auth/reset-password', { replace: true });
        return;
      }
      navigate(validateOrdinaryPostAuthNext(searchParams.get('next')), { replace: true });
    };

    const finishErr = (msg: string) => {
      if (cancelled) return;
      setStatus('error');
      setMessage(msg);
    };

    const run = async () => {
      const code = searchParams.get('code');
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const next = searchParams.get('next');

      // PKCE / magic-link moderno: ?code=...
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          finishErr(error.message);
          return;
        }
        const redirectType =
          data && 'redirectType' in data ? (data.redirectType as string | undefined) : undefined;
        finishOk(redirectType ?? (type === 'recovery' ? 'recovery' : null));
        return;
      }

      // Enlaces antiguos / plantillas con token_hash
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'signup' | 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change',
        });
        if (error) {
          finishErr(error.message);
          return;
        }
        finishOk(type === 'recovery' ? 'recovery' : null);
        return;
      }

      // Hash legacy (#access_token=...) — por si detectSessionInUrl está off
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.includes('access_token')) {
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            finishErr(error.message);
            return;
          }
          finishOk(params.get('type') === 'recovery' ? 'recovery' : null);
          return;
        }
      }

      finishErr(
        'No se recibió un enlace de verificación válido. Abre el correo otra vez desde el mismo dispositivo, o pide un reenvío en Crear cuenta.',
      );
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background-50 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {status === 'loading' ? (
          <>
            <i className="ri-loader-4-line animate-spin text-4xl text-primary-500" />
            <p className="text-sm text-foreground-600">Verificando tu acceso…</p>
          </>
        ) : (
          <>
            <i className="ri-error-warning-line text-4xl text-accent-500" />
            <p className="text-sm text-foreground-800">{message}</p>
            <button
              type="button"
              onClick={() => navigate('/auth', { replace: true })}
              className="rounded-md bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600"
            >
              Volver a iniciar sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
