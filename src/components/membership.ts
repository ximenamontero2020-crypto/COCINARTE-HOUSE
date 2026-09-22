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

export function normalizeMembershipLevel(value: string | null | undefined): MembershipLevel {
  if (value === 'bronce' || value === 'plata' || value === 'oro') return value;
  return 'sin_nivel';
}
