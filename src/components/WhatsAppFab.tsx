import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// Override de build: si está definido, gana sobre el número guardado por staff.
const ENV_E164 = ((import.meta.env.VITE_PUBLIC_WHATSAPP_E164 as string | undefined) ?? '').replace(/\D/g, '');

/** Botón fijo de WhatsApp Business. Sin número configurado no se renderiza. */
export default function WhatsAppFab() {
  const { pathname } = useLocation();
  const [e164, setE164] = useState(ENV_E164);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    let active = true;
    void supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['whatsapp_e164', 'whatsapp_greeting'])
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Error cargando contacto de WhatsApp:', error);
          return;
        }
        const settings = new Map((data ?? []).map((row) => [row.key as string, (row.value as string) ?? '']));
        if (!ENV_E164) setE164((settings.get('whatsapp_e164') ?? '').replace(/\D/g, ''));
        setGreeting(settings.get('whatsapp_greeting') ?? '');
      });
    return () => {
      active = false;
    };
  }, []);

  if (!e164 || pathname === '/staff' || pathname.startsWith('/staff/')) return null;

  const href = `https://wa.me/${e164}${greeting ? `?text=${encodeURIComponent(greeting)}` : ''}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
      className="fixed bottom-5 left-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-3xl text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
    >
      <i className="ri-whatsapp-line" aria-hidden="true" />
    </a>
  );
}
