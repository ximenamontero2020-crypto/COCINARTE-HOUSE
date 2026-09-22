import { useCallback, useEffect, useState } from 'react';

type CafeteriaCard = {
  number: string;
  balance: number;
};

const STORAGE_KEY = 'cocinarte_card';

function generateNumber(): string {
  const digits = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  const grouped = digits.match(/.{1,4}/g)?.join('-') ?? digits;
  return `COC ${grouped}`;
}

function loadCard(): CafeteriaCard {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as CafeteriaCard;
  } catch {
    // ignorar
  }
  return { number: generateNumber(), balance: 0 };
}

export function useCafeteriaCard() {
  const [card, setCard] = useState<CafeteriaCard>(loadCard);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
    } catch {
      // almacenamiento no disponible
    }
  }, [card]);

  const recharge = useCallback((amount: number) => {
    setCard((prev) => ({ ...prev, balance: prev.balance + amount }));
  }, []);

  const spend = useCallback((amount: number) => {
    setCard((prev) => ({ ...prev, balance: Math.max(0, prev.balance - amount) }));
  }, []);

  return { card, recharge, spend };
}