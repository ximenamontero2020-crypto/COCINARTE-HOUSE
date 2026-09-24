import { useState } from 'react';
import { formatPrice } from '@/utils/price';
import { MOCK_TEST_CARDS, mockGateway, type PaymentGateway } from '@/lib/payments/mockGateway';

const inputClass =
  'w-full rounded-xl border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400';

const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const formatExpiry = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/**
 * Pasarela de pago PROTOTIPO: solo llama a gateway.charge (simulado). No crea
 * comandas, no escribe en Supabase y no manda nada a cocina.
 */
export default function MockGatewayForm({
  total,
  onSuccess,
  gateway = mockGateway,
}: {
  total: number;
  onSuccess: (reference: string) => void;
  gateway?: PaymentGateway;
}) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardholder, setCardholder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return;
    setError('');
    setProcessing(true);
    const result = await gateway.charge({ amount: total, cardNumber, cardholder, expiry, cvv });
    setProcessing(false);
    if (result.ok) {
      onSuccess(result.reference ?? 'DEMO');
    } else {
      setError(result.error ?? 'El pago simulado fue rechazado.');
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold px-3 py-1 whitespace-nowrap">
        <i className="ri-flask-line"></i>
        Prototipo · no se realiza ningún cobro
      </span>

      <div className="grid gap-3">
        <label className="block">
          <span className="block text-xs font-semibold text-foreground-600 mb-1">Número de tarjeta</span>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="off"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            disabled={processing}
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-foreground-600 mb-1">Nombre en la tarjeta</span>
          <input
            className={inputClass}
            autoComplete="off"
            placeholder="Como aparece en la tarjeta"
            value={cardholder}
            onChange={(e) => setCardholder(e.target.value)}
            disabled={processing}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-semibold text-foreground-600 mb-1">Vencimiento</span>
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/AA"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              disabled={processing}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-foreground-600 mb-1">CVV</span>
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="off"
              placeholder="123"
              value={cvv}
              onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              disabled={processing}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-background-200/70 bg-background-100 px-4 py-3 text-xs text-foreground-600">
        <p className="font-semibold text-foreground-700 mb-1">Tarjetas de prueba (cualquier fecha futura y CVV)</p>
        <ul className="space-y-0.5">
          {MOCK_TEST_CARDS.map((card) => (
            <li key={card.number}>
              <button
                type="button"
                onClick={() => setCardNumber(card.number)}
                disabled={processing}
                className="font-mono underline cursor-pointer"
              >
                {card.number}
              </button>{' '}
              · {card.result}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}

      <p className="text-sm text-foreground-600 flex items-start gap-2">
        <i className="ri-information-line mt-0.5 text-foreground-500"></i>
        <span>Es una demostración: no se cobra nada y no se envía ningún pedido a cocina.</span>
      </p>

      <button
        type="submit"
        disabled={processing}
        className={`w-full rounded-full py-3 font-semibold text-sm transition-colors whitespace-nowrap ${
          processing
            ? 'bg-background-200 text-foreground-400 cursor-not-allowed'
            : 'bg-primary-500 text-background-50 hover:bg-primary-600 cursor-pointer'
        }`}
      >
        {processing ? 'Procesando pago simulado…' : `Simular pago · ${formatPrice(total)}`}
      </button>
    </form>
  );
}
