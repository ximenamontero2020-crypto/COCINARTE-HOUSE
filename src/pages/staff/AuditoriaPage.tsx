import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useStaffRole } from '@/hooks/useStaffRole';

type AuditRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export default function AuditoriaPage() {
  const { role, loading } = useStaffRole();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (role !== 'admin') return;
    supabase
      .from('staff_audit_log')
      .select('id, actor_id, action, entity, entity_id, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: loadError }) => {
        if (loadError) {
          console.error('Error cargando auditoría:', loadError);
          setError('No se pudo cargar la auditoría.');
        } else {
          setRows((data ?? []) as AuditRow[]);
        }
      });
  }, [role]);

  if (loading) return null;
  if (role !== 'admin') return <Navigate to="/staff" replace />;

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Solo admin</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Auditoría</h1>
        <p className="mt-2 text-sm text-foreground-600">Últimos 200 eventos: logins de staff, cortes de caja y cambios de stock.</p>

        {error && <p className="mt-6 text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-background-200/70 bg-background-100">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-foreground-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-background-200/70">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString('es-MX')}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.actor_id?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3">{r.action}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                  <td className="px-4 py-3 font-mono text-xs break-all">{JSON.stringify(r.meta)}</td>
                </tr>
              ))}
              {rows.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-foreground-500">Sin eventos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
