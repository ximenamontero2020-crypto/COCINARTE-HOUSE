import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'cocinarte_promo_month';
const MIN_PCT = 2;
const MAX_PCT = 10;

type PromoState = {
  month: string;
  accumulatedPct: number;
  code: string;
};

function monthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i += 1) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return `COCINA-${s}`;
}

function readState(): PromoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PromoState>;
      if (parsed.month === monthKey()) {
        return {
          month: parsed.month,
          accumulatedPct: Math.min(MAX_PCT, parsed.accumulatedPct ?? 0),
          code: parsed.code || generateCode(),
        };
      }
    }
  } catch {
    // ignorar storage corrupto
  }
  return { month: monthKey(), accumulatedPct: 0, code: generateCode() };
}

let current: PromoState =
  typeof window !== 'undefined'
    ? readState()
    : { month: '', accumulatedPct: 0, code: '' };

const listeners = new Set<(s: PromoState) => void>();

function setState(next: PromoState) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignorar errores de cuota / privacidad
  }
  listeners.forEach((listener) => listener(next));
}

/**
 * Límite de promociones mensual compartido entre los juegos de descuento.
 * Cada victoria otorga un descuento entre 2% y 10% (según la puntuación del
 * juego) que se acumula hasta un máximo de 10% por mes. Al alcanzar el tope
 * ya no se ofrecen más promociones hasta que cambie el mes (persiste por
 * navegador vía localStorage).
 */
export function usePromoLimit() {
  const [state, setLocal] = useState<PromoState>(current);

  useEffect(() => {
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  useEffect(() => {
    if (current.month !== monthKey()) {
      setState({ month: monthKey(), accumulatedPct: 0, code: generateCode() });
    }
  }, []);

  const accumulatedPct = Math.min(MAX_PCT, state.accumulatedPct);
  const limitReached = accumulatedPct >= MAX_PCT;

  const awardWin = useCallback(
    (pct: number): { wonPct: number; totalPct: number; code: string } => {
      const mk = monthKey();
      const capped = Math.max(MIN_PCT, Math.min(MAX_PCT, pct));

      if (current.month !== mk) {
        const totalPct = Math.min(MAX_PCT, capped);
        const code = generateCode();
        setState({ month: mk, accumulatedPct: totalPct, code });
        return { wonPct: totalPct, totalPct, code };
      }

      if (current.accumulatedPct >= MAX_PCT) {
        return { wonPct: 0, totalPct: current.accumulatedPct, code: current.code };
      }

      const totalPct = Math.min(MAX_PCT, current.accumulatedPct + capped);
      const wonPct = totalPct - current.accumulatedPct;
      setState({ month: current.month, accumulatedPct: totalPct, code: current.code });
      return { wonPct, totalPct, code: current.code };
    },
    [],
  );

  return {
    canPlay: !limitReached,
    limitReached,
    accumulatedPct,
    code: state.code,
    awardWin,
  };
}