const AUTH_ROUTES = [
  '/auth',
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
];

export function validateOrdinaryPostAuthNext(next: string | null | undefined): string {
  if (!next) return '/';

  // Rechazar URLs absolutas o con protocolo
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return '/';
  if (next.startsWith('//')) return '/';

  // Aceptar solo rutas internas que empiecen con una única "/"
  if (!next.startsWith('/') || next.startsWith('//')) return '/';

  // Rechazar rutas del flujo de autenticación
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => next === route || next.startsWith(`${route}/`),
  );
  if (isAuthRoute) return '/';

  return next;
}

export function getCallbackUrl(next?: string | null): string {
  const base = `${window.location.origin}/auth/callback`;
  if (next && validateOrdinaryPostAuthNext(next) !== '/') {
    return `${base}?next=${encodeURIComponent(next)}`;
  }
  return base;
}