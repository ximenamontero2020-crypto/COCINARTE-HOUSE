import { useCallback, useEffect, useRef, useState, Suspense, useMemo } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const BURGER_MODEL_URL =
  'https://static.poly.pizza/79443d35-a695-44d0-83cc-aaebabb1c541.glb';

type Layer = {
  name: string;
  emoji: string;
  note: string;
  freq: number;
  color: string;
};

const LAYERS: Layer[] = [
  { name: 'Pan superior', emoji: '🍞', note: 'Do5', freq: 523.25, color: '#D9A05B' },
  { name: 'Lechuga', emoji: '🥬', note: 'Re5', freq: 587.33, color: '#5BA83C' },
  { name: 'Jitomate', emoji: '🍅', note: 'Mi5', freq: 659.25, color: '#D8382C' },
  { name: 'Carne', emoji: '🥩', note: 'Fa5', freq: 698.46, color: '#6B3F27' },
  { name: 'Queso', emoji: '🧀', note: 'Sol5', freq: 783.99, color: '#F2B613' },
  { name: 'Pan inferior', emoji: '🍞', note: 'Do4', freq: 261.63, color: '#D9A05B' },
];

// Categoría de ingrediente -> color de UI (para botones, NO para recolorear el modelo)
type Category = 'bun' | 'lettuce' | 'tomato' | 'meat' | 'cheese';

const CATEGORY_COLOR: Record<Category, string> = {
  bun: '#D9A05B',
  lettuce: '#5BA83C',
  tomato: '#D8382C',
  meat: '#6B3F27',
  cheese: '#F2B613',
};

/**
 * Clasifica un material según su tono (hue) para saber a qué capa pertenece.
 * NO recolorea el modelo — solo clasifica para la vista explosionada y los clics.
 */
const classifyByColor = (color: THREE.Color): Category => {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const hue = hsl.h * 360;
  const { s, l } = hsl;

  if (hue >= 70 && hue <= 170 && s > 0.12) return 'lettuce';
  if ((hue <= 18 || hue >= 345) && s > 0.25) return 'tomato';
  if (hue >= 45 && hue < 70 && s > 0.35 && l > 0.35) return 'cheese';
  if (hue > 18 && hue < 45) {
    if (l < 0.34) return 'meat';
    return 'bun';
  }
  if (l < 0.3) return 'meat';
  return 'bun';
};

type MeshEntry = {
  mesh: THREE.Mesh;
  origY: number;
  origScale: THREE.Vector3;
  layerIndex: number;
};

/* ------------------------------------------------------------------ */

