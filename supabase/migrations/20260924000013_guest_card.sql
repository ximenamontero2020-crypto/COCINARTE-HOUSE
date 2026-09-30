-- DEMO: Tarjeta CocinArte de INVITADO (academic prototype, Tecmilenio challenge).
--
-- Guests (role anon, no account) get a card tied to their browser, not to a user:
-- the frontend generates a random UUID ("card token") and keeps it in localStorage.
-- That token is a bearer secret: whoever has it can spend the balance. It is never
-- stored as is; guest_card_accounts is keyed by sha256(token), so reading the table
-- (staff, backups, logs) does not let anyone use a card.
--
-- Fully separate from card_accounts / demo_self_recharge / staff_recharge_card:
-- account balances are untouched. Every guest recharge is a SIMULATED payment
-- (same exception documented in CLAUDE.md for demo_self_recharge).
--
-- What changes for guest orders:
--   * create_guest_comanda keeps working exactly the same ('caja', ready-made items).
--   * pay_with_guest_card creates the order AND debits the guest card in one
--     transaction, so any item is allowed (also dishes that need preparation):
--     an order is never left created but unpaid.
--   * Both share private.insert_guest_comanda (validation, pricing, IP rate limit).
--
-- Abuse limits (same spirit as 20260924000011 / 20260924000012):
--   * Orders: 3 per IP and 40 overall every 15 min (unchanged).
--   * Recharges: $1-$1,000 each, max balance $20,000, 10 per IP / 15 min.
--   * p_request_id is unique per transaction: double clicks and retries apply once.
--
-- Depends on 20260924000011_guest_checkout.sql.

-- 1) Tables --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guest_card_accounts (
  token_hash  text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  card_number text NOT NULL UNIQUE,
  balance     numeric(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_card_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL REFERENCES public.guest_card_accounts(token_hash) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('recharge', 'spend')),
  amount     numeric(10,2) NOT NULL CHECK (amount > 0),
  request_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_card_transactions_token_idx
  ON public.guest_card_transactions (token_hash, created_at DESC);

-- comanda_id must match comandas.id, whose type is not versioned in this repo.
DO $$
DECLARE
  v_type text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guest_card_transactions' AND column_name = 'comanda_id'
  ) THEN
    SELECT format_type(a.atttypid, a.atttypmod) INTO v_type
    FROM pg_attribute AS a
    WHERE a.attrelid = 'public.comandas'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

    EXECUTE format(
      'ALTER TABLE public.guest_card_transactions ADD COLUMN comanda_id %s UNIQUE REFERENCES public.comandas(id) ON DELETE SET NULL',
      v_type
    );
  END IF;
END $$;

COMMENT ON TABLE public.guest_card_accounts IS
  'Tarjeta CocinArte de invitado (demo). Llave = sha256 del token que guarda el navegador; nunca el token. Separada de card_accounts.';
COMMENT ON TABLE public.guest_card_transactions IS
  'Movimientos de tarjetas de invitado. Las recargas son simuladas (modo demo): no es dinero real.';

-- RLS: nobody reads or writes through the API except via the RPCs below.
-- Staff may read (only hashes, useless to spend).
ALTER TABLE public.guest_card_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_card_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_card_accounts, public.guest_card_transactions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.guest_card_accounts, public.guest_card_transactions TO authenticated;

DROP POLICY IF EXISTS "guest_card_accounts_staff_select" ON public.guest_card_accounts;
CREATE POLICY "guest_card_accounts_staff_select"
  ON public.guest_card_accounts FOR SELECT
  TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "guest_card_transactions_staff_select" ON public.guest_card_transactions;
CREATE POLICY "guest_card_transactions_staff_select"
  ON public.guest_card_transactions FOR SELECT
  TO authenticated
  USING (public.is_staff());

-- 2) Rate limit log: tell orders and recharges apart ---------------------------

ALTER TABLE private.guest_order_log
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'order';

