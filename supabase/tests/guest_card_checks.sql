-- Pruebas manuales de la tarjeta CocinArte de INVITADO (get_guest_card, guest_card_recharge,
-- pay_with_guest_card). Ejecutar en el SQL Editor de Supabase después de aplicar
-- 20260924000013_guest_card.sql.
-- Cada bloque simula al rol anon (o a un cliente) y hace ROLLBACK, así que no deja cambios.
-- Los tokens y request_id son UUID fijos de prueba; no hace falta sustituir nada salvo <CUSTOMER_UUID>:
--   SELECT id, email, role FROM public.profiles ORDER BY role;

-- 1) ANON: OK. La primera recarga crea la tarjeta (INV ####-####) y abona el monto.
--    En la BD solo queda el sha256 del token, nunca el token.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.21"}', true);
SELECT public.get_guest_card('11111111-2222-4333-8444-555555555555');
-- esperado: { card_number: null, balance: 0 }   (leer no crea la tarjeta)
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 200, 'aaaaaaaa-0000-4000-8000-000000000001');
-- esperado: { card_number: 'INV ####-####', balance: 200, amount: 200, duplicate: false }
RESET ROLE;
SELECT token_hash = encode(sha256(convert_to('11111111-2222-4333-8444-555555555555', 'UTF8')), 'hex') AS es_hash,
       position('11111111-2222-4333-8444-555555555555' IN token_hash) = 0 AS sin_token_en_claro,
       balance
FROM public.guest_card_accounts
WHERE token_hash = encode(sha256(convert_to('11111111-2222-4333-8444-555555555555', 'UTF8')), 'hex');
-- esperado: es_hash = true | sin_token_en_claro = true | balance = 200.00
ROLLBACK;

-- 2) ANON: OK. Doble clic en recargar: el mismo request_id abona una sola vez.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 100, 'aaaaaaaa-0000-4000-8000-000000000002');
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 100, 'aaaaaaaa-0000-4000-8000-000000000002');
-- esperado: la segunda devuelve duplicate: true y balance: 100 (no 200)
ROLLBACK;

-- 3) ANON: OK. Pagar un platillo que SE PREPARA con la tarjeta de invitado.
--    Pedido y cobro en una sola transacción; comanda con user_id NULL, 'cafeteria' y pagada.
BEGIN;
UPDATE public.menu_items SET pago_en_caja_permitido = false
WHERE id = (SELECT id FROM public.menu_items ORDER BY id LIMIT 1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.22"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 1000, 'aaaaaaaa-0000-4000-8000-000000000003');
SELECT public.pay_with_guest_card(
  '11111111-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Eva Invitada',
  NULL,
  'bbbbbbbb-0000-4000-8000-000000000001'
);
-- esperado: { numero_pedido 'COC-######', total = precio, saldo = 1000 - precio, duplicate: false }
RESET ROLE;
SELECT cliente, user_id, metodo_pago, estado, pagada_at IS NOT NULL AS pagada
FROM public.comandas ORDER BY id DESC LIMIT 1;
-- esperado: 'Eva Invitada' | NULL | 'cafeteria' | 'pendiente' | true
SELECT kind, amount, comanda_id IS NOT NULL AS ligado_a_pedido
FROM public.guest_card_transactions
WHERE request_id = 'bbbbbbbb-0000-4000-8000-000000000001';
-- esperado: 'spend' | precio | true
ROLLBACK;

-- 4) ANON: OK. Doble clic en pagar: el mismo request_id devuelve el mismo pedido y no cobra de nuevo.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.23"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 1000, 'aaaaaaaa-0000-4000-8000-000000000004');
SELECT public.pay_with_guest_card('11111111-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Eva Invitada', NULL, 'bbbbbbbb-0000-4000-8000-000000000002');
SELECT public.pay_with_guest_card('11111111-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Eva Invitada', NULL, 'bbbbbbbb-0000-4000-8000-000000000002');
-- esperado: la segunda devuelve el MISMO numero_pedido, duplicate: true y el mismo saldo
ROLLBACK;

-- 5) ANON: DENY. Saldo insuficiente: error y no se crea el pedido (todo se deshace).
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.24"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 1, 'aaaaaaaa-0000-4000-8000-000000000005');
SELECT public.pay_with_guest_card('11111111-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 50)),
  'Eva Invitada', NULL, 'bbbbbbbb-0000-4000-8000-000000000003');
-- esperado: ERROR "Saldo insuficiente. Tu saldo es $1.00; el pedido es $...."
ROLLBACK;

-- 6) ANON: DENY. Un request_id de otra tarjeta no revela ese pedido ni cobra.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.25"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 500, 'aaaaaaaa-0000-4000-8000-000000000006');
SELECT public.guest_card_recharge('99999999-2222-4333-8444-555555555555', 500, 'aaaaaaaa-0000-4000-8000-000000000007');
SELECT public.pay_with_guest_card('11111111-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Eva Invitada', NULL, 'bbbbbbbb-0000-4000-8000-000000000004');
SELECT public.pay_with_guest_card('99999999-2222-4333-8444-555555555555',
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Otra persona', NULL, 'bbbbbbbb-0000-4000-8000-000000000004');
-- esperado: ERROR "Solicitud de pago no válida"
ROLLBACK;

-- 7) ANON: DENY. Montos fuera de rango.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 1001, 'aaaaaaaa-0000-4000-8000-000000000008');
-- esperado: ERROR "El monto debe ser de $1 a $1,000 (máximo dos decimales)."
ROLLBACK;

-- 8) ANON: DENY. Sin acceso directo a las tablas ni a la función interna.
BEGIN;
SET LOCAL ROLE anon;
SELECT * FROM public.guest_card_accounts LIMIT 1;
-- esperado: ERROR 42501 permission denied for table guest_card_accounts
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
UPDATE public.guest_card_accounts SET balance = 99999;
-- esperado: ERROR 42501 permission denied for table guest_card_accounts
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
SELECT private.insert_guest_comanda('[]'::jsonb, 'x', NULL, 'cafeteria');
-- esperado: ERROR 42501 permission denied for schema private
ROLLBACK;

-- 9) CUSTOMER: DENY. Con sesión se usa la tarjeta de la cuenta, no la de invitado.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.guest_card_recharge('11111111-2222-4333-8444-555555555555', 100, 'aaaaaaaa-0000-4000-8000-000000000009');
-- esperado: ERROR 42501 permission denied for function guest_card_recharge
ROLLBACK;

-- 10) ANON: el pago en caja sigue igual: rechaza platillos que se preparan.
BEGIN;
UPDATE public.menu_items SET pago_en_caja_permitido = false
WHERE id = (SELECT id FROM public.menu_items ORDER BY id LIMIT 1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.create_guest_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)),
  'Ana'
);
-- esperado: ERROR "Sin cuenta, en caja solo puedes pedir productos listos. ..."
ROLLBACK;
