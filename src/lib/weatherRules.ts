/**
 * Clima → recomendaciones de menú. Única fuente de coordenadas, umbrales y reglas.
 *
 * Mapeo de platillos: menu_items NO tiene columna de tags de clima, así que una regla
 * elige platillos por (a) id de categoría (menu_categories.id, p. ej. 'smoothies') o
 * (b) palabras clave en nombre/descripción. Si se agrega una columna climate_tags,
 * este es el único archivo que hay que cambiar.
 */

/** Campus CocinArte, Villahermosa. */
export const CAMPUS = { latitude: 17.9869, longitude: -92.9303, timezone: 'America/Mexico_City' } as const;

export const HOT_MIN_C = 30;
export const COLD_MAX_C = 22;
export const RAIN_MIN_MM = 0.2;

/** Códigos WMO de Open-Meteo con lluvia: llovizna, lluvia, lluvia helada, chubascos y tormenta. */
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export type Weather = { temperature: number; precipitation: number; weatherCode: number; fetchedAt: number };
export type WeatherRule = 'hot' | 'cold' | 'rain' | 'mild';

/** La lluvia gana: con lluvia se antoja algo caliente aunque haga calor. */
export function resolveRule(weather: Weather | null): WeatherRule {
  if (!weather) return 'mild';
  if (weather.precipitation > RAIN_MIN_MM || RAIN_CODES.has(weather.weatherCode)) return 'rain';
  if (weather.temperature >= HOT_MIN_C) return 'hot';
  if (weather.temperature <= COLD_MAX_C) return 'cold';
  return 'mild';
}

type Selector = { categories: string[]; keywords: string[] };

const COLD_DRINKS: Selector = {
  categories: ['smoothies'],
  keywords: ['agua de', 'horchata', 'jamaica', 'frappe', 'frio', 'fria', 'helad', 'iced', 'limonada', 'smoothie'],
};

const WARM_FOOD: Selector = {
  categories: ['chilaquiles', 'pastas'],
  keywords: ['cafe', 'capuchino', 'latte', 'espresso', 'chocolate caliente', 'te chai', 'caliente', 'caldo', 'sopa'],
};

/** Qué platillos empuja cada regla. 'mild' no filtra: usa los más vendidos. */
const RULE_SELECTORS: Record<WeatherRule, Selector | null> = {
  hot: COLD_DRINKS,
  cold: WARM_FOOD,
  rain: WARM_FOOD,
  mild: null,
};

export const RULE_COPY: Record<WeatherRule, { title: string; message: string }> = {
  hot: { title: 'Día caluroso', message: 'Algo frío para refrescarte.' },
  cold: { title: 'Día fresco', message: 'Algo calientito te va a caer bien.' },
  rain: { title: 'Día lluvioso', message: 'Con lluvia se antoja algo caliente.' },
  mild: { title: 'Clima agradable', message: 'Lo más pedido en el campus.' },
};

function normalize(text: string | null | undefined) {
  return (text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function matchesRule(
  rule: WeatherRule,
  item: { categoryId: string | null | undefined; name: string | null | undefined; description?: string | null },
): boolean {
  const selector = RULE_SELECTORS[rule];
  if (!selector) return false;
  if (item.categoryId && selector.categories.includes(item.categoryId)) return true;
  const text = `${normalize(item.name)} ${normalize(item.description)}`;
  return selector.keywords.some((keyword) => text.includes(keyword));
}

/** Icono Remix según el código WMO. */
export function weatherIcon(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'ri-question-line';
  if (code === 0) return 'ri-sun-line';
  if (code <= 2) return 'ri-sun-cloudy-line';
  if (code === 3) return 'ri-cloudy-line';
  if (code === 45 || code === 48) return 'ri-mist-line';
  if (code >= 95) return 'ri-thunderstorms-line';
  if (code >= 80) return 'ri-showers-line';
  if (code >= 71 && code <= 77) return 'ri-snowy-line';
  if (code >= 51) return 'ri-rainy-line';
  return 'ri-cloudy-line';
}
