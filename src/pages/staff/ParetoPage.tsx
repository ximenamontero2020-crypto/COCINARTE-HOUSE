import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';

type MenuRow = {
  menu_item_id: number | null;
  nombre: string;
  qty: number | string;
  revenue: number | string;
  share: number | string;
  cumulative_pct: number | string;
  is_vital: boolean;
};
type HourRow = {
  dow: number;
  hour: number;
  orders: number;
  share: number | string;
  cumulative_pct: number | string;
  is_vital: boolean;
  is_valley: boolean;
};
type CurvePoint = { rank: number; label: string; share: number; cumulative: number };

// Mínimos para que el 80/20 diga algo.
const MIN_ORDERS = 20;
const MIN_ITEMS_SOLD = 3;
const RANGE_PRESETS = [7, 30, 90];

// Serie única del gráfico: verde de marca con croma suficiente (validado vs. la superficie background-100:
// pasa banda de luminosidad, croma y contraste ≥ 3:1). Texto y ejes usan tokens de texto, no el color de la serie.
const SERIES = '#4e6f24';
const INK_MUTED = '#847f7c'; // foreground-500
const GRID = '#e2dfda';

const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const pct = (value: number) => `${Math.round(value * 100)}%`;
const num = (value: number | string) => Number(value) || 0;
const slotLabel = (row: Pick<HourRow, 'dow' | 'hour'>) => `${DAYS[row.dow]} ${row.hour}:00`;

