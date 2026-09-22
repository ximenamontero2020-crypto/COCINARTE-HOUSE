import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import backgroundMusic from '../assets/audio/musica-fondo.mp3';

const STORAGE_KEY = 'cocinarte-background-music-muted';

export default function BackgroundMusic() {
  const { pathname } = useLocation();
  const isStaffRoute = pathname.startsWith('/staff/');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'true';
  });

  const ensureAudioState = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isStaffRoute) {
      audio.pause();
      return;
    }

    audio.loop = true;
    audio.volume = 0.28;
    audio.muted = isMuted || !hasInteracted;

    try {
      if (!audio.muted) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.warn('No se pudo controlar la música de fondo:', error);
    }
  }, [hasInteracted, isMuted, isStaffRoute]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, String(isMuted));
    }
  }, [isMuted]);

  useEffect(() => {
    ensureAudioState();
  }, [ensureAudioState]);

  useEffect(() => {
    const onUserInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    };

    window.addEventListener('pointerdown', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', onUserInteraction);
      window.removeEventListener('keydown', onUserInteraction);
    };
  }, [hasInteracted]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const audio = audioRef.current;
      if (!audio) return;

      if (document.visibilityState === 'hidden') {
        audio.pause();
        return;
      }

      if (hasInteracted && !isMuted) {
        audio.muted = false;
        audio.play().catch(() => {
          // Se ignora si el navegador sigue bloqueando el audio por una política de autoplay.
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasInteracted, isMuted]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  const toggleMute = () => {
    setHasInteracted(true);
    setIsMuted((value) => !value);
  };

  const handlePlay = () => {
    setHasInteracted(true);
  };

  const Icon = isMuted ? VolumeX : Volume2;

  if (isStaffRoute) return null;

  return (
    <>
      <audio ref={audioRef} src={backgroundMusic} loop preload="auto" playsInline />

      {!hasInteracted && !isMuted && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label="Activar música de fondo"
          title="Activar música de fondo"
          style={{ zIndex: 2147483647 }}
          className="fixed bottom-[156px] right-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d4a017]/80 bg-[#3b2a1a] text-[#f4c542] shadow-[0_12px_30px_rgba(59,42,26,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4b3521] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2"
        >
          <Volume2 className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        aria-label={isMuted ? 'Activar música de fondo' : 'Silenciar música de fondo'}
        title={isMuted ? 'Activar música de fondo' : 'Silenciar música de fondo'}
        onClick={toggleMute}
        style={{ zIndex: 2147483647 }}
        className="fixed bottom-[96px] right-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#d4a017]/80 bg-[#66703a] text-[#f4c542] shadow-[0_16px_32px_rgba(59,42,26,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#758047] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}
