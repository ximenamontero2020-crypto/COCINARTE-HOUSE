import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getGuestCardToken, getOrCreateGuestCardToken } from '@/lib/guestCard';

type GuestCard = {
  number: string | null; // null hasta la primera recarga
  balance: number;
};

/**
 * Tarjeta CocinArte de INVITADO (sin cuenta): saldo leído del servidor con el token de este
 * navegador (get_guest_card). `recharge` es la recarga demo (guest_card_recharge): pago
 * simulado, saldo abonado de verdad. Separada por completo de useCafeteriaCard.
 */
export function useGuestCard() {
  const [card, setCard] = useState<GuestCard | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const token = getGuestCardToken();
    // Nunca la ha usado: no hace falta preguntar al servidor.
    if (!token) {
      setCard({ number: null, balance: 0 });
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('get_guest_card', { p_card_token: token });
    if (rpcError) {
      console.error('Error cargando tarjeta de invitado:', rpcError);
      setError('No se pudo cargar el saldo de tu tarjeta de invitado.');
      return;
    }
    setError('');
    setCard({ number: data.card_number, balance: Number(data.balance) });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // requestId: el mismo id para reintentos de una misma recarga, así el servidor abona una sola vez.
  const recharge = useCallback(async (amount: number, requestId: string): Promise<number> => {
    const { data, error: rpcError } = await supabase.rpc('guest_card_recharge', {
      p_card_token: getOrCreateGuestCardToken(),
      p_amount: amount,
      p_request_id: requestId,
    });
    if (rpcError) {
      console.error('Error en recarga de invitado:', rpcError);
      throw new Error(rpcError.message || 'No pudimos recargar tu tarjeta. Inténtalo de nuevo.');
    }
    const balance = Number(data.balance);
    setError('');
    setCard({ number: data.card_number, balance });
    return balance;
  }, []);

  return { card, error, refresh, recharge };
}
