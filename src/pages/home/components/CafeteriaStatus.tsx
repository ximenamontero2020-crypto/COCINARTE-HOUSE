import { useCafeteriaStatus, CAFETERIA_LEVELS, QUEUE_STALE_MINUTES, type CafeteriaLevel } from '@/hooks/useCafeteriaStatus';

const styles: Record<CafeteriaLevel, { dot: string; glow: string; text: string }> = {
  green: { dot: 'bg-[#55a85a]', glow: 'shadow-[0_0_0_5px_rgba(85,168,90,0.18)]', text: 'text-[#d8e9bd]' },
  yellow: { dot: 'bg-[#f4c542]', glow: 'shadow-[0_0_0_5px_rgba(244,197,66,0.18)]', text: 'text-[#f8d978]' },
  red: { dot: 'bg-[#ed6a4e]', glow: 'shadow-[0_0_0_5px_rgba(237,106,78,0.18)]', text: 'text-[#ff9d89]' },
};

export default function CafeteriaStatus() {
  const { level, pendingCount, loading, manualLevel, queueCount, note, minutesSinceUpdate } = useCafeteriaStatus();
  const detail = CAFETERIA_LEVELS[level];
  const visual = styles[level];
  const stale = minutesSinceUpdate === null || minutesSinceUpdate > QUEUE_STALE_MINUTES;
  const updatedText =
    minutesSinceUpdate === null ? '' : minutesSinceUpdate < 1 ? 'Actualizado hace un momento' : `Actualizado hace ${minutesSinceUpdate} min`;

  return (
    <section
      id="semaforo"
      aria-label="Semáforo actual de la cafetería"
      className="w-full scroll-mt-24 border-y border-background-200/60 bg-background-100 px-4 py-8 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
        <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-2xl border border-[#d4a017]/35 bg-[#3b2a1a] px-4 py-3.5 shadow-[0_14px_30px_rgba(59,42,26,0.18)] md:px-5">
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d4a017]/45 bg-[#66703a]">
              <span className={`h-4 w-4 rounded-full ${visual.dot} ${visual.glow}`} />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#d4a017]">Flujo de personas ahora</span>
              <span className={`mt-0.5 block text-base font-bold ${visual.text}`}>{loading ? 'Consultando…' : detail.label}</span>
            </span>
          </span>
          <span className="hidden shrink-0 text-right sm:block">
            <span className="block text-xs font-medium text-[#f4ead8]/70">
              {manualLevel ? 'Indicado por staff' : 'En los últimos 60 min'}
            </span>
            <span className="mt-0.5 block text-sm font-bold text-[#f4ead8]">
              {manualLevel ? 'Modo manual' : `${pendingCount} pedidos`}
            </span>
          </span>
        </div>

        {/* Fila: dato de staff o estimado. Se actualiza en tiempo real vía useCafeteriaStatus. */}
        {!loading && (queueCount !== null || note) && (
          <div className="mt-2 w-full max-w-xl px-1 text-sm" aria-live="polite">
            {queueCount !== null && (
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="font-bold text-foreground-950">
                Aprox. {queueCount} {queueCount === 1 ? 'persona' : 'personas'} en fila
              </span>
              {updatedText && <span className="text-xs text-foreground-600">{updatedText}</span>}
            </p>
            )}
            {queueCount !== null && stale && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <i className="ri-time-line" aria-hidden="true" />
                Dato no actualizado: puede no reflejar la fila actual.
              </p>
            )}
            {note && <p className="mt-1 text-xs text-foreground-600">{note}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
