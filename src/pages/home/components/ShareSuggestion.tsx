import { useState } from 'react';

/** Enlace directo a una propuesta en la landing (#propuesta-{id}). */
function suggestionUrl(id: number) {
  return new URL(`#propuesta-${id}`, `${window.location.origin}${import.meta.env.BASE_URL}`).toString();
}

/** Bloque "Pide votos a tus amigos": copiar link, Web Share y WhatsApp. */
export default function ShareSuggestion({ id, nombre, compact = false }: { id: number; nombre: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = suggestionUrl(id);
  const message = `¡Propuse «${nombre}» para el menú de COCINARTE HOUSE! Si se te antoja, vota por ella aquí:`;
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia este enlace:', url);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: nombre, text: message, url });
    } catch {
      // El usuario canceló o el navegador no pudo compartir: no es un error.
    }
  };

  const button =
    'inline-flex items-center gap-1.5 rounded-full border border-background-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-foreground-800 hover:bg-background-200 cursor-pointer';

  return (
    <div className={compact ? 'mt-4 border-t border-background-200/70 pt-4' : 'mt-4 rounded-xl border border-primary-200 bg-primary-50 p-4'}>
      <p className="text-sm font-bold text-foreground-950">Pide votos a tus amigos</p>
      {!compact && <p className="mt-1 text-xs text-foreground-600">Entre más votos junte, más probable es que llegue al menú.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className={button}>
          <i className={copied ? 'ri-check-line' : 'ri-link'} aria-hidden="true" />
          {copied ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
        {canNativeShare && (
          <button type="button" onClick={() => void nativeShare()} className={button}>
            <i className="ri-share-forward-line" aria-hidden="true" />
            Compartir
          </button>
        )}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1ebe5a]"
        >
          <i className="ri-whatsapp-line" aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
