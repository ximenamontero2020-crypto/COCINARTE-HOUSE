import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useCafeteriaStatus, type CafeteriaLevel } from '@/hooks/useCafeteriaStatus';
import QueueControls from './components/QueueControls';

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
  const { manualLevel, manualSetAt, closed, delayMin, refresh } = useCafeteriaStatus();
  const [delayInput, setDelayInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [readyOrderId, setReadyOrderId] = useState<string | number | null>(null);

  const loadPendingOrders = async (silent = false) => {
    if (!silent) setOrdersLoading(true);
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
    if (!authLoading && user) void loadPendingOrders();
  }, [authLoading, user]);

  // Tiempo real: cualquier alta o cambio de estado en comandas recarga la lista,
  // así un pedido nuevo aparece y uno marcado como listo desaparece en todas las pantallas.
  useEffect(() => {
    if (authLoading || !user) return;
    const channel = supabase
      .channel('staff-comandas-pendientes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, () => {
        void loadPendingOrders(true);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user]);

  if (authLoading) return <div className="p-8 text-center">Cargando…</div>;
  if (!user) return <Navigate to="/" replace />;

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

  // Cerrado y demora se guardan en la misma fila; los clientes lo ven en tiempo real.
  const saveCustomerStatus = async (changes: { cerrado?: boolean; wait_minutes?: number | null }, okMessage: string) => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('cafeteria_status').upsert({ id: 1, ...changes });
    if (error) {
      console.error('Error guardando estado para clientes:', error);
      setMessage('No se pudo guardar el cambio.');
    } else {
      setMessage(okMessage);
      await refresh();
    }
    setSaving(false);
  };

  const saveDelay = () => {
    const minutes = Math.round(Number(delayInput));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      setMessage('La demora debe ser de 1 a 180 minutos.');
      return;
    }
    void saveCustomerStatus({ wait_minutes: minutes }, `Demora de ${minutes} min visible para clientes.`);
    setDelayInput('');
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
      await loadPendingOrders(true);
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

        <section className="mt-10 border-t border-background-200 pt-8" aria-labelledby="customer-status-title">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Lo que ven los clientes</p>
          <h2 id="customer-status-title" className="mt-2 font-heading text-2xl font-extrabold text-foreground-950">
            {closed ? 'Cafetería cerrada' : 'Cafetería abierta'}
          </h2>
          <p className="mt-2 text-sm text-foreground-600">
            {closed
              ? 'Los clientes ven un aviso y no pueden confirmar pedidos.'
              : 'Con semáforo amarillo o rojo, los clientes ven un aviso de fila (y la demora, si la indicas).'}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void saveCustomerStatus(
                { cerrado: !closed },
                closed ? 'Cafetería abierta: ya se aceptan pedidos.' : 'Cafetería cerrada: no se aceptan pedidos.',
              )
            }
            className={`mt-4 w-full rounded-md px-4 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
              closed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-700 hover:bg-red-800'
            }`}
          >
            {closed ? 'Abrir cafetería' : 'Cerrar cafetería (pausar pedidos)'}
          </button>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="delay-min" className="text-sm font-semibold text-foreground-800">Demora estimada</label>
            <input
              id="delay-min"
              type="number"
              min={1}
              max={180}
              inputMode="numeric"
              value={delayInput}
              onChange={(event) => setDelayInput(event.target.value)}
              placeholder={delayMin ? `${delayMin}` : 'min'}
              className="w-24 rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm"
            />
            <button type="button" disabled={saving || !delayInput} onClick={saveDelay} className="rounded-md bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50">
              Guardar
            </button>
            {delayMin !== null && (
              <button type="button" disabled={saving} onClick={() => void saveCustomerStatus({ wait_minutes: null }, 'Demora quitada.')} className="rounded-md border border-background-300 bg-background-50 px-3 py-2 text-sm font-semibold text-foreground-800 hover:bg-background-200 disabled:opacity-50">
                Quitar ({delayMin} min)
              </button>
            )}
          </div>
        </section>

        <QueueControls />

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