function BurgerScene({
  activeLayer,
  onLayerClick,
  onReady,
}: {
  activeLayer: string | null;
  onLayerClick: (name: string) => void;
  onReady: (count: number) => void;
}) {
  const { scene } = useGLTF(BURGER_MODEL_URL);

  const { group, entries } = useMemo(() => {
    const cloned = scene.clone(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3.1 / maxDim;

    const wrapper = new THREE.Group();
    wrapper.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    wrapper.scale.setScalar(scale);
    wrapper.add(cloned);

    // Recolectar mallas con su centro Y original
    const rawMeshes: { mesh: THREE.Mesh; centerY: number }[] = [];
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const b = new THREE.Box3().setFromObject(mesh);
      if (b.isEmpty()) return;
      rawMeshes.push({ mesh, centerY: b.getCenter(new THREE.Vector3()).y });
    });

    const centerY = center.y;

    // Cache de clasificación por material original
    const matCategoryCache = new Map<string, Category>();

    const list: MeshEntry[] = [];
    rawMeshes.forEach(({ mesh, centerY: meshY }) => {
      const original = mesh.material as THREE.MeshStandardMaterial;
      const matKey = original?.uuid ?? 'unknown';

      let category: Category;
      if (matCategoryCache.has(matKey)) {
        category = matCategoryCache.get(matKey) as Category;
      } else {
        const baseColor =
          original && original.color ? original.color.clone() : new THREE.Color('#D9A05B');
        category = classifyByColor(baseColor);
        matCategoryCache.set(matKey, category);
      }

      let layerIndex: number;
      if (category === 'bun') {
        layerIndex = meshY >= centerY ? 0 : 5;
      } else if (category === 'lettuce') {
        layerIndex = 1;
      } else if (category === 'tomato') {
        layerIndex = 2;
      } else if (category === 'meat') {
        layerIndex = 3;
      } else {
        layerIndex = 4;
      }

      // NO recoloreamos el modelo — respetamos los colores naturales de Poly Pizza
      // Solo configuramos sombras para que se vea bien
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      list.push({
        mesh,
        origY: mesh.position.y,
        origScale: mesh.scale.clone(),
        layerIndex,
      });
    });

    return { group: wrapper, entries: list };
  }, [scene]);

  useEffect(() => {
    onReady(entries.length);
  }, [entries, onReady]);

  useEffect(() => {
    entries.forEach((entry) => {
      entry.mesh.position.y = entry.origY;
      entry.mesh.scale.copy(entry.origScale);
    });

    if (activeLayer) {
      const idx = LAYERS.findIndex((l) => l.name === activeLayer);
      if (idx >= 0) {
        entries.forEach((entry) => {
          if (entry.layerIndex === idx) {
            entry.mesh.scale.copy(entry.origScale).multiplyScalar(1.12);
            entry.mesh.position.y = entry.origY + 0.15;
          }
        });
      }
    }
  }, [activeLayer, entries]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (!e.intersections || e.intersections.length === 0) return;

      let hitMesh: THREE.Mesh | null = null;
      for (let i = 0; i < e.intersections.length; i += 1) {
        const obj = e.intersections[i].object;
        if ((obj as THREE.Mesh).isMesh) {
          hitMesh = obj as THREE.Mesh;
          break;
        }
      }
      if (!hitMesh) return;

      const entry = entries.find((en) => en.mesh === hitMesh);
      if (!entry) return;

      const layerName = LAYERS[entry.layerIndex]?.name;
      if (layerName) onLayerClick(layerName);
    },
    [entries, onLayerClick],
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.object && (e.object as THREE.Mesh).isMesh) {
      document.body.style.cursor = 'pointer';
    }
  }, []);

  const handlePointerOut = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'default';
  }, []);

  return (
    <group position={[0, 0.45, 0]}>
      <primitive
        object={group}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */

export default function Hamburger3D() {
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const playTone = useCallback((freq: number) => {
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

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
  }, []);

  const flashPlaying = useCallback(() => {
    setPlaying(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setPlaying(false), 450);
  }, []);

  const handleLayerClick = useCallback(
    (layer: Layer) => {
      playTone(layer.freq);
      flashPlaying();
      setActiveLayer((prev) => (prev === layer.name ? null : layer.name));
    },
    [playTone, flashPlaying],
  );

  const handleMeshLayerClick = useCallback(
    (name: string) => {
      const layer = LAYERS.find((l) => l.name === name);
      if (layer) handleLayerClick(layer);
    },
    [handleLayerClick],
  );

  const handleReady = useCallback(() => {
    setModelLoaded(true);
  }, []);

  return (
    <section id="hamburguesa-3d" className="relative w-full py-20 md:py-28 px-4 md:px-6 bg-background-100">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-100 text-primary-700 text-xs md:text-sm font-semibold px-4 py-1.5 mb-4 whitespace-nowrap">
            <i className="ri-box-3-fill"></i>
            Hamburguesa 3D
          </span>
          <h2 className="font-heading font-extrabold text-3xl md:text-5xl text-foreground-950">
            Gira, acerca y explora la hamburguesa 3D
          </h2>
          <p className="mt-4 text-foreground-600 max-w-xl mx-auto text-sm md:text-base">
            Modelo 3D de nuestra hamburguesa premium. Arrastra para girarla 360° y usa la rueda para zoom.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-lg h-[420px] rounded-2xl bg-background-50 border border-background-200/70 overflow-hidden">
              {!modelLoaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background-50">
                  <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm text-foreground-500 font-medium">Cargando modelo 3D…</p>
                </div>
              )}
              <Canvas
                shadows
                dpr={[1, 2]}
                camera={{ position: [0, 0.4, 5.2], fov: 42 }}
                gl={{ antialias: true, alpha: true }}
                onCreated={({ gl }) => {
                  gl.toneMapping = THREE.ACESFilmicToneMapping;
                  gl.toneMappingExposure = 1.15;
                }}
              >
                <ambientLight intensity={0.6} />
                <hemisphereLight intensity={0.5} groundColor="#e8e0d4" />
                <directionalLight position={[5, 8, 4]} intensity={1.1} castShadow />
                <directionalLight position={[-4, 2, -4]} intensity={0.45} />

                <Suspense fallback={null}>
                  <BurgerScene
                    activeLayer={activeLayer}
                    onLayerClick={handleMeshLayerClick}
                    onReady={handleReady}
                  />
                </Suspense>

                <Suspense fallback={null}>
                  <Environment preset="studio" />
                </Suspense>

                <ContactShadows
                  position={[0, -1.7, 0]}
                  opacity={0.35}
                  scale={8}
                  blur={2.5}
                  far={4}
                  color="#1a1a1a"
                />

                <OrbitControls
                  enablePan={false}
                  minDistance={2.6}
                  maxDistance={8}
                  autoRotate
                  autoRotateSpeed={1.2}
                />
              </Canvas>
            </div>
          </div>

          <div>
            <div className="rounded-2xl bg-background-50 border border-background-200/70 p-6 md:p-8">
              <h3 className="font-heading font-bold text-xl text-foreground-950 mb-4">
                🍔 Ingredientes de la hamburguesa
              </h3>
              <ul className="space-y-3">
                {LAYERS.map((layer) => (
                  <li key={layer.name}>
                    <button
                      onClick={() => handleLayerClick(layer)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer whitespace-nowrap ${
                        activeLayer === layer.name
                          ? 'bg-primary-100 border border-primary-300 scale-[1.02]'
                          : 'bg-background-100 hover:bg-background-200 border border-transparent'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 ring-2 ring-background-200"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="font-medium text-sm text-foreground-700 flex-1 min-w-0">
                        {layer.name}
                      </span>
                      <span className="font-mono text-accent-700 font-semibold text-xs">
                        {layer.note}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-foreground-500">
                Toca cualquier alimento en la lista para escuchar su tono musical y verla resaltar.
              </p>
            </div>

            {playing && (
              <div className="mt-4 flex items-center gap-2 text-primary-600 text-sm font-medium animate-pulse">
                <i className="ri-sound-module-fill text-lg"></i>
                Reproduciendo tono…
              </div>
            )}

            <div className="mt-6 rounded-2xl bg-accent-50 border border-accent-200/60 p-5">
              <h4 className="font-heading font-bold text-sm text-accent-900 mb-2 flex items-center gap-2">
                <i className="ri-hand-coin-line"></i>
                Controles del modelo 3D
              </h4>
              <ul className="space-y-2 text-sm text-accent-800">
                <li className="flex items-start gap-2">
                  <i className="ri-drag-move-line mt-0.5 shrink-0"></i>
                  <span>
                    <strong>Arrastra</strong> con el mouse o dedo para girar la hamburguesa 360°.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-zoom-in-line mt-0.5 shrink-0"></i>
                  <span>
                    <strong>Rueda del mouse</strong> o <strong>pellizco</strong> para acercar/alejar.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-music-2-line mt-0.5 shrink-0"></i>
                  <span>
                    Haz clic en un <strong>ingrediente</strong> del modelo para resaltarlo.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}