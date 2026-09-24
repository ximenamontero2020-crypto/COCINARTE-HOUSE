-- Pruebas manuales de create_comanda y del cambio de estado. Ejecutar en el SQL Editor de Supabase.
-- Cada bloque simula un usuario y hace ROLLBACK, así que no deja cambios.
-- Sustituye <CUSTOMER_UUID> y <STAFF_UUID>:
--   SELECT id, email, role FROM public.profiles ORDER BY role;

-- 1) CUSTOMER: OK. El total y los precios salen de menu_items; ids repetidos se suman.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.create_comanda(
  jsonb_build_array(
    jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 2, 'precio', 1),
    jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)
  ),
  'caja'
);
-- esperado: productos con cantidad 3 y el precio real del menú (se ignora 'precio': 1),
--           total = 3 * precio, numero_pedido 'COC-######'
ROLLBACK;

-- 2) CUSTOMER: DENY. Insert directo, ids inexistentes, cantidades raras, método inválido.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
INSERT INTO public.comandas (productos, total, estado, numero_pedido, metodo_pago, user_id)
VALUES ('[]'::jsonb, 1, 'pendiente', 'COC-HACK01', 'caja', auth.uid());
-- esperado: ERROR 42501 permission denied for table comandas
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.create_comanda('[{"menu_item_id": 999999999, "cantidad": 1}]', 'caja');
-- esperado: ERROR "Algún platillo ya no está disponible. Actualiza tu carrito."
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.create_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items LIMIT 1), 'cantidad', -3)),
  'caja'
);
-- esperado: ERROR "Algún platillo del pedido no es válido" (igual con 0, 51 o 1.5)
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.create_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items LIMIT 1), 'cantidad', 1)),
  'tarjeta'
);
-- esperado: ERROR "Método de pago no válido"
ROLLBACK;

-- 3) CUSTOMER: 'cafeteria' sin saldo suficiente no deja comanda creada.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT count(*) AS antes FROM public.comandas WHERE user_id = auth.uid();
SELECT public.create_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items LIMIT 1), 'cantidad', 50)),
  'cafeteria'
);
-- esperado: ERROR "Saldo insuficiente. Tu saldo es $…; el pedido es $…. Recarga o elige pagar en caja."
ROLLBACK;

-- 3b) pay_with_cocinarte_card: saldo 0, exacto y de más. El STAFF deja el saldo exacto
--     con una recarga (el customer no puede escribir en card_accounts).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_card_balance();                          -- crea la cuenta si no existe
CREATE TEMP TABLE t_item ON COMMIT DROP AS
SELECT id, substring(price FROM '[0-9]+(?:\.[0-9]+)?')::numeric AS precio
FROM public.menu_items ORDER BY id LIMIT 1;
-- Saldo 0 (asumiendo cuenta nueva): falla y no crea comanda.
SELECT count(*) AS antes FROM public.comandas WHERE user_id = auth.uid();
SELECT public.pay_with_cocinarte_card(jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM t_item), 'cantidad', 1)));
-- esperado: ERROR "Saldo insuficiente. Tu saldo es $0.00; el pedido es $<precio>. …"
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_card_balance();
CREATE TEMP TABLE t_item ON COMMIT DROP AS
SELECT id, substring(price FROM '[0-9]+(?:\.[0-9]+)?')::numeric AS precio
FROM public.menu_items ORDER BY id LIMIT 1;
-- Deja el saldo exactamente igual al precio de 1 unidad.
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT public.staff_recharge_card(
  (SELECT card_number FROM public.card_accounts WHERE user_id = '<CUSTOMER_UUID>'),
  (SELECT precio FROM t_item) - (SELECT balance FROM public.card_accounts WHERE user_id = '<CUSTOMER_UUID>')
);  -- si el saldo ya era >= precio, este paso falla (monto <= 0): usa una cuenta con saldo menor
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.pay_with_cocinarte_card(jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM t_item), 'cantidad', 1)))->>'saldo';
-- esperado: 0.00 (saldo exacto: se permite y queda en cero)
SELECT public.pay_with_cocinarte_card(jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM t_item), 'cantidad', 1)));
-- esperado: ERROR "Saldo insuficiente. Tu saldo es $0.00; …"
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.get_card_balance();
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT public.staff_recharge_card((SELECT card_number FROM public.card_accounts WHERE user_id = '<CUSTOMER_UUID>'), 1000);
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT (public.get_card_balance()->>'balance')::numeric AS antes;
SELECT public.pay_with_cocinarte_card(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1))
);
-- esperado: saldo = antes - total; card_transactions tiene 1 fila 'spend' con ese comanda_id
ROLLBACK;

-- 4) STAFF: OK pendiente -> listo / cancelado. DENY otras transiciones y otras columnas.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
UPDATE public.comandas SET estado = 'cancelado'
WHERE id = (SELECT id FROM public.comandas WHERE estado = 'pendiente' LIMIT 1)
RETURNING id, estado;                                      -- esperado: 1 fila, cancelado
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
UPDATE public.comandas SET estado = 'pendiente'
WHERE id = (SELECT id FROM public.comandas WHERE estado = 'listo' LIMIT 1);
-- esperado: ERROR 42501 "Cambio de estado no permitido: listo -> pendiente"
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
UPDATE public.comandas SET total = 0
WHERE id = (SELECT id FROM public.comandas LIMIT 1);
-- esperado: ERROR 42501 permission denied for table comandas
ROLLBACK;
