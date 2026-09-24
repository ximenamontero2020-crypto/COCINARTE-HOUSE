import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type CafeteriaLevel = 'green' | 'yellow' | 'red';
type ManualLevel = CafeteriaLevel | null;

type CafeteriaStatusRow = {
  id: 1;
  manual_level: ManualLevel;
  manual_set_by: string | null;
  manual_set_at: string | null;
  cerrado: boolean;
  wait_minutes: number | null;
  queue_count: number | null;
  queue_source: 'staff' | 'pedidos' | null;
  queue_factor: number | string;
  note: string | null;
  queue_updated_at: string | null;
};

/** A partir de estos minutos sin actualización, el cliente ve "dato no actualizado". */
export const QUEUE_STALE_MINUTES = 15;

export const CAFETERIA_LEVELS: Record<CafeteriaLevel, { label: string; color: string; count: string }> = {
  green: { label: 'Poca gente', color: 'green', count: '0 a 5 pedidos activos' },
  yellow: { label: 'Regular', color: 'yellow', count: '6 a 15 pedidos activos' },
  red: { label: 'Mucha gente', color: 'red', count: 'Más de 15 pedidos activos' },
};

const EMPTY_STATUS: CafeteriaStatusRow = {
  id: 1,
  manual_level: null,
  manual_set_by: null,
  manual_set_at: null,
  cerrado: false,
  wait_minutes: null,
  queue_count: null,
  queue_source: null,
  queue_factor: 1,
  note: null,
  queue_updated_at: null,
};

function levelFromCount(count: number): CafeteriaLevel {
  if (count <= 5) return 'green';
  if (count <= 15) return 'yellow';
  return 'red';
}

function isManualActive(manualSetAt: string | null): boolean {
  if (!manualSetAt) return false;
  return Date.now() - new Date(manualSetAt).getTime() < 2 * 60 * 60 * 1000;
}

export function resolveCafeteriaLevel(status: CafeteriaStatusRow, pendingCount: number): CafeteriaLevel {
  if (status.manual_level && isManualActive(status.manual_set_at)) return status.manual_level;
  return levelFromCount(pendingCount);
}

type Snapshot = {
  status: CafeteriaStatusRow;
  pendingCount: number;
  loading: boolean;
};

// Estado compartido: una sola suscripción realtime para todos los componentes que usan
// el hook. realtime-js reutiliza el canal por nombre, así que varios canales iguales
// chocarían (y el primero en desmontarse cerraría el de los demás).
let snapshot: Snapshot = { status: EMPTY_STATUS, pendingCount: 0, loading: true };
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let expirationTimer: number | null = null;

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  const [statusResult, ordersResult] = await Promise.all([
    supabase
      .from('cafeteria_status')
      .select('id, manual_level, manual_set_by, manual_set_at, cerrado, wait_minutes, queue_count, queue_source, queue_factor, note, queue_updated_at')
      .eq('id', 1)
      .maybeSingle(),
    supabase.rpc('get_active_pending_orders_count'),
  ]);

  if (statusResult.error) throw statusResult.error;
  if (ordersResult.error) throw ordersResult.error;
  emit({ status: statusResult.data ?? EMPTY_STATUS, pendingCount: ordersResult.data ?? 0, loading: false });
}

function refreshSafely() {
  void refresh().catch((error) => {
    console.error('Error cargando el semáforo de la cafetería:', error);
    if (snapshot.loading) emit({ ...snapshot, loading: false });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (listeners.size === 1) {
    refreshSafely();
    channel = supabase
      .channel('cafeteria-status-realtime')
      .on('broadcast', { event: 'comandas_changed' }, refreshSafely)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_status' }, refreshSafely)
      .subscribe();
    // El override manual expira a las 2 h aunque nadie cambie la fila.
    expirationTimer = window.setInterval(refreshSafely, 60_000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (expirationTimer !== null) window.clearInterval(expirationTimer);
    expirationTimer = null;
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}

const getSnapshot = () => snapshot;

export function useCafeteriaStatus() {
  const { status, pendingCount, loading } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const level = resolveCafeteriaLevel(status, pendingCount);

  return {
    level,
    pendingCount,
    manualLevel: isManualActive(status.manual_set_at) ? status.manual_level : null,
    manualSetAt: status.manual_set_at,
    /** Staff marcó la cafetería como cerrada: no se aceptan pedidos. */
    closed: status.cerrado,
    /** Hay más fila de lo normal (amarillo o rojo). */
    busy: level !== 'green',
    /** Demora estimada por staff, en minutos (solo tiene sentido si busy). */
    delayMin: status.wait_minutes,
    /** Personas en fila según staff o estimación; null = sin dato. */
    queueCount: status.queue_count,
    queueSource: status.queue_source,
    queueFactor: Number(status.queue_factor) || 1,
    note: status.note,
    /** Minutos desde el último conteo o confirmación de la fila (reloj del servidor); null = nunca. */
    minutesSinceUpdate: status.queue_updated_at
      ? Math.max(0, Math.floor((Date.now() - new Date(status.queue_updated_at).getTime()) / 60_000))
      : null,
    loading,
    refresh,
  };
}
