import type { MenuItem } from '@/mocks/menu';
import Dish3DViewer from '@/pages/home/components/Dish3DViewer';

type Props = {
  item: MenuItem;
  categoryTitle: string;
  inCart: boolean;
  onClose: () => void;
  onAdd: () => void;
};

const NUTRITION_ITEMS = [
  { key: 'calories', label: 'Calorías', unit: 'kcal', icon: 'ri-fire-line' },
  { key: 'protein', label: 'Proteínas', unit: 'g', icon: 'ri-heart-pulse-line' },
  { key: 'carbs', label: 'Carbohidratos', unit: 'g', icon: 'ri-restaurant-2-line' },
  { key: 'fat', label: 'Grasas', unit: 'g', icon: 'ri-drop-line' },
] as const;

export default function ProductDetailModal({ item, categoryTitle, inCart, onClose, onAdd }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${item.name}`}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-hidden rounded-2xl bg-background-50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-background-50/90 backdrop-blur-sm text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
          aria-label="Cerrar"
        >
          <i className="ri-close-line text-lg"></i>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 max-h-[92vh] overflow-y-auto">
          {/* Información (izquierda en escritorio) */}
          <div className="order-2 md:order-1 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-100 text-secondary-900 text-xs font-semibold px-3 py-1 whitespace-nowrap">
                <i className="ri-price-tag-3-line"></i>
                {categoryTitle}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <h3 className="font-heading font-extrabold text-2xl text-foreground-950">
                {item.name}
              </h3>
              <span className="font-heading font-bold text-xl text-primary-600 whitespace-nowrap">
                {item.price}
              </span>
            </div>

            <p className="mt-3 text-sm md:text-base text-foreground-600 leading-relaxed">
              {item.description}
            </p>

            <div className="mt-6 space-y-6">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-foreground-950 mb-3">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-accent-100 text-accent-700">
                    <i className="ri-alert-line text-base"></i>
                  </span>
                  Alérgenos
                </h4>
                {item.allergens.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {item.allergens.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 text-accent-900 text-xs font-semibold px-3 py-1.5 whitespace-nowrap"
                      >
                        <i className="ri-shield-check-line"></i>
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-sm text-foreground-500">
                    <i className="ri-checkbox-circle-line text-primary-600"></i>
                    Sin alérgenos principales
                  </p>
                )}
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold text-foreground-950 mb-3">
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-secondary-100 text-secondary-900">
                    <i className="ri-file-list-3-line text-base"></i>
                  </span>
                  Información nutrimental
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {NUTRITION_ITEMS.map((n) => (
                    <div
                      key={n.key}
                      className="rounded-xl bg-background-100 border border-background-200/70 p-3"
                    >
                      <div className="flex items-center gap-1.5 text-accent-600 mb-1">
                        <i className={`${n.icon} text-base`}></i>
                        <span className="text-[11px] font-medium text-foreground-500">
                          {n.label}
                        </span>
                      </div>
                      <div className="font-heading font-bold text-lg text-foreground-950">
                        {item.nutrition[n.key]}
                        <span className="text-xs font-semibold text-foreground-500 ml-0.5">
                          {n.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onAdd}
              className="mt-8 w-full flex items-center justify-center gap-2 rounded-full text-sm font-semibold px-5 py-3 bg-primary-500 text-background-50 hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-shopping-bag-3-line"></i>
              {inCart ? 'Añadir otro al pedido' : 'Añadir al pedido'}
            </button>
          </div>

          {/* Imagen completa (derecha en escritorio) */}
          <div className="order-1 md:order-2 relative h-64 sm:h-72 md:h-auto min-h-[320px] bg-background-100">
            <Dish3DViewer image={item.image} title={item.name} />
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background-50/90 backdrop-blur-sm text-foreground-700 text-[11px] font-semibold px-3 py-1.5 whitespace-nowrap z-10">
              <i className="ri-image-2-line"></i>
              Vista interactiva
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}