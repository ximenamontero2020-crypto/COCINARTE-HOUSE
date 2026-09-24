import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export type UserRole = 'customer' | 'staff' | 'admin';

// Solo decide qué UI mostrar; la seguridad real está en las políticas RLS (is_staff()).
export function useStaffRole() {
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<{ userId: string; role: UserRole | null } | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;

    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Error cargando el rol del perfil:', error);
        setResult({ userId: user.id, role: (data?.role as UserRole | undefined) ?? null });
      });

    return () => {
      active = false;
    };
  }, [authLoading, user]);

  // El rol solo cuenta si pertenece al usuario actual (evita usar el de una sesión anterior).
  const role = user && result?.userId === user.id ? result.role : null;
  const loading = authLoading || Boolean(user && result?.userId !== user.id);

  return { role, isStaff: role === 'staff' || role === 'admin', loading };
}
