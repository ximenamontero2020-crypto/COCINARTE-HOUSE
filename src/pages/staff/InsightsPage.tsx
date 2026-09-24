import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useClimaRecomendado } from '@/hooks/useClimaRecomendado';

type Slot = {
  dow: number;
  hour: number;
  snapshots: number;
  days_seen: number;
  avg_queue: number | string;
  p90_queue: number | string;
  avg_pending: number | string | null;
};

type TopItem = { menu_item_id: number | null; nombre: string; cantidad: number | string; pedidos: number };

type Data = { slots: Slot[]; items: TopItem[]; snapshots: number; orders: number };

// Mínimos para que el pronóstico signifique algo.
const MIN_SNAPSHOTS = 50;
const MIN_ORDERS = 20;
const WEEK_OPTIONS = [2, 4, 8];

// ISO: 1 = lunes … 7 = domingo.
const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0;
const fmt = (value: number | string | null | undefined) => num(value).toLocaleString('es-MX', { maximumFractionDigits: 1 });
const slotLabel = (slot: Slot) => `${DAYS[slot.dow]} ${slot.hour}:00–${slot.hour + 1}:00`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function listJoin(parts: string[]) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

/** Párrafo con plantilla fija (sin LLM). */
function summary(weeks: number, slots: Slot[], items: TopItem[]) {
  const [top, ...rest] = slots;
  const sentences = [
    `En las últimas ${weeks} semanas, la franja más concurrida fue el ${slotLabel(top)}, con ${fmt(top.avg_queue)} personas en fila en promedio y hasta ${fmt(top.p90_queue)} en los días más llenos.`,
  ];
  if (rest.length > 0) {
    sentences.push(`También suelen llenarse: ${listJoin(rest.slice(0, 2).map(slotLabel))}.`);
  }
  if (items.length > 0) {
    sentences.push(
      `En esas horas lo más pedido es ${listJoin(items.slice(0, 3).map((item) => item.nombre))}; conviene tener sus insumos listos antes de las ${top.hour}:00.`,
    );
  }
  if (top.days_seen < 3) {
    sentences.push('Ojo: la franja principal tiene pocos días registrados, tómalo como tendencia inicial.');
  }
  return sentences.join(' ');
}

export default function InsightsPage() {
  const [weeks, setWeeks] = useState(4);
  const { weather, rule, cargando: weatherLoading } = useClimaRecomendado();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    const since = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();

    void Promise.all([
      supabase.rpc('forecast_busy_slots', { p_weeks: weeks }),
      supabase.rpc('top_items_in_busy_windows', { p_weeks: weeks, p_slots: 5, p_limit: 5 }),
      supabase
        .from('cafeteria_status_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since)
        .not('queue_count', 'is', null),
      supabase
        .from('comandas')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since)
        .neq('estado', 'cancelado'),
    ]).then(([slots, items, snapshots, orders]) => {
      if (!active) return;
      const failed = slots.error ?? items.error ?? snapshots.error ?? orders.error;
      if (failed) {
        console.error('Error cargando insights:', failed);
        setError('No se pudieron cargar los datos.');
        return;
      }
      setData({
        slots: (slots.data ?? []) as Slot[],
        items: (items.data ?? []) as TopItem[],
        snapshots: snapshots.count ?? 0,
        orders: orders.count ?? 0,
      });
    });

    return () => {
      active = false;
    };
  }, [weeks]);

  const enoughData = data !== null && data.snapshots >= MIN_SNAPSHOTS && data.orders >= MIN_ORDERS && data.slots.length > 0;
  const topSlots = data?.slots.slice(0, 5) ?? [];

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Panel de staff</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Insights</h1>
        <p className="mt-2 text-sm text-foreground-600">
          Pronóstico por reglas a partir del historial del semáforo y de los pedidos. Horario de Ciudad de México.
        </p>
        {!weatherLoading && (
          <p className="mt-2 text-sm text-foreground-700">
            {weather ? (
              <>Clima ahora: <strong>{Math.round(weather.temperature)}°C</strong> — regla activa: <strong>{rule}</strong></>
            ) : (
              <>Clima no disponible — regla activa: <strong>{rule}</strong> (más vendidos)</>
            )}
          </p>
        )}

        <div className="mt-6 flex gap-2" role="group" aria-label="Periodo">
          {WEEK_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setWeeks(option)}
              aria-pressed={weeks === option}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                weeks === option ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700 hover:bg-background-200'
              }`}
            >
              {option} semanas
            </button>
          ))}
        </div>

        {error && <p className="mt-6 rounded-lg bg-accent-100 px-3 py-2 text-sm text-accent-700">{error}</p>}
        {!data && !error && <p className="mt-6 text-sm text-foreground-600">Calculando…</p>}

        {data && !enoughData && (
          <div className="mt-6 rounded-2xl border border-dashed border-background-300 bg-background-100 p-8 text-center">
            <p className="font-heading text-xl font-bold text-foreground-950">Necesitas más datos; usa el semáforo 2 semanas.</p>
            <p className="mt-2 text-sm text-foreground-600">
              En este periodo hay {data.snapshots} registros de fila (mínimo {MIN_SNAPSHOTS}) y {data.orders} pedidos (mínimo {MIN_ORDERS}).
              Actualiza la fila en Cafetería varias veces al día para alimentar el pronóstico.
            </p>
          </div>
        )}

        {data && enoughData && (
          <>
            <p className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 p-5 text-sm leading-relaxed text-foreground-800">
              {summary(weeks, data.slots, data.items)}
            </p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="slots-title">
                <h2 id="slots-title" className="font-heading text-lg font-bold text-foreground-950">Franjas más concurridas</h2>
                <ol className="mt-4 space-y-3">
                  {topSlots.map((slot, index) => (
                    <li key={`${slot.dow}-${slot.hour}`} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        <span className="font-semibold text-foreground-950">{index + 1}. {capitalize(slotLabel(slot))}</span>
                        <span className="block text-xs text-foreground-500">
                          {slot.snapshots} registros · {slot.days_seen} {slot.days_seen === 1 ? 'día' : 'días'}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-bold text-foreground-950">{fmt(slot.avg_queue)} en fila</span>
                        <span className="block text-xs text-foreground-500">p90: {fmt(slot.p90_queue)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="items-title">
                <h2 id="items-title" className="font-heading text-lg font-bold text-foreground-950">Lo más pedido en esas franjas</h2>
                {data.items.length === 0 ? (
                  <p className="mt-4 text-sm text-foreground-600">No hay pedidos en esas franjas todavía.</p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {data.items.map((item, index) => (
                      <li key={`${item.menu_item_id ?? item.nombre}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-foreground-950">{index + 1}. {item.nombre}</span>
                        <span className="text-right">
                          <span className="block font-bold text-foreground-950">{fmt(item.cantidad)} uds.</span>
                          <span className="block text-xs text-foreground-500">en {item.pedidos} {item.pedidos === 1 ? 'pedido' : 'pedidos'}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