const isoDay = (offsetDays: number) => {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

function listJoin(parts: string[]) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

function CurveTooltip({ active, payload, unit }: { active?: boolean; payload?: Array<{ payload: CurvePoint }>; unit: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground-950">#{point.rank} · {point.label}</p>
      <p className="mt-0.5 text-foreground-600">{pct(point.share)} de {unit}</p>
      <p className="text-foreground-600">Acumulado: <strong className="text-foreground-950">{pct(point.cumulative)}</strong></p>
    </div>
  );
}

/** Curva acumulada (un solo eje, 0–100%) con la línea del 80% y el corte de los "vital few". */
function ParetoCurve({ points, vitalCount, unit, title }: { points: CurvePoint[]; vitalCount: number; unit: string; title: string }) {
  return (
    <figure>
      <figcaption className="text-sm font-semibold text-foreground-800">{title}</figcaption>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="rank" tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
            <YAxis domain={[0, 1]} ticks={[0, 0.5, 0.8, 1]} tickFormatter={pct} tick={{ fill: INK_MUTED, fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <ReferenceLine y={0.8} stroke={INK_MUTED} strokeDasharray="4 4" label={{ value: '80%', position: 'insideTopRight', fill: INK_MUTED, fontSize: 11 }} />
            {vitalCount > 0 && vitalCount < points.length && (
              <ReferenceLine x={vitalCount} stroke={INK_MUTED} strokeDasharray="2 4" label={{ value: 'Vital few', position: 'insideTopLeft', fill: INK_MUTED, fontSize: 11 }} />
            )}
            <Tooltip content={<CurveTooltip unit={unit} />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
            <Line type="linear" dataKey="cumulative" stroke={SERIES} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: '#f0eee9', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="shrink-0 rounded-md border border-background-300 bg-background-50 px-2.5 py-1 text-xs font-semibold text-foreground-800 hover:bg-background-200"
    >
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export default function ParetoPage() {
  const [from, setFrom] = useState(isoDay(-29));
  const [to, setTo] = useState(isoDay(0));
  const [menu, setMenu] = useState<MenuRow[] | null>(null);
  const [hours, setHours] = useState<HourRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !to || from > to) return;
    let active = true;
    setMenu(null);
    setHours(null);
    setError('');
    void Promise.all([
      supabase.rpc('pareto_menu', { p_from: from, p_to: to }),
      supabase.rpc('pareto_hours', { p_from: from, p_to: to }),
    ]).then(([menuResult, hoursResult]) => {
      if (!active) return;
      const failed = menuResult.error ?? hoursResult.error;
      if (failed) {
        console.error('Error cargando Pareto:', failed);
        setError('No se pudo calcular el análisis.');
        return;
      }
      setMenu((menuResult.data ?? []) as MenuRow[]);
      setHours((hoursResult.data ?? []) as HourRow[]);
    });
    return () => {
      active = false;
    };
  }, [from, to]);

  const sold = useMemo(() => (menu ?? []).filter((row) => num(row.revenue) > 0), [menu]);
  const vitalItems = sold.filter((row) => row.is_vital);
  const totalOrders = (hours ?? []).reduce((sum, row) => sum + row.orders, 0);
  const totalRevenue = sold.reduce((sum, row) => sum + num(row.revenue), 0);
  const vitalSlots = (hours ?? []).filter((row) => row.is_vital);
  const valleySlots = (hours ?? []).filter((row) => row.is_valley);
  const enoughData = menu !== null && hours !== null && totalOrders >= MIN_ORDERS && sold.length >= MIN_ITEMS_SOLD;

  const menuCurve: CurvePoint[] = sold.map((row, index) => ({ rank: index + 1, label: row.nombre, share: num(row.share), cumulative: num(row.cumulative_pct) }));
  const hourCurve: CurvePoint[] = (hours ?? []).map((row, index) => ({ rank: index + 1, label: slotLabel(row), share: num(row.share), cumulative: num(row.cumulative_pct) }));

  // Slow-mover para el bundle: el que menos vende pero sí se vende; si no, uno sin ventas.
  const slowMover = [...sold].reverse().find((row) => !row.is_vital) ?? (menu ?? []).find((row) => num(row.revenue) === 0) ?? null;
  // Valles de menor a mayor tráfico, empezando por los más tranquilos.
  const quietest = [...valleySlots].reverse().slice(0, 3);

  const actions = enoughData
    ? [
        {
          title: 'Pon los vital few arriba del menú y en «Para ti»',
          text: `${vitalItems.length} de ${sold.length} platillos generan el 80% de los ingresos: ${listJoin(vitalItems.slice(0, 5).map((row) => row.nombre))}. Muéstralos primero en el menú y en la sección «Para ti».`,
        },
        ...(vitalItems[0] && slowMover
          ? [
              {
                title: 'Bundle: 1 vital + 1 slow-mover',
                text: `Combo sugerido: ${vitalItems[0].nombre} + ${slowMover.nombre}. El primero atrae; el segundo gana visibilidad. Define el precio del combo en caja antes de publicarlo.`,
              },
            ]
          : []),
        ...(quietest.length
          ? [
              {
                title: 'Promo solo en horas valle',
                text: `Cuando se active la promo de juegos, limítala a horas valle (la mitad con menos pedidos), por ejemplo: ${listJoin(quietest.map(slotLabel))}. Así llenas horas flojas sin saturar las pico.`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Panel de staff</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Pareto 80/20</h1>
        <p className="mt-2 text-sm text-foreground-600">Qué platillos y qué horas concentran el negocio. Solo análisis: no cambia precios ni el menú.</p>

        {/* Filtros en una sola fila, arriba de las gráficas. */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-foreground-600">Desde</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-foreground-600">Hasta</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2" role="group" aria-label="Periodos rápidos">
            {RANGE_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  setFrom(isoDay(-(days - 1)));
                  setTo(isoDay(0));
                }}
                className="rounded-full bg-background-100 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-200"
              >
                {days} días
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-6 rounded-lg bg-accent-100 px-3 py-2 text-sm text-accent-700">{error}</p>}
        {!error && (menu === null || hours === null) && <p className="mt-6 text-sm text-foreground-600">Calculando…</p>}

        {menu !== null && hours !== null && !enoughData && (
          <div className="mt-6 rounded-2xl border border-dashed border-background-300 bg-background-100 p-8 text-center">
            <p className="font-heading text-xl font-bold text-foreground-950">Todavía hay pocos datos para un 80/20 confiable.</p>
            <p className="mt-2 text-sm text-foreground-600">
              En este periodo hay {totalOrders} pedidos (mínimo {MIN_ORDERS}) y {sold.length} platillos vendidos (mínimo {MIN_ITEMS_SOLD}). Amplía el rango de fechas o vuelve en unos días.
            </p>
          </div>
        )}

        {enoughData && (
          <>
            <section className="mt-6 rounded-2xl border border-primary-200 bg-primary-50 p-5" aria-labelledby="actions-title">
              <h2 id="actions-title" className="font-heading text-lg font-bold text-foreground-950">Acciones sugeridas</h2>
              <ul className="mt-3 space-y-3">
                {actions.map((action) => (
                  <li key={action.title} className="flex items-start justify-between gap-3 rounded-xl bg-background-50 p-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground-950">{action.title}</p>
                      <p className="mt-1 text-sm text-foreground-700">{action.text}</p>
                    </div>
                    <CopyButton text={action.text} />
                  </li>
                ))}
              </ul>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="menu-title">
                <h2 id="menu-title" className="font-heading text-lg font-bold text-foreground-950">Platillos</h2>
                <p className="mt-1 text-sm text-foreground-600">
                  <strong className="text-foreground-950">{vitalItems.length} de {sold.length}</strong> platillos generan el 80% de {money.format(totalRevenue)}.
                </p>
                <div className="mt-4">
                  <ParetoCurve points={menuCurve} vitalCount={vitalItems.length} unit="los ingresos" title="Ingresos acumulados por platillo (del que más vende al que menos)" />
                </div>
                <div className="mt-4 max-h-96 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background-100 text-xs uppercase tracking-wide text-foreground-500">
                      <tr><th className="py-2 pr-2">#</th><th className="py-2 pr-2">Platillo</th><th className="py-2 pr-2 text-right">Uds.</th><th className="py-2 pr-2 text-right">Ingresos</th><th className="py-2 text-right">Acum.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-background-200">
                      {(menu ?? []).map((row, index) => (
                        <tr key={`${row.menu_item_id ?? row.nombre}`} className={num(row.revenue) === 0 ? 'text-foreground-500' : ''}>
                          <td className="py-2 pr-2 text-foreground-500">{index + 1}</td>
                          <td className="py-2 pr-2">
                            <span className="font-semibold text-foreground-950">{row.nombre}</span>
                            {row.is_vital && <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-800">Vital</span>}
                            {num(row.revenue) === 0 && <span className="ml-2 text-xs">sin ventas</span>}
                          </td>
                          <td className="py-2 pr-2 text-right">{num(row.qty).toLocaleString('es-MX')}</td>
                          <td className="py-2 pr-2 text-right">{money.format(num(row.revenue))}</td>
                          <td className="py-2 text-right">{num(row.revenue) > 0 ? pct(num(row.cumulative_pct)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="hours-title">
                <h2 id="hours-title" className="font-heading text-lg font-bold text-foreground-950">Horarios</h2>
                <p className="mt-1 text-sm text-foreground-600">
                  <strong className="text-foreground-950">{vitalSlots.length} de {hours.length}</strong> franjas (día + hora) concentran el 80% de {totalOrders} pedidos.
                </p>
                <div className="mt-4">
                  <ParetoCurve points={hourCurve} vitalCount={vitalSlots.length} unit="los pedidos" title="Pedidos acumulados por franja (de la más llena a la más tranquila)" />
                </div>
                <div className="mt-4 max-h-96 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-background-100 text-xs uppercase tracking-wide text-foreground-500">
                      <tr><th className="py-2 pr-2">#</th><th className="py-2 pr-2">Franja</th><th className="py-2 pr-2 text-right">Pedidos</th><th className="py-2 text-right">Acum.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-background-200">
                      {hours.map((row, index) => (
                        <tr key={`${row.dow}-${row.hour}`}>
                          <td className="py-2 pr-2 text-foreground-500">{index + 1}</td>
                          <td className="py-2 pr-2">
                            <span className="font-semibold text-foreground-950">{slotLabel(row)}</span>
                            {row.is_vital && <span className="ml-2 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-800">Pico</span>}
                            {row.is_valley && <span className="ml-2 rounded-full bg-background-200 px-2 py-0.5 text-[10px] font-bold uppercase text-foreground-700">Valle</span>}
                          </td>
                          <td className="py-2 pr-2 text-right">{row.orders}</td>
                          <td className="py-2 text-right">{pct(num(row.cumulative_pct))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
