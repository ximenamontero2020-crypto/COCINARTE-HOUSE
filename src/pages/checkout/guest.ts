import type { DatosInvitado } from '@/utils/orders';

// Mismas reglas que create_guest_comanda; el servidor vuelve a validar.
export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 60;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function datosInvitadoValidos({ nombre, email }: DatosInvitado): boolean {
  const n = nombre.trim().length;
  const e = email.trim();
  return n >= NOMBRE_MIN && n <= NOMBRE_MAX && (e === '' || EMAIL_RE.test(e));
}
