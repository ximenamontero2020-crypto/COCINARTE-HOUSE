import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type CafeteriaCard = {
  number: string;
  balance: number;
};

/**
 * Saldo de la Tarjeta CocinArte leído del servidor (RPC get_card_balance).
 * Las recargas se hacen en caja con el staff; el cobro ocurre dentro de
 * create_comanda. Aquí solo se lee.
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

  return { card, error, refresh };
}
