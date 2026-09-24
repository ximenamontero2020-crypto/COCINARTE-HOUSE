import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCafeteriaStatus, QUEUE_STALE_MINUTES } from '@/hooks/useCafeteriaStatus';

const PRESETS = [0, 5, 10, 20, 30];
const MAX_QUEUE = 500;

type QueueChanges = {
  queue_count?: number;
  queue_source?: 'staff' | 'pedidos';
  queue_factor?: number;
  note?: string | null;
  /** Cualquier valor marca el conteo como confirmado; el servidor lo cambia por now(). */
  queue_updated_at?: string;
};

/** Fila visible para clientes: conteo manual, presets, estimación desde pedidos y nota. */
export default function QueueControls() {
  const { queueCount, queueSource, queueFactor, note, minutesSinceUpdate, refresh } = useCafeteriaStatus();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [factorInput, setFactorInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // Cada escritura agrega una fila al historial; solo las de conteo mueven queue_updated_at.
  const save = async (changes: QueueChanges, okMessage: string) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('cafeteria_status').upsert({ id: 1, ...changes });
    if (error) {
      console.error('Error guardando la fila:', error);
      setMessage('No se pudo guardar el cambio.');
    } else {
      setMessage(okMessage);
      await refresh().catch(() => {});
    }
    setSaving(false);
  };

  const setCount = (value: number) => {
    const count = Math.min(MAX_QUEUE, Math.max(0, Math.round(value)));
    void save({ queue_count: count, queue_source: 'staff', queue_updated_at: new Date().toISOString() }, `Fila: ${count} ${count === 1 ? 'persona' : 'personas'}.`);
  };

  const estimateFromOrders = async () => {
    setSaving(true);
    setMessage(null);
    const { count, error } = await supabase
      .from('comandas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente');
    setSaving(false);
    if (error || count === null) {
      console.error('Error contando pedidos pendientes:', error);
      setMessage('No se pudieron contar los pedidos pendientes.');
      return;
    }
    const estimated = Math.min(MAX_QUEUE, Math.round(count * queueFactor));
    void save(
      { queue_count: estimated, queue_source: 'pedidos', queue_updated_at: new Date().toISOString() },
      `Estimado: ${count} pendientes × ${queueFactor} = ${estimated} ${estimated === 1 ? 'persona' : 'personas'}.`,
    );
  };

  const saveFactor = () => {
    const factor = Number(factorInput);
    if (!Number.isFinite(factor) || factor <= 0 || factor > 10) {
      setMessage('El factor debe ser mayor a 0 y hasta 10.');
      return;
    }
    void save({ queue_factor: Math.round(factor * 100) / 100 }, `Factor guardado: ${factor}.`);
    setFactorInput('');
  };

  const saveNote = () => {
    const text = noteInput.trim().slice(0, 140);
    void save({ note: text || null }, text ? 'Nota visible para clientes.' : 'Nota quitada.');
    setNoteInput('');
  };

  const stale = minutesSinceUpdate === null || minutesSinceUpdate > QUEUE_STALE_MINUTES;
  const button =
    'rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm font-semibold text-foreground-800 hover:bg-background-200 disabled:opacity-50';

  return (
    <section className="mt-10 border-t border-background-200 pt-8" aria-labelledby="queue-title">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Fila</p>
      <h2 id="queue-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">
        {queueCount === null ? 'Sin dato de fila' : `${queueCount} ${queueCount === 1 ? 'persona' : 'personas'} en fila`}
      </h2>
      <p className={`mt-1 text-sm ${stale ? 'font-semibold text-amber-800' : 'text-foreground-600'}`}>
        {minutesSinceUpdate === null ? 'Nunca actualizado.' : `Actualizado hace ${minutesSinceUpdate} min`}
        {queueSource ? ` · ${queueSource === 'pedidos' ? 'estimado desde pedidos' : 'conteo de staff'}` : ''}
        {stale ? ` · Los clientes ven "dato no actualizado" (más de ${QUEUE_STALE_MINUTES} min).` : ''}
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" aria-label="Una persona menos" disabled={saving || !queueCount} onClick={() => setCount((queueCount ?? 0) - 1)} className={`${button} w-12 text-lg`}>
          −
        </button>
        <button type="button" aria-label="Una persona más" disabled={saving || (queueCount ?? 0) >= MAX_QUEUE} onClick={() => setCount((queueCount ?? 0) + 1)} className={`${button} w-12 text-lg`}>
          +
        </button>
        <button type="button" disabled={saving || queueCount === null} onClick={() => setCount(queueCount ?? 0)} className={button}>
          Confirmar dato
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button key={preset} type="button" disabled={saving} onClick={() => setCount(preset)} className={button}>
            {preset}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={saving} onClick={() => void estimateFromOrders()} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
          Estimar desde pedidos pendientes
        </button>
        <label htmlFor="queue-factor" className="text-sm text-foreground-700">Factor</label>
        <input
          id="queue-factor"
          type="number"
          min={0.1}
          max={10}
          step={0.1}
          value={factorInput}
          onChange={(event) => setFactorInput(event.target.value)}
          placeholder={String(queueFactor)}
          className="w-20 rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm"
        />
        <button type="button" disabled={saving || !factorInput} onClick={saveFactor} className={button}>
          Guardar factor
        </button>
      </div>
      <p className="mt-1 text-xs text-foreground-500">Personas estimadas = pedidos pendientes × factor (por defecto 1).</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="queue-note" className="sr-only">Nota para clientes</label>
        <input
          id="queue-note"
          type="text"
          maxLength={140}
          value={noteInput}
          onChange={(event) => setNoteInput(event.target.value)}
          placeholder={note ?? 'Nota para clientes (opcional)'}
          className="min-w-0 flex-1 rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm"
        />
        <button type="button" disabled={saving || !noteInput.trim()} onClick={saveNote} className={button}>
          Guardar nota
        </button>
        {note && (
          <button type="button" disabled={saving} onClick={() => void save({ note: null }, 'Nota quitada.')} className={button}>
            Quitar nota
          </button>
        )}
      </div>

      {message && <p className="mt-3 text-sm font-semibold text-primary-700">{message}</p>}
    </section>
  );
}
