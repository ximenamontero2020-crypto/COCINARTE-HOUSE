import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/price';
import CafeteriaCardPanel from './CafeteriaCardPanel';
import MockGatewayForm from './MockGatewayForm';
import type { PaymentMethod } from '@/pages/checkout/types';
import PopularRecommendations from './PopularRecommendations';
import CafeteriaNotice from '@/components/CafeteriaNotice';
import { useCafeteriaStatus } from '@/hooks/useCafeteriaStatus';

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: string }[] = [
  // Modo demostración: no cobra ni crea pedidos (ver src/lib/payments/mockGateway.ts).
  { id: 'pasarela', label: 'Tarjeta', desc: 'Débito o crédito', icon: 'ri-bank-card-line' },
  { id: 'cafeteria', label: 'Tarjeta Cocinarte', desc: 'Paga con tu saldo', icon: 'ri-bank-card-2-line' },
  { id: 'caja', label: 'Pagar en caja', desc: 'Efectivo al recoger · solo productos listos', icon: 'ri-store-2-line' },
];

// Efectivo solo si nada requiere preparación: si algo que se prepara se paga al recoger y el
// cliente no llega, la comida se desperdicia. El servidor (create_comanda) aplica la misma regla.
const CASH_BLOCKED_REASON =
  'Tu carrito tiene productos que se preparan al momento. Paga con tu tarjeta CocinArte o con tarjeta.';

export default function PaymentMethods({
  onConfirm,
  onMockPaid,
  cashAllowed,
}: {
  onConfirm: (method: 'cafeteria' | 'caja') => Promise<void>;
  // Solo muestra la pantalla de demostración: la pasarela nunca crea pedidos.
  onMockPaid: (reference: string) => void;
  cashAllowed: boolean;
}) {
  const { total } = useCart();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Con la cafetería cerrada no se puede confirmar (el servidor también lo rechaza).
  const { closed } = useCafeteriaStatus();
  const blocked = submitting || closed;

  const confirm = async (m: 'cafeteria' | 'caja') => {
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
          const disabled = m.id === 'caja' && !cashAllowed;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setMethod(m.id);
                setError('');
              }}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              } ${
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
                {disabled && (
                  <span className="mt-1 flex items-start gap-1 text-xs text-accent-700">
                    <i className="ri-information-line mt-px"></i>
                    <span>{CASH_BLOCKED_REASON}</span>
                  </span>
                )}
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
        {method === 'caja' && cashAllowed && (
          <div className="space-y-4">
            <p className="text-sm text-foreground-600 flex items-start gap-2">
              <i className="ri-information-line mt-0.5 text-foreground-500"></i>
              <span>Todos tus productos están listos: pagas en efectivo al recogerlos. No se hace ningún cargo en línea.</span>
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
          />
        )}
        {method === 'pasarela' && <MockGatewayForm total={total} onSuccess={onMockPaid} />}
      </div>
    </div>
  );
}
