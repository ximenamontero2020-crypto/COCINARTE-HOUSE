import CocinArteCard from '@/components/CocinArteCard';
import { MEMBERSHIP_LEVELS, normalizeMembershipLevel } from '@/components/membership';
import { useAuth } from '@/context/AuthContext';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

const nextLevelConfig = {
  sin_nivel: { label: 'Bronce', start: 0, target: 499 },
  bronce: { label: 'Plata', start: 499, target: 799 },
  plata: { label: 'Oro', start: 799, target: 1500 },
};

export default function MembershipCard() {
  const { profile } = useAuth();
  const level = normalizeMembershipLevel(profile?.membership_level);
  const spend = Math.max(0, Number(profile?.membership_current_spend ?? 0));
  const visual = MEMBERSHIP_LEVELS[level];
  const holderName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Cliente CocinArte';
  const nextLevel = level === 'oro' ? null : nextLevelConfig[level];
  const remaining = nextLevel ? Math.max(0, nextLevel.target - spend) : 0;
  const progress = nextLevel
    ? Math.min(100, Math.max(0, ((spend - nextLevel.start) / (nextLevel.target - nextLevel.start)) * 100))
    : 100;

  return (
    <section aria-labelledby="membership-card-title">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground-600">Tarjeta CocinArte</p>
        <h2 id="membership-card-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Tu membresía</h2>
      </div>
      <CocinArteCard level={level} holderName={holderName} mode="full" />
      <div className={`mt-5 rounded-2xl border p-5 md:p-7 ${visual.cardClassName}`}>
        {nextLevel ? (
          <div className="mt-7">
            <p className="font-heading text-2xl font-extrabold leading-tight text-foreground-950 md:text-3xl">
              ¡Te faltan {currencyFormatter.format(remaining)} para alcanzar {nextLevel.label}!
            </p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-label={`Progreso hacia ${nextLevel.label}`} aria-valuemin={nextLevel.start} aria-valuemax={nextLevel.target} aria-valuenow={Math.min(spend, nextLevel.target)}>
              <div className={`h-full rounded-full transition-[width] duration-700 ${visual.progressClassName}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <p className="font-heading text-2xl font-extrabold leading-tight text-[#6f5200] md:text-3xl">
            ¡Felicidades, alcanzaste el nivel máximo! 🎉
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-foreground-500">
          Gasto este mes: {currencyFormatter.format(spend)}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-foreground-600">
          Tu nivel se recalcula el día 1 de cada mes según tus compras del mes en curso.
        </p>
      </div>
    </section>
  );
}
