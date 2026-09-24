import { useEffect, useState } from 'react';
import { getCampusWeather } from '@/lib/weather';
import { resolveRule, type Weather, type WeatherRule } from '@/lib/weatherRules';

/**
 * Clima real del campus (Open-Meteo, caché de 20 min) y la regla de menú activa.
 * Si el clima no está disponible: weather = null, unavailable = true y rule = 'mild' (más vendidos).
 */
export function useClimaRecomendado() {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [cargando, setCargando] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let activo = true;
    getCampusWeather()
      .then((result) => {
        if (activo) setWeather(result);
      })
      .catch((error) => {
        console.error('No se pudo obtener el clima:', error);
        if (activo) setUnavailable(true);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const rule: WeatherRule = resolveRule(weather);
  return { weather, rule, cargando, unavailable };
}
