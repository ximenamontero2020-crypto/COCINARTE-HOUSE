-- pg_net is the only extension required by this trigger.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Run this separately in the Supabase SQL Editor with the public anon key:
-- ALTER DATABASE postgres SET app.settings.anon_key = 'PASTE_VITE_PUBLIC_SUPABASE_ANON_KEY_HERE';
-- Existing connections must disconnect/reconnect before current_setting sees the value.

CREATE OR REPLACE FUNCTION public.notify_order_ready_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  anon_key := current_setting('app.settings.anon_key', true);

  IF anon_key IS NULL OR btrim(anon_key) = '' THEN
    RAISE WARNING 'app.settings.anon_key no esta configurado; no se notifico el pedido %', NEW.id;
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
    -- Do not roll back the staff update if the asynchronous notification fails.
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
