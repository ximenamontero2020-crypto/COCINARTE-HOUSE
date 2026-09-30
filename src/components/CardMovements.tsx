import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Movement = {
  id: string;
  kind: 'recharge' | 'spend';
  amount: number;
  demo: boolean;
  created_at: string;
};

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

function label(m: Movement): string {
  if (m.kind === 'spend') return 'Pago de pedido';
  return m.demo ? 'Recarga demo' : 'Recarga en caja';
}

/**
 * Últimos movimientos de la Tarjeta CocinArte (card_transactions; RLS: solo los propios).
 * `refreshKey` cambia cuando cambia el saldo, para releer después de recargar o pagar.
 */
export default function CardMovements({ refreshKey, limit = 8 }: { refreshKey?: unknown; limit?: number }) {
  const [items, setItems] = useState<Movement[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void supabase
      .from('card_transactions')
      .select('id, kind, amount, demo, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) {
          console.error('Error cargando movimientos:', queryError);
          setError('No se pudieron cargar tus movimientos.');
          return;
        }
        setError('');
        setItems((data ?? []).map((m) => ({ ...m, amount: Number(m.amount) }) as Movement));
      });
    return () => {
      active = false;
    };
  }, [refreshKey, limit]);

  return (
    <div className="mt-4 rounded-2xl border border-background-200 bg-background-50 px-5 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Últimos movimientos</h3>
      {error ? (
        <p className="mt-2 text-sm text-accent-700">{error}</p>
      ) : items === null ? (
        <p className="mt-2 text-sm text-foreground-500">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-foreground-500">Aún no hay movimientos en tu tarjeta.</p>
      ) : (
        <ul className="mt-2 divide-y divide-background-200/70">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground-900">
                  {label(m)}
                  {m.demo && <span className="ml-1.5 rounded bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-800">demo</span>}
                </p>
                <p className="text-xs text-foreground-500">{fecha.format(new Date(m.created_at))}</p>
              </div>
              <span className={`shrink-0 font-heading text-sm font-bold ${m.kind === 'recharge' ? 'text-primary-700' : 'text-foreground-900'}`}>
                {m.kind === 'recharge' ? '+' : '−'}
                {pesos.format(m.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
