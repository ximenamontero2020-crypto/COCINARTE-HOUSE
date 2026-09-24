-- Pruebas manuales de la fila (cafeteria_status + historial). Ejecutar en el SQL Editor de Supabase.
-- Cada bloque hace ROLLBACK. Sustituye <STAFF_UUID> y <CUSTOMER_UUID>.

-- 1) STAFF: cambiar el conteo mueve queue_updated_at y agrega historial.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT count(*) AS hist_antes FROM public.cafeteria_status_history;
UPDATE public.cafeteria_status SET queue_count = 7, queue_source = 'staff' WHERE id = 1
RETURNING queue_count, queue_updated_at;                   -- esperado: 7, now()
SELECT count(*) AS hist_despues FROM public.cafeteria_status_history;  -- esperado: hist_antes + 1
SELECT level, queue_count, source, pending_orders, actor_id = auth.uid() AS actor_ok
FROM public.cafeteria_status_history ORDER BY id DESC LIMIT 1;  -- esperado: 7, 'staff', actor_ok = true
ROLLBACK;

-- 2) STAFF: cerrar la cafetería NO mueve queue_updated_at (el dato de fila no se "refresca").
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT queue_updated_at AS antes FROM public.cafeteria_status WHERE id = 1;
UPDATE public.cafeteria_status SET cerrado = NOT cerrado WHERE id = 1 RETURNING queue_updated_at;
-- esperado: igual a "antes"
ROLLBACK;

-- 3) Límites y permisos.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
UPDATE public.cafeteria_status SET queue_count = -1 WHERE id = 1;
-- esperado: ERROR cafeteria_status_queue_count_check
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT queue_count, queue_updated_at FROM public.cafeteria_status WHERE id = 1;  -- esperado: lo ve (lectura pública)
UPDATE public.cafeteria_status SET queue_count = 0 WHERE id = 1 RETURNING id;   -- esperado: 0 filas (RLS)
SELECT count(*) FROM public.cafeteria_status_history;                          -- esperado: 0 (solo staff)
ROLLBACK;
