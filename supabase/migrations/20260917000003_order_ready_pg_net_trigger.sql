-- Verify/load the extensions used by the database trigger.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Vault is managed by Supabase and is not created from this migration.
-- Store the public anon key once in the Vault dashboard or SQL Editor:
-- SELECT vault.create_secret(
--   'PASTE_VITE_PUBLIC_SUPABASE_ANON_KEY_HERE',
--   'supabase_anon_key',
--   'Anon key used by the order-ready pg_net trigger'
-- );

CREATE OR REPLACE FUNCTION public.notify_order_ready_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
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

  BEGIN
    EXECUTE $vault$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_anon_key'
      LIMIT 1
    $vault$
    INTO anon_key;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE WARNING 'Vault no esta disponible; no se notifico el pedido %', NEW.id;
      RETURN NEW;
  END;

  IF anon_key IS NULL OR btrim(anon_key) = '' THEN
    RAISE WARNING 'supabase_anon_key no existe en Vault; no se notifico el pedido %', NEW.id;
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
