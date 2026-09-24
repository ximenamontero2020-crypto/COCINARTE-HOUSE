export type MembershipLevel = 'sin_nivel' | 'bronce' | 'plata' | 'oro';

export const MEMBERSHIP_LEVELS: Record<MembershipLevel, {
  label: string;
  icon: string | null;
  badgeClassName: string;
  cardClassName: string;
  progressClassName: string;
}> = {
  sin_nivel: {
    label: 'Sin nivel',
    icon: null,
    badgeClassName: 'bg-foreground-400 text-background-50',
    cardClassName: 'border-background-300 bg-background-100',
    progressClassName: 'bg-foreground-400',
  },
  bronce: {
    label: 'Bronce',
    icon: 'ri-medal-2-fill',
    badgeClassName: 'bg-[#A0522D] text-[#fff4e9]',
    cardClassName: 'border-[#A0522D]/45 bg-[#fff4e9]',
    progressClassName: 'bg-[#A0522D]',
  },
  plata: {
    label: 'Plata',
    icon: 'ri-medal-fill',
    badgeClassName: 'bg-[#A9A9A9] text-white shadow-[0_0_8px_rgba(192,192,192,0.8)]',
    cardClassName: 'border-[#B8B8B8]/70 bg-[#f4f4f4]',
    progressClassName: 'bg-[#8D9398]',
  },
  oro: {
    label: 'Oro',
    icon: 'ri-vip-crown-2-fill',
    badgeClassName: 'bg-[#D4AF37] text-[#4b3500] shadow-[0_0_9px_rgba(255,215,0,0.75)]',
    cardClassName: 'membership-card-gold border-[#D4AF37]/75 bg-[#fff8d8]',
    progressClassName: 'bg-[#D4AF37]',
  },
};

/**
 * Gasto mensual mínimo (MXN) para cada nivel. Única fuente de estos umbrales en el front.
 * El nivel real lo recalcula el backend el día 1 de cada mes; si cambian estos valores,
 * actualiza también supabase/functions/send-membership-reminder-email (minimumSpend).
 */
export const MEMBERSHIP_THRESHOLDS = {
  bronce: 499,
  plata: 799,
  oro: 1500,
} as const;

const NEXT_LEVEL: Record<MembershipLevel, Exclude<MembershipLevel, 'sin_nivel'> | null> = {
  sin_nivel: 'bronce',
  bronce: 'plata',
  plata: 'oro',
  oro: null,
};

export type MembershipProgress = {
  next: { level: Exclude<MembershipLevel, 'sin_nivel'>; label: string; start: number; target: number } | null;
  remaining: number;
  percent: number;
};

/** Progreso del gasto del mes hacia el siguiente nivel (100% en Oro). */
export function membershipProgress(level: MembershipLevel, spend: number): MembershipProgress {
  const nextLevel = NEXT_LEVEL[level];
  if (!nextLevel) return { next: null, remaining: 0, percent: 100 };

  const start = level === 'sin_nivel' ? 0 : MEMBERSHIP_THRESHOLDS[level];
  const target = MEMBERSHIP_THRESHOLDS[nextLevel];
  return {
    next: { level: nextLevel, label: MEMBERSHIP_LEVELS[nextLevel].label, start, target },
    remaining: Math.max(0, target - spend),
    percent: Math.min(100, Math.max(0, ((spend - start) / (target - start)) * 100)),
  };
}

export function normalizeMembershipLevel(value: string | null | undefined): MembershipLevel {
  if (value === 'bronce' || value === 'plata' || value === 'oro') return value;
  return 'sin_nivel';
}
