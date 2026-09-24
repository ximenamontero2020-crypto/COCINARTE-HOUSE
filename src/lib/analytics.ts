/**
 * Analítica mínima y sin PII.
 *
 * VITE_PUBLIC_ANALYTICS_ID decide el proveedor:
 *   - "G-XXXXXXX"        → Google Analytics 4 (sin Google Signals ni personalización de anuncios)
 *   - "cocinarte.mx"     → Plausible (el valor es el dominio registrado en Plausible)
 *   - vacío / sin definir → solo console.debug en desarrollo; nada sale del navegador.
 *
 * Las props pasan por sanitize(): solo números, booleanos y textos cortos, y se descarta
 * cualquier clave o valor que parezca dato personal (email, teléfono, nombre, ids de usuario).
 */

export type AnalyticsEvent =
  | 'view_menu'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'place_order'
  | 'play_game'
  | 'claim_promo';

type Primitive = string | number | boolean;
export type AnalyticsProps = Record<string, Primitive | null | undefined>;

type Gtag = (...args: unknown[]) => void;
type Plausible = ((event: string, options?: { props?: Record<string, Primitive> }) => void) & { q?: unknown[] };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    plausible?: Plausible;
  }
}

const ANALYTICS_ID = (import.meta.env.VITE_PUBLIC_ANALYTICS_ID as string | undefined)?.trim() ?? '';
const PROVIDER: 'ga4' | 'plausible' | null = !ANALYTICS_ID ? null : /^G-[A-Z0-9]+$/i.test(ANALYTICS_ID) ? 'ga4' : 'plausible';

const BLOCKED_KEY = /(email|correo|mail|phone|tel|celular|nombre|name|user|uid|address|direccion)/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LONG_DIGITS = /\d[\d\s-]{6,}\d/; // teléfonos, tarjetas, etc.

function sanitize(props: AnalyticsProps = {}): Record<string, Primitive> {
  const clean: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || BLOCKED_KEY.test(key)) continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) clean[key] = value;
    } else if (typeof value === 'boolean') {
      clean[key] = value;
    } else if (value.length <= 64 && !EMAIL.test(value) && !LONG_DIGITS.test(value)) {
      clean[key] = value;
    }
  }
  return clean;
}

let loaded = false;

function loadProvider() {
  if (loaded || !PROVIDER || typeof document === 'undefined') return;
  loaded = true;

  const script = document.createElement('script');
  script.async = true;

  if (PROVIDER === 'ga4') {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js espera el objeto arguments tal cual.
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', ANALYTICS_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ANALYTICS_ID)}`;
  } else {
    // Cola oficial de Plausible para eventos disparados antes de que cargue el script.
    window.plausible =
      window.plausible ??
      Object.assign((...args: unknown[]) => {
        (window.plausible!.q = window.plausible!.q ?? []).push(args);
      }, {});
    script.defer = true;
    script.dataset.domain = ANALYTICS_ID;
    script.src = 'https://plausible.io/js/script.js';
  }

  document.head.appendChild(script);
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  const clean = sanitize(props);

  if (import.meta.env.DEV) console.debug('[analytics]', event, clean);
  if (!PROVIDER) return;

  try {
    loadProvider();
    if (PROVIDER === 'ga4') window.gtag?.('event', event, clean);
    else window.plausible?.(event, { props: clean });
  } catch (error) {
    // La analítica nunca debe romper la app.
    console.warn('No se pudo enviar el evento de analítica:', error);
  }
}
