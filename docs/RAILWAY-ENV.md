# Railway + Vite env (CocinArte House)

## Variables requeridas en Railway (build)

Vite solo inyecta variables con prefijo `VITE_`. Deben existir **en el momento del build** (no basta con runtime-only):

| Nombre | Uso |
|--------|-----|
| `VITE_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (`https://xxxx.supabase.co`) |
| `VITE_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key de Supabase |

Después de cambiarlas: **Redeploy** (nuevo build).

## Otras referencias `import.meta.env` en `src/`

Escaneo actual: **solo** `src/lib/supabase.ts` usa `import.meta.env` (`VITE_PUBLIC_SUPABASE_URL`, `VITE_PUBLIC_SUPABASE_ANON_KEY`).

`vite.config.ts` usa `process.env` de Node en build (`BASE_PATH`, `IS_PREVIEW`, `PROJECT_ID`, etc.); no son variables Vite del cliente.

## Build / start en Railway

- `outDir` de Vite: **`out`** (ver `vite.config.ts`).
- Scripts:
  - `npm run build` → genera `out/`
  - `npm start` → sirve `out` en `0.0.0.0:$PORT` (SPA fallback)

## Supabase Auth URLs (manual)

1. **Authentication → URL Configuration**
   - **Site URL:** dominio de producción Railway, p. ej. `https://cocinarte-house-production-c24e.up.railway.app`
   - **Redirect URLs:**
     - `https://<tu-dominio>/**`
     - `https://<tu-dominio>/auth/callback`
2. Plantilla Confirm signup debe incluir `{{ .ConfirmationURL }}` (enlace). Opcional: `{{ .Token }}` para OTP de 6 dígitos.
3. Ejecutar el SQL de tarjeta: `docs/SQL-cafeteria-card-balance.sql` (o la migración en `supabase/migrations/`).

Ver también `docs/AUTH-SUPABASE-RAILWAY.md`.
