import { useEffect, useRef, useState } from 'react';
import { usePromoLimit } from '@/hooks/usePromoLimit';
import { track } from '@/lib/analytics';

type Status = 'idle' | 'playing' | 'gameover';

const CANVAS_W = 360;
const CANVAS_H = 520;
const GROUND_H = 72;
const GRAVITY = 0.5;
const JUMP = -7.6;
const PIPE_W = 58;
const GAP = 138;
const SPEED = 3;
const RIM_H = 20;
const BEAN_X = 82;
const BEAN_W = 30;
const BEAN_H = 24;

type Pipe = { x: number; top: number; bottom: number; passed: boolean };

const MIN_PURCHASE = 250;
const GAME_DURATION_MS = 120000;

function scoreToDiscount(score: number): number {
  if (score >= 35) return 10;
  if (score >= 20) return 8;
  if (score >= 10) return 5;
  return 2;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBean(ctx: CanvasRenderingContext2D, y: number) {
  const cx = BEAN_X + BEAN_W / 2;
  const cy = y + BEAN_H / 2;

  ctx.fillStyle = '#4A3525';
  ctx.beginPath();
  ctx.ellipse(cx, cy, BEAN_W / 2, BEAN_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#2f2115';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - BEAN_H / 2 + 2);
  ctx.quadraticCurveTo(cx + 5, cy, cx, cy + BEAN_H / 2 - 2);
  ctx.stroke();

  ctx.fillStyle = '#6b4a2f';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 3, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawPipe(ctx: CanvasRenderingContext2D, p: Pipe) {
  const bodyColor = '#8b5e3c';
  const rimColor = '#5b3a1e';
  const floorY = CANVAS_H - GROUND_H;

  // tubería superior
  ctx.fillStyle = bodyColor;
  ctx.fillRect(p.x, 0, PIPE_W, p.top - RIM_H);
  ctx.fillStyle = rimColor;
  roundRect(ctx, p.x - 4, p.top - RIM_H, PIPE_W + 8, RIM_H, 6);
  ctx.fill();

  // tubería inferior
  const bottomTop = floorY - p.bottom;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(p.x, bottomTop + RIM_H, PIPE_W, p.bottom - RIM_H);
  ctx.fillStyle = rimColor;
  roundRect(ctx, p.x - 4, bottomTop, PIPE_W + 8, RIM_H, 6);
  ctx.fill();
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  pipes: Pipe[],
  beanY: number,
  score: number,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#f8f1e7');
  grad.addColorStop(1, '#efe0cb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (const p of pipes) drawPipe(ctx, p);

  // suelo
  const floorY = CANVAS_H - GROUND_H;
  ctx.fillStyle = '#7a5436';
  ctx.fillRect(0, floorY, CANVAS_W, GROUND_H);
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(0, floorY, CANVAS_W, 6);

  drawBean(ctx, beanY);

  // marcador
  ctx.fillStyle = '#3b2a1a';
  ctx.font = '700 32px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(score), CANVAS_W / 2, 18);
}

export default function GranoVoladorGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [score, setScore] = useState(0);
  const [discount, setDiscount] = useState<{ pct: number; code: string; totalPct: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { canPlay, accumulatedPct, awardWin } = usePromoLimit();

  const beanYRef = useRef(150);
  const velocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const framesRef = useRef(0);
  const scoreRef = useRef(0);
  const statusRef = useRef<Status>('idle');
  const startTimeRef = useRef(0);
  statusRef.current = status;

  const startGame = () => {
    if (!canPlay) return;
    track('play_game', { game: 'grano_volador' });
    beanYRef.current = 150;
    velocityRef.current = 0;
    pipesRef.current = [];
    framesRef.current = 0;
    scoreRef.current = 0;
    startTimeRef.current = performance.now();
    setScore(0);
    setDiscount(null);
    setCopied(false);
    setStatus('playing');
  };

  const jump = () => {
    if (statusRef.current === 'playing') {
      velocityRef.current = JUMP;
    }
  };

  useEffect(() => {
    if (status !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (now - startTimeRef.current >= GAME_DURATION_MS) {
        finish();
        return;
      }

      framesRef.current += 1;

      if (framesRef.current % 75 === 0) {
        const minTop = 60;
        const maxTop = CANVAS_H - GROUND_H - GAP - 60;
        const top = minTop + Math.random() * (maxTop - minTop);
        pipesRef.current.push({
          x: CANVAS_W,
          top,
          bottom: CANVAS_H - GROUND_H - GAP - top,
          passed: false,
        });
      }

      velocityRef.current += GRAVITY;
      beanYRef.current += velocityRef.current;

      const beanY = beanYRef.current;
      const floorY = CANVAS_H - GROUND_H;
      let reset = false;
      if (beanY + BEAN_H >= floorY || beanY <= 0) {
        reset = true;
      }

      const remaining: Pipe[] = [];
      for (const p of pipesRef.current) {
        p.x -= SPEED;

        const hitX = BEAN_X + BEAN_W > p.x && BEAN_X < p.x + PIPE_W;
        const hitY = beanY < p.top || beanY + BEAN_H > floorY - p.bottom;
        if (hitX && hitY) {
          reset = true;
          break;
        }

        if (p.x + PIPE_W < BEAN_X && !p.passed) {
          p.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
        }

        if (p.x + PIPE_W > 0) remaining.push(p);
      }

      if (reset) {
        beanYRef.current = 150;
        velocityRef.current = 0;
        pipesRef.current = [];
      } else {
        pipesRef.current = remaining;
      }

      drawScene(ctx, pipesRef.current, beanY, scoreRef.current);
      raf = requestAnimationFrame(loop);
    };

    const finish = () => {
      cancelAnimationFrame(raf);
      const { wonPct, totalPct, code } = awardWin(scoreToDiscount(scoreRef.current));
      // Sin el código: es un cupón canjeable, no debe salir a analítica.
      track('claim_promo', { game: 'grano_volador', score: scoreRef.current, won_pct: wonPct, total_pct: totalPct });
      setDiscount({ pct: wonPct, code, totalPct });
      setStatus('gameover');
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  useEffect(() => {
    if (status !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status]);

  const copyCode = async () => {
    if (!discount) return;
    try {
      await navigator.clipboard.writeText(discount.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl bg-background-50 border border-background-200/70 p-5 md:p-6">
      <div className="text-center mb-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-100 text-accent-800 text-xs font-semibold px-4 py-1.5 whitespace-nowrap">
          <i className="ri-gift-2-fill"></i>
          Premio Cocinarte
        </span>
        <h2 className="mt-3 font-heading font-extrabold text-2xl text-foreground-950">
          El Grano Volador
        </h2>
        <p className="mt-2 text-sm text-foreground-600">
          Haz saltar al grano de café entre las tazas y gana un descuento según tu puntuación
          (entre 2% y 10%) en tu siguiente compra. Acumulable hasta un máximo de 10% por mes.
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={jump}
          className="w-full h-auto rounded-xl touch-none cursor-pointer"
        />

        {status !== 'playing' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background-50/85 backdrop-blur-sm">
            <div className="text-center px-6">
              {status === 'idle' ? (
                canPlay ? (
                  <>
                    <div className="text-5xl mb-4">☕</div>
                    <h3 className="font-heading font-bold text-2xl text-foreground-950">
                      ¿Juegas por tu descuento?
                    </h3>
                    <p className="mt-2 text-sm text-foreground-600">
                      Haz clic o presiona espacio para saltar. Evita chocar con las tazas.
                    </p>
                    <button
                      onClick={startGame}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-500 text-foreground-950 font-semibold text-sm px-8 py-3.5 whitespace-nowrap cursor-pointer hover:bg-accent-600 transition-colors"
                    >
                      <i className="ri-play-fill"></i>
                      Jugar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-4">⏳</div>
                    <h3 className="font-heading font-bold text-2xl text-foreground-950">
                      Ya alcanzaste tu descuento máximo de 10%
                    </h3>
                    <p className="mt-2 text-sm text-foreground-600">
                      Este mes ya acumulaste el tope de 10%. Vuelve el mes que viene para ganar una nueva promoción.
                    </p>
                  </>
                )
              ) : (
                <>
                  <div className="text-5xl mb-3">🎉</div>
                  <h3 className="font-heading font-extrabold text-2xl text-foreground-950">
                    ¡Ganaste {discount?.pct}% de descuento!
                  </h3>
                  <p className="mt-1 text-xs text-foreground-500">
                    Puntuación: {score} tazas · Descuento según puntuación
                  </p>
                  <p className="mt-2 text-xs font-semibold text-foreground-700">
                    Acumulado este mes: {discount?.totalPct}% (máximo 10%)
                  </p>

                  <div className="mt-4 rounded-xl bg-background-100 border border-dashed border-accent-400 p-4">
                    <p className="text-xs text-foreground-500">Tu código de descuento</p>
                    <p className="font-heading font-extrabold text-2xl tracking-widest text-primary-600 mt-1">
                      {discount?.code}
                    </p>
                    <p className="mt-2 text-xs text-foreground-600">
                      Aplica en tu siguiente compra con un mínimo de ${MIN_PURCHASE}.
                    </p>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      onClick={copyCode}
                      className="inline-flex items-center gap-2 rounded-full bg-primary-500 text-background-50 font-semibold text-sm px-6 py-3 whitespace-nowrap cursor-pointer hover:bg-primary-600 transition-colors"
                    >
                      <i className={copied ? 'ri-check-line' : 'ri-file-copy-line'}></i>
                      {copied ? 'Copiado' : 'Copiar código'}
                    </button>
                    <button
                      onClick={startGame}
                      disabled={!canPlay}
                      className={`inline-flex items-center gap-2 rounded-full font-semibold text-sm px-6 py-3 whitespace-nowrap transition-colors ${
                        canPlay
                          ? 'bg-background-100 text-foreground-700 cursor-pointer hover:bg-background-200'
                          : 'bg-background-100 text-foreground-300 cursor-not-allowed'
                      }`}
                    >
                      <i className="ri-refresh-line"></i>
                      {canPlay ? 'Jugar otra vez' : 'Límite alcanzado'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl bg-background-100 border border-background-200/70 p-4">
        <p className="text-center text-xs font-semibold text-foreground-700 mb-3">
          Metas de puntuación (tazas) · Descuento
        </p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">0–9</p>
            <p className="text-xs font-semibold text-accent-600">2%</p>
          </div>
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">10–19</p>
            <p className="text-xs font-semibold text-accent-600">5%</p>
          </div>
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">20–34</p>
            <p className="text-xs font-semibold text-accent-600">8%</p>
          </div>
          <div className="rounded-lg bg-accent-100 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">35+</p>
            <p className="text-xs font-extrabold text-accent-700">10%</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-foreground-500">
        Descuento acumulado este mes: {accumulatedPct}% (máximo 10%) · Válido en compras de ${MIN_PURCHASE} o más.
        Se reinicia el mes siguiente.
      </p>
    </div>
  );
}