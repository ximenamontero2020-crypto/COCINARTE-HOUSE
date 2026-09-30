/**
 * Token de la Tarjeta CocinArte de INVITADO (demo). Es un UUID aleatorio que vive solo en
 * este navegador y funciona como llave de la tarjeta: quien lo tenga puede usar el saldo.
 * El servidor solo guarda su sha256 (guest_card_accounts). Si se borran los datos del
 * navegador o se cambia de dispositivo, la tarjeta y su saldo se pierden.
 */
const STORAGE_KEY = 'cocinarte_guest_card';

export const GUEST_CARD_NOTICE =
  'Tarjeta de invitado temporal: vive solo en este navegador. Si borras los datos de navegación o cambias de dispositivo, pierdes este saldo.';

// Respaldo si localStorage no está disponible (modo privado estricto): dura lo que la pestaña.
let memoryToken: string | null = null;

/** Token existente, o null si este navegador nunca usó la tarjeta de invitado. */
export function getGuestCardToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

/** Token existente o uno nuevo (la primera vez que el invitado usa la tarjeta). */
export function getOrCreateGuestCardToken(): string {
  const existing = getGuestCardToken();
  if (existing) return existing;
  const token = crypto.randomUUID();
  memoryToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Sin localStorage: queda solo en memoria.
  }
  return token;
}

/** Olvida la tarjeta de invitado de este navegador (al iniciar sesión no se migra el saldo). */
export function clearGuestCardToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar.
  }
}
