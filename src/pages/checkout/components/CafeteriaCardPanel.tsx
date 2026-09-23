import { useState } from 'react';
import { useCafeteriaCard } from '@/hooks/useCafeteriaCard';
import { useAuth } from '@/context/AuthContext';
import CocinArteCard from '@/components/CocinArteCard';
import { normalizeMembershipLevel } from '@/components/membership';
import { formatPrice } from '@/utils/price';
import { generateOrderNumber } from '@/utils/order';
import { playFoley } from '@/hooks/useFoley';
import type { OrderInfo } from '@/pages/checkout/types';

const PRESETS = [50, 100, 200, 500];

export default function CafeteriaCardPanel({
  total,
  onSuccess,
}: {
  total: number;
  onSuccess: (info: OrderInfo) => void;
}) {
  const { card, recharge, spend, loading, error } = useCafeteriaCard();
  const { user, profile } = useAuth();
  const [custom, setCustom] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const missing = Math.max(0, total - card.balance);
  const canPay = Boolean(user) && card.balance >= total && !loading && !busy;

  const doRecharge = async (amount: number) => {
    if (amount <= 0 || busy) return;
    setBusy(true);
    const ok = await recharge(amount);
    setBusy(false);
    if (!ok) return;
    playFoley('success');
    setNotice(`Recargaste ${formatPrice(amount)}. Saldo actualizado.`);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const handleCustom = () => {
    const n = Number(custom);
    if (Number.isFinite(n) && n > 0) {
      void doRecharge(n);
      setCustom('');
    }
  };

  const handlePay = async () => {
    if (!canPay || busy) return;
    setBusy(true);
    const ok = await spend(total);
    setBusy(false);
    if (!ok) return;
    playFoley('success');
    onSuccess({ orderNumber: generateOrderNumber(), method: 'cafeteria', total });
  };

  return (
    <div className="mt-5 space-y-4">
      <CocinArteCard
        level={normalizeMembershipLevel(profile?.membership_level)}
        holderName={profile?.name?.trim() || profile?.email?.split('@')[0] || 'Cliente CocinArte'}
        mode="compact"
      />

      <div className="rounded-xl border border-background-200/70 bg-background-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-500">Saldo disponible</span>
          <span className="font-heading text-xl font-extrabold text-foreground-950">
            {loading ? '…' : formatPrice(card.balance)}
          </span>
        </div>
        {card.number ? (
          <span className="mt-1 block text-xs text-foreground-500 font-mono">{card.number}</span>
        ) : (
          <span className="mt-1 block text-xs text-foreground-500">Recargable para tus pedidos en CocinArte</span>
        )}
      </div>

      {!user && (
        <p className="text-sm text-accent-900 bg-accent-100 rounded-lg px-3 py-2">
          Inicia sesión para usar el saldo de tu tarjeta de cafetería.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-800 bg-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {notice && (
        <p className="text-sm text-primary-700 bg-primary-100 rounded-lg px-3 py-2">{notice}</p>
      )}

      {!canPay && user && !loading && (
        <div className="rounded-xl bg-accent-100 text-accent-900 text-sm px-4 py-3 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>
            Saldo insuficiente. Te faltan <strong>{formatPrice(missing)}</strong> para cubrir tu
            pedido.
          </span>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-foreground-800 mb-2">Recargar saldo</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => void doRecharge(p)}
              disabled={!user || busy || loading}
              className="rounded-full bg-secondary-100 text-secondary-900 text-sm font-semibold px-4 py-2 hover:bg-secondary-200 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +{formatPrice(p)}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Monto personalizado"
            disabled={!user || busy || loading}
            className="flex-1 rounded-md border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400 disabled:opacity-50"
          />
          <button
            onClick={handleCustom}
            disabled={!user || busy || loading}
            className="rounded-md bg-primary-500 text-background-50 text-sm font-semibold px-4 py-2.5 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Recargar
          </button>
        </div>
      </div>

      <button
        onClick={() => void handlePay()}
        disabled={!canPay}
        className={`w-full rounded-full py-3 font-semibold text-sm transition-colors whitespace-nowrap ${
          canPay
            ? 'bg-accent-500 text-foreground-950 hover:bg-accent-600 cursor-pointer'
            : 'bg-background-200 text-foreground-400 cursor-not-allowed'
        }`}
      >
        {busy ? 'Procesando…' : `Pagar con saldo ${formatPrice(total)}`}
      </button>
    </div>
  );
}
