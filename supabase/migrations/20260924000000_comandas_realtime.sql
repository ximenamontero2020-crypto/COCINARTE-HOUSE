-- /staff/cafeteria-status listens to postgres_changes on comandas. Realtime
-- only emits for tables in the supabase_realtime publication, and still applies
-- RLS: staff receive every row, customers only their own.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comandas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
  END IF;
END $$;
