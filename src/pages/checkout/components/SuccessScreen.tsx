import { Link } from 'react-router-dom';
import { formatPrice } from '@/utils/price';
import GranoVoladorGame from './GranoVoladorGame';
import LluviaEspressoGame from './LluviaEspressoGame';
import type { OrderInfo } from '@/pages/checkout/types';

const METHOD_DETAIL: Record<
  OrderInfo['method'],
  { icon: string; heading: string; title: string; totalLabel: string; hint: string }
> = {
  // Efectivo solo para productos listos (no requieren preparación).
  caja: {
    icon: 'ri-store-2-line',
    heading: '¡Pedido confirmado!',
    title: 'Pago en caja · solo productos listos',
    totalLabel: 'Total a pagar en caja',
    hint: 'Tus productos ya están listos: paga en efectivo al recogerlos. Menciona tu número de pedido en caja.',
  },
  cafeteria: {
    icon: 'ri-bank-card-2-line',
    heading: '¡Pedido confirmado!',
    title: 'Tarjeta Cocinarte',
    totalLabel: 'Total pagado',
    hint: 'El saldo fue descontado de tu tarjeta.',
  },
  // Modo demostración: no se cobró nada y no se creó ningún pedido.
  pasarela: {
    icon: 'ri-flask-line',
    heading: 'Pago simulado',
    title: 'Tarjeta · Modo demostración',
    totalLabel: 'Monto simulado (no se cobró)',
    hint: 'Esto fue una simulación: no se realizó ningún cobro y NO se envió ningún pedido a cocina. Para pedir de verdad, paga con tu tarjeta CocinArte.',
  },
};

export default function SuccessScreen({ order }: { order: OrderInfo }) {
  const d = METHOD_DETAIL[order.method];

  return (
    <div className="max-w-lg mx-auto text-center py-8">
      <span className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-primary-100 text-primary-600 text-3xl">
        <i className="ri-check-line"></i>
      </span>
      <h1 className="mt-6 font-heading font-extrabold text-3xl text-foreground-950">
        {d.heading}
      </h1>
      <p className="mt-2 text-foreground-600 text-sm">{d.title}</p>

      <div className="mt-8 rounded-2xl bg-background-50 border border-background-200/70 p-6 text-left">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 flex items-center justify-center rounded-full bg-accent-100 text-accent-700 text-xl">
            <i className={d.icon}></i>
          </span>
          <div>
            <p className="text-xs text-foreground-500">
              {order.method === 'pasarela' ? 'Referencia de demostración' : 'Número de pedido'}
            </p>
            <p className="font-heading font-bold text-xl text-foreground-950">
              {order.method === 'pasarela' ? order.reference : order.orderNumber}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-background-200/70 pt-4">
          <span className="text-sm text-foreground-600">{d.totalLabel}</span>
          <span className="font-heading font-bold text-xl text-foreground-950">
            {formatPrice(order.total)}
          </span>
        </div>
        <p className="mt-4 text-sm text-foreground-600 flex items-start gap-2">
          <i className="ri-information-line mt-0.5 text-foreground-500"></i>
          <span>{d.hint}</span>
        </p>
      </div>

      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 text-background-50 font-semibold text-sm px-6 py-3 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
      >
        <i className="ri-arrow-left-line"></i>
        Volver al menú
      </Link>

      <div className="mt-10 text-left space-y-6">
        <GranoVoladorGame />
        <LluviaEspressoGame />
      </div>
    </div>
  );
}