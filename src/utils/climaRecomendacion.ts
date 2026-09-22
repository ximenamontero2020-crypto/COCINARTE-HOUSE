import type { ClimaTipo } from '@/hooks/useClimaRecomendado';

const CATEGORIAS_CALUROSO = ['bebidas', 'smoothies'];
const PALABRAS_CALUROSO = ['helado', 'frío', 'fria', 'fría', 'frappé', 'frappe'];
const CATEGORIAS_LLUVIOSO = ['chilaquiles', 'pastas', 'sándwiches rústicos', 'sandwiches rusticos'];
const PALABRAS_LLUVIOSO = ['caliente', 'caldo', 'sopa'];

function normaliza(texto: string | null | undefined) {
  return (texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function esRecomendadoPorClima(
  clima: ClimaTipo,
  categoryTitle: string | null | undefined,
  nombre: string | null | undefined,
  descripcion: string | null | undefined
): boolean {
  if (!clima || clima === 'templado') return false;
  const categoria = normaliza(categoryTitle);
  const texto = `${normaliza(nombre)} ${normaliza(descripcion)}`;

  if (clima === 'caluroso') {
    return CATEGORIAS_CALUROSO.some((c) => categoria.includes(c)) ||
           PALABRAS_CALUROSO.some((p) => texto.includes(normaliza(p)));
  }
  if (clima === 'lluvioso') {
    return CATEGORIAS_LLUVIOSO.some((c) => categoria.includes(c)) ||
           PALABRAS_LLUVIOSO.some((p) => texto.includes(normaliza(p)));
  }
  return false;
}

export function mensajeBanner(clima: ClimaTipo): string | null {
  if (clima === 'caluroso') return '☀️ Día caluroso — te recomendamos algo fresco';
  if (clima === 'lluvioso') return '🌧️ Día lluvioso — algo calientito te vendría bien';
  return null;
}