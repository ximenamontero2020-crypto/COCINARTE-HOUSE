import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { parsePrice } from '@/utils/price';
import type { MenuItem } from '@/mocks/menu';

type PopularRow = MenuItem & {
  category_id: string;
  category_title: string;
  sold_quantity: number | string;
};

export default function PopularRecommendations() {
  const { items, addItem } = useCart();
  const [products, setProducts] = useState<PopularRow[]>([]);

  useEffect(() => {
    let active = true;
    const loadPopular = async () => {
      const { data, error } = await supabase.rpc('get_productos_mas_vendidos', { p_limite: 5 });
      if (error) {
        console.error('Error cargando productos más vendidos:', error);
        return;
      }
      if (active) setProducts((data ?? []) as PopularRow[]);
    };
    void loadPopular();
    return () => {
      active = false;
    };
  }, []);

  const available = products
    .filter((product) => !items.some((item) => item.menuItemId === product.id || item.name === product.name))
    .slice(0, 3);

  if (available.length === 0) return null;

  return (
    <section className="mb-5 rounded-2xl border border-accent-200 bg-accent-50/70 p-4" aria-labelledby="popular-recommendations-title">
      <div className="flex items-center gap-2">
        <i className="ri-sparkling-2-line text-accent-700" aria-hidden="true" />
        <h3 id="popular-recommendations-title" className="font-heading text-base font-extrabold text-foreground-950">¿Te gustaría agregar...?</h3>
      </div>
      <div className="mt-3 grid gap-2">
        {available.map((product) => {
          const key = `${product.category_id}:${product.name}`;
          return (
            <div key={product.id} className="flex items-center gap-3 rounded-xl border border-accent-200/70 bg-background-50 px-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-lg">{product.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-950">{product.name}</p>
                <p className="text-xs text-foreground-500">{product.price}</p>
              </div>
              <button
                type="button"
                onClick={() => addItem({
                  key,
                  menuItemId: product.id,
                  categoryId: product.category_id,
                  categoryTitle: product.category_title,
                  name: product.name,
                  price: product.price,
                  priceValue: parsePrice(product.price),
                  emoji: product.emoji,
                  pagoEnCajaPermitido: product.pago_en_caja_permitido === true,
                })}
                className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-700"
              >
                Agregar
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
