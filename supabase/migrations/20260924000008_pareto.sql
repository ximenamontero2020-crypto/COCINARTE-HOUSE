-- Pareto (80/20) for /staff/pareto. Read-only aggregations over comandas.
-- SECURITY INVOKER: comandas RLS limits the data to staff (a customer only
-- aggregates their own orders). Dates are Mexico City calendar days, both ends
-- inclusive. Cancelled orders are ignored.
--
-- is_vital: the item/slot STARTS before 80% of the cumulative total
-- (cumulative_pct - share < 0.8). That includes the one that crosses 80%, and a
-- single item that alone is > 80% is still marked vital.

CREATE OR REPLACE FUNCTION public.pareto_menu(p_from date, p_to date)
RETURNS TABLE (
  menu_item_id   bigint,
  nombre         text,
  qty            numeric,
  revenue        numeric,
  share          numeric,   -- of revenue, 0..1
  cumulative_pct numeric,   -- 0..1
  is_vital       boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH orders AS (
    SELECT c.productos
    FROM public.comandas AS c
    WHERE (c.created_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN p_from AND p_to
      AND c.estado IS DISTINCT FROM 'cancelado'
  ),
  lines AS (
    SELECT
      CASE WHEN p->>'menu_item_id' ~ '^[0-9]{1,18}$' THEN (p->>'menu_item_id')::bigint END AS menu_item_id,
      NULLIF(btrim(p->>'nombre'), '') AS nombre,
      CASE WHEN p->>'cantidad' ~ '^[0-9]+(\.[0-9]+)?$' THEN (p->>'cantidad')::numeric ELSE 1 END AS cantidad,
      CASE WHEN p->>'precio' ~ '^[0-9]+(\.[0-9]+)?$' THEN (p->>'precio')::numeric ELSE 0 END AS precio
    FROM orders AS o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(o.productos) = 'array' THEN o.productos ELSE '[]'::jsonb END
    ) AS p
  ),
  sold AS (
    SELECT menu_item_id, max(nombre) AS nombre, sum(cantidad) AS qty, sum(cantidad * precio) AS revenue
    FROM lines
    WHERE menu_item_id IS NOT NULL OR nombre IS NOT NULL
    GROUP BY menu_item_id, CASE WHEN menu_item_id IS NULL THEN lower(nombre) END
  ),
  -- Every current menu item appears, with 0 if it did not sell (slow movers).
  items AS (
    SELECT mi.id AS menu_item_id, mi.name AS nombre, COALESCE(s.qty, 0) AS qty, COALESCE(s.revenue, 0) AS revenue
    FROM public.menu_items AS mi
    LEFT JOIN sold AS s ON s.menu_item_id = mi.id
    UNION ALL
    SELECT s.menu_item_id, COALESCE(s.nombre, 'Platillo sin nombre'), s.qty, s.revenue
    FROM sold AS s
    WHERE s.menu_item_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.menu_items AS mi WHERE mi.id = s.menu_item_id)
  ),
  ranked AS (
    SELECT
      i.*,
      i.revenue / NULLIF(sum(i.revenue) OVER (), 0) AS share,
      sum(i.revenue) OVER (ORDER BY i.revenue DESC, i.qty DESC, i.nombre ROWS UNBOUNDED PRECEDING)
        / NULLIF(sum(i.revenue) OVER (), 0) AS cumulative_pct
    FROM items AS i
  )
  SELECT
    menu_item_id,
    nombre,
    qty,
    round(revenue, 2),
    round(COALESCE(share, 0), 4),
    round(COALESCE(cumulative_pct, 0), 4),
    COALESCE(revenue > 0 AND cumulative_pct - share < 0.8, false)
  FROM ranked
  ORDER BY revenue DESC, qty DESC, nombre;
$$;

-- Orders per day-of-week (ISO: 1 = lunes) + hour. Only slots with orders:
-- hours with none are usually closed hours, not "valleys".
-- is_valley: the less busy half of those slots (bottom 50% by order count).
CREATE OR REPLACE FUNCTION public.pareto_hours(p_from date, p_to date)
RETURNS TABLE (
  dow            integer,
  hour           integer,
  orders         integer,
  share          numeric,
  cumulative_pct numeric,
  is_vital       boolean,
  is_valley      boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH slots AS (
    SELECT
      extract(isodow FROM c.created_at AT TIME ZONE 'America/Mexico_City')::int AS dow,
      extract(hour   FROM c.created_at AT TIME ZONE 'America/Mexico_City')::int AS hour,
      count(*)::int AS orders
    FROM public.comandas AS c
    WHERE (c.created_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN p_from AND p_to
      AND c.estado IS DISTINCT FROM 'cancelado'
    GROUP BY 1, 2
  ),
  ranked AS (
    SELECT
      s.*,
      s.orders::numeric / sum(s.orders) OVER () AS share,
      sum(s.orders) OVER (ORDER BY s.orders DESC, s.dow, s.hour ROWS UNBOUNDED PRECEDING)::numeric
        / sum(s.orders) OVER () AS cumulative_pct,
      row_number() OVER (ORDER BY s.orders DESC, s.dow, s.hour) AS rn,
      count(*) OVER () AS n
    FROM slots AS s
  )
  SELECT
    dow,
    hour,
    orders,
    round(share, 4),
    round(cumulative_pct, 4),
    cumulative_pct - share < 0.8,
    rn > ceil(n / 2.0)
  FROM ranked
  ORDER BY orders DESC, dow, hour;
$$;

REVOKE ALL ON FUNCTION public.pareto_menu(date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pareto_hours(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pareto_menu(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pareto_hours(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
