import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CAFETERIA_LEVELS, useCafeteriaStatus } from '@/hooks/useCafeteriaStatus';

type LowStockRow = { id: number | string; nombre: string };
type CorteEstado = 'abierto' | 'cerrado' | 'sin-abrir' | 'error' | null;

const LEVEL_DOT = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-red-500' } as const;

const CORTE_TEXT: Record<Exclude<CorteEstado, null>, string> = {
  abierto: 'Abierto',
  cerrado: 'Cerrado',
  'sin-abrir': 'Sin abrir',
  error: 'No disponible',
};

// Fecha local YYYY-MM-DD, igual que en CorteCajaPage.
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

function Card({ label, to, children }: { label: string; to: string; children: ReactNode }) {
  return (
    <Link to={to} className="rounded-2xl border border-background-200/70 bg-background-100 p-5 transition-colors hover:border-primary-300">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground-500">{label}</p>
      <div className="mt-2">{children}</div>
    </Link>
  );
}

export default function StaffSummary() {
  const { level, pendingCount, loading: statusLoading } = useCafeteriaStatus();
  const [corte, setCorte] = useState<CorteEstado>(null);
  const [lowStock, setLowStock] = useState<LowStockRow[] | 'error' | null>(null);

  useEffect(() => {
    let active = true;

    void supabase
      .from('cortes_caja')
      .select('estado')
      .eq('fecha', today())
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Error cargando corte de hoy:', error);
          setCorte('error');
        } else {
          setCorte(!data ? 'sin-abrir' : data.estado === 'cerrado' ? 'cerrado' : 'abierto');
        }
      });

    void supabase.rpc('get_insumos_stock_bajo').then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('Error cargando stock bajo:', error);
      setLowStock(error ? 'error' : ((data ?? []) as LowStockRow[]));
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card label="Cafetería ahora" to="/staff/cafeteria-status">
        {statusLoading ? (
          <p className="text-sm text-foreground-500">Cargando…</p>
        ) : (
          <>
            <p className="flex items-center gap-2 font-heading text-xl font-extrabold text-foreground-950">
              <span className={`h-3 w-3 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />
              {CAFETERIA_LEVELS[level].label}
            </p>
            <p className="mt-1 text-sm text-foreground-600">
              {pendingCount} pedido{pendingCount === 1 ? '' : 's'} pendiente{pendingCount === 1 ? '' : 's'}
            </p>
          </>
        )}
      </Card>

      <Card label="Corte de hoy" to="/staff/corte-caja">
        <p className="font-heading text-xl font-extrabold text-foreground-950">{corte ? CORTE_TEXT[corte] : '…'}</p>
        <p className="mt-1 text-sm text-foreground-600">
          {corte === 'sin-abrir' ? 'Abre caja antes de empezar a cobrar.' : 'Movimientos y cierre del día.'}
        </p>
      </Card>

      <Card label="Stock bajo" to="/staff/almacen">
        {lowStock === null ? (
          <p className="text-sm text-foreground-500">Cargando…</p>
        ) : lowStock === 'error' ? (
          <p className="font-heading text-xl font-extrabold text-foreground-950">No disponible</p>
        ) : lowStock.length === 0 ? (
          <p className="font-heading text-xl font-extrabold text-foreground-950">Todo en orden</p>
        ) : (
          <>
            <p className="font-heading text-xl font-extrabold text-red-700">
              {lowStock.length} insumo{lowStock.length === 1 ? '' : 's'} bajo el mínimo
            </p>
            <p className="mt-1 truncate text-sm text-foreground-600">
              {lowStock.slice(0, 3).map((item) => item.nombre).join(', ')}
              {lowStock.length > 3 ? '…' : ''}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
