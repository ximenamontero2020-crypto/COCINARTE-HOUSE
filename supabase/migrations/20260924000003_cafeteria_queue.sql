-- Queue count visible to customers + history for future forecasts (phase 1:
-- staff input or an estimate from pending orders; no cameras / IoT).
-- Depends on 20260924000001_cafeteria_open_status.sql (cerrado, wait_minutes).

-- 1) Live row ------------------------------------------------------------------

ALTER TABLE public.cafeteria_status
  ADD COLUMN IF NOT EXISTS queue_count integer,          -- NULL = no data yet
  ADD COLUMN IF NOT EXISTS queue_source text,            -- 'staff' | 'pedidos'
  ADD COLUMN IF NOT EXISTS queue_factor numeric(4,2) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS queue_updated_at timestamptz;  -- NULL = never counted

ALTER TABLE public.cafeteria_status DROP CONSTRAINT IF EXISTS cafeteria_status_queue_count_check;
ALTER TABLE public.cafeteria_status
  ADD CONSTRAINT cafeteria_status_queue_count_check CHECK (queue_count IS NULL OR queue_count BETWEEN 0 AND 500);

ALTER TABLE public.cafeteria_status DROP CONSTRAINT IF EXISTS cafeteria_status_queue_source_check;
ALTER TABLE public.cafeteria_status
  ADD CONSTRAINT cafeteria_status_queue_source_check CHECK (queue_source IS NULL OR queue_source IN ('staff', 'pedidos'));

ALTER TABLE public.cafeteria_status DROP CONSTRAINT IF EXISTS cafeteria_status_queue_factor_check;
ALTER TABLE public.cafeteria_status
  ADD CONSTRAINT cafeteria_status_queue_factor_check CHECK (queue_factor > 0 AND queue_factor <= 10);

ALTER TABLE public.cafeteria_status DROP CONSTRAINT IF EXISTS cafeteria_status_note_check;
ALTER TABLE public.cafeteria_status
  ADD CONSTRAINT cafeteria_status_note_check CHECK (note IS NULL OR char_length(note) <= 140);

-- queue_updated_at drives "Actualizado hace X min" / "dato no actualizado" on
-- the landing page, so it must only move when the queue data is (re)confirmed,
-- not when staff toggle cerrado or the wait time. It moves when queue_count
-- changes, or when the client sends any queue_updated_at ("Confirmar dato" with
-- the same count). The value is always replaced by the server clock.
CREATE OR REPLACE FUNCTION public.touch_cafeteria_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.queue_updated_at := CASE WHEN NEW.queue_count IS NOT NULL THEN now() END;
  ELSIF NEW.queue_count IS DISTINCT FROM OLD.queue_count
     OR NEW.queue_updated_at IS DISTINCT FROM OLD.queue_updated_at THEN
    NEW.queue_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cafeteria_status_touch ON public.cafeteria_status;
CREATE TRIGGER cafeteria_status_touch
BEFORE INSERT OR UPDATE ON public.cafeteria_status
FOR EACH ROW
EXECUTE FUNCTION public.touch_cafeteria_status();

-- 2) History (append-only) -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cafeteria_status_history (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level          text,          -- manual_level at that moment; NULL = automatic
  queue_count    integer,
  wait_minutes   integer,
  source         text,          -- queue_source: 'staff' | 'pedidos'
  cerrado        boolean NOT NULL,
  pending_orders integer,       -- comandas pendientes at that moment, for forecasts
  actor_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cafeteria_status_history_created_at_idx
  ON public.cafeteria_status_history(created_at DESC);

ALTER TABLE public.cafeteria_status_history ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.cafeteria_status_history FROM anon, authenticated;

DROP POLICY IF EXISTS "cafeteria_status_history_staff_read" ON public.cafeteria_status_history;
CREATE POLICY "cafeteria_status_history_staff_read"
  ON public.cafeteria_status_history FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- SECURITY DEFINER: staff cannot write the history table directly, and the
-- pending count must see every comanda.
CREATE OR REPLACE FUNCTION public.append_cafeteria_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.cafeteria_status_history
    (level, queue_count, wait_minutes, source, cerrado, pending_orders, actor_id)
  VALUES (
    NEW.manual_level,
    NEW.queue_count,
    NEW.wait_minutes,
    NEW.queue_source,
    NEW.cerrado,
    (SELECT count(*)::int FROM public.comandas WHERE estado = 'pendiente'),
    auth.uid()
  );
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.append_cafeteria_status_history() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cafeteria_status_history_append ON public.cafeteria_status;
CREATE TRIGGER cafeteria_status_history_append
AFTER INSERT OR UPDATE ON public.cafeteria_status
FOR EACH ROW
EXECUTE FUNCTION public.append_cafeteria_status_history();

NOTIFY pgrst, 'reload schema';
