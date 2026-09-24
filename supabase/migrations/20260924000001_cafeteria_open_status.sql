-- The staff traffic light now affects customers:
--   * cerrado = true  -> banner on the landing page and no new orders.
--   * wait_minutes    -> optional wait estimate shown when the line is busy.
-- Existing RLS on cafeteria_status is unchanged: everyone reads, staff writes.

ALTER TABLE public.cafeteria_status
  ADD COLUMN IF NOT EXISTS cerrado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wait_minutes integer;

ALTER TABLE public.cafeteria_status
  DROP CONSTRAINT IF EXISTS cafeteria_status_wait_minutes_check;
ALTER TABLE public.cafeteria_status
  ADD CONSTRAINT cafeteria_status_wait_minutes_check CHECK (wait_minutes IS NULL OR wait_minutes BETWEEN 1 AND 180);

-- Customers get the change in real time (useCafeteriaStatus listens to this table).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cafeteria_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cafeteria_status;
  END IF;
END $$;

-- Disabling the checkout button is only UI: the database rejects new orders
-- while the cafeteria is closed, whoever inserts them (create_comanda included).
CREATE OR REPLACE FUNCTION public.reject_comanda_when_closed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.cafeteria_status WHERE id = 1 AND cerrado) THEN
    RAISE EXCEPTION 'La cafetería está cerrada. Intenta más tarde.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comandas_reject_when_closed ON public.comandas;
CREATE TRIGGER comandas_reject_when_closed
BEFORE INSERT ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.reject_comanda_when_closed();

NOTIFY pgrst, 'reload schema';
