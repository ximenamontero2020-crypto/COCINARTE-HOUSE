export function generateOrderNumber(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `COC-${n}`;
}