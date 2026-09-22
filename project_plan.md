# COCINARTE HOUSE

## 1. Descripción del Proyecto
COCINARTE HOUSE es una cafetería universitaria y snack bar de nueva generación ubicada en el Campus Tecmilenio. Su objetivo es ser el punto de encuentro de los estudiantes, combinando comida fresca, snacks gourmet y una experiencia lúdica con recompensas (Cocinarte Coins) que incentivan la visita y la convivencia.

- **Público objetivo:** estudiantes universitarios.
- **Valor central:** comida fresca de calidad + experiencia interactiva (menú sensorial 3D sonoro + minijuego de recompensas tras el pago).

## 2. Estructura de Páginas
- `/auth` — Pantalla de acceso obligatoria: iniciar sesión o crear cuenta (nombre, teléfono y correo). Incluye verificación por código y recuperación de contraseña.
- `/auth/callback` — Callback de verificación de correo (PKCE).
- `/auth/reset-password` — Definir nueva contraseña.
- `/` — Landing page (SPA, protegida tras iniciar sesión) con todas las secciones:
  - Hero
  - Menú Sensorial 3D
  - Menú Rápido (tarjetas)
  - Valores / Comunidad
  - Footer
- `/checkout` — Checkout y pago. Tras confirmar el pedido se muestran los minijuegos "El Grano Volador" y "Lluvia de Espresso" que otorgan un descuento aleatorio del 2–10% (mínimo $250), acumulable hasta 10% por mes.

## 3. Funcionalidades Principales
- [x] Registro e inicio de sesión obligatorio al entrar (nombre, teléfono y correo) con verificación por código y recuperación de contraseña
- [x] Hero con CTA (Explorar Menú Sensorial / Pide y Gana un descuento)
- [x] Menú Sensorial 3D (vista explotada con CSS 3D Transforms)
- [x] Lógica sonora (Web Audio API, un tono por capa)
- [x] Minijuegos "El Grano Volador" y "Lluvia de Espresso" (canvas) que aparecen tras pagar y otorgan un descuento aleatorio del 2–10% (mínimo $250), acumulable hasta un máximo de 10% mensual.
- [x] Menú en tarjetas (Sándwiches, Comida Rápida, Pastas, Chilaquiles, Bebidas, Smoothies, Cheesecakes, Rebanadas de Pastel, Galletas) con información nutrimental, alérgenos y vista de imagen de referencia al hacer clic
- [x] Sección de valores
- [x] Footer con horarios, ubicación y redes

## 4. Modelo de Datos
El menú se carga desde un mock estático (`src/mocks/menu.ts`). La autenticación usa Readdy Backend (Supabase-compatible). Tabla `profiles` para guardar nombre y teléfono del usuario (id → auth.users.id).

## 5. Integraciones Backend / Terceros
- Readdy Backend: autenticación de usuarios (registro, login, verificación por código, recuperación de contraseña) y tabla `profiles`.
- Shopify / Stripe / Pagos: no requeridos (el descuento se canjea mostrando la pantalla al cajero).

## 6. Plan de Fases de Desarrollo

### Fase 1: Landing page completa
- Objetivo: montar la SPA funcional con todas las secciones y la lógica del menú 3D y el minijuego de recompensas tras el pago.
- Entregable: página `/` totalmente operativa, responsive mobile-first, con sonido e interacciones, y flujo de checkout con minijuego de descuento.

### Fase 2: Autenticación y acceso
- Objetivo: solicitar registro o inicio de sesión al entrar a la web (nombre, teléfono y correo).
- Entregable: pantalla `/auth` con login/registro, verificación por código, recuperación de contraseña y protección de las páginas `/` y `/checkout`.