import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/price';
import { generateOrderNumber } from '@/utils/order';
import CardForm from './CardForm';
import CafeteriaCardPanel from './CafeteriaCardPanel';
import type { OrderInfo, PaymentMethod } from '@/pages/checkout/types';
import PopularRecommendations from './PopularRecommendations';

const METHODS: { id: PaymentMethod; label: string; desc: string; icon: string }[] = [
  { id: 'tarjeta', label: 'Tarjeta', desc: 'Débito o crédito', icon: 'ri-bank-card-line' },

  { id: 'cafeteria', label: 'Tarjeta Cocinarte', desc: 'Recargable con saldo', icon: 'ri-bank-card-2-line' },
];

export default function PaymentMethods({
  onSuccess,
}: {
  onSuccess: (info: OrderInfo) => void;
}) {
  const { total } = useCart();
  const [method, setMethod] = useState<PaymentMethod | null>(null);

  return (
    <div className="rounded-2xl bg-background-50 border border-background-200/70 p-5 md:p-6">
      <h2 className="font-heading font-bold text-xl text-foreground-950">Método de pago</h2>
      <p className="mt-1 text-sm text-foreground-500">Elige cómo quieres pagar tu pedido.</p>

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
              onClick={() => setMethod(m.id)}
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

      <div className="mt-5">
        {method === 'tarjeta' && <CardForm total={total} onSuccess={onSuccess} />}
        {method === 'cafeteria' && <CafeteriaCardPanel total={total} onSuccess={onSuccess} />}
      </div>
    </div>
  );
}