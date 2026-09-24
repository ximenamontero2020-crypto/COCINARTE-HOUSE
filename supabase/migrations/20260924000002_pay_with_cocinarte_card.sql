-- Single entry point for paying with the Tarjeta CocinArte. Everything happens
-- in one transaction inside create_comanda():
--   1. prices and total are computed from menu_items (never from the client),
--   2. the comanda is inserted,
--   3. pay_with_card() locks card_accounts (FOR UPDATE), reads the real balance
--      and raises 'Saldo insuficiente…' if balance < total, which rolls back the
--      insert. Otherwise it debits and records the card_transactions row.
--
-- There is no card_id parameter on purpose: each user has exactly one card
-- (card_accounts.user_id is the PK), so the card is always auth.uid()'s. Taking
-- a card_id from the client would only add a way to target someone else's card.
--
-- Cases: balance 0 -> error, no order; balance = total -> ok, balance ends at 0
-- (CHECK balance >= 0 holds); balance > total -> ok, balance - total.
-- Returns the same shape as create_comanda: { id, numero_pedido, total, productos, saldo }.

CREATE OR REPLACE FUNCTION public.pay_with_cocinarte_card(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.create_comanda(p_items, 'cafeteria');
$$;

REVOKE ALL ON FUNCTION public.pay_with_cocinarte_card(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_with_cocinarte_card(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
