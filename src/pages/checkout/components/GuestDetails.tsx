import { Link } from 'react-router-dom';
import type { DatosInvitado } from '@/utils/orders';
import { EMAIL_RE, NOMBRE_MAX } from '../guest';

const PERKS = [
  // Sin cuenta también hay tarjeta, pero temporal (solo en este navegador).
  { icon: 'ri-bank-card-2-line', text: 'Tu Tarjeta CocinArte y su saldo, en cualquier dispositivo' },
  { icon: 'ri-history-line', text: 'Ve los movimientos de tu tarjeta' },
  { icon: 'ri-vip-crown-line', text: 'Sube de nivel de membresía con cada compra' },
  { icon: 'ri-gamepad-line', text: 'Juega y gana descuentos' },
];

/** Checkout sin cuenta: datos para recoger el pedido + invitación opcional a entrar o registrarse. */
export default function GuestDetails({
  value,
  onChange,
}: {
  value: DatosInvitado;
  onChange: (next: DatosInvitado) => void;
}) {
  const inputClass =
    'w-full rounded-md border border-background-200/70 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-400 focus:outline-none focus:border-primary-400';
  const emailInvalido = value.email.trim() !== '' && !EMAIL_RE.test(value.email.trim());

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-background-50 border border-background-200/70 p-5 md:p-6">
        <h2 className="font-heading font-bold text-xl text-foreground-950">Tus datos</h2>
        <p className="mt-1 text-sm text-foreground-500">Compra sin cuenta: solo necesitamos tu nombre para entregarte el pedido.</p>

        <div className="mt-5 space-y-3">
          <div>
            <label htmlFor="guest-nombre" className="block text-xs font-medium text-foreground-600 mb-1.5">
              Nombre para recoger
            </label>
            <input
              id="guest-nombre"
              type="text"
              autoComplete="name"
              value={value.nombre}
              maxLength={NOMBRE_MAX}
              onChange={(e) => onChange({ ...value, nombre: e.target.value })}
              placeholder="Ej. Ana García"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="guest-email" className="block text-xs font-medium text-foreground-600 mb-1.5">
              Correo <span className="font-normal text-foreground-400">(opcional)</span>
            </label>
            <input
              id="guest-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={value.email}
              maxLength={254}
              onChange={(e) => onChange({ ...value, email: e.target.value })}
              placeholder="tu@correo.com"
              aria-invalid={emailInvalido}
              className={inputClass}
            />
            <p className={`mt-1.5 text-xs ${emailInvalido ? 'text-accent-700' : 'text-foreground-500'}`}>
              {emailInvalido ? 'Revisa el correo o déjalo vacío.' : 'Si lo escribes, te avisamos cuando tu pedido esté listo.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
        <p className="text-sm font-semibold text-primary-800">¿Quieres más? Crear cuenta es opcional</p>
        <ul className="mt-3 space-y-1.5">
          {PERKS.map((p) => (
            <li key={p.text} className="flex items-start gap-2 text-sm text-primary-900">
              <i className={`${p.icon} mt-0.5 text-primary-600`} aria-hidden="true"></i>
              {p.text}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/auth?next=/checkout"
            className="inline-flex min-h-11 items-center rounded-full bg-primary-600 px-4 text-sm font-semibold text-background-50 hover:bg-primary-700 transition-colors md:min-h-0 md:py-2"
          >
            Iniciar sesión o crear cuenta
          </Link>
        </div>
        <p className="mt-2 text-xs text-primary-800/80">Tu carrito se conserva.</p>
      </div>
    </div>
  );
}
