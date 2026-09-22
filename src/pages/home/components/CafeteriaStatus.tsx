import { useCafeteriaStatus, CAFETERIA_LEVELS, type CafeteriaLevel } from '@/hooks/useCafeteriaStatus';

const styles: Record<CafeteriaLevel, { dot: string; glow: string; text: string }> = {
  green: { dot: 'bg-[#55a85a]', glow: 'shadow-[0_0_0_5px_rgba(85,168,90,0.18)]', text: 'text-[#d8e9bd]' },
  yellow: { dot: 'bg-[#f4c542]', glow: 'shadow-[0_0_0_5px_rgba(244,197,66,0.18)]', text: 'text-[#f8d978]' },
  red: { dot: 'bg-[#ed6a4e]', glow: 'shadow-[0_0_0_5px_rgba(237,106,78,0.18)]', text: 'text-[#ff9d89]' },
};

export default function CafeteriaStatus() {
  const { level, pendingCount, loading, manualLevel } = useCafeteriaStatus();
  const detail = CAFETERIA_LEVELS[level];
  const visual = styles[level];

  return (
    <section
      id="semaforo"
      aria-label="Semáforo actual de la cafetería"
      className="w-full scroll-mt-24 border-y border-background-200/60 bg-background-100 px-4 py-8 md:px-6"
    >
      <div className="mx-auto flex w-full max-w-6xl justify-center">
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
      </div>
    </section>
  );
}
