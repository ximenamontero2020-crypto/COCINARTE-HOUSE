-- Pruebas manuales de promos y saldo. Ejecutar en el SQL Editor de Supabase.
-- Cada bloque simula un usuario y hace ROLLBACK, así que no deja cambios.
-- Sustituye los UUID por un customer real, otro customer y un staff:
--   SELECT id, email, role FROM public.profiles ORDER BY role;

-- 1) CUSTOMER: gana, acumula hasta 10% y aplica el código a su propia comanda.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_my_promo();                              -- esperado: total_pct 0, can_play true
SELECT public.claim_promo('grano_volador', 12);            -- esperado: won_pct 5, total_pct 5
SELECT public.claim_promo('lluvia_espresso', 9999);        -- esperado: won_pct 5, total_pct 10 (tope)
SELECT public.claim_promo('grano_volador', 50);            -- esperado: won_pct 0, total_pct 10
SELECT public.preview_promo((public.get_my_promo()->>'code'), 100);  -- esperado: valid false (mínimo $250)
SELECT public.preview_promo((public.get_my_promo()->>'code'), 300);  -- esperado: discount 30, final_total 270
-- 20 unidades del platillo más barato: total >= $250.
CREATE TEMP TABLE t_comanda ON COMMIT DROP AS
SELECT public.create_comanda(
  jsonb_build_array(jsonb_build_object(
    'menu_item_id', (SELECT id FROM public.menu_items ORDER BY substring(price FROM '[0-9]+')::int LIMIT 1),
    'cantidad', 20)),
  'caja'
) AS r;
SELECT public.apply_promo(
  (SELECT code FROM public.promo_codes WHERE user_id = auth.uid()),
  (SELECT (r->>'id')::bigint FROM t_comanda)
);                                                         -- esperado: discount = 10% del total
SELECT total, descuento FROM public.comandas WHERE id = (SELECT (r->>'id')::bigint FROM t_comanda);
SELECT public.get_my_promo();                              -- esperado: used true, can_play false
ROLLBACK;

-- 2) CUSTOMER: DENY al escribir códigos directo y al usar uno ajeno.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
INSERT INTO public.promo_codes (user_id, code, month, discount_value, expires_at)
VALUES (auth.uid(), 'COCINA-HACK00', current_date, 10, now() + interval '1 day');
-- esperado: ERROR 42501 permission denied for table promo_codes
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<OTHER_CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.claim_promo('grano_volador', 40);
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.preview_promo(
  (SELECT code FROM public.promo_codes WHERE user_id = '<OTHER_CUSTOMER_UUID>'), 300
);                                                         -- esperado: valid false, "Código no válido"
ROLLBACK;

-- 3) Saldo: el customer no puede recargarse; staff recarga; el customer paga una comanda.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_card_balance();                          -- esperado: balance 0 (o el actual)
UPDATE public.card_accounts SET balance = 9999 WHERE user_id = auth.uid();
-- esperado: ERROR 42501 permission denied for table card_accounts
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.staff_recharge_card((public.get_card_balance()->>'card_number'), 500);
-- esperado: ERROR 42501 "Solo el staff puede recargar saldo"
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_card_balance();                          -- crea la cuenta si no existe
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT public.staff_recharge_card(
  (SELECT card_number FROM public.card_accounts WHERE user_id = '<CUSTOMER_UUID>'), 200
);                                                         -- esperado: balance +200
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
CREATE TEMP TABLE t_pago ON COMMIT DROP AS
SELECT public.create_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'cafeteria'
) AS r;
SELECT r->>'total' AS total, r->>'saldo' AS saldo FROM t_pago;  -- esperado: saldo = anterior + 200 - total
SELECT public.pay_with_card((SELECT (r->>'id')::bigint FROM t_pago));
-- esperado: ERROR "Este pedido ya fue pagado o no está pendiente"
ROLLBACK;
