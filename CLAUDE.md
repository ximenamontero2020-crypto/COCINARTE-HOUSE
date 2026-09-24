# COCINARTE HOUSE

Cafetería universitaria: landing + menú + carrito + checkout para clientes, y back-office `/staff`.

## Stack
- Vite + React 19 + TypeScript + React Router + Tailwind. Iconos: Remix Icon (`ri-*`). 3D: three / @react-three.
- Supabase: Auth, Postgres con RLS, RPCs, Realtime, Edge Functions (Deno) en `supabase/functions/`.
- Build a `out/` (no `dist/`). Deploy en Railway.
- `@stripe/react-stripe-js` está en deps pero **no está cableado**.

## Comandos
- `npm run dev`: servidor local.
- `npm run build`: build de producción a `out/`. No lo corras solo para verificar: reescribe `out/`, que está en git.
- `npm run type-check`: tsc sobre `tsconfig.app.json`. Úsalo para verificar.
- `npm run lint`: `--max-warnings 0`. Un warning nuevo rompe el lint.

## Estructura
- `src/pages/{home,checkout,account,auth,staff}`: páginas; componentes propios en `components/`.
- `src/components/`: compartidos (`feature/StaffLayout`, `feature/AuthGuard`, `CafeteriaNotice`, `membership.ts`).
- `src/hooks/`: `useStaffRole`, `useCafeteriaStatus` (store compartido, un solo canal realtime), `useCafeteriaCard`, `usePromoLimit`, `useClimaRecomendado`.
- `src/lib/`: `supabase.ts`, `analytics.ts` (`track()`), `weather.ts` (Open-Meteo, caché 20 min) y `weatherRules.ts` (coords del campus, umbrales y reglas hot/cold/rain/mild → platillos).
- `src/utils/`: `orders.ts` (`crearComanda`), `price.ts`.
- `src/router/config.tsx`: todas las rutas.
- `supabase/migrations/`: SQL versionado. `supabase/tests/`: checks manuales para el SQL Editor (BEGIN/ROLLBACK).

## Rutas
- Públicas: `/`, `/auth`, `/auth/callback`, `/auth/reset-password`.
- Con sesión (`AuthGuard`): `/checkout`, `/account`.
- Staff: `/staff/login` (sin guard). Con guard de rol en `StaffLayout`: `/staff` (hub), `/staff/cafeteria-status`, `/staff/almacen`, `/staff/proveedores`, `/staff/corte-caja`, `/staff/fun-facts`, `/staff/insights`, `/staff/pareto` (lazy, Recharts) y `/staff/auditoria` (solo admin).

## Supabase: tablas y RPCs clave
- `profiles`: `role` ('customer' | 'staff' | 'admin'), `membership_level`, `membership_current_spend`.
- `comandas`: pedidos. Se crean **solo** con `create_comanda(p_items, p_metodo_pago)`; el servidor calcula precios y total. Staff solo cambia `estado`: pendiente → listo | cancelado.
- `menu_items`, `menu_categories`: menú (`price` es texto, p. ej. "MXN 85").
- `cafeteria_status` (fila id=1): semáforo, `cerrado`, fila (`queue_count`, `wait_minutes`, `note`); historial en `cafeteria_status_history`. Si está cerrado, la BD rechaza pedidos.
- Staff: `insumos` (stock = `cantidad_actual`, mínimo = `umbral_minimo`), `proveedores`, `insumo_proveedor`, `stock_alert_log`, `receta_platillo`, `cortes_caja`, `movimientos_efectivo`, `fun_facts`, `staff_audit_log`.
- Promos y saldo: `promo_codes`, `promo_redemptions`, `card_accounts`, `card_transactions`.
- `app_settings` (key/value editable por staff; público solo lo listado en su policy): `whatsapp_e164`, `whatsapp_greeting`.
- Helpers: `is_staff()`, `is_admin()`. Permisos en BD, nunca en el cliente.

## Reglas (no negociables)
- **Nunca hardcodear emails de staff.** Acceso = `profiles.role` + RLS. Para promover a alguien: `UPDATE profiles SET role='staff' ...` en el SQL Editor (ver comentario en `20260923000000_staff_roles_rls.sql`).
- **Nunca simular pagos.** Nada de "cargo procesado" falso ni saldo en localStorage. Métodos válidos: `caja` (paga al recoger) y `cafeteria` (solo vía `pay_with_cocinarte_card`: saldo real, débito y comanda en una transacción). Solo staff recarga saldo (`staff_recharge_card`).
- **Nunca confiar en el front** para totales, descuentos, saldo ni roles; el servidor valida (RPC `SECURITY DEFINER` + RLS).
- **`VITE_*` se inyecta en build.** En Railway deben existir como variables *de build*; si cambias una, hay que redeployar. Todo `VITE_*` es público: nunca pongas ahí service keys.
  - Usadas (ver `.env.example`): `VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY`, `VITE_PUBLIC_ANALYTICS_ID` (opcional: `G-…` = GA4, dominio = Plausible), `VITE_PUBLIC_WHATSAPP_E164` (opcional, gana sobre `app_settings`).
- Analítica sin PII: usa `track()`; nada de email, teléfono, nombre, ids de usuario ni códigos de promo.
- Sin secretos en el repo (`.env` está en `.gitignore`). No subas `src.zip` / `src (2).zip`.

## Convenciones
- Todo el texto de UI en **español de México** (es-MX), tuteando. Montos con `formatPrice` o `Intl` es-MX / MXN.
- Comentarios de código en español; los de migraciones SQL, en inglés. Mensajes de error SQL visibles al usuario, en español.
- Diffs acotados: no rediseñes módulos que no pide la tarea. Reutiliza hooks y componentes existentes.
- Migraciones nuevas: idempotentes (`IF NOT EXISTS`, `DROP ... IF EXISTS`), con `search_path = ''` en funciones y `NOTIFY pgrst, 'reload schema'` al final.
- Realtime: un canal por topic. Si varios componentes lo necesitan, compártelo como en `useCafeteriaStatus`.

## Prioridades P0 actuales
1. Aplicar en orden las migraciones `20260923000000` → `20260924000008`. Después promover al primer admin y correr `supabase/tests/*.sql`. **Nada de SQL se ha probado aún en una base real.**
2. Juegos → promos del servidor: pasar `usePromoLimit` a `claim_promo` / `get_my_promo` y agregar el campo de código en checkout (`preview_promo` + `apply_promo`). Hoy el descuento sigue viviendo en localStorage.
3. Pantalla staff para `staff_recharge_card`. Sin ella, el saldo solo se recarga desde el SQL Editor.
4. Alerta de stock: configurar `stock_alert_secret` en `private.app_config` y los secrets de la función (`STOCK_ALERT_SECRET`, `STOCK_ALERT_EMAILS`, `RESEND_API_KEY` o `GMAIL_*`), y redeployar `send-low-stock-email`.
5. Confirmar el tipo de `comandas.id` (las pruebas asumen bigint) y cómo agrupa `calcular_corte_caja` los métodos `caja` / `cafeteria`.
