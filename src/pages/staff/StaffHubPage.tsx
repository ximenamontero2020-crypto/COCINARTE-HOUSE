import { Link } from 'react-router-dom';
import StaffSummary from './components/StaffSummary';
import WhatsAppSettings from './components/WhatsAppSettings';

type Module = { title: string; desc: string; icon: string; to?: string };

const MODULES: Module[] = [
  { title: 'Estado de cafetería', desc: 'Semáforo de la fila y pedidos pendientes por entregar.', icon: 'ri-traffic-light-line', to: '/staff/cafeteria-status' },
  { title: 'Almacén digital', desc: 'Stock de insumos, mínimos y recetas por platillo.', icon: 'ri-archive-2-line', to: '/staff/almacen' },
  { title: 'Corte de caja', desc: 'Apertura, movimientos de efectivo y cierre del día.', icon: 'ri-cash-line', to: '/staff/corte-caja' },
  { title: 'Pago en efectivo', desc: 'Productos listos que se pueden pagar en caja al recoger.', icon: 'ri-money-dollar-circle-line', to: '/staff/menu-efectivo' },
  { title: 'Datos curiosos', desc: 'Contenido que ven los clientes en la app.', icon: 'ri-lightbulb-line', to: '/staff/fun-facts' },
  { title: 'Proveedores', desc: 'Proveedores por insumo y alerta diaria de stock bajo.', icon: 'ri-truck-line', to: '/staff/proveedores' },
  { title: 'Insights', desc: 'Franjas más concurridas y qué se pide en ellas.', icon: 'ri-line-chart-line', to: '/staff/insights' },
  { title: 'Pareto', desc: 'Platillos y horarios que concentran el 80% del negocio.', icon: 'ri-bar-chart-2-line', to: '/staff/pareto' },
];

export default function StaffHubPage() {
  return (
    <main className="min-h-screen bg-background-50 px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-700">Panel de staff</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold text-foreground-950">Control operativo</h1>
        <p className="mt-2 text-sm text-foreground-600">Así va la operación hoy. Elige un módulo para entrar.</p>

        <div className="mt-8">
          <StaffSummary />
        </div>

        <h2 className="mt-10 font-heading text-xl font-bold text-foreground-950">Módulos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const body = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-xl text-primary-700">
                  <i className={m.icon} aria-hidden="true"></i>
                </span>
                <span className="mt-4 flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
                  {m.title}
                  {!m.to && (
                    <span className="rounded-full bg-background-200 px-2 py-0.5 text-xs font-semibold text-foreground-600">Próximamente</span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-foreground-600">{m.desc}</span>
              </>
            );

            return m.to ? (
              <Link
                key={m.title}
                to={m.to}
                className="rounded-2xl border border-background-200/70 bg-background-100 p-5 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                {body}
              </Link>
            ) : (
              <div key={m.title} aria-disabled="true" className="rounded-2xl border border-dashed border-background-300 bg-background-100/60 p-5 opacity-60">
                {body}
              </div>
            );
          })}
        </div>
        <WhatsAppSettings />
      </div>
    </main>
  );
}
