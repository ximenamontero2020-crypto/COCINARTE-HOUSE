import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type CafeteriaLevel = 'green' | 'yellow' | 'red';
type ManualLevel = CafeteriaLevel | null;

type CafeteriaStatusRow = {
  id: 1;
  manual_level: ManualLevel;
  manual_set_by: string | null;
  manual_set_at: string | null;
};

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

export function useCafeteriaStatus() {
  const [status, setStatus] = useState<CafeteriaStatusRow>(EMPTY_STATUS);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [statusResult, ordersResult] = await Promise.all([
      supabase
        .from('cafeteria_status')
        .select('id, manual_level, manual_set_by, manual_set_at')
        .eq('id', 1)
        .maybeSingle(),
      supabase.rpc('get_active_pending_orders_count'),
    ]);

    if (statusResult.error) throw statusResult.error;
    if (ordersResult.error) throw ordersResult.error;
    setStatus(statusResult.data ?? EMPTY_STATUS);
    setPendingCount(ordersResult.data ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().catch((error) => {
      console.error('Error cargando el semáforo de la cafetería:', error);
      if (active) setLoading(false);
    });

    const channel = supabase
      .channel('cafeteria-status-realtime')
      .on('broadcast', { event: 'comandas_changed' }, () => {
        void refresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafeteria_status' }, () => {
        void refresh();
      })
      .subscribe();

    const expirationTimer = window.setInterval(() => void refresh(), 60_000);

    return () => {
      active = false;
      window.clearInterval(expirationTimer);
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  return {
    level: resolveCafeteriaLevel(status, pendingCount),
    pendingCount,
    manualLevel: isManualActive(status.manual_set_at) ? status.manual_level : null,
    manualSetAt: status.manual_set_at,
    loading,
    refresh,
  };
}
