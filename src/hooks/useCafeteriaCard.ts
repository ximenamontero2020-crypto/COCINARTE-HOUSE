import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CafeteriaCard = {
  number: string;
  balance: number;
};

/**
 * Saldo de la Tarjeta CocinArte leído del servidor (RPC get_card_balance).
 * Las recargas reales se hacen en caja con el staff; el cobro ocurre dentro de
 * create_comanda. `recharge` es la recarga DEMO de autoservicio (demo_self_recharge):
 * el pago es simulado pero el saldo se abona de verdad (excepción documentada en CLAUDE.md).
 */
export function useCafeteriaCard() {
  const [card, setCard] = useState<CafeteriaCard | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('get_card_balance');
    if (rpcError) {
      console.error('Error cargando saldo:', rpcError);
      setError('No se pudo cargar tu saldo.');
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
    const { data, error: rpcError } = await supabase.rpc('demo_self_recharge', {
      p_amount: amount,
      p_request_id: requestId,
    });
    if (rpcError) {
      console.error('Error en recarga demo:', rpcError);
      throw new Error(rpcError.message || 'No pudimos recargar tu saldo. Inténtalo de nuevo.');
    }
    const balance = Number(data.balance);
    setError('');
    setCard({ number: data.card_number, balance });
    return balance;
  }, []);

  return { card, error, refresh, recharge };
}
