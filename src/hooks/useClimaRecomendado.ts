import { useEffect, useState } from 'react';

export type ClimaTipo = 'caluroso' | 'lluvioso' | 'templado' | null;

const LATITUDE = 17.9869;
const LONGITUDE = -92.9303;
const OPEN_METEO_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,precipitation&timezone=America/Mexico_City`;

export function useClimaRecomendado() {
  const [clima, setClima] = useState<ClimaTipo>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    const cargarClima = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(OPEN_METEO_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Respuesta de Open-Meteo no válida');

        const data = await res.json();
        const temperatura = data?.current?.temperature_2m;
        const precipitacion = data?.current?.precipitation;

        if (!activo) return;

        if (typeof temperatura === 'number' && temperatura >= 30) {
          setClima('caluroso');
        } else if (typeof precipitacion === 'number' && precipitacion > 0) {
          setClima('lluvioso');
        } else {
          setClima('templado');
        }
      } catch (error) {
        console.error('No se pudo obtener el clima:', error);
        if (activo) setClima(null);
      } finally {
        if (activo) setCargando(false);
      }
    };

    void cargarClima();
    return () => { activo = false; };
  }, []);

  return { clima, cargando };
}