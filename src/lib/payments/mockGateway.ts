/**
 * Pasarela de pago en MODO DEMOSTRACIÓN. No se conecta a nada (sin Stripe, Mercado Pago,
 * PayPal ni llamadas de red) y no realiza ningún cobro. La UI solo depende de
 * PaymentGateway, así que después se puede cambiar por un proveedor real.
 *
 * Nunca marca pedidos como pagados ni los manda a cocina: quien la use no debe
 * llamar create_comanda ni escribir en Supabase.
 */

export type ChargeInput = {
  amount: number;
  cardNumber: string;
  cardholder: string;
  expiry: string; // MM/AA
  cvv: string;
};

export type ChargeResult = { ok: boolean; reference?: string; error?: string };

export interface PaymentGateway {
  charge(input: ChargeInput): Promise<ChargeResult>;
}

const PROCESSING_MS = 1600;

const digits = (value: string) => value.replace(/\D/g, '');

function validate({ amount, cardNumber, cardholder, expiry, cvv }: ChargeInput): string | null {
  const number = digits(cardNumber);
  if (!(amount > 0)) return 'El monto no es válido.';
  if (number.length < 13 || number.length > 19) return 'El número de tarjeta no es válido.';
  if (cardholder.trim().length < 3) return 'Escribe el nombre como aparece en la tarjeta.';
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return 'La fecha de vencimiento debe ser MM/AA.';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'El mes de vencimiento no es válido.';
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
    return 'La tarjeta está vencida.';
  }
  if (!/^\d{3,4}$/.test(cvv)) return 'El CVV debe tener 3 o 4 dígitos.';
  return null;
}

export const mockGateway: PaymentGateway = {
  async charge(input) {
    await new Promise((resolve) => setTimeout(resolve, PROCESSING_MS));
    const invalid = validate(input);
    if (invalid) return { ok: false, error: invalid };
    if (digits(input.cardNumber).endsWith('0002')) {
      return { ok: false, error: 'Tarjeta rechazada por el banco emisor (simulación).' };
    }
    return { ok: true, reference: `DEMO-${Date.now().toString(36).toUpperCase()}` };
  },
};
