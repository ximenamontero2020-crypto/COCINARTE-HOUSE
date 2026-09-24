import { useEffect, useMemo, useState } from 'react';
import type { MenuCategory, MenuItem } from '@/mocks/menu';
import { supabase } from '@/lib/supabase';
import { useClimaRecomendado } from '@/hooks/useClimaRecomendado';
import { RULE_COPY } from '@/lib/weatherRules';
import DishCard from './DishCard';

type MenuCategoryRow = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  orden: number;
};

type MenuItemRow = {
  id: number;
  category_id: string;
  name: string;
  description: string;
  price: string;
  emoji: string;
  image: string;
  nutrition_calories: number | null;
  nutrition_protein: number | null;
  nutrition_carbs: number | null;
  nutrition_fat: number | null;
  allergens: string[] | null;
  orden: number;
};

const mapMenuItem = (row: MenuItemRow): MenuItem => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: row.price,
  emoji: row.emoji,
  image: row.image,
  nutrition: {
    calories: Number(row.nutrition_calories ?? 0),
    protein: Number(row.nutrition_protein ?? 0),
    carbs: Number(row.nutrition_carbs ?? 0),
    fat: Number(row.nutrition_fat ?? 0),
  },
  allergens: Array.isArray(row.allergens) ? row.allergens : [],
});

const mapMenuCategory = (category: MenuCategoryRow, items: MenuItemRow[]): MenuCategory => ({
  id: category.id,
  title: category.title,
  subtitle: category.subtitle,
  image: category.image,
  items: items
    .filter((item) => item.category_id === category.id)
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
    .map(mapMenuItem),
});

export default function MenuSection() {
  const { rule, weather } = useClimaRecomendado();
  const bannerClima = weather && rule !== 'mild' ? `${RULE_COPY[rule].title} (${Math.round(weather.temperature)}°C): ${RULE_COPY[rule].message}` : null;
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    return menuCategories
      .filter((category) => selectedCategory === 'all' || category.id === selectedCategory)
      .map((category) => ({
        ...category,
        items: normalizedQuery
          ? category.items.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
          : category.items,
      }))
      .filter((category) => category.items.length > 0);
  }, [menuCategories, normalizedQuery, selectedCategory]);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError(null);

      try {
        const [categoriesResult, itemsResult] = await Promise.all([
          supabase
            .from('menu_categories')
            .select('*')
            .order('orden', { ascending: true }),
          supabase
            .from('menu_items')
            .select('*')
            .order('orden', { ascending: true }),
        ]);

        if (categoriesResult.error) throw categoriesResult.error;
        if (itemsResult.error) throw itemsResult.error;

        const categories = (categoriesResult.data ?? []) as MenuCategoryRow[];
        const items = (itemsResult.data ?? []) as MenuItemRow[];

        const mapped = categories
          .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
          .map((category) => mapMenuCategory(category, items));

        setMenuCategories(mapped);
      } catch (err) {
        console.error('Error cargando el menú:', err);
        setError('No se pudo cargar el menú en este momento.');
      } finally {
        setLoading(false);
      }
    };

    void fetchMenu();
  }, []);

  if (loading) {
    return (
      <section id="menu" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm text-foreground-500">Cargando menú...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm text-red-600">{error}</p>
        </div>
      </section>
    );
  }

  if (!menuCategories.length || menuCategories.every((category) => category.items.length === 0)) {
    return (
      <section id="menu" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-sm text-foreground-500">
            El menú está temporalmente vacío. Vuelve a intentarlo más tarde.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="menu" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 text-primary-700 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
            <i className="ri-restaurant-2-fill"></i>
            Nuestro Menú
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground-950">
            Sabores para <span className="text-primary-600">todos los días</span>
          </h2>
          <p className="mt-4 text-foreground-600 max-w-xl mx-auto text-sm md:text-base">
            Ingredientes frescos, preparados al momento y pensados para que estudies, convivas y
            disfrutes. Toca cualquier platillo para ver su imagen, información nutrimental y
            alérgenos.
          </p>
                </div>

        {bannerClima && (
          <div className="mx-auto mb-6 max-w-4xl rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-center text-sm font-semibold text-primary-800">
            {bannerClima}
          </div>
        )}

        <div className="mx-auto mb-8 max-w-4xl">
          <label className="relative block">
            <span className="sr-only">Buscar platillo por nombre</span>
            <i className="ri-search-line pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-foreground-500" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar un platillo..."
              className="h-12 w-full rounded-xl border border-background-300 bg-background-50 pl-11 pr-4 text-sm text-foreground-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
            />
          </label>

          <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6" aria-label="Filtrar por categoría">
            <div className="flex min-w-max gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${selectedCategory === 'all' ? 'bg-primary-600 text-background-50 shadow-sm' : 'bg-background-50 text-foreground-700 hover:bg-primary-100 hover:text-primary-800'}`}
              >
                Todos
              </button>
              {menuCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${selectedCategory === category.id ? 'bg-primary-600 text-background-50 shadow-sm' : 'bg-background-50 text-foreground-700 hover:bg-primary-100 hover:text-primary-800'}`}
                >
                  {category.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-background-300 bg-background-50 px-6 py-12 text-center">
            <i className="ri-search-eye-line text-3xl text-foreground-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground-700">No encontramos platillos que coincidan con tu búsqueda</p>
            <p className="mt-1 text-xs text-foreground-500">Prueba con otro nombre o selecciona otra categoría.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 transition-opacity duration-300 md:grid-cols-2">
          {filteredCategories.map((cat) => (
            <DishCard key={cat.id} category={cat} />
          ))}
          </div>
        )}
      </div>
    </section>
  );
}