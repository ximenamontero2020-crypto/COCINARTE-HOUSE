import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

 type CashCut = {
  id: string;
  fecha: string;
  efectivo_inicial: number | string;
  efectivo_final_contado: number | string | null;
  estado: 'abierto' | 'cerrado';
  notas: string | null;
};

type CashMovement = {
  id: string;
  corte_id: string;
  tipo: 'entrada' | 'salida';
  monto: number | string;
  concepto: string;
  created_at: string;
};

type CutSummary = {
  fecha_inicio: string;
  fecha_fin: string;
  total_ventas_tarjeta: number | string;
  total_ventas_cafeteria: number | string;
  total_ventas_efectivo: number | string;
  total_ventas_general: number | string;
  total_pedidos: number | string;
  corte_id: string | null;
  corte_fecha: string | null;
  efectivo_inicial: number | string | null;
  total_entradas: number | string | null;
  total_salidas: number | string | null;
  efectivo_esperado: number | string | null;
  efectivo_final_contado: number | string | null;
  diferencia: number | string | null;
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value ?? 0));

const numberValue = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

export default function CorteCajaPage() {
  const { user, loading: authLoading } = useAuth();
  const [todayDate] = useState(today);
  const [todayCut, setTodayCut] = useState<CashCut | null>(null);
  const [todayMovements, setTodayMovements] = useState<CashMovement[]>([]);
  const [todaySales, setTodaySales] = useState<CutSummary | null>(null);
  const [history, setHistory] = useState<CutSummary[]>([]);
  const [historySales, setHistorySales] = useState<CutSummary | null>(null);
  const [historySearched, setHistorySearched] = useState(false);
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState(todayDate);
  const [initialCash, setInitialCash] = useState('');
  const [movementType, setMovementType] = useState<'entrada' | 'salida'>('entrada');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementConcept, setMovementConcept] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const notifyError = (messageText: string, error: unknown) => {
    setErrorMessage(messageText);
    setMessage(null);
    console.error(messageText, error);
  };

  const loadToday = async () => {
    setLoading(true);
    const [cutResult, salesResult] = await Promise.all([
      supabase.from('cortes_caja').select('id, fecha, efectivo_inicial, efectivo_final_contado, estado, notas').eq('fecha', todayDate).maybeSingle(),
      supabase.rpc('calcular_corte_caja', { p_fecha_inicio: todayDate, p_fecha_fin: todayDate }),
    ]);

    if (cutResult.error) notifyError('No se pudo cargar el corte del día.', cutResult.error);
    else setTodayCut(cutResult.data as CashCut | null);

    if (salesResult.error) notifyError('No se pudo cargar el resumen de ventas del día.', salesResult.error);
    else setTodaySales(((salesResult.data ?? []) as CutSummary[])[0] ?? null);

    if (cutResult.data) {
      const { data, error } = await supabase.from('movimientos_efectivo').select('id, corte_id, tipo, monto, concepto, created_at').eq('corte_id', cutResult.data.id).order('created_at', { ascending: false });
      if (error) notifyError('No se pudieron cargar los movimientos.', error);
      else setTodayMovements((data ?? []) as CashMovement[]);
    } else {
      setTodayMovements([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) void loadToday();
  }, [authLoading, user]);

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-background-50 text-sm text-foreground-600">Cargando…</div>;
  if (!user) return <Navigate to="/" replace />;

  const totalEntries = todayMovements.filter((movement) => movement.tipo === 'entrada').reduce((sum, movement) => sum + numberValue(movement.monto), 0);
  const totalExits = todayMovements.filter((movement) => movement.tipo === 'salida').reduce((sum, movement) => sum + numberValue(movement.monto), 0);
  const expectedCash = todayCut ? numberValue(todayCut.efectivo_inicial) + totalEntries - totalExits : 0;
  const closedDifference = todayCut?.efectivo_final_contado === null || todayCut?.efectivo_final_contado === undefined ? null : numberValue(todayCut.efectivo_final_contado) - expectedCash;

  const openCut = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(initialCash);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    const { error } = await supabase.rpc('abrir_corte_caja', { p_fecha: todayDate, p_monto_inicial: amount });
    if (error) notifyError(error.message || 'No se pudo abrir el corte.', error);
    else {
      setInitialCash('');
      setMessage('Corte del día abierto.');
      setErrorMessage(null);
      await loadToday();
    }
    setSaving(false);
  };

  const addMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!todayCut || todayCut.estado !== 'abierto') return;
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0 || !movementConcept.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('movimientos_efectivo').insert({ corte_id: todayCut.id, tipo: movementType, monto: amount, concepto: movementConcept.trim() });
    if (error) notifyError('No se pudo registrar el movimiento.', error);
    else {
      setMovementAmount('');
      setMovementConcept('');
      setMessage('Movimiento registrado.');
      setErrorMessage(null);
      await loadToday();
    }
    setSaving(false);
  };

  const closeCut = async () => {
    if (!todayCut || todayCut.estado !== 'abierto') return;
    const amount = Number(countedCash);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    const { error } = await supabase.rpc('cerrar_corte_caja', { p_corte_id: todayCut.id, p_monto_contado: amount });
    if (error) notifyError(error.message || 'No se pudo cerrar el corte.', error);
    else {
      setCountedCash('');
      setMessage('Corte cerrado correctamente.');
      setErrorMessage(null);
      await loadToday();
    }
    setSaving(false);
  };

  const loadHistory = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!startDate || !endDate || endDate < startDate) return;
    setHistoryLoading(true);
    setHistorySearched(false);
    const [summaryResult, cutsResult] = await Promise.all([
      supabase.rpc('calcular_corte_caja', { p_fecha_inicio: startDate, p_fecha_fin: endDate }),
      supabase.from('cortes_caja').select('id, fecha, efectivo_inicial, efectivo_final_contado, estado, notas').gte('fecha', startDate).lte('fecha', endDate).order('fecha', { ascending: false }),
    ]);
    if (summaryResult.error || cutsResult.error) {
      notifyError('No se pudo cargar el historial de cortes.', summaryResult.error ?? cutsResult.error);
    } else {
      setHistory((summaryResult.data ?? []) as CutSummary[]);
      setHistorySales(((summaryResult.data ?? []) as CutSummary[])[0] ?? null);
      setHistorySearched(true);
    }
    setHistoryLoading(false);
  };

  const historyRows = history;

  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Panel de staff</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950 md:text-4xl">Corte de caja</h1>
          <p className="mt-2 max-w-2xl text-sm text-foreground-600">Combina las ventas digitales con el seguimiento diario del efectivo físico.</p>
        </header>
        {(message || errorMessage) && <p className={`mb-5 text-sm font-semibold ${errorMessage ? 'text-red-700' : 'text-primary-700'}`} role="status">{errorMessage ?? message}</p>}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="today-cut-title">
            <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">{todayDate}</p><h2 id="today-cut-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Corte del día</h2></div>{todayCut && <span className={`rounded-full px-3 py-1 text-xs font-bold ${todayCut.estado === 'abierto' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{todayCut.estado === 'abierto' ? 'Abierto' : 'Cerrado'}</span>}</div>
            {loading ? <p className="mt-6 text-sm text-foreground-600">Cargando corte…</p> : !todayCut ? <form onSubmit={(event) => void openCut(event)} className="mt-6 rounded-xl border border-dashed border-background-300 bg-background-50 p-5"><h3 className="font-heading text-lg font-bold text-foreground-950">Abrir corte</h3><p className="mt-1 text-sm text-foreground-600">Registra el efectivo disponible al comenzar el día.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="number" min="0" step="0.01" required value={initialCash} onChange={(event) => setInitialCash(event.target.value)} placeholder="Efectivo inicial" className="h-11 flex-1 rounded-lg border border-background-300 bg-background-50 px-3 text-sm outline-none focus:border-primary-500" /><button type="submit" disabled={saving || !initialCash} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">Abrir corte</button></div></form> : <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Efectivo inicial</p><p className="mt-1 font-heading text-xl font-extrabold text-foreground-950">{money(todayCut.efectivo_inicial)}</p></div><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Entradas</p><p className="mt-1 font-heading text-xl font-extrabold text-emerald-700">{money(totalEntries)}</p></div><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Salidas</p><p className="mt-1 font-heading text-xl font-extrabold text-red-700">{money(totalExits)}</p></div></div>
              <div className="mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4"><p className="text-sm font-semibold text-primary-900">Efectivo esperado</p><p className="mt-1 font-heading text-3xl font-extrabold text-primary-900">{money(expectedCash)}</p></div>
              {todayCut.estado === 'abierto' && <><form onSubmit={(event) => void addMovement(event)} className="mt-6 rounded-xl border border-background-200 bg-background-50 p-4"><h3 className="font-heading text-lg font-bold text-foreground-950">Registrar movimiento</h3><div className="mt-4 grid gap-3 sm:grid-cols-[140px_150px_minmax(0,1fr)_auto]"><select value={movementType} onChange={(event) => setMovementType(event.target.value as 'entrada' | 'salida')} className="rounded-lg border border-background-300 px-3 py-2.5 text-sm"><option value="entrada">Entrada</option><option value="salida">Salida</option></select><input type="number" min="0.01" step="0.01" required value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder="Monto" className="rounded-lg border border-background-300 px-3 py-2.5 text-sm" /><input required value={movementConcept} onChange={(event) => setMovementConcept(event.target.value)} placeholder="Concepto" className="rounded-lg border border-background-300 px-3 py-2.5 text-sm" /><button type="submit" disabled={saving || !movementAmount || !movementConcept.trim()} className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">Registrar</button></div></form><div className="mt-5"><h3 className="font-heading text-lg font-bold text-foreground-950">Movimientos del día</h3>{todayMovements.length === 0 ? <p className="mt-3 text-sm text-foreground-600">Todavía no hay movimientos.</p> : <div className="mt-3 grid gap-2">{todayMovements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-4 rounded-lg border border-background-200 bg-background-50 px-4 py-3"><div><p className="text-sm font-semibold text-foreground-900">{movement.concepto}</p><p className="text-xs text-foreground-500">{new Date(movement.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p></div><span className={`font-bold ${movement.tipo === 'entrada' ? 'text-emerald-700' : 'text-red-700'}`}>{movement.tipo === 'entrada' ? '+' : '-'}{money(movement.monto)}</span></div>)}</div>}</div><div className="mt-6 flex flex-col gap-3 border-t border-background-200 pt-5 sm:flex-row sm:items-end"><label className="grid flex-1 gap-1 text-sm font-semibold text-foreground-800">Efectivo contado<input type="number" min="0" step="0.01" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Monto contado" className="h-11 rounded-lg border border-background-300 px-3 font-normal" /></label><button type="button" disabled={saving || !countedCash} onClick={() => void closeCut()} className="rounded-lg bg-foreground-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-foreground-800 disabled:opacity-50">Cerrar corte</button></div></>}
              {todayCut.estado === 'cerrado' && <div className={`mt-6 rounded-xl border p-4 ${numberValue(closedDifference) >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><p className="text-sm font-semibold">Contado: {money(todayCut.efectivo_final_contado)} · Esperado: {money(expectedCash)}</p><p className={`mt-1 font-heading text-xl font-extrabold ${numberValue(closedDifference) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{numberValue(closedDifference) >= 0 ? 'Sobrante' : 'Faltante'}: {money(Math.abs(numberValue(closedDifference)))}</p></div>}
            </>}
          </section>

          <section className="rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="sales-title"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Ventas digitales</p><h2 id="sales-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Resumen de hoy</h2>{todaySales ? <div className="mt-6 grid gap-3"><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Tarjeta normal</p><p className="mt-1 font-heading text-2xl font-extrabold">{money(todaySales.total_ventas_tarjeta)}</p></div><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Tarjeta CocinArte</p><p className="mt-1 font-heading text-2xl font-extrabold">{money(todaySales.total_ventas_cafeteria)}</p></div><div className="rounded-xl bg-primary-50 p-4"><p className="text-xs text-primary-800">Total general</p><p className="mt-1 font-heading text-3xl font-extrabold text-primary-900">{money(todaySales.total_ventas_general)}</p></div><p className="text-sm text-foreground-600">{numberValue(todaySales.total_pedidos)} pedidos registrados hoy.</p></div> : <p className="mt-6 text-sm text-foreground-600">Sin ventas registradas o sin datos para hoy.</p>}</section>
        </div>

        <section className="mt-8 rounded-2xl border border-background-200/70 bg-background-100 p-5 shadow-sm md:p-7" aria-labelledby="history-title"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Consultas</p><h2 id="history-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Historial de cortes</h2></div></div><form onSubmit={(event) => void loadHistory(event)} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-sm font-semibold">Desde<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-lg border border-background-300 bg-background-50 px-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold">Hasta<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-lg border border-background-300 bg-background-50 px-3 font-normal" /></label><button type="submit" disabled={historyLoading || !startDate || !endDate || endDate < startDate} className="self-end rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">{historyLoading ? 'Consultando…' : 'Consultar rango'}</button></form>{historySales && <div className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Tarjeta normal</p><p className="mt-1 font-bold">{money(historySales.total_ventas_tarjeta)}</p></div><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Tarjeta CocinArte</p><p className="mt-1 font-bold">{money(historySales.total_ventas_cafeteria)}</p></div><div className="rounded-xl bg-primary-50 p-4"><p className="text-xs text-primary-800">Total general</p><p className="mt-1 font-bold text-primary-900">{money(historySales.total_ventas_general)}</p></div><div className="rounded-xl bg-background-50 p-4"><p className="text-xs text-foreground-600">Pedidos</p><p className="mt-1 font-bold">{numberValue(historySales.total_pedidos)}</p></div></div>}{historyLoading ? <p className="mt-6 text-sm text-foreground-600">Cargando historial…</p> : historySearched && history.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-background-300 p-8 text-center text-sm text-foreground-600">No hay cortes registrados en esas fechas.</p> : history.length > 0 && <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-background-300 text-xs uppercase tracking-wide text-foreground-500"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Inicial</th><th className="px-3 py-3">Entradas</th><th className="px-3 py-3">Salidas</th><th className="px-3 py-3">Esperado</th><th className="px-3 py-3">Contado</th><th className="px-3 py-3">Diferencia</th></tr></thead><tbody className="divide-y divide-background-200">{historyRows.map((row) => <tr key={row.corte_id ?? row.corte_fecha}><td className="px-3 py-3 font-semibold">{row.corte_fecha}</td><td className="px-3 py-3">{money(row.efectivo_inicial)}</td><td className="px-3 py-3">{money(row.total_entradas)}</td><td className="px-3 py-3">{money(row.total_salidas)}</td><td className="px-3 py-3">{money(row.efectivo_esperado)}</td><td className="px-3 py-3">{row.efectivo_final_contado === null ? '—' : money(row.efectivo_final_contado)}</td><td className="px-3 py-3">{row.efectivo_final_contado === null ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Corte aún abierto</span> : <span className={numberValue(row.diferencia) < 0 ? 'font-bold text-red-700' : 'font-bold text-emerald-700'}>{money(row.diferencia)}</span>}</td></tr>)}</tbody></table></div>}</section>
      </div>
    </main>
  );
}
