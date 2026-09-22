import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isStaffEmail } from '@/config/staff';
import StaffChatbotWidget from '@/components/StaffChatbotWidget';

export default function StaffLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background-50 text-sm text-foreground-600">Cargando…</div>;
  }

  if (!user || !isStaffEmail(user.email)) return <Navigate to="/" replace />;

  return (
    <>
      <Outlet />
      <StaffChatbotWidget />
    </>
  );
}
