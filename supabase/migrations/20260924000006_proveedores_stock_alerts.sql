-- Suppliers + daily low-stock email.
--
-- insumos already has the stock columns this needs: cantidad_actual (stock)
-- and umbral_minimo (stock_min). No new columns on insumos.
--
-- Flow: when an insumo is written with cantidad_actual <= umbral_minimo, the
-- trigger claims today's row in stock_alert_log (Mexico City date). Only the
-- first claim of the day calls the Edge Function send-low-stock-email, which
-- builds ONE email with every low insumo and its preferred suppliers and sends
-- it to STOCK_ALERT_EMAILS (function env). No addresses live in the database.
--
-- One-time setup (SQL Editor, never in a migration):
--   INSERT INTO private.app_config (key, value) VALUES ('stock_alert_secret', '<random string>')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- and the same value as STOCK_ALERT_SECRET in the function's secrets.
-- Depends on: private.app_config (20260918000001), public.is_staff().

-- 1) Suppliers ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.proveedores (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre         text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120),
  contacto_email text CHECK (contacto_email IS NULL OR contacto_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  telefono       text CHECK (telefono IS NULL OR char_length(telefono) <= 30),
  notas          text CHECK (notas IS NULL OR char_length(notas) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insumo_proveedor (
  proveedor_id bigint NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  sku_ref      text CHECK (sku_ref IS NULL OR char_length(sku_ref) <= 60),
  lead_days    integer CHECK (lead_days IS NULL OR lead_days BETWEEN 0 AND 365),
  preferred    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- insumo_id must match insumos.id, whose type is not versioned in this repo.
DO $$
DECLARE
  v_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'insumo_proveedor' AND column_name = 'insumo_id'
  ) THEN
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute AS a
    WHERE a.attrelid = 'public.insumos'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

    EXECUTE format(
      'ALTER TABLE public.insumo_proveedor ADD COLUMN insumo_id %s NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE',
      v_type
    );
    ALTER TABLE public.insumo_proveedor ADD PRIMARY KEY (insumo_id, proveedor_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS insumo_proveedor_proveedor_idx ON public.insumo_proveedor(proveedor_id);

ALTER TABLE public.proveedores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumo_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proveedores_staff_all" ON public.proveedores;
CREATE POLICY "proveedores_staff_all"
  ON public.proveedores FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "insumo_proveedor_staff_all" ON public.insumo_proveedor;
CREATE POLICY "insumo_proveedor_staff_all"
  ON public.insumo_proveedor FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 2) Daily dedupe log ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.stock_alert_log (
  day          date PRIMARY KEY,               -- Mexico City date
  triggered_at timestamptz NOT NULL DEFAULT now(),
  insumo_id    text,                           -- insumo whose write fired the alert
  result       text,                           -- set by the function: sent | preview_only | no_recipients | nothing_low | error: ...
  finished_at  timestamptz
);

ALTER TABLE public.stock_alert_log ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stock_alert_log FROM anon, authenticated;

DROP POLICY IF EXISTS "stock_alert_log_staff_read" ON public.stock_alert_log;
CREATE POLICY "stock_alert_log_staff_read"
  ON public.stock_alert_log FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- 3) Trigger -----------------------------------------------------------------------

-- The old dashboard trigger called send-low-stock-email once per insumo with a
-- per-insumo payload (and a hard-coded recipient in the function). The
-- function now builds a daily digest, so drop any trigger on insumos whose
-- function calls it, to avoid duplicate / malformed calls.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tg.tgname
    FROM pg_trigger AS tg
    JOIN pg_proc AS p ON p.oid = tg.tgfoid
    WHERE tg.tgrelid = 'public.insumos'::regclass
      AND NOT tg.tgisinternal
      AND p.prosrc ILIKE '%send-low-stock-email%'
      AND p.proname <> 'notify_low_stock_digest'
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.insumos', t.tgname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.notify_low_stock_digest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  v_day    date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_secret text;
  v_anon   text;
  v_claimed date;
BEGIN
  -- First low-stock write of the day claims the row; everyone else stops here.
  INSERT INTO public.stock_alert_log (day, insumo_id)
  VALUES (v_day, NEW.id::text)
  ON CONFLICT (day) DO NOTHING
  RETURNING day INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_secret FROM private.app_config WHERE key = 'stock_alert_secret';
  -- anon_key only gets the request past the functions gateway (verify_jwt);
  -- the function itself only trusts x-stock-alert-secret.
  SELECT value INTO v_anon FROM private.app_config WHERE key = 'anon_key';
  IF COALESCE(btrim(v_secret), '') = '' OR COALESCE(btrim(v_anon), '') = '' THEN
    UPDATE public.stock_alert_log
    SET result = 'error: falta stock_alert_secret o anon_key en private.app_config', finished_at = now()
    WHERE day = v_day;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://ugmoanyaqdqpombrqnny.supabase.co/functions/v1/send-low-stock-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'apikey', v_anon,
      'x-stock-alert-secret', v_secret
    ),
    body := jsonb_build_object('day', v_day)
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block a stock update because of the alert.
    RAISE WARNING 'Error programando alerta de stock bajo: %', SQLERRM;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_low_stock_digest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS insumos_low_stock_digest ON public.insumos;
CREATE TRIGGER insumos_low_stock_digest
AFTER INSERT OR UPDATE OF cantidad_actual, umbral_minimo ON public.insumos
FOR EACH ROW
WHEN (NEW.cantidad_actual <= NEW.umbral_minimo)
EXECUTE FUNCTION public.notify_low_stock_digest();

NOTIFY pgrst, 'reload schema';
