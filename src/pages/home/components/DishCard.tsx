import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/mocks/menu';
import { playFoley } from '@/hooks/useFoley';
import { useCart } from '@/context/CartContext';
import { parsePrice } from '@/utils/price';
import Dish3DViewer from '@/pages/home/components/Dish3DViewer';
import ProductDetailModal from '@/pages/home/components/ProductDetailModal';

type Tilt = { x: number; y: number };

export default function DishCard({ category, recommendedItemIds }: { category: MenuCategory; recommendedItemIds?: Set<number> }) {
  const { items, addItem } = useCart();
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -12, y: px * 14 });
  }, []);

  const resetTilt = useCallback(() => setTilt({ x: 0, y: 0 }), []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        setOpenItem(null);
      }
    };
    if (open || openItem) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, openItem]);

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTilt}
        className="rounded-2xl bg-background-50 border border-background-200/70 overflow-hidden hover:border-primary-200 transition-colors"
        style={{ perspective: '1200px' }}
      >
        <div
          className="dish-image-tilt relative h-52 w-full overflow-hidden cursor-zoom-in group"
          style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          aria-label={`Explorar ${category.title} en 3D`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpen();
            }
          }}
        >
          <img
            src={category.image}
            alt={category.title}
            title={`${category.title} COCINARTE HOUSE`}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"></div>

          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-background-50/85 backdrop-blur-sm text-foreground-700 text-xs font-semibold px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <i className="ri-eye-line"></i>
            Toca para explorar
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-heading font-bold text-xl text-background-50">
              {category.title}
            </h3>
            <p className="mt-1 text-xs text-background-50/80 flex items-center gap-1.5">
              <i className="ri-cursor-line"></i>
              Mueve el cursor para ver · clic para acercar
            </p>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm text-foreground-500 mb-4">{category.subtitle}</p>
          <ul className="divide-y divide-background-200/70">
            {category.items.map((item) => {
              const key = `${category.id}:${item.name}`;
              const inCart = items.find((i) => i.key === key);
              const handleAdd = () => {
                addItem({
                  key,
                  menuItemId: item.id,
                  categoryId: category.id,
                  categoryTitle: category.title,
                  name: item.name,
                  price: item.price,
                  priceValue: parsePrice(item.price),
                  emoji: item.emoji,
                  pagoEnCajaPermitido: item.pago_en_caja_permitido === true,
                });
                playFoley('success');
              };
              return (
                <li key={item.name} className={`py-4 first:pt-0 last:pb-0 flex gap-4 items-center rounded-xl transition-colors ${recommendedItemIds?.has(item.id ?? -1) ? 'bg-accent-100/70 px-3 ring-1 ring-accent-300' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className="w-12 h-12 flex items-center justify-center rounded-xl bg-background-100 text-2xl shrink-0 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                    aria-label={`Ver ${item.name}`}
                    title="Ver imagen de referencia"
                  >
                    {item.emoji}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className="flex-1 min-w-0 text-left cursor-pointer group/item"
                    aria-label={`Ver detalles de ${item.name}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-semibold text-foreground-950 text-sm md:text-base group-hover/item:text-primary-600 transition-colors">
                        {item.name}
                      </h4>
                      <span className="font-heading font-bold text-primary-600 whitespace-nowrap">
                        {item.price}
                      </span>
                    </div>
                    <p className="mt-1 text-xs md:text-sm text-foreground-500 leading-relaxed">
                      {item.description}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <i className="ri-information-line"></i>
                      Ver nutrimental y alérgenos
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                      inCart
                        ? 'bg-primary-500 text-background-50 hover:bg-primary-600'
                        : 'bg-background-100 text-primary-700 hover:bg-primary-100'
                    }`}
                    aria-label={`Añadir ${item.name} al pedido`}
                    title={inCart ? 'Añadir otro' : 'Añadir al pedido'}
                  >
                    {inCart ? (
                      <span className="text-sm font-bold">{inCart.quantity}</span>
                    ) : (
                      <i className="ri-add-line text-lg"></i>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label={`Vista cercana de ${category.title}`}
        >
          <div
            className="relative w-full max-w-3xl rounded-2xl bg-background-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-background-200/70">
              <div>
                <h3 className="font-heading font-bold text-lg text-foreground-950">
                  {category.title}
                </h3>
                <p className="text-xs text-foreground-500">Gira, inclina y acerca el platillo</p>
              </div>
              <button
                onClick={handleClose}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-background-100 text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                aria-label="Cerrar"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <div className="relative h-72 md:h-96 overflow-hidden bg-background-100">
              <Dish3DViewer image={category.image} title={category.title} />
            </div>
          </div>
        </div>
      )}

      {openItem && (
        <ProductDetailModal
          item={openItem}
          categoryTitle={category.title}
          inCart={items.some((i) => i.key === `${category.id}:${openItem.name}`)}
          onClose={() => setOpenItem(null)}
          onAdd={() => {
            addItem({
              key: `${category.id}:${openItem.name}`,
              menuItemId: openItem.id,
              categoryId: category.id,
              categoryTitle: category.title,
              name: openItem.name,
              price: openItem.price,
              priceValue: parsePrice(openItem.price),
              emoji: openItem.emoji,
              pagoEnCajaPermitido: openItem.pago_en_caja_permitido === true,
            });
            playFoley('success');
          }}
        />
      )}
    </>
  );
}