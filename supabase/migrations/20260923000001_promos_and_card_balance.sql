-- Game discounts and the Tarjeta CocinArte balance live in the database. The
-- client only mirrors what these RPCs return; localStorage is never the source
-- of truth for a discount or a balance.
--
-- Depends on 20260923000000_staff_roles_rls.sql (public.is_staff() and the
-- comandas_insert_own policy, which is recreated below).
--
-- Rules:
--   * One promo code per user per month (America/Mexico_City). Game wins top it
--     up to 10% until it is redeemed; after that, no more wins that month.
--   * The score is reported by the client, so it cannot be trusted: the server
--     maps it to a percentage and the 10%/month cap is the real limit.
--   * A code is redeemed against an existing comanda of its owner, never
--     against a bare client-supplied total.
--   * Customers can read their balance and spend it on their own comandas.
--     Only staff can recharge (cash received at the register).

-- 1) comandas: discount and card-payment columns -----------------------------

ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS descuento numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id uuid,
  ADD COLUMN IF NOT EXISTS pagada_at timestamptz;

-- A customer inserts orders as 'pendiente' with no discount and unpaid. Only
-- apply_promo() and pay_with_card() (SECURITY DEFINER) may set those columns.
DROP POLICY IF EXISTS "comandas_insert_own" ON public.comandas;
CREATE POLICY "comandas_insert_own"
  ON public.comandas FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND estado = 'pendiente'
    AND descuento = 0
    AND promo_code_id IS NULL
    AND pagada_at IS NULL
  );

-- 2) Tables ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE,
  month          date NOT NULL,  -- first day of the month, Mexico City time
  discount_type  text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'amount')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_purchase   numeric(10,2) NOT NULL DEFAULT 250,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month),
  CHECK (discount_type <> 'percent' OR discount_value <= 10)
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL UNIQUE REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_total    numeric(10,2) NOT NULL,
  discount      numeric(10,2) NOT NULL,
  final_total   numeric(10,2) NOT NULL,
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.card_accounts (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number text NOT NULL UNIQUE,
  balance     numeric(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.card_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.card_accounts(user_id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('recharge', 'spend')),
  amount     numeric(10,2) NOT NULL CHECK (amount > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_transactions_user_id_idx ON public.card_transactions(user_id);

-- comanda_id columns must match comandas.id, whose type is not versioned in
-- this repo, so it is read from the catalog.
DO $$
DECLARE
  v_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.comandas'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promo_redemptions' AND column_name = 'comanda_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.promo_redemptions ADD COLUMN comanda_id %s NOT NULL UNIQUE REFERENCES public.comandas(id) ON DELETE CASCADE',
      v_type
    );
  END IF;

  -- UNIQUE: a comanda can be paid with the card only once.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'card_transactions' AND column_name = 'comanda_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.card_transactions ADD COLUMN comanda_id %s UNIQUE REFERENCES public.comandas(id) ON DELETE SET NULL',
      v_type
    );
  END IF;
END $$;

ALTER TABLE public.comandas
  DROP CONSTRAINT IF EXISTS comandas_promo_code_id_fkey;
ALTER TABLE public.comandas
  ADD CONSTRAINT comandas_promo_code_id_fkey
  FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;

-- 3) RLS: read own rows (staff reads all); every write goes through an RPC ----

ALTER TABLE public.promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_transactions ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
  ON public.promo_codes, public.promo_redemptions, public.card_accounts, public.card_transactions
  FROM anon, authenticated;

DROP POLICY IF EXISTS "promo_codes_select_own_or_staff" ON public.promo_codes;
CREATE POLICY "promo_codes_select_own_or_staff"
  ON public.promo_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "promo_redemptions_select_own_or_staff" ON public.promo_redemptions;
CREATE POLICY "promo_redemptions_select_own_or_staff"
  ON public.promo_redemptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "card_accounts_select_own_or_staff" ON public.card_accounts;
CREATE POLICY "card_accounts_select_own_or_staff"
  ON public.card_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "card_transactions_select_own_or_staff" ON public.card_transactions;
CREATE POLICY "card_transactions_select_own_or_staff"
  ON public.card_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

-- 4) Internal helpers (not callable from the API) ------------------------------

CREATE OR REPLACE FUNCTION public.promo_month_start()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT date_trunc('month', now() AT TIME ZONE 'America/Mexico_City')::date;
$$;

-- Same thresholds as scoreToDiscount() in each game component.
CREATE OR REPLACE FUNCTION public.promo_pct_for_score(p_game_id text, p_score integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_game_id
    WHEN 'grano_volador' THEN
      CASE WHEN p_score >= 35 THEN 10 WHEN p_score >= 20 THEN 8 WHEN p_score >= 10 THEN 5 ELSE 2 END
    WHEN 'lluvia_espresso' THEN
      CASE WHEN p_score >= 300 THEN 10 WHEN p_score >= 150 THEN 8 WHEN p_score >= 50 THEN 5 ELSE 2 END
  END;
$$;

-- random() is enough: a code only works for the user who owns it.
CREATE OR REPLACE FUNCTION public.generate_promo_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT 'COCINA-' || string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 6);
$$;

