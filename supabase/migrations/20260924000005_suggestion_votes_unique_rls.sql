-- suggestion_votes: one vote per user per proposal, and writes locked down by RLS.
-- The tables were created outside versioned migrations, so everything here is
-- idempotent and checks the catalog first.

-- 1) Unique (suggestion_id, user_id) -------------------------------------------

-- Remove duplicates (keep one row per pair) so the constraint can be created.
DELETE FROM public.suggestion_votes AS a
USING public.suggestion_votes AS b
WHERE a.suggestion_id = b.suggestion_id
  AND a.user_id = b.user_id
  AND a.ctid > b.ctid;

DO $$
BEGIN
  -- Skip if any unique index already covers exactly these two columns.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index AS i
    WHERE i.indrelid = 'public.suggestion_votes'::regclass
      AND i.indisunique
      AND i.indnkeyatts = 2
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey) AS k(attnum)
        JOIN pg_attribute AS a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
      ) = ARRAY['suggestion_id', 'user_id']
  ) THEN
    ALTER TABLE public.suggestion_votes
      ADD CONSTRAINT suggestion_votes_suggestion_user_key UNIQUE (suggestion_id, user_id);
  END IF;
END $$;

-- 2) RLS -----------------------------------------------------------------------

-- Policies are OR-ed: drop every existing one so no older permissive policy survives.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'suggestion_votes'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.suggestion_votes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.suggestion_votes ENABLE ROW LEVEL SECURITY;

-- Read stays public: the landing page shows live counts, and Realtime only
-- delivers a vote event to clients that can SELECT that row.
CREATE POLICY "suggestion_votes_public_read"
  ON public.suggestion_votes FOR SELECT
  TO anon, authenticated
  USING (true);

-- A logged-in user votes as themselves, not on their own proposal, and only
-- on proposals that are open (pendiente / en_prueba).
CREATE POLICY "suggestion_votes_insert_own"
  ON public.suggestion_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.food_suggestions AS s
      WHERE s.id = suggestion_id
        AND s.user_id IS DISTINCT FROM auth.uid()
        AND s.status IN ('pendiente', 'en_prueba')
    )
  );

-- No UPDATE policy: a vote cannot be moved to another proposal or user.
-- A user may withdraw their own vote; staff may remove any (moderation).
CREATE POLICY "suggestion_votes_delete_own_or_staff"
  ON public.suggestion_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

REVOKE UPDATE ON public.suggestion_votes FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
