import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Row = { id: number; name: string; emoji: string | null; category_id: string; pago_en_caja_permitido: boolean };

/**
 * Qué productos se pueden pagar en efectivo al recoger. Solo productos listos
 * (agua, sándwiches ya hechos, galletas): si algo que se prepara se paga al recoger
 * y el cliente no llega, la comida se desperdicia. create_comanda aplica la regla.
 */
export default function MenuEfectivoPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void (async () => {
      const { data, error: err } = await supabase
        .from('menu_items')
        .select('id, name, emoji, category_id, pago_en_caja_permitido')
        .order('category_id')
        .order('orden');
      if (err) {
        console.error('Error cargando menú:', err);
        setError('No se pudo cargar el menú. ¿Ya se aplicó la migración 20260924000009?');
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
  }, []);

  const toggle = async (row: Row) => {
    setBusyId(row.id);
    setError(null);
    const next = !row.pago_en_caja_permitido;
    const { error: err } = await supabase.rpc('staff_set_pago_en_caja', { p_menu_item_id: row.id, p_permitido: next });
    if (err) {
      console.error('Error guardando pago en efectivo:', err);
      setError(err.message || 'No se pudo guardar el cambio.');
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, pago_en_caja_permitido: next } : r)));
    }
    setBusyId(null);
  };

  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  const enabled = rows.filter((r) => r.pago_en_caja_permitido).length;

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-extrabold text-foreground-950">Pago en efectivo</h1>
        <p className="mt-2 text-sm text-foreground-600">
          Activa solo productos que <strong>no requieren preparación</strong> (agua, sándwiches ya hechos, galletas). Si un
          carrito tiene algo que se prepara al momento, el cliente no puede pagar en caja: si no llega, la comida se
          desperdicia.
        </p>
        <p className="mt-2 text-xs text-foreground-500">
          {enabled} de {rows.length} productos se pueden pagar en efectivo.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          className="mt-5 w-full rounded-xl border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
        />

        {error && <p className="mt-4 rounded-lg bg-accent-100 px-3 py-2 text-sm text-accent-700">{error}</p>}

        {loading ? (
          <p className="mt-6 text-sm text-foreground-500">Cargando…</p>
        ) : (
          <ul className="mt-5 divide-y divide-background-200/70 rounded-2xl border border-background-200/70 bg-background-50">
            {visible.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden="true">{row.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground-950">{row.name}</span>
                  <span className="block text-xs text-foreground-500">{row.category_id}</span>
                </span>
                <label className="flex items-center gap-2 text-xs text-foreground-600 cursor-pointer">
                  <span className="hidden sm:inline">Se puede pagar en efectivo (no requiere preparación)</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 cursor-pointer accent-primary-500"
                    checked={row.pago_en_caja_permitido}
                    disabled={busyId === row.id}
                    onChange={() => void toggle(row)}
                    aria-label={`${row.name}: se puede pagar en efectivo`}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
