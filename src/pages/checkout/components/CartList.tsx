import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/utils/price';

export default function CartList() {
  const { items, total, increment, decrement, removeItem } = useCart();

  return (
    <div className="rounded-2xl bg-background-50 border border-background-200/70 p-5 md:p-6">
      <h2 className="font-heading font-bold text-xl text-foreground-950">Tu pedido</h2>
      <p className="mt-1 text-sm text-foreground-500">
        {items.length} platillo{items.length === 1 ? '' : 's'} en tu carrito.
      </p>

      <ul className="mt-5 divide-y divide-background-200/70">
        {items.map((item) => (
          <li key={item.key} className="py-4 flex gap-4 items-center">
            <span className="w-12 h-12 flex items-center justify-center rounded-xl bg-background-100 text-2xl shrink-0">
              {item.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground-950 text-sm">{item.name}</p>
              <p className="text-xs text-foreground-500">
                {item.categoryTitle} · {formatPrice(item.priceValue)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => decrement(item.key)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-background-100 text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer"
                aria-label="Quitar uno"
              >
                <i className="ri-subtract-line"></i>
              </button>
              <span className="w-6 text-center text-sm font-semibold text-foreground-950">
                {item.quantity}
              </span>
              <button
                onClick={() => increment(item.key)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-background-100 text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer"
                aria-label="Añadir uno"
              >
                <i className="ri-add-line"></i>
              </button>
            </div>
            <button
              onClick={() => removeItem(item.key)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-foreground-400 hover:bg-background-100 hover:text-foreground-700 transition-colors cursor-pointer"
              aria-label="Eliminar"
            >
              <i className="ri-delete-bin-6-line"></i>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-5 border-t border-background-200/70 flex items-center justify-between">
        <span className="text-sm text-foreground-600">Total</span>
        <span className="font-heading font-bold text-2xl text-foreground-950">
          {formatPrice(total)}
        </span>
      </div>
    </div>
  );
}