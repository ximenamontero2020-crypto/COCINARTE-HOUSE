CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

-- Defense in depth: the table is not accessible to API roles, and RLS stays enabled.
ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.app_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_order_ready_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, private
AS $$
DECLARE
  anon_key text;
  request_id bigint;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'listo'
     OR OLD.estado IS NOT DISTINCT FROM 'listo'
     OR NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  SELECT value
    INTO anon_key
  FROM private.app_config
  WHERE key = 'anon_key';

  IF anon_key IS NULL OR btrim(anon_key) = '' THEN
    RAISE WARNING 'private.app_config no tiene anon_key; no se notifico el pedido %', NEW.id;
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := 'https://ugmoanyaqdqpombrqnny.supabase.co/functions/v1/send-order-ready-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
    ),
    body := jsonb_build_object('order_id', NEW.id)
  )
  INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error llamando send-order-ready-email para pedido %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comandas_order_ready_email ON public.comandas;

CREATE TRIGGER comandas_order_ready_email
AFTER UPDATE OF estado ON public.comandas
FOR EACH ROW
WHEN (
  OLD.estado IS DISTINCT FROM NEW.estado
  AND OLD.estado IS DISTINCT FROM 'listo'
  AND NEW.estado = 'listo'
)
EXECUTE FUNCTION public.notify_order_ready_email();

REVOKE ALL ON FUNCTION public.notify_order_ready_email() FROM PUBLIC;
