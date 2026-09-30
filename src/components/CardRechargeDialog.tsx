import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MockGatewayForm from '@/pages/checkout/components/MockGatewayForm';
import { mockGateway, type PaymentGateway } from '@/lib/payments/mockGateway';
import { formatPrice } from '@/utils/price';

// Mismos límites que demo_self_recharge; el servidor vuelve a validar.
const PRESETS = [50, 100, 200, 500];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 1000;

function parseAmount(raw: string): number | null {
  const clean = raw.replace(',', '.').trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value >= MIN_AMOUNT && value <= MAX_AMOUNT ? value : null;
}

type Step = 'amount' | 'pay' | 'done';

/**
 * Recarga DEMO de la Tarjeta CocinArte (prototipo académico). El pago es simulado con la
 * misma pasarela demo del checkout: no se cobra nada ni se guarda ningún dato de tarjeta.
 * El saldo sí se abona de verdad en card_accounts vía demo_self_recharge.
 */
export default function CardRechargeDialog({
  onClose,
  onRecharge,
  notice,
}: {
  onClose: () => void;
  // Devuelve el saldo nuevo. requestId se repite en reintentos: el servidor abona una sola vez.
  onRecharge: (amount: number, requestId: string) => Promise<number>;
  // Aviso extra (p. ej. tarjeta de invitado temporal).
  notice?: string;
}) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);
  // Referencia de la pasarela demo (DEMO-…), como en la pantalla "Pago simulado" del checkout.
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  // Una llave por recarga: si el usuario da doble clic o reintenta, el servidor no duplica.
  const requestId = useRef(crypto.randomUUID());
  const inFlight = useRef(false);

  const customAmount = custom === '' ? null : parseAmount(custom);
  const customInvalid = custom !== '' && customAmount === null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const choose = (value: number) => {
    // Nuevo monto = nueva recarga: nueva llave de idempotencia.
    if (value !== amount) requestId.current = crypto.randomUUID();
    setAmount(value);
    setStep('pay');
  };

  // Misma pasarela demo, pero el diálogo no se puede cerrar desde el cobro simulado hasta que
  // responde el servidor (handlePaid libera `busy`). Si el cobro simulado falla, se libera aquí.
  const lockingGateway: PaymentGateway = {
    async charge(input) {
      setBusy(true);
      const result = await mockGateway.charge(input);
      if (!result.ok) setBusy(false);
      return result;
    },
  };

  const handlePaid = async (reference: string) => {
    if (inFlight.current || amount === null) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const balance = await onRecharge(amount, requestId.current);
      setReference(reference);
      setNewBalance(balance);
      setStep('done');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  // Portal al final de <body> con el mismo z-index que los botones flotantes (música/chat):
  // si no, quedan encima del diálogo y tapan montos y botones.
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex: 2147483647 }}
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-recharge-title"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background-50 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Tarjeta CocinArte</p>
            <h2 id="card-recharge-title" className="mt-1 font-heading text-xl font-extrabold text-foreground-950">
              Recargar saldo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-background-100 text-foreground-700 transition-colors hover:bg-background-200 disabled:opacity-50 md:h-9 md:w-9"
            aria-label="Cerrar"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        <p role="note" className="mt-2 flex items-start gap-1.5 text-xs text-foreground-500">
          <i className="ri-flask-line" aria-hidden="true"></i>
          <span>Modo demo — no se procesan pagos reales; es una simulación para el prototipo.</span>
        </p>
        {notice && (
          <p role="note" className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent-50 px-2.5 py-2 text-xs text-accent-900">
            <i className="ri-time-line" aria-hidden="true"></i>
            <span>{notice}</span>
          </p>
        )}

        {step === 'amount' && (
          <div className="mt-5">
            <p className="text-sm font-medium text-foreground-700">¿Cuánto quieres recargar?</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => choose(value)}
                  className="min-h-11 rounded-xl border border-background-200 bg-background-100 px-3 font-heading text-base font-bold text-foreground-900 transition-colors hover:border-primary-400 hover:bg-primary-50"
                >
                  {formatPrice(value)}
                </button>
              ))}
            </div>

            <form
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (customAmount !== null) choose(customAmount);
              }}
            >
              <label htmlFor="recharge-custom" className="block text-xs font-medium text-foreground-600">
                Otro monto (de {formatPrice(MIN_AMOUNT)} a {formatPrice(MAX_AMOUNT)})
              </label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-500">MXN</span>
                  <input
                    id="recharge-custom"
                    type="text"
                    inputMode="decimal"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="150"
                    aria-invalid={customInvalid}
                    className="h-11 w-full rounded-md border border-background-200/70 bg-background-50 pl-12 pr-3 text-sm text-foreground-900 placeholder:text-foreground-400 focus:border-primary-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={customAmount === null}
                  className="min-h-11 shrink-0 rounded-full bg-primary-500 px-5 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-background-200 disabled:text-foreground-400"
                >
                  Continuar
                </button>
              </div>
              {customInvalid && (
                <p className="mt-1.5 text-xs text-accent-700">
                  Escribe un monto de {formatPrice(MIN_AMOUNT)} a {formatPrice(MAX_AMOUNT)}, con máximo dos decimales.
                </p>
              )}
            </form>
          </div>
        )}

        {step === 'pay' && amount !== null && (
          <div className="mt-5">
            <div className="flex items-center justify-between rounded-xl bg-background-100 px-4 py-3">
              <span className="text-sm text-foreground-600">Monto a recargar</span>
              <span className="font-heading text-xl font-extrabold text-foreground-950">{formatPrice(amount)}</span>
            </div>
            <button
              type="button"
              onClick={() => setStep('amount')}
              disabled={busy}
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50 md:min-h-0"
            >
              <i className="ri-arrow-left-line"></i>
              Cambiar monto
            </button>
            <p className="mt-2 text-xs text-foreground-500">
              Usa cualquier tarjeta de prueba (por ejemplo 4242 4242 4242 4242, vencimiento futuro y CVV 123). No se guarda ningún dato.
            </p>
            <MockGatewayForm
              total={amount}
              gateway={lockingGateway}
              onSuccess={handlePaid}
              submitLabel={`Recargar ${formatPrice(amount)}`}
            />
          </div>
        )}

        {step === 'done' && newBalance !== null && amount !== null && (
          <div className="mt-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-3xl text-primary-600">
              <i className="ri-check-line"></i>
            </span>
            <p className="mt-4 font-heading text-lg font-extrabold text-foreground-950">Recarga demo aplicada</p>
            <p className="mt-1 text-sm text-foreground-600">Se abonaron {formatPrice(amount)} (simulado, sin cobro real).</p>
            <div className="mt-4 rounded-xl bg-background-100 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-foreground-500">Saldo disponible</p>
              <p className="font-heading text-2xl font-extrabold text-foreground-950">{formatPrice(newBalance)}</p>
            </div>
            {reference && (
              <p className="mt-3 text-xs text-foreground-500">
                Referencia de demostración: <span className="font-semibold text-foreground-700">{reference}</span>
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-5 min-h-11 w-full rounded-full bg-primary-500 text-sm font-semibold text-background-50 transition-colors hover:bg-primary-600"
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
