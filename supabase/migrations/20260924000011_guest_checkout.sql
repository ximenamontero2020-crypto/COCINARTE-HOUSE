-- Guest checkout: place an order without an account.
--
-- Guests can only pay 'caja' (cash on pickup), so the same rule applies: every
-- item must have menu_items.pago_en_caja_permitido. 'cafeteria' needs an account
-- (card balance) and 'pasarela' is a frontend demo that never creates orders.
--
-- Guest orders are stored with user_id = NULL, the name in comandas.cliente and
-- an optional email in comandas.cliente_email (used only by send-order-ready-email).
-- They do not count toward memberships, card balance or order history, which all
-- key on user_id.
--
-- anon never gets INSERT/SELECT on comandas: the only way in is this RPC, and the
-- guest reads back only what it returns. RLS on comandas is unchanged.

-- 1) comandas: guest contact ---------------------------------------------------

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS cliente text,
  ADD COLUMN IF NOT EXISTS cliente_email text;

COMMENT ON COLUMN public.comandas.cliente IS
  'Nombre para recoger el pedido. Solo pedidos de invitado (user_id NULL); con cuenta se usa profiles.';
COMMENT ON COLUMN public.comandas.cliente_email IS
  'Correo opcional de un invitado para avisarle que su pedido está listo. NULL en pedidos con cuenta.';

-- 2) Rate limit log (not exposed through the API) ------------------------------

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.guest_order_log (
  id         bigserial PRIMARY KEY,
  client_key text NOT NULL,          -- md5 of the caller IP, never the raw IP
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_order_log_key_created_idx
  ON private.guest_order_log (client_key, created_at);
CREATE INDEX IF NOT EXISTS guest_order_log_created_idx
  ON private.guest_order_log (created_at);

ALTER TABLE private.guest_order_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.guest_order_log FROM PUBLIC, anon, authenticated;

-- 3) create_guest_comanda -------------------------------------------------------

-- Item validation and pricing mirror create_comanda
-- (20260924000009_payment_methods_cash_rule.sql); keep both in sync.
-- p_items: [{ "menu_item_id": 12, "cantidad": 2 }, ...]. Repeated ids are merged.
-- Returns { id, numero_pedido, total, productos, saldo: null }.
CREATE OR REPLACE FUNCTION public.create_guest_comanda(p_items jsonb, p_nombre text, p_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- Limits: per caller IP and for all guests together, in a sliding window.
  c_window     constant interval := interval '15 minutes';
  c_per_client constant integer  := 3;
  c_global     constant integer  := 40;

  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_email     text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_headers   jsonb;
  v_ip        text;
  v_key       text;
  v_lines     integer;
  v_found     integer;
  v_productos jsonb;
  v_total     numeric(10,2);
  v_numero    text;
  v_id        public.comandas.id%TYPE;
BEGIN
  -- Signed-in customers use create_comanda so the order counts toward their account.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ya iniciaste sesión: confirma el pedido con tu cuenta.' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_nombre) < 2 OR char_length(v_nombre) > 60 THEN
    RAISE EXCEPTION 'Escribe tu nombre (2 a 60 caracteres) para recoger el pedido.' USING ERRCODE = '22023';
  END IF;

  IF v_email IS NOT NULL
     AND (char_length(v_email) > 254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'El correo no es válido. Corrígelo o déjalo vacío.' USING ERRCODE = '22023';
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

  -- Guests only pay cash on pickup, so every item must be ready-made.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e
    LEFT JOIN public.menu_items AS mi ON mi.id = (e->>'menu_item_id')::bigint
    WHERE mi.pago_en_caja_permitido IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Sin cuenta solo puedes pedir productos listos para pagar en caja. Inicia sesión para pedir platillos que se preparan.'
      USING ERRCODE = '22023';
  END IF;

  -- Rate limit. PostgREST exposes the request headers; the first X-Forwarded-For
  -- entry is the client. Without it every guest shares one bucket (stricter, not looser).
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  v_ip := btrim(split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1));
  v_key := md5(coalesce(nullif(v_ip, ''), 'sin-ip'));

  -- Serialize guest orders so two concurrent calls cannot both pass the count.
  PERFORM pg_advisory_xact_lock(hashtext('create_guest_comanda'));

  DELETE FROM private.guest_order_log WHERE created_at < now() - interval '1 day';

  IF (SELECT count(*) FROM private.guest_order_log
      WHERE client_key = v_key AND created_at > now() - c_window) >= c_per_client THEN
    RAISE EXCEPTION 'Hiciste varios pedidos seguidos. Espera unos minutos o inicia sesión para seguir pidiendo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT count(*) FROM private.guest_order_log
      WHERE created_at > now() - c_window) >= c_global THEN
    RAISE EXCEPTION 'Hay muchos pedidos sin cuenta en este momento. Inténtalo en unos minutos o inicia sesión.'
      USING ERRCODE = 'P0001';
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

  -- comandas_reject_when_closed (BEFORE INSERT) still rejects if the cafeteria is closed.
  INSERT INTO public.comandas (cliente, cliente_email, productos, total, estado, numero_pedido, metodo_pago, user_id)
  VALUES (v_nombre, v_email, v_productos, v_total, 'pendiente', v_numero, 'caja', NULL)
  RETURNING id INTO v_id;

  INSERT INTO private.guest_order_log (client_key) VALUES (v_key);

  RETURN jsonb_build_object(
    'id', v_id,
    'numero_pedido', v_numero,
    'total', v_total,
    'productos', v_productos,
    'saldo', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_comanda(jsonb, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_comanda(jsonb, text, text) TO anon;

NOTIFY pgrst, 'reload schema';
