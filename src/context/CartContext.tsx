import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type CartItem = {
  key: string;
  menuItemId?: number;
  categoryId: string;
  categoryTitle: string;
  name: string;
  price: string;
  priceValue: number;
  emoji: string;
  quantity: number;
};

export type NewCartItem = Omit<CartItem, 'quantity'>;

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: NewCartItem) => void;
  removeItem: (key: string) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'cocinarte_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // almacenamiento no disponible
    }
  }, [items]);

  const addItem = (item: NewCartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.key === item.key);
      if (existing) {
        return prev.map((i) => (i.key === item.key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const increment = (key: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i)));

  const decrement = (key: string) =>
    setItems((prev) =>
      prev.flatMap((i) => {
        if (i.key !== key) return [i];
        if (i.quantity <= 1) return [];
        return [{ ...i, quantity: i.quantity - 1 }];
      }),
    );

  const clear = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.priceValue * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, count, total, addItem, removeItem, increment, decrement, clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}