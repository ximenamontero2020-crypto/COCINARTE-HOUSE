-- Light audit trail for back-office actions: staff logins, cash cuts
-- (cortes_caja) and stock changes (insumos). Rows are written only by
-- SECURITY DEFINER code; only admins can read them. Depends on
-- 20260923000000_staff_roles_rls.sql (profiles.role, public.is_staff()).

-- 1) is_admin() --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
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
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- 2) Table -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.staff_audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  meta       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_audit_log_created_at_idx ON public.staff_audit_log(created_at DESC);

ALTER TABLE public.staff_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.staff_audit_log FROM anon, authenticated;

DROP POLICY IF EXISTS "staff_audit_log_admin_read" ON public.staff_audit_log;
CREATE POLICY "staff_audit_log_admin_read"
  ON public.staff_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3) Writers -----------------------------------------------------------------

-- Called by /staff/login after a successful sign-in. No-op for non-staff.
CREATE OR REPLACE FUNCTION public.log_staff_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RETURN;
  END IF;

  INSERT INTO public.staff_audit_log (actor_id, action, entity, entity_id)
  VALUES (auth.uid(), 'login', 'staff_session', auth.uid()::text);
END;
$$;

REVOKE ALL ON FUNCTION public.log_staff_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_staff_login() TO authenticated;

-- Row trigger: logs staff writes with the changed columns (old -> new).
-- Writes made by the system (no staff session) are not logged.
CREATE OR REPLACE FUNCTION public.audit_staff_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old  jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) END;
  v_new  jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) END;
  v_meta jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff() THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_object_agg(n.key, jsonb_build_object('antes', v_old->n.key, 'despues', n.value)), '{}'::jsonb)
    INTO v_meta
    FROM jsonb_each(v_new) AS n
    WHERE n.key <> 'updated_at'
      AND n.value IS DISTINCT FROM v_old->n.key;

    IF v_meta = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSE
    v_meta := COALESCE(v_new, v_old);
  END IF;

  INSERT INTO public.staff_audit_log (actor_id, action, entity, entity_id, meta)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    COALESCE(v_new->>'id', v_old->>'id'),
    v_meta
  );

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_staff_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cortes_caja_audit ON public.cortes_caja;
CREATE TRIGGER cortes_caja_audit
AFTER INSERT OR UPDATE ON public.cortes_caja
FOR EACH ROW
EXECUTE FUNCTION public.audit_staff_change();

DROP TRIGGER IF EXISTS insumos_audit ON public.insumos;
CREATE TRIGGER insumos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.insumos
FOR EACH ROW
EXECUTE FUNCTION public.audit_staff_change();

NOTIFY pgrst, 'reload schema';
