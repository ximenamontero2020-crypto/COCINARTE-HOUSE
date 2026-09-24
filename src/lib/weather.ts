import { CAMPUS, type Weather } from '@/lib/weatherRules';

// Open-Meteo: sin API key. Nunca se inventa un valor: si falla, se lanza y la UI muestra "Clima no disponible".
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${CAMPUS.latitude}&longitude=${CAMPUS.longitude}&current=temperature_2m,precipitation,weather_code&timezone=${encodeURIComponent(CAMPUS.timezone)}`;
const CACHE_KEY = 'cocinarte_weather_cache';
const TTL_MS = 20 * 60 * 1000;
const TIMEOUT_MS = 5000;

let memory: Weather | null = null;
let inflight: Promise<Weather> | null = null;

const fresh = (weather: Weather | null) => weather !== null && Date.now() - weather.fetchedAt < TTL_MS;

function readStorage(): Weather | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Weather;
    return [parsed.temperature, parsed.precipitation, parsed.weatherCode, parsed.fetchedAt].every(Number.isFinite) ? parsed : null;
  } catch {
    return null;
  }
}

/** Clima actual del campus, con caché de 20 min (memoria + localStorage) y una sola petición a la vez. */
export function getCampusWeather(): Promise<Weather> {
  if (fresh(memory)) return Promise.resolve(memory!);
  const stored = readStorage();
  if (fresh(stored)) {
    memory = stored;
    return Promise.resolve(stored!);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(URL, { signal: controller.signal });
      if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
      const data = await response.json();
      const weather: Weather = {
        temperature: data?.current?.temperature_2m,
        precipitation: data?.current?.precipitation,
        weatherCode: data?.current?.weather_code,
        fetchedAt: Date.now(),
      };
      if (![weather.temperature, weather.precipitation, weather.weatherCode].every(Number.isFinite)) {
        throw new Error('Respuesta de Open-Meteo incompleta');
      }
      memory = weather;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(weather));
      } catch {
        // Sin storage (modo privado): basta la caché en memoria.
      }
      return weather;
    } finally {
      window.clearTimeout(timer);
      inflight = null;
    }
  })();

  return inflight;
}
