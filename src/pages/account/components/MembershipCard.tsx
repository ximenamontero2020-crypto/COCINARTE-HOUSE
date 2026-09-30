import { useState } from 'react';
import CocinArteCard from '@/components/CocinArteCard';
import CardRechargeDialog from '@/components/CardRechargeDialog';
import CardMovements from '@/components/CardMovements';
import { MEMBERSHIP_LEVELS, membershipProgress, normalizeMembershipLevel } from '@/components/membership';
import { useAuth } from '@/context/AuthContext';
import { useCafeteriaCard } from '@/hooks/useCafeteriaCard';

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
});

export default function MembershipCard() {
  const { profile } = useAuth();
  const level = normalizeMembershipLevel(profile?.membership_level);
  const spend = Math.max(0, Number(profile?.membership_current_spend ?? 0));
  const visual = MEMBERSHIP_LEVELS[level];
  const holderName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Cliente CocinArte';
  const { next: nextLevel, remaining, percent: progress } = membershipProgress(level, spend);
  const { card, error: cardError, recharge } = useCafeteriaCard();
  const [rechargeOpen, setRechargeOpen] = useState(false);

  return (
    <section aria-labelledby="membership-card-title">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground-600">Tarjeta CocinArte</p>
        <h2 id="membership-card-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">Tu membresía</h2>
      </div>
      <CocinArteCard level={level} holderName={holderName} mode="full" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-background-200 bg-background-50 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Saldo disponible</p>
          <p className="font-heading text-2xl font-extrabold text-foreground-950">
            {card ? currencyFormatter.format(card.balance) : cardError ? '—' : '…'}
          </p>
          {cardError && <p className="text-xs text-accent-700">{cardError}</p>}
        </div>
        <button
          type="button"
          onClick={() => setRechargeOpen(true)}
          disabled={!card}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className="ri-add-circle-line" aria-hidden="true"></i>
          Recargar saldo
        </button>
        <p className="w-full text-[11px] text-foreground-400">Modo demo — no se procesan pagos reales.</p>
      </div>
      <CardMovements refreshKey={card?.balance} />
      {rechargeOpen && <CardRechargeDialog onClose={() => setRechargeOpen(false)} onRecharge={recharge} />}
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
