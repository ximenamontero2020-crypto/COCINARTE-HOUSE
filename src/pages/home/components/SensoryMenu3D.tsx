import { useRef, useState } from 'react';

type Layer = {
  id: string;
  name: string;
  emoji: string;
  note: string;
  freq: number;
  className: string;
  explodeOffset: number;
  z: number;
};

const LAYERS: Layer[] = [
  {
    id: 'pan-superior',
    name: 'Pan superior',
    emoji: '🍞',
    note: 'Do5',
    freq: 523.25,
    className:
      'h-16 md:h-20 rounded-t-[3rem] bg-gradient-to-b from-secondary-300 to-secondary-500 border-b-4 border-secondary-600',
    explodeOffset: -130,
    z: 40,
  },
  {
    id: 'fresas',
    name: 'Fresas',
    emoji: '🍓',
    note: 'Sol4',
    freq: 392.0,
    className:
      'h-8 md:h-10 bg-gradient-to-r from-rose-400 to-red-500 rounded-lg',
    explodeOffset: -55,
    z: 30,
  },
  {
    id: 'crema',
    name: 'Crema',
    emoji: '🥛',
    note: 'Mi4',
    freq: 329.63,
    className: 'h-9 md:h-11 bg-gradient-to-b from-background-50 to-background-200 rounded-lg',
    explodeOffset: 55,
    z: 20,
  },
  {
    id: 'pan-inferior',
    name: 'Pan inferior',
    emoji: '🍞',
    note: 'Do4',
    freq: 261.63,
    className:
      'h-14 md:h-16 rounded-b-[2rem] bg-gradient-to-b from-secondary-400 to-secondary-600 border-t-4 border-secondary-600',
    explodeOffset: 130,
    z: 10,
  },
];

export default function SensoryMenu3D() {
  const [exploded, setExploded] = useState(false);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const ensureContext = () => {
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (freq: number) => {
    const ctx = ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.65);
  };

  const handleLayerClick = (layer: Layer) => {
    setActiveLayer(layer.id);
    playTone(layer.freq);
    setPlaying(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setActiveLayer(null);
      setPlaying(false);
    }, 450);
  };

  const handleToggle = () => {
    setExploded((v) => !v);
    // pequeña retroalimentación sonora al armar/desarmar
    playTone(exploded ? 392.0 : 523.25);
  };

  return (
    <section id="menu-sensorial" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 text-primary-700 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
            <i className="ri-stack-fill"></i>
            Menú Sensorial 3D
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground-950">
            Desarma el sabor, <span className="text-primary-600">escucha cada capa</span>
          </h2>
          <p className="mt-4 text-foreground-600 max-w-xl mx-auto text-sm md:text-base">
            Toca &quot;Desarmar Platillo&quot; para separar el Sándwich de Fresas con Crema y
            descubre el tono musical único de cada ingrediente.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Escena 3D */}
          <div className="flex flex-col items-center">
            <div className="sensory-scene relative w-full max-w-sm h-[340px] md:h-[380px] flex items-center justify-center">
              {/* plato base */}
              <div className="absolute bottom-6 w-72 h-6 md:w-80 md:h-7 rounded-full bg-background-300/80 shadow-sm"></div>

              <div className="relative w-64 md:w-72 flex flex-col items-center">
                {LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => handleLayerClick(layer)}
                    style={{
                      zIndex: layer.z,
                      transform: exploded
                        ? `translateY(${layer.explodeOffset}px)`
                        : 'translateY(0)',
                    }}
                    className={`sensory-layer relative w-full flex items-center justify-center cursor-pointer ${
                      layer.className
                    } ${activeLayer === layer.id ? 'is-active scale-105' : 'hover:scale-[1.02]'}`}
                  >
                    <span className="text-2xl md:text-3xl drop-shadow-sm select-none">
                      {layer.emoji}
                    </span>
                    {exploded && (
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full bg-background-50 border border-background-200 text-foreground-700 text-[10px] md:text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap">
                        {layer.name} · {layer.note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleToggle}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary-500 text-background-50 font-semibold text-sm md:text-base px-8 py-4 whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
            >
              <i className={exploded ? 'ri-shuffle-fill' : 'ri-layout-grid-fill'}></i>
              {exploded ? 'Armar Platillo' : 'Desarmar Platillo'}
            </button>
          </div>

          {/* Leyenda de notas */}
          <div>
            <div className="rounded-2xl bg-background-50 border border-background-200/70 p-6 md:p-8">
              <h3 className="font-heading font-bold text-xl text-foreground-950 mb-4">
                🎵 Cada capa, una nota musical
              </h3>
              <ul className="space-y-3">
                {LAYERS.map((layer, i) => (
                  <li
                    key={layer.id}
                    className="flex items-center gap-3 text-sm text-foreground-700"
                  >
                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-secondary-100 text-secondary-900 font-semibold text-xs">
                      {i + 1}
                    </span>
                    <span className="font-medium">{layer.name}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-foreground-400">{layer.emoji}</span>
                      <span className="font-mono text-accent-700 font-semibold">{layer.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-foreground-500">
                Toca cualquier capa flotante para escuchar su tono. ¡Juntas forman un acorde de
                Do mayor!
              </p>
            </div>

            {playing && (
              <div className="mt-4 flex items-center gap-2 text-primary-600 text-sm font-medium animate-pop-in">
                <i className="ri-sound-module-fill text-lg"></i>
                Reproduciendo tono…
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}