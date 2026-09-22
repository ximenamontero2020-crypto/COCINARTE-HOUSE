import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { MEMBERSHIP_LEVELS, normalizeMembershipLevel } from '@/components/membership';

const links = [
  { href: '#hero', label: 'Inicio' },
  { href: '#hamburguesa-3d', label: 'Hamburguesa 3D' },
  { href: '#menu', label: 'Menú' },
  { href: '#semaforo', label: 'Semáforo' },
  { href: '#propuestas', label: 'Propuestas' },
  { href: '#resenas', label: 'Reseñas' },
  { href: '#valores', label: 'Comunidad' },
];

export default function Navbar() {
  const { count } = useCart();
  const { profile, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayName = profile?.name?.trim() || 'Mi cuenta';
  const initial = displayName.charAt(0).toUpperCase();
  const membershipLevel = normalizeMembershipLevel(profile?.membership_level);
  const membershipVisual = MEMBERSHIP_LEVELS[membershipLevel];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background-50/90 backdrop-blur-xl border-b border-background-200/70'
          : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex items-center justify-between px-4 md:px-6 h-16 md:h-20">
        <a href="#hero" className="flex items-center gap-2 cursor-pointer">
          <span className="w-9 h-9 flex items-center justify-center rounded-full bg-primary-500 text-background-50">
            <img src="https://static.readdy.ai/image/b443135844d971a5ec2a9ef47dead5a2/a9d3bd8a1f84223b3e47d1011b063586.png" alt="CocinArte" className="w-7 h-7 object-contain" />
          </span>
          <span
            className={`font-heading font-extrabold text-lg tracking-tight whitespace-nowrap ${
              scrolled ? 'text-foreground-950' : 'text-background-50'
            }`}
          >
            COCINARTE <span className="text-accent-500">HOUSE</span>
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                scrolled
                  ? 'text-foreground-700 hover:text-primary-600'
                  : 'text-background-50/90 hover:text-accent-400'
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/checkout"
            className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              scrolled
                ? 'bg-background-100 text-foreground-800 hover:bg-background-200'
                : 'bg-background-50/15 text-background-50 hover:bg-background-50/25'
            }`}
            aria-label="Ver mi pedido"
          >
            <i className="ri-shopping-bag-3-line text-xl"></i>
            {count > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-accent-500 text-foreground-950 text-[11px] font-bold">
                {count}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setUserOpen((v) => !v)}
              className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm cursor-pointer transition-colors ${
                scrolled
                  ? 'bg-primary-500 text-background-50 hover:bg-primary-600'
                  : 'bg-accent-500 text-foreground-950 hover:bg-accent-600'
              }`}
              aria-label="Mi cuenta"
            >
              {initial}
            </button>
            {membershipLevel !== 'sin_nivel' && membershipVisual.icon && (
              <span
                className={`group absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background-50 text-[11px] ${membershipVisual.badgeClassName}`}
                title={`Nivel: ${membershipVisual.label}`}
                aria-label={`Nivel: ${membershipVisual.label}`}
              >
                <i className={membershipVisual.icon} />
                <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max rounded-md bg-foreground-950 px-2 py-1 text-[11px] font-semibold text-background-50 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Nivel: {membershipVisual.label}
                </span>
              </span>
            )}
            {userOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-background-200 bg-background-50 p-2 shadow-sm">
                <p className="truncate px-3 py-2 text-sm font-medium text-foreground-900">
                  {displayName}
                </p>
                {profile?.phone && (
                  <p className="truncate px-3 pb-2 text-xs text-foreground-600">{profile.phone}</p>
                )}
                <Link
                  to="/account"
                  onClick={() => setUserOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100"
                >
                  <i className="ri-user-settings-line"></i>
                  Ver mi perfil
                </Link>
                <button
                  onClick={() => {
                    setUserOpen(false);
                    void signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground-700 hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-logout-box-r-line"></i>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg cursor-pointer"
            aria-label="Abrir menú"
          >
            <i
              className={`text-xl ${
                scrolled ? 'text-foreground-900' : 'text-background-50'
              } ${open ? 'ri-close-line' : 'ri-menu-line'}`}
            ></i>
          </button>
        </div>
      </nav>

      {open && (
        <div className="md:hidden px-4 pb-4 bg-background-50 border-b border-background-200/70">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-foreground-800 font-medium text-sm cursor-pointer hover:text-primary-600"
            >
              {l.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}