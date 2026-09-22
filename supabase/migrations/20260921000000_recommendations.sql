CREATE OR REPLACE FUNCTION public.get_recomendaciones_usuario(p_user_id uuid)
RETURNS TABLE (
  id bigint,
  category_id text,
  name text,
  description text,
  price text,
  emoji text,
  image text,
  nutrition_calories integer,
  nutrition_protein integer,
  nutrition_carbs integer,
  nutrition_fat integer,
  allergens text[],
  orden integer,
  category_title text,
  category_subtitle text,
  category_image text,
  purchased_quantity numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH recent_orders AS (
    SELECT c.id, c.productos
    FROM public.comandas AS c
    WHERE c.user_id = p_user_id
      AND c.created_at >= now() - interval '30 days'
  ),
  order_count AS (
    SELECT COUNT(DISTINCT id) AS total
    FROM recent_orders
  ),
  purchased AS (
    SELECT
      NULLIF(product->>'menu_item_id', '')::bigint AS menu_item_id,
      SUM(NULLIF(product->>'cantidad', '')::numeric) AS purchased_quantity
    FROM recent_orders AS c
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(c.productos, '[]'::jsonb)) = 'array'
          THEN COALESCE(c.productos, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS product
    WHERE product ? 'menu_item_id'
      AND product->>'menu_item_id' ~ '^[0-9]+$'
    GROUP BY NULLIF(product->>'menu_item_id', '')::bigint
  )
  SELECT
    mi.id,
    mi.category_id,
    mi.name,
    mi.description,
    mi.price,
    mi.emoji,
    mi.image,
    mi.nutrition_calories,
    mi.nutrition_protein,
    mi.nutrition_carbs,
    mi.nutrition_fat,
    mi.allergens,
    mi.orden,
    mc.title,
    mc.subtitle,
    mc.image,
    purchased.purchased_quantity
  FROM purchased
  JOIN order_count ON order_count.total >= 2
  JOIN public.menu_items AS mi ON mi.id = purchased.menu_item_id
  JOIN public.menu_categories AS mc ON mc.id = mi.category_id
  WHERE p_user_id = auth.uid()
  ORDER BY purchased.purchased_quantity DESC, mi.orden ASC
  LIMIT 4;
$$;

CREATE OR REPLACE FUNCTION public.get_productos_mas_vendidos(p_limite integer DEFAULT 3)
RETURNS TABLE (
  id bigint,
  category_id text,
  name text,
  description text,
  price text,
  emoji text,
  image text,
  nutrition_calories integer,
  nutrition_protein integer,
  nutrition_carbs integer,
  nutrition_fat integer,
  allergens text[],
  orden integer,
  category_title text,
  category_subtitle text,
  category_image text,
  sold_quantity numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH sold AS (
    SELECT
      NULLIF(product->>'menu_item_id', '')::bigint AS menu_item_id,
      SUM(NULLIF(product->>'cantidad', '')::numeric) AS sold_quantity
    FROM public.comandas AS c
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(c.productos, '[]'::jsonb)) = 'array'
          THEN COALESCE(c.productos, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS product
    WHERE c.created_at >= now() - interval '30 days'
      AND product ? 'menu_item_id'
      AND product->>'menu_item_id' ~ '^[0-9]+$'
    GROUP BY NULLIF(product->>'menu_item_id', '')::bigint
  )
  SELECT
    mi.id,
    mi.category_id,
    mi.name,
    mi.description,
    mi.price,
    mi.emoji,
    mi.image,
    mi.nutrition_calories,
    mi.nutrition_protein,
    mi.nutrition_carbs,
    mi.nutrition_fat,
    mi.allergens,
    mi.orden,
    mc.title,
    mc.subtitle,
    mc.image,
    sold.sold_quantity
  FROM sold
  JOIN public.menu_items AS mi ON mi.id = sold.menu_item_id
  JOIN public.menu_categories AS mc ON mc.id = mi.category_id
  ORDER BY sold.sold_quantity DESC, mi.orden ASC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limite, 3), 10));
$$;

GRANT EXECUTE ON FUNCTION public.get_recomendaciones_usuario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_productos_mas_vendidos(integer) TO anon, authenticated;
