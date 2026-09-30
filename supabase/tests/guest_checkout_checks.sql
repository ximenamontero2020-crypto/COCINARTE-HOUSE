-- Pruebas manuales de create_guest_comanda (pedidos sin cuenta). Ejecutar en el SQL Editor de Supabase
-- después de aplicar 20260924000011_guest_checkout.sql.
-- Cada bloque simula al rol anon (o a un cliente) y hace ROLLBACK, así que no deja cambios.
-- Sustituye <CUSTOMER_UUID>:
--   SELECT id, email, role FROM public.profiles ORDER BY role;

-- 1) ANON: OK. Solo productos listos; total del servidor; user_id NULL; nombre y correo normalizados.
BEGIN;
UPDATE public.menu_items SET pago_en_caja_permitido = true
WHERE id = (SELECT id FROM public.menu_items ORDER BY id LIMIT 1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.10"}', true);
SELECT public.create_guest_comanda(
  jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 2)),
  '  Ana López ',
  ' Ana@Correo.MX '
);
-- esperado: { numero_pedido 'COC-######', total = 2 * precio, saldo null }
RESET ROLE;
SELECT cliente, cliente_email, user_id, metodo_pago, estado FROM public.comandas ORDER BY id DESC LIMIT 1;
-- esperado: 'Ana López' | 'ana@correo.mx' | NULL | 'caja' | 'pendiente'
ROLLBACK;

-- 2) ANON: DENY. Producto que requiere preparación.
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
--   (antes de 20260924000013: "Sin cuenta solo puedes pedir productos listos para pagar en caja. ...")
ROLLBACK;

-- 3) ANON: DENY. Nombre vacío / correo inválido.
BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.create_guest_comanda('[{"menu_item_id": 1, "cantidad": 1}]', ' ');
-- esperado: ERROR "Escribe tu nombre (2 a 60 caracteres) para recoger el pedido."
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.create_guest_comanda('[{"menu_item_id": 1, "cantidad": 1}]', 'Ana', 'no-es-correo');
-- esperado: ERROR "El correo no es válido. Corrígelo o déjalo vacío."
ROLLBACK;

-- 4) ANON: DENY. Sin acceso directo a comandas ni al log de límites.
BEGIN;
SET LOCAL ROLE anon;
SELECT * FROM public.comandas LIMIT 1;
-- esperado: ERROR 42501 permission denied for table comandas (o 0 filas si hay un GRANT SELECT viejo: revísalo)
ROLLBACK;

BEGIN;
SET LOCAL ROLE anon;
SELECT * FROM private.guest_order_log;
-- esperado: ERROR 42501 permission denied for schema private
ROLLBACK;

-- 5) CUSTOMER: DENY. Con sesión se usa create_comanda (el pedido cuenta para su cuenta).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.create_guest_comanda('[{"menu_item_id": 1, "cantidad": 1}]', 'Ana');
-- esperado: ERROR 42501 permission denied for function create_guest_comanda
ROLLBACK;

-- 6) ANON: límite por IP (3 pedidos en 15 min). El 4º falla.
BEGIN;
UPDATE public.menu_items SET pago_en_caja_permitido = true
WHERE id = (SELECT id FROM public.menu_items ORDER BY id LIMIT 1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT set_config('request.headers', '{"x-forwarded-for":"203.0.113.77"}', true);
SELECT public.create_guest_comanda(jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)), 'Ana')
FROM generate_series(1, 4);
-- esperado: ERROR "Hiciste varios pedidos seguidos. ..." (al 4º)
ROLLBACK;

-- 7) Cafetería cerrada: también rechaza pedidos de invitado.
BEGIN;
UPDATE public.cafeteria_status SET cerrado = true WHERE id = 1;
UPDATE public.menu_items SET pago_en_caja_permitido = true
WHERE id = (SELECT id FROM public.menu_items ORDER BY id LIMIT 1);
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT public.create_guest_comanda(jsonb_build_array(jsonb_build_object('menu_item_id', (SELECT id FROM public.menu_items ORDER BY id LIMIT 1), 'cantidad', 1)), 'Ana');
-- esperado: ERROR "La cafetería está cerrada. Intenta más tarde."
ROLLBACK;
