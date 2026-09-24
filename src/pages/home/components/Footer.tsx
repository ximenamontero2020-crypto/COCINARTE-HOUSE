import { Link } from 'react-router-dom';

const schedule = [
  { day: 'Lunes a Viernes', hours: '7:00 — 21:00' },
  { day: 'Sábado', hours: '8:00 — 18:00' },
  { day: 'Domingo', hours: 'cerrado' },
];

const socials = [
  { icon: 'ri-facebook-fill', label: 'Facebook', href: '#' },
  { icon: 'ri-whatsapp-fill', label: 'WhatsApp', href: '#' },
];

export default function Footer() {
  return (
    <footer id="contacto" className="relative w-full bg-primary-800 text-background-50 px-4 md:px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 flex items-center justify-center rounded-full bg-accent-500 text-foreground-950">
                <img
                  src="https://static.readdy.ai/image/b443135844d971a5ec2a9ef47dead5a2/b2f2a4a276ed34e9f864736fe1afd2e1.png"
                  alt="CocinArte"
                  className="w-6 h-6 object-contain"
                />
              </span>
              <span className="font-heading font-extrabold text-lg tracking-tight">
                COCINARTE <span className="text-accent-400">HOUSE</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-background-50/70 leading-relaxed max-w-xs">
              Tu punto de encuentro en el Tecmilenio. Comida fresca, snacks gourmet y recompensas
              por jugar.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-bold text-base mb-4">Horarios</h4>
            <ul className="space-y-2 text-sm text-background-50/80">
              {schedule.map((s) => (
                <li key={s.day} className="flex justify-between gap-4">
                  <span>{s.day}</span>
                  <span className="text-accent-300 font-medium whitespace-nowrap">{s.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-base mb-4">Ubicación y redes</h4>
            <p className="text-sm text-background-50/80 flex items-start gap-2">
              <i className="ri-map-pin-2-fill text-accent-400 mt-0.5"></i>
              Campus Tecmilenio, Zona Universitaria
            </p>
            <div className="mt-5 flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  rel="nofollow"
                  aria-label={s.label}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-background-50/10 hover:bg-accent-500 hover:text-foreground-950 transition-colors cursor-pointer"
                >
                  <i className={s.icon}></i>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-background-50/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-background-50/60">
          <p>© {new Date().getFullYear()} COCINARTE HOUSE. Todos los derechos reservados.</p>
          <p>Hecho con cariño para la comunidad Tecmilenio.</p>
        </div>
        {/* Acceso discreto al panel de staff; StaffLayout valida el rol. */}
        <div className="mt-4 flex justify-center">
          <Link
            to="/staff/login"
            className="inline-flex items-center gap-1 text-[10px] text-background-50/30 hover:text-background-50/70 transition-colors"
          >
            <i className="ri-lock-line" aria-hidden="true"></i>
            Administración
          </Link>
        </div>
      </div>
    </footer>
  );
}