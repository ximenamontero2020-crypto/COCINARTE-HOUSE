import { MEMBERSHIP_LEVELS, normalizeMembershipLevel, type MembershipLevel } from '@/components/membership';

type CocinArteCardProps = {
  level: MembershipLevel;
  holderName: string;
  mode?: 'compact' | 'full';
};

const cardStyles: Record<MembershipLevel, {
  background: string;
  text: string;
  muted: string;
  chip: string;
  line: string;
}> = {
  sin_nivel: {
    background: 'bg-[linear-gradient(135deg,#363636_0%,#5d5d5d_52%,#777_100%)]',
    text: 'text-white',
    muted: 'text-white/65',
    chip: 'bg-[linear-gradient(135deg,#777_0%,#b0b0b0_50%,#656565_100%)]',
    line: 'border-white/15',
  },
  bronce: {
    background: 'bg-[linear-gradient(135deg,#6f3e20_0%,#a96832_42%,#cd7f32_62%,#8d4c28_100%)]',
    text: 'text-[#fff5e7]',
    muted: 'text-[#ffe0b9]/75',
    chip: 'bg-[linear-gradient(135deg,#9a5b2d_0%,#e0a15e_45%,#8c4c27_100%)]',
    line: 'border-[#f4c38e]/30',
  },
  plata: {
    background: 'bg-[linear-gradient(135deg,#596267_0%,#aeb5b8_30%,#eeeeee_52%,#9ba2a5_75%,#626b70_100%)]',
    text: 'text-[#20282c]',
    muted: 'text-[#26343a]/70',
    chip: 'bg-[linear-gradient(135deg,#8d969b_0%,#f2f2f2_46%,#a2aaad_100%)]',
    line: 'border-white/55',
  },
  oro: {
    background: 'bg-[linear-gradient(135deg,#8b6507_0%,#b8860b_24%,#ffd700_47%,#ffed4e_59%,#d4af37_78%,#8b6507_100%)]',
    text: 'text-[#342500]',
    muted: 'text-[#4f3b00]/75',
    chip: 'bg-[linear-gradient(135deg,#9b720d_0%,#fff09a_45%,#b8860b_100%)]',
    line: 'border-[#fff4a3]/55',
  },
};

function CardChip({ className }: { className: string }) {
  return (
    <span className={`relative block h-8 w-11 overflow-hidden rounded-md border border-black/20 shadow-inner md:h-10 md:w-14 ${className}`} aria-hidden="true">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-black/25" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-black/25" />
      <span className="absolute left-1/4 top-0 h-full w-px bg-black/20" />
      <span className="absolute right-1/4 top-0 h-full w-px bg-black/20" />
      <span className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
      <span className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
    </span>
  );
}

export default function CocinArteCard({ level, holderName, mode = 'full' }: CocinArteCardProps) {
  const safeLevel = normalizeMembershipLevel(level);
  const visual = MEMBERSHIP_LEVELS[safeLevel];
  const style = cardStyles[safeLevel];
  const isCompact = mode === 'compact';
  const displayName = holderName.trim() || 'CLIENTE COCINARTE';
  const levelLabel = safeLevel === 'sin_nivel' ? 'AÚN SIN NIVEL' : visual.label.toUpperCase();

  return (
    <div
      className={`cocinarte-card group relative aspect-[1.586/1] w-full overflow-hidden rounded-[18px] border shadow-[0_18px_35px_rgba(36,27,16,0.28)] transition-transform duration-500 ease-out hover:scale-[1.02] ${style.background} ${style.line} ${isCompact ? 'max-w-[330px]' : 'max-w-[560px]'}`}
      aria-label={`Tarjeta CocinArte ${visual.label}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(125deg,transparent_0,transparent_7px,rgba(255,255,255,0.22)_8px,transparent_9px)]" />
      <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full border border-white/20 bg-white/10 blur-2xl" />
      <div className={`relative flex h-full flex-col justify-between ${isCompact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`font-heading text-sm font-extrabold tracking-[0.28em] ${style.text}`}>COCINARTE</p>
            <p className={`mt-1 text-[8px] font-semibold uppercase tracking-[0.25em] ${style.muted}`}>HOUSE MEMBERSHIP</p>
          </div>
          <div className="flex items-center gap-2">
            {visual.icon && <i className={`${visual.icon} text-xl ${style.text}`} aria-hidden="true" />}
            <span className={`text-[10px] font-bold uppercase tracking-[0.16em] ${style.text}`}>{levelLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CardChip className={style.chip} />
          <span className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${style.muted}`}>CocinArte member</span>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[8px] uppercase tracking-[0.2em] ${style.muted}`}>Titular</p>
            <p className={`mt-1 truncate text-xs font-bold uppercase tracking-[0.16em] ${style.text}`}>{displayName}</p>
          </div>
          <p className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] ${style.muted}`}>MXN</p>
        </div>
      </div>

      {safeLevel === 'oro' && <span className="cocinarte-card__shine pointer-events-none absolute inset-0" aria-hidden="true" />}
    </div>
  );
}
