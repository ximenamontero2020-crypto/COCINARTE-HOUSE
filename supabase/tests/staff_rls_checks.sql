-- Pruebas manuales de RLS para staff/customer. Ejecutar en el SQL Editor de Supabase.
-- Cada bloque simula un usuario (rol `authenticated` + JWT con su id) y hace ROLLBACK,
-- así que no deja cambios.
-- Sustituye los UUID por un usuario staff/admin real y un customer real:
--   SELECT id, email, role FROM public.profiles ORDER BY role;

-- 1) STAFF: OK. Ve insumos y puede cambiar el estado de una comanda.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<STAFF_UUID>","role":"authenticated"}', true);
SELECT public.is_staff() AS es_staff;                     -- esperado: true
SELECT count(*) AS insumos_visibles FROM public.insumos;  -- esperado: > 0
UPDATE public.comandas SET estado = estado
WHERE id = (SELECT id FROM public.comandas LIMIT 1)
RETURNING id;                                             -- esperado: 1 fila
ROLLBACK;

-- 2) CUSTOMER: DENY en lecturas y en el update de estado (RLS filtra en silencio: 0 filas).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
SELECT public.is_staff() AS es_staff;                          -- esperado: false
SELECT count(*) AS insumos_visibles FROM public.insumos;       -- esperado: 0
SELECT count(*) AS cortes_visibles FROM public.cortes_caja;    -- esperado: 0
UPDATE public.comandas SET estado = 'listo' RETURNING id;      -- esperado: 0 filas
ROLLBACK;

-- 3) CUSTOMER: DENY en escrituras y en la escalada de rol (estas sí lanzan error).
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
-- esperado: ERROR 42501 "No autorizado para cambiar el rol"
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"<CUSTOMER_UUID>","role":"authenticated"}', true);
INSERT INTO public.fun_facts (content, category, active) VALUES ('hack', 'x', true);
-- esperado: ERROR 42501 "new row violates row-level security policy for table fun_facts"
ROLLBACK;