CREATE INDEX IF NOT EXISTS guest_order_log_action_key_created_idx
  ON private.guest_order_log (action, client_key, created_at);

-- 3) Private helpers (not callable through the API) -----------------------------

-- md5 of the caller IP (first X-Forwarded-For entry). Without it every guest
-- shares one bucket (stricter, not looser).
CREATE OR REPLACE FUNCTION private.guest_client_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_ip      text;
BEGIN
  v_ip := btrim(split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1));
  RETURN md5(coalesce(nullif(v_ip, ''), 'sin-ip'));
END;
$$;

CREATE OR REPLACE FUNCTION private.guest_card_hash(p_card_token uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(p_card_token::text, 'UTF8')), 'hex');
$$;

-- Validates, prices and inserts a guest order; applies the order rate limit.
-- p_metodo: 'caja' (only ready-made items, unpaid) or 'cafeteria' (paid with the
-- guest card by the caller in the same transaction, any item).
-- Item validation and pricing mirror create_comanda
-- (20260924000009_payment_methods_cash_rule.sql); keep both in sync.
CREATE OR REPLACE FUNCTION private.insert_guest_comanda(
  p_items jsonb, p_nombre text, p_email text, p_metodo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_window     constant interval := interval '15 minutes';
  c_per_client constant integer  := 3;
  c_global     constant integer  := 40;

  v_nombre    text := btrim(coalesce(p_nombre, ''));
  v_email     text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_key       text := private.guest_client_key();
  v_lines     integer;
  v_found     integer;
  v_productos jsonb;
  v_total     numeric(10,2);
  v_numero    text;
  v_id        public.comandas.id%TYPE;
BEGIN
  IF p_metodo IS NULL OR p_metodo NOT IN ('caja', 'cafeteria') THEN
    RAISE EXCEPTION 'Método de pago no válido' USING ERRCODE = '22023';
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

  -- Cash on pickup: only ready-made items. With the guest card the order is paid
  -- up front, so dishes that need preparation are allowed.
  IF p_metodo = 'caja' AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS e
    LEFT JOIN public.menu_items AS mi ON mi.id = (e->>'menu_item_id')::bigint
    WHERE mi.pago_en_caja_permitido IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Sin cuenta, en caja solo puedes pedir productos listos. Para platillos que se preparan, paga con tu tarjeta de invitado o inicia sesión.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize guest writes so two concurrent calls cannot both pass the count.
  PERFORM pg_advisory_xact_lock(hashtext('create_guest_comanda'));

  DELETE FROM private.guest_order_log WHERE created_at < now() - interval '1 day';

  IF (SELECT count(*) FROM private.guest_order_log
      WHERE action = 'order' AND client_key = v_key AND created_at > now() - c_window) >= c_per_client THEN
    RAISE EXCEPTION 'Hiciste varios pedidos seguidos. Espera unos minutos o inicia sesión para seguir pidiendo.'
      USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT count(*) FROM private.guest_order_log
      WHERE action = 'order' AND created_at > now() - c_window) >= c_global THEN
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
  VALUES (v_nombre, v_email, v_productos, v_total, 'pendiente', v_numero, p_metodo, NULL)
  RETURNING id INTO v_id;

  INSERT INTO private.guest_order_log (client_key, action) VALUES (v_key, 'order');

  RETURN jsonb_build_object('id', v_id, 'numero_pedido', v_numero, 'total', v_total, 'productos', v_productos);
END;
$$;

REVOKE ALL ON FUNCTION private.guest_client_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guest_card_hash(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.insert_guest_comanda(jsonb, text, text, text) FROM PUBLIC, anon, authenticated;

-- 4) create_guest_comanda: same contract, now on top of the shared helper -------

