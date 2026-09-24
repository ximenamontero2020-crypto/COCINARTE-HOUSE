import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStaffRole } from '@/hooks/useStaffRole';

const NO_ACCESS = 'No tienes acceso al panel de staff. Pide que te activen.';

export default function StaffLoginPage() {
  const { isStaff, loading } = useStaffRole();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isStaff && !submitting) return <Navigate to="/staff" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError || !data.user) {
      setError('Correo o contraseña incorrectos.');
      setSubmitting(false);
      return;
    }

    // La UI decide con el rol; la seguridad real está en RLS (is_staff()).
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (profile?.role !== 'staff' && profile?.role !== 'admin') {
      await supabase.auth.signOut();
      setError(NO_ACCESS);
      setSubmitting(false);
      return;
    }

    const { error: auditError } = await supabase.rpc('log_staff_login');
    if (auditError) console.error('No se pudo registrar el login en auditoría:', auditError);
    navigate('/staff', { replace: true });
  };

  const inputClass =
    'w-full rounded-md border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400';

  return (
    <main className="flex min-h-screen items-center justify-center bg-background-100 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-background-200/70 bg-background-50 p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Back-office</p>
        <h1 className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">
          Staff · COCINARTE <span className="text-accent-500">HOUSE</span>
        </h1>
        <p className="mt-2 text-sm text-foreground-600">Acceso para el equipo de operación de la cafetería.</p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs font-medium text-foreground-600 mb-1.5">Correo</label>
            <input id="staff-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-xs font-medium text-foreground-600 mb-1.5">Contraseña</label>
            <input id="staff-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>

          {error && (
            <p role="alert" className="text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full rounded-full py-3 font-semibold text-sm transition-colors whitespace-nowrap ${
              submitting ? 'bg-background-200 text-foreground-400 cursor-not-allowed' : 'bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer'
            }`}
          >
            {submitting ? 'Entrando…' : 'Entrar al panel'}
          </button>
        </form>
      </div>
    </main>
  );
}
