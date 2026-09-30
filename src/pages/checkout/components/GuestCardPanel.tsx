import { useState } from 'react';
import { useGuestCard } from '@/hooks/useGuestCard';
import CocinArteCard from '@/components/CocinArteCard';
import CardRechargeDialog from '@/components/CardRechargeDialog';
import { normalizeMembershipLevel } from '@/components/membership';
import { formatPrice } from '@/utils/price';
import { GUEST_CARD_NOTICE } from '@/lib/guestCard';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Tarjeta CocinArte de INVITADO en el checkout: saldo, recarga demo y pago (pay_with_guest_card). */
export default function GuestCardPanel({
  total,
  submitting,
  closed,
  guestReady,
  onPay,
}: {
  total: number;
  submitting: boolean;
  closed: boolean;
  // El pedido necesita nombre (GuestDetails) antes de pagar.
  guestReady: boolean;
  onPay: () => Promise<void>;
}) {
  const { card, error, refresh, recharge } = useGuestCard();
  const [rechargeOpen, setRechargeOpen] = useState(false);

  const balance = card?.balance ?? 0;
  const insufficient = card !== null && balance < total;
  // Solo para la UI: el servidor vuelve a leer el saldo al cobrar y rechaza si no alcanza.
  const canPay = card !== null && !insufficient && !submitting && !closed && guestReady;

  return (
    <div className="space-y-4">
      <CocinArteCard level={normalizeMembershipLevel(null)} holderName="Invitado" mode="compact" />

      <p role="note" className="flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-900">
        <i className="ri-time-line mt-px" aria-hidden="true"></i>
        <span>{GUEST_CARD_NOTICE}</span>
      </p>

      <div className="rounded-xl border border-background-200/70 bg-background-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Saldo disponible</span>
          <span className="font-heading text-xl font-extrabold text-foreground-950">
            {card ? formatPrice(balance) : '…'}
          </span>
        </div>
        {card?.number && <span className="mt-1 block text-xs text-foreground-500">Tarjeta de invitado {card.number}</span>}
        <button
          type="button"
          onClick={() => setRechargeOpen(true)}
          disabled={!card || submitting}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-300 px-4 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:py-2"
        >
          <i className="ri-add-circle-line" aria-hidden="true"></i>
          Recargar saldo
        </button>
        <p className="mt-1 text-[11px] text-foreground-400">Modo demo — no se procesan pagos reales.</p>
      </div>
      {rechargeOpen && (
        <CardRechargeDialog onClose={() => setRechargeOpen(false)} onRecharge={recharge} notice={GUEST_CARD_NOTICE} />
      )}

      {error && <p className="text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2">{error}</p>}

      {insufficient && (
        <div role="alert" className="rounded-xl bg-accent-100 text-accent-900 text-sm px-4 py-3 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>
            Saldo insuficiente. Tu saldo es {pesos.format(balance)}; el pedido es {pesos.format(total)}. Usa «Recargar
            saldo» o elige otro método de pago.
          </span>
        </div>
      )}

      {!guestReady && (
        <p className="text-sm text-accent-700 flex items-start gap-2">
          <i className="ri-user-line mt-0.5"></i>
          <span>Escribe tu nombre en «Tus datos» para confirmar el pedido.</span>
        </p>
      )}

      <button
        type="button"
        // Tras intentar pagar se relee el saldo: si el servidor rechazó, el aviso se actualiza.
        onClick={() => void onPay().then(refresh)}
        disabled={!canPay}
        className={`w-full rounded-full py-3 font-semibold text-sm transition-colors whitespace-nowrap ${
          canPay
            ? 'bg-accent-500 text-foreground-950 hover:bg-accent-600 cursor-pointer'
            : 'bg-background-200 text-foreground-400 cursor-not-allowed'
        }`}
      >
        {submitting ? 'Procesando…' : closed ? 'Cafetería cerrada' : `Pagar con saldo ${formatPrice(total)}`}
      </button>
    </div>
  );
}
