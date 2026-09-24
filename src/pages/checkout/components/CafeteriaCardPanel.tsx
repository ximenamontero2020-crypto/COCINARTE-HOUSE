import { useCafeteriaCard } from '@/hooks/useCafeteriaCard';
import { useAuth } from '@/context/AuthContext';
import CocinArteCard from '@/components/CocinArteCard';
import { normalizeMembershipLevel } from '@/components/membership';
import { formatPrice } from '@/utils/price';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

export default function CafeteriaCardPanel({
  total,
  submitting,
  closed,
  onPay,
}: {
  total: number;
  submitting: boolean;
  closed: boolean;
  onPay: () => Promise<void>;
}) {
  const { card, error, refresh } = useCafeteriaCard();
  const { profile } = useAuth();

  const balance = card?.balance ?? 0;
  const insufficient = card !== null && balance < total;
  // Solo para la UI: el servidor vuelve a leer el saldo real al cobrar y rechaza si no alcanza.
  const canPay = card !== null && !insufficient && !submitting && !closed;

  return (
    <div className="space-y-4">
      <CocinArteCard
        level={normalizeMembershipLevel(profile?.membership_level)}
        holderName={profile?.name?.trim() || profile?.email?.split('@')[0] || 'Cliente CocinArte'}
        mode="compact"
      />

      <div className="rounded-xl border border-background-200/70 bg-background-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Saldo disponible</span>
          <span className="font-heading text-xl font-extrabold text-foreground-950">
            {card ? formatPrice(balance) : '…'}
          </span>
        </div>
        {card && <span className="mt-1 block text-xs text-foreground-500">Tarjeta {card.number}</span>}
      </div>

      {error && <p className="text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2">{error}</p>}

      {insufficient && (
        <div role="alert" className="rounded-xl bg-accent-100 text-accent-900 text-sm px-4 py-3 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>
            Saldo insuficiente. Tu saldo es {pesos.format(balance)}; el pedido es {pesos.format(total)}. Recarga en
            caja o usa otro método de pago.
          </span>
        </div>
      )}

      <p className="text-sm text-foreground-600 flex items-start gap-2">
        <i className="ri-information-line mt-0.5 text-foreground-500"></i>
        <span>Recarga saldo en caja mostrando el número de tu tarjeta.</span>
      </p>

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
