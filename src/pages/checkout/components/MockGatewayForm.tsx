import { useState } from 'react';
import { formatPrice } from '@/utils/price';
import { playFoley } from '@/hooks/useFoley';
import { mockGateway, type PaymentGateway } from '@/lib/payments/mockGateway';

/**
 * Pago con tarjeta en MODO DEMOSTRACIÓN: solo llama a gateway.charge (simulado). No crea
 * comandas, no escribe en Supabase y no manda nada a cocina. Para un proveedor real basta
 * con pasar otro `gateway` que implemente PaymentGateway.
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
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    setNumber(digits.replace(/(.{4})/g, '$1 ').trim());
  };

  const handleExpiry = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4);
    setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processing) return;
    if (
      !name.trim() ||
      number.replace(/\s/g, '').length < 12 ||
      !/^\d{2}\/\d{2}$/.test(expiry) ||
      cvv.length < 3
    ) {
      setError('Revisa los datos de tu tarjeta antes de continuar.');
      return;
    }
    setError('');
    setProcessing(true);
    const result = await gateway.charge({ amount: total, cardNumber: number, cardholder: name, expiry, cvv });
    if (result.ok) {
      playFoley('success');
      onSuccess(result.reference ?? 'DEMO');
    } else {
      setProcessing(false);
      setError(result.error ?? 'No pudimos procesar tu tarjeta. Inténtalo de nuevo.');
    }
  };

  const inputClass =
    'w-full rounded-md border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400';

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-3">
      <div>
        <label className="block text-xs font-medium text-foreground-600 mb-1.5">
          Nombre en la tarjeta
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Ana García"
          className={inputClass}
          disabled={processing}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-foreground-600 mb-1.5">
          Número de tarjeta
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={number}
          onChange={(e) => handleNumber(e.target.value)}
          placeholder="1234 5678 9012 3456"
          className={inputClass}
          disabled={processing}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground-600 mb-1.5">
            Vencimiento
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={expiry}
            onChange={(e) => handleExpiry(e.target.value)}
            placeholder="MM/AA"
            className={inputClass}
            disabled={processing}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-600 mb-1.5">CVV</label>
          <input
            type="password"
            inputMode="numeric"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            className={inputClass}
            disabled={processing}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-accent-700 bg-accent-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <i className="ri-error-warning-line mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={processing}
        className={`w-full rounded-full py-3 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap ${
          processing
            ? 'bg-background-200 text-foreground-400 cursor-not-allowed'
            : 'bg-primary-500 text-background-50 hover:bg-primary-600'
        }`}
      >
        {processing ? (
          <span className="inline-flex items-center gap-2">
            <i className="ri-loader-4-line animate-spin"></i>
            Procesando pago…
          </span>
        ) : (
          `Pagar ${formatPrice(total)}`
        )}
      </button>

      <p className="text-center text-[11px] text-foreground-400">
        Pago con tarjeta en modo demostración: no se realiza ningún cargo.
      </p>
    </form>
  );
}