CREATE OR REPLACE FUNCTION public.generate_card_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT 'COC ' || string_agg(lpad(floor(random() * 10000)::int::text, 4, '0'), '-')
  FROM generate_series(1, 3);
$$;

-- Creates the caller's card account on first use.
CREATE OR REPLACE FUNCTION public.ensure_card_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOOP
    BEGIN
      INSERT INTO public.card_accounts (user_id, card_number)
      VALUES (p_user_id, public.generate_card_number())
      ON CONFLICT (user_id) DO NOTHING;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- card_number collision: try another one
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.promo_month_start() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promo_pct_for_score(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_promo_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_card_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_card_account(uuid) FROM PUBLIC, anon, authenticated;

-- 5) Promo RPCs ----------------------------------------------------------------

-- Current month's state, for canPlay / accumulatedPct when a game mounts.
-- { code, total_pct, used, can_play, expires_at }
CREATE OR REPLACE FUNCTION public.get_my_promo()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.promo_codes;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para ver tus premios' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE user_id = v_uid AND month = public.promo_month_start();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', NULL, 'total_pct', 0, 'used', false, 'can_play', true, 'expires_at', NULL);
  END IF;

  RETURN jsonb_build_object(
    'code', CASE WHEN v_row.used_at IS NULL AND v_row.discount_value > 0 THEN v_row.code END,
    'total_pct', v_row.discount_value,
    'used', v_row.used_at IS NOT NULL,
    'can_play', v_row.used_at IS NULL AND v_row.discount_value < 10,
    'expires_at', v_row.expires_at
  );
END;
$$;

