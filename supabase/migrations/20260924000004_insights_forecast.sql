-- Rule-based forecasts for /staff/insights: read-only aggregations, no jobs.
-- SECURITY INVOKER on purpose: RLS already limits cafeteria_status_history to
-- staff and comandas to staff (customers only see their own rows), so a
-- non-staff caller just gets empty or personal-only results.
-- Day/hour are in America/Mexico_City; dow is ISO (1 = lunes ... 7 = domingo).
-- Depends on 20260924000003_cafeteria_queue.sql.

-- Busy slots: queue snapshots grouped by day of week + hour.
-- Only slots with at least 2 snapshots, busiest first.
CREATE OR REPLACE FUNCTION public.forecast_busy_slots(p_weeks integer DEFAULT 4)
RETURNS TABLE (
  dow          integer,
  hour         integer,
  snapshots    integer,
  days_seen    integer,
  avg_queue    numeric,
  p90_queue    numeric,
  avg_pending  numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH h AS (
    SELECT
      extract(isodow FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS dow,
      extract(hour   FROM created_at AT TIME ZONE 'America/Mexico_City')::int AS hour,
      (created_at AT TIME ZONE 'America/Mexico_City')::date AS day,
      queue_count,
      pending_orders
    FROM public.cafeteria_status_history
    WHERE created_at >= now() - make_interval(weeks => GREATEST(1, LEAST(COALESCE(p_weeks, 4), 52)))
      AND queue_count IS NOT NULL
      AND NOT cerrado
  )
  SELECT
    dow,
    hour,
    count(*)::int,
    count(DISTINCT day)::int,
    round(avg(queue_count), 1),
    round(percentile_cont(0.9) WITHIN GROUP (ORDER BY queue_count)::numeric, 1),
    round(avg(pending_orders), 1)
  FROM h
  GROUP BY dow, hour
  HAVING count(*) >= 2
  ORDER BY 5 DESC, 6 DESC, 3 DESC;
$$;

-- Top products ordered during the p_slots busiest slots (same time window).
-- Cancelled orders are ignored. Old productos rows without menu_item_id are
-- grouped by name.
CREATE OR REPLACE FUNCTION public.top_items_in_busy_windows(
  p_weeks integer DEFAULT 4,
  p_slots integer DEFAULT 5,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  menu_item_id bigint,
  nombre       text,
  cantidad     numeric,
  pedidos      integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH slots AS (
    SELECT s.dow, s.hour
    FROM public.forecast_busy_slots(p_weeks) AS s
    LIMIT GREATEST(1, LEAST(COALESCE(p_slots, 5), 24))
  ),
  orders AS (
    SELECT c.id, c.productos
    FROM public.comandas AS c
    JOIN slots AS s
      ON s.dow  = extract(isodow FROM c.created_at AT TIME ZONE 'America/Mexico_City')::int
     AND s.hour = extract(hour   FROM c.created_at AT TIME ZONE 'America/Mexico_City')::int
    WHERE c.created_at >= now() - make_interval(weeks => GREATEST(1, LEAST(COALESCE(p_weeks, 4), 52)))
      AND c.estado IS DISTINCT FROM 'cancelado'
  ),
  lines AS (
    SELECT
      o.id AS comanda_id,
      CASE WHEN p->>'menu_item_id' ~ '^[0-9]{1,18}$' THEN (p->>'menu_item_id')::bigint END AS menu_item_id,
      NULLIF(btrim(p->>'nombre'), '') AS nombre,
      CASE WHEN p->>'cantidad' ~ '^[0-9]+(\.[0-9]+)?$' THEN (p->>'cantidad')::numeric ELSE 1 END AS cantidad
    FROM orders AS o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.productos) = 'array' THEN o.productos ELSE '[]'::jsonb END
    ) AS p
  )
  SELECT
    l.menu_item_id,
    COALESCE(max(mi.name), max(l.nombre), 'Platillo sin nombre'),
    sum(l.cantidad),
    count(DISTINCT l.comanda_id)::int
  FROM lines AS l
  LEFT JOIN public.menu_items AS mi ON mi.id = l.menu_item_id
  WHERE l.menu_item_id IS NOT NULL OR l.nombre IS NOT NULL
  GROUP BY l.menu_item_id, CASE WHEN l.menu_item_id IS NULL THEN lower(l.nombre) END
  ORDER BY 3 DESC, 4 DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
$$;

REVOKE ALL ON FUNCTION public.forecast_busy_slots(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.top_items_in_busy_windows(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forecast_busy_slots(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_items_in_busy_windows(integer, integer, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
