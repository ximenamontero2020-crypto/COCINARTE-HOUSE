-- Métodos de pago del checkout:
--   'cafeteria' Tarjeta CocinArte: el saldo se cobra aquí, en la misma transacción.
--   'caja'      Efectivo al recoger: SOLO si ningún producto requiere preparación.
--   'pasarela'  Prototipo del frontend: no cobra, nunca crea pedidos. Se rechaza aquí
--               explícitamente por si alguien llama la RPC a mano.
--
-- Por qué el efectivo solo aplica a productos listos: si algo que se prepara se
-- paga al recoger y el cliente no llega, la comida ya se preparó y se desperdicia.
-- El efectivo es pago contra entrega, así que solo sirve para productos que ya
-- están hechos (agua, sándwiches ya preparados, galletas).
--
-- comandas.metodo_pago no cambia: sigue recibiendo solo 'caja' y 'cafeteria'
-- ('pasarela' nunca llega a la BD), así que un CHECK existente sigue siendo compatible.
--
-- Nota: el nombre pedido (20260924000000_…) ya lo usa comandas_realtime y la
-- versión debe ser única, por eso esta migración va después de 20260924000008.

-- 1) menu_items.pago_en_caja_permitido -----------------------------------------

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS pago_en_caja_permitido boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.menu_items.pago_en_caja_permitido IS
  'true = producto listo que no requiere preparación (agua, sándwich ya hecho, galletas) y se puede pagar en efectivo al recoger. '
  'false (por defecto) = requiere preparación: el efectivo queda bloqueado hasta que el staff lo permita, porque si el cliente '
  'no llega a pagar, la comida ya preparada se desperdicia.';

-- 2) create_comanda -------------------------------------------------------------

-- Igual que 20260923000002_create_comanda_rpc.sql, con estos cambios:
--   * DEFAULT 'cafeteria' (antes 'caja').
--   * 'pasarela' se rechaza con un mensaje propio.
--   * 'caja' solo si TODOS los productos tienen pago_en_caja_permitido = true.
-- p_items: [{ "menu_item_id": 12, "cantidad": 2 }, ...]. Repeated ids are merged.
-- p_metodo_pago: 'cafeteria' | 'caja'. With 'cafeteria' the card is charged in
-- the same transaction, so an order is never left created but unpaid.
-- Returns { id, numero_pedido, total, productos, saldo } (saldo only for 'cafeteria').
CREATE OR REPLACE FUNCTION public.create_comanda(p_items jsonb, p_metodo_pago text DEFAULT 'cafeteria')
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

  -- La pasarela es solo una demostración en el frontend: nunca crea pedidos ni los manda a cocina.
  IF p_metodo_pago = 'pasarela' THEN
    RAISE EXCEPTION 'La pasarela de pago es un prototipo y no puede crear pedidos.' USING ERRCODE = '22023';
  END IF;

  IF p_metodo_pago IS NULL OR p_metodo_pago NOT IN ('cafeteria', 'caja') THEN
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

  -- Efectivo = pago contra entrega: solo productos que no requieren preparación.
  -- Si algo se prepara y el cliente no llega a pagar, la comida se desperdicia.
  -- Un id que no existe o sin el permiso cuenta como "requiere preparación".
  IF p_metodo_pago = 'caja' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e
    LEFT JOIN public.menu_items AS mi ON mi.id = (e->>'menu_item_id')::bigint
    WHERE mi.pago_en_caja_permitido IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'El pago en efectivo solo aplica a productos que no requieren preparación.' USING ERRCODE = '22023';
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

-- 3) pay_with_card: solo cambia el mensaje de saldo insuficiente --------------

-- Igual que 20260923000001_promos_and_card_balance.sql; el mensaje ya no ofrece
-- "pagar en caja" porque el efectivo solo aplica a productos sin preparación.
-- Pays one of the caller's pending comandas (metodo_pago = 'cafeteria') with
-- the card balance. Returns { balance } after the charge.
CREATE OR REPLACE FUNCTION public.pay_with_card(p_comanda_id public.comandas.id%TYPE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_owner  uuid;
  v_estado text;
  v_metodo text;
  v_paid   timestamptz;
  v_total  numeric(10,2);
  v_acc    public.card_accounts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para pagar' USING ERRCODE = '42501';
  END IF;

  SELECT c.user_id, c.estado, c.metodo_pago, c.pagada_at, c.total::numeric
  INTO v_owner, v_estado, v_metodo, v_paid, v_total
  FROM public.comandas AS c
  WHERE c.id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF v_estado <> 'pendiente' OR v_paid IS NOT NULL THEN
    RAISE EXCEPTION 'Este pedido ya fue pagado o no está pendiente';
  END IF;
  IF v_metodo IS DISTINCT FROM 'cafeteria' THEN
    RAISE EXCEPTION 'Este pedido no se paga con la Tarjeta CocinArte';
  END IF;

  PERFORM public.ensure_card_account(v_uid);
  SELECT * INTO v_acc FROM public.card_accounts WHERE user_id = v_uid FOR UPDATE;

  IF v_acc.balance < v_total THEN
    -- Message shown to the customer as is (checkout displays error.message).
    RAISE EXCEPTION 'Saldo insuficiente. Tu saldo es $%; el pedido es $%. Recarga en caja o usa otro método de pago.',
      to_char(v_acc.balance, 'FM999,990.00'), to_char(v_total, 'FM999,990.00')
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.card_accounts
  SET balance = balance - v_total, updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_acc;

  INSERT INTO public.card_transactions (user_id, kind, amount, comanda_id, created_by)
  VALUES (v_uid, 'spend', v_total, p_comanda_id, v_uid);

  UPDATE public.comandas SET pagada_at = now() WHERE id = p_comanda_id;

  RETURN jsonb_build_object('balance', v_acc.balance);
END;
$$;

-- pay_with_card takes comandas.id%TYPE, so revoke/grant by name.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'pay_with_card'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
