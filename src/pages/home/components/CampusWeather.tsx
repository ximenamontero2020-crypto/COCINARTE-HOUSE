import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useClimaRecomendado } from '@/hooks/useClimaRecomendado';
import { matchesRule, RULE_COPY, weatherIcon, type WeatherRule } from '@/lib/weatherRules';
import DishQuickList, { type QuickDish } from './DishQuickList';

const MIN_ITEMS = 3;
const MAX_ITEMS = 6;

type MenuRow = QuickDish & { description: string | null };

async function loadMenu(): Promise<MenuRow[]> {
  const [categories, items] = await Promise.all([
    supabase.from('menu_categories').select('id, title'),
    supabase.from('menu_items').select('id, name, description, price, emoji, category_id, pago_en_caja_permitido').order('orden'),
  ]);
  if (categories.error || items.error) throw categories.error ?? items.error;
  const titles = new Map((categories.data ?? []).map((c) => [c.id as string, c.title as string]));
  return (items.data ?? []).map((item) => ({ ...item, category_title: titles.get(item.category_id) ?? '' }) as MenuRow);
}

async function loadBestsellers(): Promise<QuickDish[]> {
  const { data, error } = await supabase.rpc('get_productos_mas_vendidos', { p_limite: MAX_ITEMS });
  if (error) console.error('Error cargando más vendidos:', error);
  return (data ?? []) as QuickDish[];
}

/** Platillos para la regla: los que la cumplen; si son menos de 3, se completa con más vendidos y luego con el menú. */
async function pickDishes(rule: WeatherRule): Promise<QuickDish[]> {
  const [menu, bestsellers] = await Promise.all([loadMenu(), loadBestsellers()]);
  const picked = rule === 'mild' ? [] : menu.filter((item) => matchesRule(rule, { categoryId: item.category_id, name: item.name, description: item.description }));
  const result: QuickDish[] = picked.slice(0, MAX_ITEMS);
  for (const extra of [...bestsellers, ...menu]) {
    if (result.length >= (rule === 'mild' ? MAX_ITEMS : MIN_ITEMS)) break;
    if (!result.some((item) => item.id === extra.id)) result.push(extra);
  }
  return result;
}

/** "Hoy en el campus": clima real de Open-Meteo + 3–6 platillos según la regla activa. */
export default function CampusWeather() {
  const { weather, rule, cargando, unavailable } = useClimaRecomendado();
  const [dishes, setDishes] = useState<QuickDish[]>([]);

  useEffect(() => {
    if (cargando) return;
    let active = true;
    pickDishes(rule)
      .then((result) => {
        if (active) setDishes(result);
      })
      .catch((error) => console.error('Error cargando platillos para el clima:', error));
    return () => {
      active = false;
    };
  }, [rule, cargando]);

  if (cargando || dishes.length === 0) return null;

  const copy = RULE_COPY[rule];

  return (
    <section className="w-full bg-background-50 px-4 py-12 md:px-6 md:py-16" aria-labelledby="campus-weather-title">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Hoy en el campus</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {weather ? (
            <p className="flex items-center gap-2 font-heading text-2xl font-extrabold text-foreground-950 md:text-3xl">
              <i className={`${weatherIcon(weather.weatherCode)} text-accent-600`} aria-hidden="true" />
              <span id="campus-weather-title">
                {Math.round(weather.temperature)}°C · {copy.title}
              </span>
            </p>
          ) : (
            <p id="campus-weather-title" className="flex items-center gap-2 font-heading text-2xl font-extrabold text-foreground-950 md:text-3xl">
              <i className="ri-cloud-off-line text-foreground-400" aria-hidden="true" />
              Clima no disponible
            </p>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground-600">
          {unavailable ? 'Te dejamos lo más pedido en el campus.' : copy.message}
          {weather && weather.precipitation > 0 ? ` Lluvia: ${weather.precipitation} mm.` : ''}
        </p>

        <div className="mt-6">
          <DishQuickList items={dishes} />
        </div>
      </div>
    </section>
  );
}
