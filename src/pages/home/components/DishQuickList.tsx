import { useCart } from '@/context/CartContext';
import { formatPrice, parsePrice } from '@/utils/price';
import { playFoley } from '@/hooks/useFoley';

export type QuickDish = {
  id: number;
  name: string;
  price: string;
  emoji: string;
  category_id: string;
  category_title: string;
  // Las RPC de recomendaciones no lo devuelven: sin dato = requiere preparación.
  pago_en_caja_permitido?: boolean;
};

/** Lista compacta de platillos con "Agregar" al carrito (misma key que DishCard, así se suman). */
export default function DishQuickList({ items }: { items: QuickDish[] }) {
  const { addItem } = useCart();

  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-background-200/70 bg-background-100 p-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background-50 text-2xl" aria-hidden="true">
            {item.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground-950">{item.name}</p>
            <p className="text-xs text-foreground-500">{item.category_title} · {formatPrice(parsePrice(item.price))}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              addItem({
                key: `${item.category_id}:${item.name}`,
                menuItemId: item.id,
                categoryId: item.category_id,
                categoryTitle: item.category_title,
                name: item.name,
                price: item.price,
                priceValue: parsePrice(item.price),
                emoji: item.emoji,
                pagoEnCajaPermitido: item.pago_en_caja_permitido === true,
              });
              playFoley('success');
            }}
            aria-label={`Agregar ${item.name} al carrito`}
            className="shrink-0 rounded-full bg-primary-500 px-4 py-2 text-xs font-bold text-background-50 transition-colors hover:bg-primary-600 cursor-pointer"
          >
            Agregar
          </button>
        </li>
      ))}
    </ul>
  );
}
