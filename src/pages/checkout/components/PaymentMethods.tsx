import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/price';
import CafeteriaCardPanel from './CafeteriaCardPanel';
import type { PaymentMethod } from '@/pages/checkout/types';
import PopularRecommendations from './PopularRecommendations';
import CafeteriaNotice from '@/components/CafeteriaNotice';
import { useCafeteriaStatus } from '@/hooks/useCafeteriaStatus';

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: string }[] = [
  { id: 'caja', label: 'Pagar en caja', desc: 'Efectivo al recoger tu pedido', icon: 'ri-store-2-line' },
  { id: 'cafeteria', label: 'Tarjeta Cocinarte', desc: 'Paga con tu saldo', icon: 'ri-bank-card-2-line' },
];

export default function PaymentMethods({
  onConfirm,
}: {
  onConfirm: (method: PaymentMethod) => Promise<void>;
}) {
  const { total } = useCart();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Con la cafetería cerrada no se puede confirmar (el servidor también lo rechaza).
  const { closed } = useCafeteriaStatus();
  const blocked = submitting || closed;

  const confirm = async (m: PaymentMethod) => {
    if (blocked) return;
    setError('');
    setSubmitting(true);
    try {
      await onConfirm(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos registrar tu pedido. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-background-50 border border-background-200/70 p-5 md:p-6">
      <h2 className="font-heading font-bold text-xl text-foreground-950">Método de pago</h2>
      <p className="mt-1 text-sm text-foreground-500">Elige cómo quieres pagar tu pedido.</p>

      <CafeteriaNotice className="mt-4 overflow-hidden rounded-xl" />

      <div className="mt-5">
        <PopularRecommendations />
      </div>

      <div className="mt-5 grid gap-3">
        {METHODS.map((m) => {
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMethod(m.id);
                setError('');
              }}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'border-primary-400 bg-primary-100/60'
                  : 'border-background-200/70 bg-background-50 hover:bg-background-100'
              }`}
            >
              <span
                className={`w-11 h-11 flex items-center justify-center rounded-full text-xl ${
                  active ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600'
                }`}
              >
                <i className={m.icon}></i>
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-foreground-950 text-sm">{m.label}</span>
                <span className="block text-xs text-foreground-500">{m.desc}</span>
              </span>
              <span
                className={`w-5 h-5 flex items-center justify-center rounded-full border-2 ${
                  active ? 'border-primary-500' : 'border-background-300'
                }`}
              >
                {active && <span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span>}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-5 text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}

      <div className="mt-5">
        {method === 'caja' && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-600 flex items-start gap-2">
              <i className="ri-information-line mt-0.5 text-foreground-500"></i>
              <span>Tu pedido se paga al recoger. No se hace ningún cargo en línea.</span>
            </p>
            <button
              type="button"
              onClick={() => void confirm('caja')}
              disabled={blocked}
              className={`w-full rounded-full py-3 font-semibold text-sm transition-colors whitespace-nowrap ${
                blocked
                  ? 'bg-background-200 text-foreground-400 cursor-not-allowed'
                  : 'bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer'
              }`}
            >
              {submitting ? 'Enviando pedido…' : closed ? 'Cafetería cerrada' : `Confirmar pedido · ${formatPrice(total)}`}
            </button>
          </div>
        )}
        {method === 'cafeteria' && (
          <CafeteriaCardPanel
            total={total}
            submitting={submitting}
            closed={closed}
            onPay={() => confirm('cafeteria')}
            onChooseCaja={() => {
              setMethod('caja');
              setError('');
            }}
          />
        )}
      </div>
    </div>
  );
}
