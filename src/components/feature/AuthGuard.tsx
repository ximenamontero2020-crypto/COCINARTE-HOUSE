import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background-50">
        <div className="flex flex-col items-center gap-4">
          <i className="ri-loader-4-line animate-spin text-4xl text-primary-500" />
          <p className="text-sm text-foreground-600">Cargando…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}