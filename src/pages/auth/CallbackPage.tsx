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
    const code = searchParams.get('code');
    const next = searchParams.get('next');

    if (!code) {
      setStatus('error');
      setMessage('No se recibió un código de verificación.');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }
      if ('redirectType' in data && data.redirectType === 'recovery') {
        navigate('/auth/reset-password', { replace: true });
        return;
      }
      navigate(validateOrdinaryPostAuthNext(next), { replace: true });
    });
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