-- Orders are created only through public.create_comanda(): the server reads
-- prices from menu_items, computes the total and assigns numero_pedido. The
-- client sends ids and quantities, nothing else.
--
-- Depends on 20260923000000_staff_roles_rls.sql and
-- 20260923000001_promos_and_card_balance.sql (apply_promo / pay_with_card keep
-- working: they are SECURITY DEFINER and run as the table owner).

-- 1) estado: allow 'cancelado' ------------------------------------------------

-- Same approach as 20260917000000_order_ready_email.sql: if estado has a CHECK
-- constraint, keep every existing value and add 'cancelado'.
DO $$
DECLARE
  constraint_name text;
  allowed_values text;
BEGIN
  SELECT con.conname,
         pg_get_constraintdef(con.oid)
  INTO constraint_name, allowed_values
  FROM pg_constraint AS con
  WHERE con.conrelid = 'public.comandas'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%estado%'
  LIMIT 1;

  IF constraint_name IS NOT NULL AND allowed_values NOT ILIKE '%cancelado%' THEN
    EXECUTE format('ALTER TABLE public.comandas DROP CONSTRAINT %I', constraint_name);
    EXECUTE format(
      'ALTER TABLE public.comandas ADD CONSTRAINT %I CHECK (%s OR estado = ''cancelado'')',
      constraint_name,
      regexp_replace(allowed_values, '^CHECK \((.*)\)$', '\1')
    );
  END IF;
END $$;

-- 2) No direct INSERT; API roles may only UPDATE estado -----------------------

DROP POLICY IF EXISTS "comandas_insert_own" ON public.comandas;

REVOKE INSERT ON public.comandas FROM anon, authenticated;

-- Column privilege: an UPDATE touching any other column fails with 42501.
-- comandas_staff_update (RLS) still limits who can update to staff.
REVOKE UPDATE ON public.comandas FROM anon, authenticated;
GRANT UPDATE (estado) ON public.comandas TO authenticated;

-- Only pendiente -> listo | cancelado. SECURITY DEFINER functions run as the
-- owner, so apply_promo / pay_with_card are not affected.
CREATE OR REPLACE FUNCTION public.guard_comanda_estado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Not SECURITY DEFINER on purpose: current_user is the caller's role.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado
     AND NOT (OLD.estado = 'pendiente' AND NEW.estado IN ('listo', 'cancelado')) THEN
    RAISE EXCEPTION 'Cambio de estado no permitido: % -> %', OLD.estado, NEW.estado
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comandas_guard_estado ON public.comandas;
CREATE TRIGGER comandas_guard_estado
BEFORE UPDATE ON public.comandas
FOR EACH ROW
EXECUTE FUNCTION public.guard_comanda_estado();

-- 3) create_comanda -------------------------------------------------------------

-- p_items: [{ "menu_item_id": 12, "cantidad": 2 }, ...]. Repeated ids are merged.
-- p_metodo_pago: 'caja' | 'cafeteria'. With 'cafeteria' the card is charged in
-- the same transaction, so an order is never left created but unpaid.
-- Returns { id, numero_pedido, total, productos, saldo } (saldo only for 'cafeteria').
CREATE OR REPLACE FUNCTION public.create_comanda(p_items jsonb, p_metodo_pago text DEFAULT 'caja')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_lines     integer;
  v_found     integer;
  v_productos jsonb;
  v_total     numeric(10,2);
  v_numero    text;
  v_id        public.comandas.id%TYPE;
  v_saldo     numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para hacer un pedido' USING ERRCODE = '42501';
  END IF;

  IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN ('caja', 'cafeteria') THEN
    RAISE EXCEPTION 'Método de pago no válido' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'El pedido está vacío o no es válido' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e
    WHERE jsonb_typeof(e) <> 'object'
       OR NOT (e->>'menu_item_id' ~ '^[0-9]{1,18}$')
       OR NOT (e->>'cantidad' ~ '^[0-9]{1,3}$')
       OR (e->>'cantidad')::int NOT BETWEEN 1 AND 50
  ) THEN
    RAISE EXCEPTION 'Algún platillo del pedido no es válido' USING ERRCODE = '22023';
  END IF;

  WITH requested AS (
    SELECT (e->>'menu_item_id')::bigint AS menu_item_id,
           sum((e->>'cantidad')::int)   AS cantidad
    FROM jsonb_array_elements(p_items) AS e
    GROUP BY 1
  ),
  priced AS (
    SELECT r.menu_item_id,
           mi.name,
           r.cantidad,
           substring(mi.price FROM '[0-9]+(?:\.[0-9]+)?')::numeric(10,2) AS precio
    FROM requested AS r
    JOIN public.menu_items AS mi ON mi.id = r.menu_item_id
  )
  SELECT (SELECT count(*) FROM requested),
         count(*) FILTER (WHERE precio IS NOT NULL),
         jsonb_agg(
           jsonb_build_object('menu_item_id', menu_item_id, 'nombre', name, 'cantidad', cantidad, 'precio', precio)
           ORDER BY menu_item_id
         ),
         sum(precio * cantidad)
  INTO v_lines, v_found, v_productos, v_total
  FROM priced;

  IF v_found IS DISTINCT FROM v_lines THEN
    RAISE EXCEPTION 'Algún platillo ya no está disponible. Actualiza tu carrito.' USING ERRCODE = '22023';
  END IF;

  LOOP
    v_numero := 'COC-' || lpad(floor(random() * 1000000)::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.comandas WHERE numero_pedido = v_numero);
  END LOOP;

  INSERT INTO public.comandas (cliente, productos, total, estado, numero_pedido, metodo_pago, user_id)
  VALUES (NULL, v_productos, v_total, 'pendiente', v_numero, p_metodo_pago, v_uid)
  RETURNING id INTO v_id;

  -- Raises (and rolls back the insert) if the balance is not enough.
  IF p_metodo_pago = 'cafeteria' THEN
    v_saldo := (public.pay_with_card(v_id)->>'balance')::numeric;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'numero_pedido', v_numero,
    'total', v_total,
    'productos', v_productos,
    'saldo', v_saldo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_comanda(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comanda(jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
