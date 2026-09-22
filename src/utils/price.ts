export function parsePrice(price: string): number {
  const n = Number(price.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatPrice(value: number): string {
  return `MXN ${value}`;
}