import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useStaffRole } from '@/hooks/useStaffRole';
import StaffChatbotWidget from '@/components/StaffChatbotWidget';

const NAV = [
  { to: '/staff', label: 'Hub', end: true },
  { to: '/staff/cafeteria-status', label: 'Cafetería' },
  { to: '/staff/almacen', label: 'Almacén' },
  { to: '/staff/proveedores', label: 'Proveedores' },
  { to: '/staff/corte-caja', label: 'Corte' },
  { to: '/staff/menu-efectivo', label: 'Efectivo' },
  { to: '/staff/fun-facts', label: 'Fun facts' },
  { to: '/staff/insights', label: 'Insights' },
  { to: '/staff/pareto', label: 'Pareto' },
];

export default function StaffLayout() {
  const { user, signOut } = useAuth();
  const { role, isStaff, loading } = useStaffRole();
  const navigate = useNavigate();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background-50 text-sm text-foreground-600">Cargando…</div>;
  }

  if (!isStaff) return <Navigate to="/staff/login" replace />;

  const logout = async () => {
    await signOut();
    navigate('/staff/login', { replace: true });
  };

  const links = role === 'admin' ? [...NAV, { to: '/staff/auditoria', label: 'Auditoría' }] : NAV;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-background-200/70 bg-background-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 md:px-6">
          <span className="font-heading text-sm font-extrabold text-foreground-950 whitespace-nowrap">
            Staff · COCINARTE <span className="text-accent-500">HOUSE</span>
          </span>
          <nav className="flex flex-1 flex-wrap gap-1" aria-label="Panel de staff">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive ? 'bg-primary-500 text-background-50' : 'text-foreground-600 hover:bg-background-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs text-foreground-600">
            <span className="truncate max-w-[14rem]" title={user?.email ?? ''}>{user?.email}</span>
            <span className="rounded-full bg-accent-100 px-2 py-0.5 font-semibold text-accent-800">{role}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-background-300 px-3 py-1.5 font-semibold text-foreground-700 hover:bg-background-100 cursor-pointer whitespace-nowrap"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <StaffChatbotWidget />
    </>
  );
}