CREATE OR REPLACE FUNCTION public.create_guest_comanda(p_items jsonb, p_nombre text, p_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order jsonb;
BEGIN
  -- Signed-in customers use create_comanda so the order counts toward their account.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ya iniciaste sesión: confirma el pedido con tu cuenta.' USING ERRCODE = '22023';
  END IF;

  v_order := private.insert_guest_comanda(p_items, p_nombre, p_email, 'caja');
  RETURN v_order || jsonb_build_object('saldo', NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_comanda(jsonb, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_comanda(jsonb, text, text) TO anon;

-- 5) get_guest_card ---------------------------------------------------------------

-- Returns { card_number, balance }; card_number is null until the first recharge.
CREATE OR REPLACE FUNCTION public.get_guest_card(p_card_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acc public.guest_card_accounts;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ya iniciaste sesión: usa la tarjeta de tu cuenta.' USING ERRCODE = '22023';
  END IF;
  IF p_card_token IS NULL THEN
    RAISE EXCEPTION 'Tarjeta de invitado no válida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_acc FROM public.guest_card_accounts WHERE token_hash = private.guest_card_hash(p_card_token);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('card_number', NULL, 'balance', 0);
  END IF;
  RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', v_acc.balance);
END;
$$;

-- 6) guest_card_recharge (SIMULATED payment) ---------------------------------------

-- Returns { card_number, balance, amount, duplicate }.
CREATE OR REPLACE FUNCTION public.guest_card_recharge(p_card_token uuid, p_amount numeric, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_amount  constant numeric  := 1000;
  c_max_balance constant numeric  := 20000;
  c_window      constant interval := interval '15 minutes';
  c_per_client  constant integer  := 10;

  v_hash   text;
  v_key    text := private.guest_client_key();
  v_amount numeric(10,2);
  v_acc    public.guest_card_accounts;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ya iniciaste sesión: recarga la tarjeta de tu cuenta.' USING ERRCODE = '22023';
  END IF;
  IF p_card_token IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Solicitud de recarga no válida' USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NULL OR p_amount <> round(p_amount, 2) OR p_amount < 1 OR p_amount > c_max_amount THEN
    RAISE EXCEPTION 'El monto debe ser de $1 a $% (máximo dos decimales).', to_char(c_max_amount, 'FM999,990')
      USING ERRCODE = '22023';
  END IF;
  v_amount := p_amount;
  v_hash := private.guest_card_hash(p_card_token);

  -- Same request already applied (double click / retry): report, change nothing.
  IF EXISTS (SELECT 1 FROM public.guest_card_transactions WHERE request_id = p_request_id) THEN
    SELECT * INTO v_acc FROM public.guest_card_accounts WHERE token_hash = v_hash;
    RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', coalesce(v_acc.balance, 0), 'amount', 0, 'duplicate', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('create_guest_comanda'));
  IF (SELECT count(*) FROM private.guest_order_log
      WHERE action = 'recharge' AND client_key = v_key AND created_at > now() - c_window) >= c_per_client THEN
    RAISE EXCEPTION 'Hiciste varias recargas seguidas. Espera unos minutos.' USING ERRCODE = 'P0001';
  END IF;

  -- Create the card on first use (card_number collision: try another one).
  LOOP
    BEGIN
      INSERT INTO public.guest_card_accounts (token_hash, card_number)
      VALUES (v_hash, 'INV ' || lpad(floor(random() * 10000)::int::text, 4, '0') || '-'
                             || lpad(floor(random() * 10000)::int::text, 4, '0'))
      ON CONFLICT (token_hash) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- card_number taken
    END;
  END LOOP;

  SELECT * INTO v_acc FROM public.guest_card_accounts WHERE token_hash = v_hash FOR UPDATE;

  -- Re-check under the lock: a concurrent call with the same request may have just committed.
  IF EXISTS (SELECT 1 FROM public.guest_card_transactions WHERE request_id = p_request_id) THEN
    RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', v_acc.balance, 'amount', 0, 'duplicate', true);
  END IF;

  IF v_acc.balance + v_amount > c_max_balance THEN
    RAISE EXCEPTION 'Tu saldo demo no puede pasar de $%. Usa tu saldo antes de recargar más.', to_char(c_max_balance, 'FM999,990')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.guest_card_transactions (token_hash, kind, amount, request_id)
  VALUES (v_hash, 'recharge', v_amount, p_request_id);

  UPDATE public.guest_card_accounts
  SET balance = balance + v_amount, updated_at = now()
  WHERE token_hash = v_hash
  RETURNING * INTO v_acc;

  INSERT INTO private.guest_order_log (client_key, action) VALUES (v_key, 'recharge');

  RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', v_acc.balance, 'amount', v_amount, 'duplicate', false);
END;
$$;

-- 7) pay_with_guest_card: order + debit in one transaction --------------------------

-- Returns { id, numero_pedido, total, productos, saldo, duplicate }.
CREATE OR REPLACE FUNCTION public.pay_with_guest_card(
  p_card_token uuid, p_items jsonb, p_nombre text, p_email text DEFAULT NULL, p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash  text;
  v_acc   public.guest_card_accounts;
  v_prev  public.guest_card_transactions;
  v_order jsonb;
  v_total numeric(10,2);
  v_id    public.comandas.id%TYPE;
  v_row   record;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Ya iniciaste sesión: paga con la tarjeta de tu cuenta.' USING ERRCODE = '22023';
  END IF;
  IF p_card_token IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Solicitud de pago no válida' USING ERRCODE = '22023';
  END IF;
  v_hash := private.guest_card_hash(p_card_token);

  -- Lock the card first: concurrent payments (or a double click) run one after another.
  SELECT * INTO v_acc FROM public.guest_card_accounts WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tu tarjeta de invitado no tiene saldo. Recárgala primero.' USING ERRCODE = 'P0001';
  END IF;

  -- Same request already paid: return that order, charge nothing.
  SELECT * INTO v_prev FROM public.guest_card_transactions WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_prev.token_hash <> v_hash OR v_prev.kind <> 'spend' THEN
      RAISE EXCEPTION 'Solicitud de pago no válida' USING ERRCODE = '22023';
    END IF;
    SELECT c.id, c.numero_pedido, c.total, c.productos INTO v_row FROM public.comandas AS c WHERE c.id = v_prev.comanda_id;
    RETURN jsonb_build_object('id', v_row.id, 'numero_pedido', v_row.numero_pedido, 'total', v_row.total,
                              'productos', v_row.productos, 'saldo', v_acc.balance, 'duplicate', true);
  END IF;

  -- Validates, prices, applies the order rate limit and inserts (raises on any problem).
  v_order := private.insert_guest_comanda(p_items, p_nombre, p_email, 'cafeteria');
  v_total := (v_order->>'total')::numeric;

  IF v_acc.balance < v_total THEN
    -- Raising rolls back the order insert too.
    RAISE EXCEPTION 'Saldo insuficiente. Tu saldo es $%; el pedido es $%. Recarga tu tarjeta de invitado o paga en caja.',
      to_char(v_acc.balance, 'FM999,990.00'), to_char(v_total, 'FM999,990.00')
      USING ERRCODE = 'P0001';
  END IF;

  v_id := v_order->>'id';  -- assignment converts to comandas.id's type, whatever it is

  UPDATE public.guest_card_accounts
  SET balance = balance - v_total, updated_at = now()
  WHERE token_hash = v_hash
  RETURNING * INTO v_acc;

  INSERT INTO public.guest_card_transactions (token_hash, kind, amount, request_id, comanda_id)
  VALUES (v_hash, 'spend', v_total, p_request_id, v_id);

  UPDATE public.comandas SET pagada_at = now() WHERE id = v_id;

  RETURN v_order || jsonb_build_object('saldo', v_acc.balance, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_guest_card(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.guest_card_recharge(uuid, numeric, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.pay_with_guest_card(uuid, jsonb, text, text, uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_card(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.guest_card_recharge(uuid, numeric, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.pay_with_guest_card(uuid, jsonb, text, text, uuid) TO anon;

NOTIFY pgrst, 'reload schema';