-- Records a game win. { code, won_pct, total_pct, expires_at }
-- won_pct = 0 when the monthly cap is reached or this month's code was used.
CREATE OR REPLACE FUNCTION public.claim_promo(p_game_id text, p_score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_month date := public.promo_month_start();
  v_pct   integer;
  v_row   public.promo_codes;
  v_total numeric(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para reclamar tu premio' USING ERRCODE = '42501';
  END IF;

  v_pct := public.promo_pct_for_score(p_game_id, GREATEST(COALESCE(p_score, 0), 0));
  IF v_pct IS NULL THEN
    RAISE EXCEPTION 'Juego desconocido: %', p_game_id USING ERRCODE = '22023';
  END IF;

  LOOP
    BEGIN
      INSERT INTO public.promo_codes (user_id, code, month, discount_type, discount_value, expires_at)
      VALUES (
        v_uid,
        public.generate_promo_code(),
        v_month,
        'percent',
        0,
        (v_month + interval '1 month')::timestamp AT TIME ZONE 'America/Mexico_City'
      )
      ON CONFLICT (user_id, month) DO NOTHING;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- code collision: try another one
    END;
  END LOOP;

  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE user_id = v_uid AND month = v_month
  FOR UPDATE;

  IF v_row.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('code', NULL, 'won_pct', 0, 'total_pct', v_row.discount_value, 'expires_at', v_row.expires_at);
  END IF;

  v_total := LEAST(10, v_row.discount_value + v_pct);
  UPDATE public.promo_codes SET discount_value = v_total WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'code', v_row.code,
    'won_pct', v_total - v_row.discount_value,
    'total_pct', v_total,
    'expires_at', v_row.expires_at
  );
END;
$$;

-- Read-only check for the checkout UI while the cart is still editable.
-- { valid, reason, percent, discount, final_total }. Redeems nothing.
CREATE OR REPLACE FUNCTION public.preview_promo(p_code text, p_cart_total numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row      public.promo_codes;
  v_discount numeric(10,2);
  v_reason   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para usar un código' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE code = upper(btrim(p_code)) AND user_id = auth.uid();

  v_reason := CASE
    WHEN NOT FOUND OR v_row.discount_value <= 0 THEN 'Código no válido'
    WHEN v_row.used_at IS NOT NULL THEN 'Este código ya se usó'
    WHEN v_row.expires_at <= now() THEN 'Este código expiró'
    WHEN COALESCE(p_cart_total, 0) < v_row.min_purchase THEN
      format('El descuento aplica en compras de $%s o más', v_row.min_purchase::int)
  END;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_reason, 'percent', 0, 'discount', 0, 'final_total', p_cart_total);
  END IF;

  v_discount := round(CASE v_row.discount_type
    WHEN 'percent' THEN p_cart_total * v_row.discount_value / 100
    ELSE LEAST(v_row.discount_value, p_cart_total)
  END, 2);

  RETURN jsonb_build_object(
    'valid', true,
    'reason', NULL,
    'percent', CASE WHEN v_row.discount_type = 'percent' THEN v_row.discount_value ELSE 0 END,
    'discount', v_discount,
    'final_total', p_cart_total - v_discount
  );
END;
$$;

-- Redeems the code on a comanda the caller just created. The discount is
-- computed from comandas.total, not from a client-supplied amount, and the
-- comanda, the code and the redemption row change in one transaction.
-- { percent, discount, final_total }
CREATE OR REPLACE FUNCTION public.apply_promo(p_code text, p_comanda_id public.comandas.id%TYPE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_promo    public.promo_codes;
  v_owner    uuid;
  v_estado   text;
  v_prev     uuid;
  v_paid     timestamptz;
  v_total    numeric(10,2);
  v_discount numeric(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para usar un código' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = upper(btrim(p_code))
  FOR UPDATE;

  IF NOT FOUND OR v_promo.user_id <> v_uid OR v_promo.discount_value <= 0 THEN
    RAISE EXCEPTION 'Código no válido';
  END IF;
  IF v_promo.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este código ya se usó';
  END IF;
  IF v_promo.expires_at <= now() THEN
    RAISE EXCEPTION 'Este código expiró';
  END IF;

  SELECT c.user_id, c.estado, c.promo_code_id, c.pagada_at, c.total::numeric
  INTO v_owner, v_estado, v_prev, v_paid, v_total
  FROM public.comandas AS c
  WHERE c.id = p_comanda_id
  FOR UPDATE;

  IF NOT FOUND OR v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF v_estado <> 'pendiente' OR v_prev IS NOT NULL OR v_paid IS NOT NULL THEN
    RAISE EXCEPTION 'Este pedido ya no admite descuentos';
  END IF;
  IF v_total < v_promo.min_purchase THEN
    RAISE EXCEPTION 'El descuento aplica en compras de $% o más', v_promo.min_purchase::int;
  END IF;

  v_discount := round(CASE v_promo.discount_type
    WHEN 'percent' THEN v_total * v_promo.discount_value / 100
    ELSE LEAST(v_promo.discount_value, v_total)
  END, 2);

  UPDATE public.comandas
  SET total = v_total - v_discount,
      descuento = v_discount,
      promo_code_id = v_promo.id
  WHERE id = p_comanda_id;

  UPDATE public.promo_codes SET used_at = now() WHERE id = v_promo.id;

  INSERT INTO public.promo_redemptions (promo_code_id, user_id, comanda_id, cart_total, discount, final_total)
  VALUES (v_promo.id, v_uid, p_comanda_id, v_total, v_discount, v_total - v_discount);

  RETURN jsonb_build_object(
    'percent', CASE WHEN v_promo.discount_type = 'percent' THEN v_promo.discount_value ELSE 0 END,
    'discount', v_discount,
    'final_total', v_total - v_discount
  );
END;
$$;

-- 6) Card RPCs -----------------------------------------------------------------

-- { card_number, balance }. Creates the account (balance 0) on first call.
CREATE OR REPLACE FUNCTION public.get_card_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_acc public.card_accounts;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para ver tu saldo' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_card_account(v_uid);
  SELECT * INTO v_acc FROM public.card_accounts WHERE user_id = v_uid;

  RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', v_acc.balance);
END;
$$;

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
    RAISE EXCEPTION 'Saldo insuficiente. Tu saldo es $%; el pedido es $%. Recarga o elige pagar en caja.',
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

-- Staff only: credits cash received at the register to a card, looked up by
-- the number the customer shows. Returns { card_number, balance }.
CREATE OR REPLACE FUNCTION public.staff_recharge_card(p_card_number text, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acc public.card_accounts;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Solo el staff puede recargar saldo' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
    RAISE EXCEPTION 'Monto de recarga no válido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.card_accounts
  SET balance = balance + round(p_amount, 2), updated_at = now()
  WHERE card_number = upper(btrim(p_card_number))
  RETURNING * INTO v_acc;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarjeta no encontrada';
  END IF;

  INSERT INTO public.card_transactions (user_id, kind, amount, created_by)
  VALUES (v_acc.user_id, 'recharge', round(p_amount, 2), auth.uid());

  RETURN jsonb_build_object('card_number', v_acc.card_number, 'balance', v_acc.balance);
END;
$$;

-- 7) Grants --------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_my_promo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_promo(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_promo(text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_card_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_recharge_card(text, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_promo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_promo(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_promo(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_card_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_recharge_card(text, numeric) TO authenticated;

-- apply_promo / pay_with_card take comandas.id%TYPE, so revoke/grant by name.
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN ('apply_promo', 'pay_with_card')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
