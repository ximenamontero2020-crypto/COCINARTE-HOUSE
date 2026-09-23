import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type CafeteriaCard = {
  number: string;
  balance: number;
};

const STORAGE_KEY = 'cocinarte_card';

function readLocalCard(): CafeteriaCard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CafeteriaCard;
    if (typeof parsed?.balance === 'number' && typeof parsed?.number === 'string') {
      return parsed;
    }
  } catch {
    // ignorar
  }
  return null;
}

function writeLocalCache(card: CafeteriaCard) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
  } catch {
    // almacenamiento no disponible
  }
}

function clearLocalCard() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorar
  }
}

export function useCafeteriaCard() {
  const { user } = useAuth();
  const [card, setCard] = useState<CafeteriaCard>({ number: '', balance: 0 });
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState<string | null>(null);
  const migratedRef = useRef(false);

  const applyCard = useCallback((number: string | null | undefined, balance: number | string | null | undefined) => {
    const next: CafeteriaCard = {
      number: number?.trim() || '',
      balance: Number(balance) || 0,
    };
    setCard(next);
    writeLocalCache(next);
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setCard({ number: '', balance: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('card_number, card_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    let number = data?.card_number as string | null | undefined;
    let balance = Number(data?.card_balance ?? 0);

    // One-time migrate localStorage balance into Supabase when DB is empty.
    if (!migratedRef.current && balance === 0) {
      const local = readLocalCard();
      if (local && local.balance > 0) {
        migratedRef.current = true;
        const { data: rpcData, error: rpcError } = await supabase.rpc('recharge_cafeteria_card', {
          p_amount: local.balance,
        });
        if (!rpcError) {
          const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
          number = row?.card_number ?? number;
          balance = Number(row?.card_balance ?? local.balance);
          clearLocalCard();
        }
      } else {
        migratedRef.current = true;
      }
    }

    applyCard(number, balance);
    setLoading(false);
  }, [applyCard, user]);

  useEffect(() => {
    migratedRef.current = false;
    void refresh();
  }, [refresh]);

  const recharge = useCallback(
    async (amount: number) => {
      if (!user || !isSupabaseConfigured) {
        setError('Inicia sesión para recargar tu tarjeta de cafetería.');
        return false;
      }
      if (!Number.isFinite(amount) || amount <= 0) return false;

      setError(null);
      const { data, error: rpcError } = await supabase.rpc('recharge_cafeteria_card', {
        p_amount: amount,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      const row = Array.isArray(data) ? data[0] : data;
      applyCard(row?.card_number, row?.card_balance);
      return true;
    },
    [applyCard, user],
  );

  const spend = useCallback(
    async (amount: number) => {
      if (!user || !isSupabaseConfigured) {
        setError('Inicia sesión para pagar con saldo de cafetería.');
        return false;
      }
      if (!Number.isFinite(amount) || amount <= 0) return false;

      setError(null);
      const { data, error: rpcError } = await supabase.rpc('spend_cafeteria_card', {
        p_amount: amount,
      });
      if (rpcError) {
        setError(rpcError.message);
        return false;
      }
      const row = Array.isArray(data) ? data[0] : data;
      applyCard(row?.card_number, row?.card_balance);
      return true;
    },
    [applyCard, user],
  );

  return { card, recharge, spend, loading, error, refresh };
}
