-- Staff access is decided by profiles.role in the database, never by an email
-- allowlist in the client. Every staff table below is protected by RLS using
-- public.is_staff().

-- 1) Roles -------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('customer', 'staff', 'admin'));

-- The existing self-INSERT/UPDATE policies on profiles would let a customer
-- write role = 'admin' on their own row. API roles can never set or change
-- role; it is managed from the SQL Editor or with the service role.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Not SECURITY DEFINER on purpose: current_user is the caller's role.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'No autorizado para asignar el rol %', NEW.role USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'No autorizado para cambiar el rol' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_role ON public.profiles;
CREATE TRIGGER profiles_protect_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- No staff emails live in code. To promote a user (SQL Editor, after they
-- have signed up in Supabase Auth):
--   UPDATE public.profiles SET role = 'staff'   -- or 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('persona@ejemplo.com'));
-- To revoke access: SET role = 'customer'.

-- 2) is_staff() --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('staff', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated, service_role;

-- 3) RLS ---------------------------------------------------------------------

-- Policies are OR-ed, so any older permissive policy would keep the table open.
-- Drop every existing policy on the protected tables before recreating them.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'cafeteria_status', 'comandas', 'fun_facts', 'insumos',
        'receta_platillo', 'cortes_caja', 'movimientos_efectivo'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.cafeteria_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fun_facts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receta_platillo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cortes_caja          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_efectivo ENABLE ROW LEVEL SECURITY;

-- cafeteria_status: everyone sees the traffic light (home page); only staff sets it.
CREATE POLICY "cafeteria_status_public_read"
  ON public.cafeteria_status FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cafeteria_status_staff_insert"
  ON public.cafeteria_status FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "cafeteria_status_staff_update"
  ON public.cafeteria_status FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- comandas: a customer inserts and reads only their own orders, always as
-- 'pendiente'. Changing estado (and deleting) is staff only.
CREATE POLICY "comandas_insert_own"
  ON public.comandas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND estado = 'pendiente');

CREATE POLICY "comandas_select_own_or_staff"
  ON public.comandas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE POLICY "comandas_staff_update"
  ON public.comandas FOR UPDATE
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "comandas_staff_delete"
  ON public.comandas FOR DELETE
  TO authenticated
  USING (public.is_staff());

-- fun_facts: active facts are public; staff sees and manages all of them.
CREATE POLICY "fun_facts_read"
  ON public.fun_facts FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff());

CREATE POLICY "fun_facts_staff_write"
  ON public.fun_facts FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Internal tables: staff only, no customer access at all.
CREATE POLICY "insumos_staff_all"
  ON public.insumos FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "receta_platillo_staff_all"
  ON public.receta_platillo FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "cortes_caja_staff_all"
  ON public.cortes_caja FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "movimientos_efectivo_staff_all"
  ON public.movimientos_efectivo FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 4) Staff RPCs --------------------------------------------------------------

-- A SECURITY DEFINER function skips RLS, so any logged-in customer could call
-- these staff RPCs directly. Run them as the caller so the policies above apply.
-- get_active_pending_orders_count stays as is: the public traffic light uses it.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'abrir_corte_caja', 'cerrar_corte_caja', 'calcular_corte_caja', 'get_insumos_stock_bajo'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
