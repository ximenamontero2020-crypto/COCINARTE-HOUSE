import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

/** Número de WhatsApp Business (solo dígitos, con lada de país) y saludo prellenado. */
export default function WhatsAppSettings() {
  const [e164, setE164] = useState('');
  const [greeting, setGreeting] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['whatsapp_e164', 'whatsapp_greeting'])
      .then(({ data, error }) => {
        if (error) console.error('Error cargando ajustes de WhatsApp:', error);
        const settings = new Map((data ?? []).map((row) => [row.key as string, (row.value as string) ?? '']));
        setE164(settings.get('whatsapp_e164') ?? '');
        setGreeting(settings.get('whatsapp_greeting') ?? '');
        setLoading(false);
      });
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const digits = e164.replace(/\D/g, '');
    if (digits && !/^[1-9]\d{7,14}$/.test(digits)) {
      setMessage({ tone: 'error', text: 'Escribe el número con lada de país, solo dígitos (p. ej. 52 y los 10 dígitos).' });
      return;
    }
    setSaving(true);
    setMessage(null);
    const now = new Date().toISOString();
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'whatsapp_e164', value: digits, updated_at: now },
      { key: 'whatsapp_greeting', value: greeting.trim().slice(0, 300), updated_at: now },
    ]);
    setSaving(false);
    if (error) {
      console.error('Error guardando ajustes de WhatsApp:', error);
      setMessage({ tone: 'error', text: 'No se pudo guardar.' });
      return;
    }
    setE164(digits);
    setMessage({ tone: 'ok', text: digits ? 'Guardado. El botón de WhatsApp ya aparece en el sitio.' : 'Guardado. Sin número, el botón no se muestra.' });
  };

  return (
    <section className="mt-10 rounded-2xl border border-background-200/70 bg-background-100 p-5" aria-labelledby="whatsapp-title">
      <h2 id="whatsapp-title" className="flex items-center gap-2 font-heading text-lg font-bold text-foreground-950">
        <i className="ri-whatsapp-line text-[#25D366]" aria-hidden="true" />
        Contacto por WhatsApp
      </h2>
      <p className="mt-1 text-sm text-foreground-600">Si dejas el número vacío, el botón no aparece en el sitio.</p>

      <form onSubmit={(event) => void save(event)} className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-start">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground-800">Número (con lada de país)</span>
          <input
            type="tel"
            inputMode="numeric"
            disabled={loading}
            value={e164}
            onChange={(event) => setE164(event.target.value.replace(/\D/g, '').slice(0, 15))}
            placeholder="521234567890"
            className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-foreground-800">Mensaje inicial</span>
          <input
            type="text"
            disabled={loading}
            maxLength={300}
            value={greeting}
            onChange={(event) => setGreeting(event.target.value)}
            className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" disabled={loading || saving} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50 md:mt-6">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-sm ${message.tone === 'ok' ? 'text-primary-700' : 'text-accent-700'}`}>{message.text}</p>
      )}
    </section>
  );
}
