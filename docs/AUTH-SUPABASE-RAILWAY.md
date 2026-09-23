# Auth: correo de confirmación + Railway

## Problema típico
La app pide un código de 6 dígitos, pero el correo de Supabase trae un **enlace**.
Si en Supabase el **Site URL** sigue en `http://localhost:3000`, ese enlace abre un servidor local vacío.

## Configuración obligatoria en Supabase (Dashboard)
1. **Authentication → URL Configuration**
   - **Site URL:** `https://cocinarte-house-production-c24e.up.railway.app` (o el dominio final)
   - **Redirect URLs** (agregar):
     - `https://cocinarte-house-production-c24e.up.railway.app/**`
     - `https://cocinarte-house-production-c24e.up.railway.app/auth/callback`

2. **Authentication → Providers → Email**
   - Confirm email: puede quedarse ON (flujo con enlace) o OFF solo para pruebas.

3. **Authentication → Email Templates → Confirm signup**
   - Debe incluir el enlace: `{{ .ConfirmationURL }}`
   - Opcional, si quieren código de 6 dígitos en la UI: agregar también `{{ .Token }}`

## Variables en Railway (build de Vite)
- `VITE_PUBLIC_SUPABASE_URL`
- `VITE_PUBLIC_SUPABASE_ANON_KEY`

Después de cambiar variables: **Redeploy** (Vite las mete en el build).

## Flujo esperado
1. Usuario crea cuenta en `/auth`
2. Supabase crea el user (auth.users) y manda correo
3. Usuario abre el **enlace** → llega a `/auth/callback`
4. La app crea/actualiza `profiles` y queda con sesión
