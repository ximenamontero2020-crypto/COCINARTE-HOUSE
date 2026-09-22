import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isStaffEmail } from '@/config/staff';
import { supabase } from '@/lib/supabase';
import { useCafeteriaStatus, type CafeteriaLevel } from '@/hooks/useCafeteriaStatus';

const levels: Array<{ value: CafeteriaLevel; label: string; className: string }> = [
  { value: 'green', label: 'Verde: poca gente', className: 'bg-emerald-600 hover:bg-emerald-700' },
  { value: 'yellow', label: 'Amarillo: regular', className: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'red', label: 'Rojo: mucha gente', className: 'bg-red-600 hover:bg-red-700' },
];

type PendingOrder = {
  id: string | number;
  numero_pedido: string;
  total: number | string;
  created_at: string | null;
};

export default function CafeteriaStatusPage() {
  const { user, loading: authLoading } = useAuth();
  const { manualLevel, manualSetAt, refresh } = useCafeteriaStatus();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [readyOrderId, setReadyOrderId] = useState<string | number | null>(null);

  const loadPendingOrders = async () => {
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('comandas')
      .select('id, numero_pedido, total, created_at')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true });

    if (error) {
      setMessage('No se pudieron cargar los pedidos pendientes.');
      console.error('Error cargando pedidos pendientes:', error);
    } else {
      setPendingOrders((data ?? []) as PendingOrder[]);
    }
    setOrdersLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user && isStaffEmail(user.email)) void loadPendingOrders();
  }, [authLoading, user]);

  if (authLoading) return <div className="p-8 text-center">Cargando…</div>;
  if (!user || !isStaffEmail(user.email)) return <Navigate to="/" replace />;

  const saveLevel = async (level: CafeteriaLevel | null) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('cafeteria_status').upsert({
      id: 1,
      manual_level: level,
      manual_set_by: level ? user.id : null,
      manual_set_at: level ? new Date().toISOString() : null,
    });
    if (error) setMessage('No se pudo actualizar el semáforo.');
    else {
      setMessage(level ? 'Override guardado por 2 horas.' : 'El semáforo volvió al modo automático.');
      await refresh();
    }
    setSaving(false);
  };

  const markOrderReady = async (orderId: string | number) => {
    setReadyOrderId(orderId);
    setMessage(null);
    const { error } = await supabase
      .from('comandas')
      .update({ estado: 'listo' })
      .eq('id', orderId)
      .eq('estado', 'pendiente');

    if (error) {
      console.error('Error marcando pedido como listo:', error);
      setMessage('No se pudo marcar el pedido como listo.');
    } else {
      setMessage('Pedido marcado como listo.');
      await loadPendingOrders();
    }
    setReadyOrderId(null);
  };

  return (
    <main className="min-h-screen bg-background-50 px-4 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-background-200/70 bg-background-100 p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Panel de staff</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Semáforo de cafetería</h1>
        <p className="mt-2 text-sm text-foreground-600">El override manual expira automáticamente después de dos horas.</p>

        <div className="mt-8 grid gap-3">
          {levels.map((level) => (
            <button
              key={level.value}
              type="button"
              disabled={saving}
              onClick={() => void saveLevel(level.value)}
              className={`rounded-md px-4 py-3 text-left text-sm font-bold text-white transition-colors disabled:opacity-50 ${level.className}`}
            >
              {level.label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveLevel(null)}
            className="rounded-md border border-background-300 bg-background-50 px-4 py-3 text-left text-sm font-bold text-foreground-800 transition-colors hover:bg-background-200 disabled:opacity-50"
          >
            Volver a automático
          </button>
        </div>

        <p className="mt-6 text-sm text-foreground-600">
          Estado manual actual: <strong>{manualLevel ?? 'ninguno'}</strong>
          {manualSetAt ? ` · establecido ${new Date(manualSetAt).toLocaleString('es-MX')}` : ''}
        </p>
        {message && <p className="mt-3 text-sm font-semibold text-primary-700">{message}</p>}

        <section className="mt-10 border-t border-background-200 pt-8" aria-labelledby="pending-orders-title">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Pedidos</p>
              <h2 id="pending-orders-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">
                Pendientes
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadPendingOrders()}
              disabled={ordersLoading}
              className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm font-semibold text-foreground-800 transition-colors hover:bg-background-200 disabled:opacity-50"
            >
              Actualizar
            </button>
          </div>

          {ordersLoading ? (
            <p className="mt-4 text-sm text-foreground-600">Cargando pedidos…</p>
          ) : pendingOrders.length === 0 ? (
            <p className="mt-4 text-sm text-foreground-600">No hay pedidos pendientes.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {pendingOrders.map((order) => (
                <article key={order.id} className="rounded-xl border border-background-200 bg-background-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground-950">Pedido {order.numero_pedido}</p>
                      <p className="mt-1 text-sm text-foreground-600">
                        Total: ${Number(order.total).toFixed(2)}
                        {order.created_at ? ` · ${new Date(order.created_at).toLocaleString('es-MX')}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void markOrderReady(order.id)}
                      disabled={readyOrderId === order.id}
                      className="rounded-md bg-primary-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                    >
                      {readyOrderId === order.id ? 'Guardando…' : 'Marcar como listo'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
