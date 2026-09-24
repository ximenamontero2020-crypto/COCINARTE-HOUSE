import { useCafeteriaStatus } from '@/hooks/useCafeteriaStatus';

export type CafeteriaNoticeData = { tone: 'closed' | 'busy'; icon: string; text: string };

/** Aviso para clientes según el semáforo: cerrado bloquea pedidos; fila alta solo avisa. */
export function useCafeteriaNotice(): CafeteriaNoticeData | null {
  const { closed, busy, level, delayMin, loading } = useCafeteriaStatus();
  if (loading) return null;

  if (closed) {
    return {
      tone: 'closed',
      icon: 'ri-store-3-line',
      text: 'La cafetería está cerrada. Por ahora no recibimos pedidos en línea.',
    };
  }

  if (busy) {
    const fila = level === 'red' ? 'Hay mucha fila ahora' : 'Hay más fila de lo normal';
    const demora = delayMin ? `: demora aproximada de ${delayMin} min` : '';
    return { tone: 'busy', icon: 'ri-time-line', text: `${fila}${demora}. Tu pedido puede tardar un poco más.` };
  }

  return null;
}
