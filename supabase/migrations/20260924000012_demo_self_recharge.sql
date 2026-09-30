-- DEMO EXCEPTION (academic prototype, Tecmilenio challenge): self-service
-- recharge of the Tarjeta CocinArte with a SIMULATED payment.
--
-- The project rule is "never simulate payments". This is the one documented
-- exception (see CLAUDE.md): evaluators scan the project and must be able to
-- add balance themselves to try the flow "recharge -> pay an order with the
-- card". No card data reaches the server; the frontend mock gateway
-- (src/lib/payments/mockGateway.ts) only simulates the charge, and this RPC
-- credits the real balance in card_accounts.
--
-- Guards (not anti-fraud, just against obvious bugs):
--   * p_request_id is unique in card_transactions: a double click or a retry
--     with the same id credits once and returns the current balance.
--   * Max per recharge and max resulting balance.
-- Every demo recharge is marked card_transactions.demo = true, so reports and
-- cash counts can exclude it (staff_recharge_card rows keep demo = false).
--
-- To turn the exception off: REVOKE EXECUTE ON FUNCTION
-- public.demo_self_recharge(numeric, uuid) FROM authenticated; and hide the button.

-- 1) card_transactions: demo flag + idempotency key ---------------------------

ALTER TABLE public.card_transactions
  ADD COLUMN IF NOT EXISTS demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS card_transactions_request_id_key
  ON public.card_transactions (request_id);

COMMENT ON COLUMN public.card_transactions.demo IS
  'true = recarga simulada de autoservicio (demo_self_recharge, prototipo académico). No es dinero real: exclúyela de cortes y reportes.';
COMMENT ON COLUMN public.card_transactions.request_id IS
  'Llave de idempotencia de demo_self_recharge: la misma solicitud nunca abona dos veces.';

-- 2) demo_self_recharge ---------------------------------------------------------

-- Returns { balance, card_number, amount, duplicate }.
CREATE OR REPLACE FUNCTION public.demo_self_recharge(p_amount numeric, p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_amount  constant numeric := 1000;
  c_max_balance constant numeric := 20000;

  v_uid    uuid := auth.uid();
  v_amount numeric(10,2);
  v_acc    public.card_accounts;
  v_tx_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para recargar tu tarjeta' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Solicitud de recarga no válida' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <> round(p_amount, 2) OR p_amount < 1 OR p_amount > c_max_amount THEN
    RAISE EXCEPTION 'El monto debe ser de $1 a $% (máximo dos decimales).', to_char(c_max_amount, 'FM999,990')
      USING ERRCODE = '22023';
  END IF;
  v_amount := p_amount;

  PERFORM public.ensure_card_account(v_uid);
  -- Lock the account so concurrent recharges apply one after another.
  SELECT * INTO v_acc FROM public.card_accounts WHERE user_id = v_uid FOR UPDATE;

  -- Idempotency: a repeated request_id inserts nothing and changes nothing.
  INSERT INTO public.card_transactions (user_id, kind, amount, created_by, demo, request_id)
  SELECT v_uid, 'recharge', v_amount, v_uid, true, p_request_id
  WHERE v_acc.balance + v_amount <= c_max_balance
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.card_transactions WHERE request_id = p_request_id) THEN
      -- Already applied (double click / retry): report the current balance.
      RETURN jsonb_build_object('balance', v_acc.balance, 'card_number', v_acc.card_number, 'amount', 0, 'duplicate', true);
    END IF;
    RAISE EXCEPTION 'Tu saldo demo no puede pasar de $%. Usa tu saldo antes de recargar más.', to_char(c_max_balance, 'FM999,990')
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.card_accounts
  SET balance = balance + v_amount, updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_acc;

  RETURN jsonb_build_object('balance', v_acc.balance, 'card_number', v_acc.card_number, 'amount', v_amount, 'duplicate', false);
END;
$$;

REVOKE ALL ON FUNCTION public.demo_self_recharge(numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_self_recharge(numeric, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
