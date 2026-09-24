import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { usePromoLimit } from '@/hooks/usePromoLimit';
import { track } from '@/lib/analytics';

type Status = 'idle' | 'playing' | 'gameover';

const CANVAS_W = 360;
const CANVAS_H = 520;
const CUP_W = 62;
const CUP_H = 46;
const CUP_Y = CANVAS_H - 80;
const DROP_R = 9;
const GAME_DURATION_MS = 120000;
const MIN_PURCHASE = 250;

function scoreToDiscount(score: number): number {
  if (score >= 300) return 10;
  if (score >= 150) return 8;
  if (score >= 50) return 5;
  return 2;
}

type Drop = { x: number; y: number; r: number; type: 'coffee' | 'bad' };

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

function drawCup(ctx: CanvasRenderingContext2D, x: number) {
  const y = CUP_Y;

  // asa
  ctx.fillStyle = '#d9c9b8';
  roundRect(ctx, x + CUP_W, y + 10, 12, 22, 5);
  ctx.fill();

  // cuerpo de la taza
  ctx.fillStyle = '#f7f1e8';
  roundRect(ctx, x, y, CUP_W, CUP_H, 8);
  ctx.fill();

  // espresso dentro
  ctx.fillStyle = '#4A3525';
  roundRect(ctx, x + 6, y + 6, CUP_W - 12, 9, 3);
  ctx.fill();

  // contorno
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 3;
  roundRect(ctx, x - 2, y - 2, CUP_W + 4, CUP_H + 4, 9);
  ctx.stroke();
}

function drawDrop(ctx: CanvasRenderingContext2D, d: Drop) {
  ctx.fillStyle = d.type === 'coffee' ? '#4A3525' : '#c0392b';
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  ctx.fill();
}

export default function LluviaEspressoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [score, setScore] = useState(0);
  const [discount, setDiscount] = useState<{ pct: number; code: string; totalPct: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const { canPlay, accumulatedPct, awardWin } = usePromoLimit();

  const cupXRef = useRef(CANVAS_W / 2 - CUP_W / 2);
  const dropsRef = useRef<Drop[]>([]);
  const framesRef = useRef(0);
  const speedRef = useRef(3);
  const scoreRef = useRef(0);
  const statusRef = useRef<Status>('idle');
  const startTimeRef = useRef(0);
  statusRef.current = status;

  const startGame = () => {
    if (!canPlay) return;
    track('play_game', { game: 'lluvia_espresso' });
    cupXRef.current = CANVAS_W / 2 - CUP_W / 2;
    dropsRef.current = [];
    framesRef.current = 0;
    speedRef.current = 4.5;
    scoreRef.current = 0;
    startTimeRef.current = performance.now();
    setScore(0);
    setDiscount(null);
    setCopied(false);
    setStatus('playing');
  };

  useEffect(() => {
    if (status !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let lastTime = performance.now();

    const finish = () => {
      cancelAnimationFrame(raf);
      const { wonPct, totalPct, code } = awardWin(scoreToDiscount(scoreRef.current));
      // Sin el código: es un cupón canjeable, no debe salir a analítica.
      track('claim_promo', { game: 'lluvia_espresso', score: scoreRef.current, won_pct: wonPct, total_pct: totalPct });
      setDiscount({ pct: wonPct, code, totalPct });
      setStatus('gameover');
    };

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (now - startTimeRef.current >= GAME_DURATION_MS) {
        finish();
        return;
      }

      framesRef.current += 1;

      const spawnRate = Math.max(12, 40 - Math.floor(framesRef.current / 90));
      if (framesRef.current % spawnRate === 0) {
        const isBad = Math.random() < 0.22;
        dropsRef.current.push({
          x: Math.random() * (CANVAS_W - 30) + 15,
          y: -12,
          r: DROP_R,
          type: isBad ? 'bad' : 'coffee',
        });
      }

      const cupX = cupXRef.current;
      const remaining: Drop[] = [];

      for (const d of dropsRef.current) {
        d.y += speedRef.current;

        const hitX = d.x + d.r > cupX && d.x - d.r < cupX + CUP_W;
        const hitY = d.y + d.r > CUP_Y && d.y - d.r < CUP_Y + CUP_H;

        if (hitX && hitY) {
          if (d.type === 'coffee') {
            scoreRef.current += 10;
            setScore(scoreRef.current);
            if (scoreRef.current % 100 === 0) speedRef.current += 0.6;
          } else {
            finish();
            return;
          }
          continue;
        }

        if (d.y - d.r > CANVAS_H) {
          if (d.type === 'coffee' && scoreRef.current > 0) {
            scoreRef.current = Math.max(0, scoreRef.current - 5);
            setScore(scoreRef.current);
          }
          continue;
        }

        remaining.push(d);
      }

      dropsRef.current = remaining;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#f8f1e7');
      grad.addColorStop(1, '#efe0cb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      for (const d of dropsRef.current) drawDrop(ctx, d);
      drawCup(ctx, cupX);

      ctx.fillStyle = '#3b2a1a';
      ctx.font = '700 32px ui-sans-serif, system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(scoreRef.current), CANVAS_W / 2, 18);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const moveCup = (e: PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = CANVAS_W / rect.width;
    const x = (e.clientX - rect.left) * scale - CUP_W / 2;
    cupXRef.current = Math.max(0, Math.min(CANVAS_W - CUP_W, x));
  };

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
          <i className="ri-cup-fill"></i>
          Premio Cocinarte
        </span>
        <h2 className="mt-3 font-heading font-extrabold text-2xl text-foreground-950">
          Lluvia de Espresso
        </h2>
        <p className="mt-2 text-sm text-foreground-600">
          Mueve tu taza para atrapar las gotas de espresso y gana un descuento según tu puntuación
          (entre 2% y 10%) por victoria. Acumulable hasta un máximo de 10% por mes. ¡Evita las gotas rojas!
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerMove={moveCup}
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
                      Mueve el cursor (o el dedo) para mover la taza y atrapar las gotas de café.
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
                  <p className="mt-1 text-xs text-foreground-500">Puntuación: {score} · Descuento según puntuación</p>
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
          Metas de puntuación (puntos) · Descuento
        </p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">0–49</p>
            <p className="text-xs font-semibold text-accent-600">2%</p>
          </div>
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">50–149</p>
            <p className="text-xs font-semibold text-accent-600">5%</p>
          </div>
          <div className="rounded-lg bg-background-50 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">150–299</p>
            <p className="text-xs font-semibold text-accent-600">8%</p>
          </div>
          <div className="rounded-lg bg-accent-100 px-2 py-2.5">
            <p className="font-heading font-bold text-sm text-foreground-950">300+</p>
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