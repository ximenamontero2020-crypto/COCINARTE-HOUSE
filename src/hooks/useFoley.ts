// Motor de sonidos de foley (Web Audio API)
// Sintetiza sonidos "realistas" de comida: crujido, apretón cremoso,
// glug de líquido, tintineo de taza, fizz, etc. sin depender de archivos externos.

export type FoleyType =
  | 'touch'
  | 'squeeze'
  | 'move'
  | 'crunch'
  | 'breadCut'
  | 'glug'
  | 'clink'
  | 'fizz'
  | 'hover'
  | 'success';

let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

function getNoise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 1.5);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuf;
}

// Toque suave / pulsación sobre el alimento
function playTouch(ac: AudioContext) {
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 1;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.1, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  src.connect(bp);
  bp.connect(ng);
  ng.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.1);
}

// Apretón esponjoso / cremoso (presión que se hunde)
function playSqueeze(ac: AudioContext) {
  const now = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.setValueAtTime(1300, now);
  bp.frequency.exponentialRampToValueAtTime(240, now + 0.35);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.3, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  src.connect(bp);
  bp.connect(g);
  g.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.5);

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.22, now);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  osc.connect(og);
  og.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.45);
}

// Crujido seco (galleta, pan tostado)
function playCrunch(ac: AudioContext) {
  const now = ac.currentTime;
  const times = [0, 0.06, 0.13, 0.2, 0.28];
  times.forEach((t) => {
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, now + t);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(ac.destination);
    src.start(now + t);
    src.stop(now + t + 0.06);
  });
}

// Pan crujiente al cortarlo (corteza que se rompe + cuchillo penetrando)
function playBreadCut(ac: AudioContext) {
  const now = ac.currentTime;
  const crackTimes = [0, 0.03, 0.09, 0.16, 0.24];
  crackTimes.forEach((t, i) => {
    const src = ac.createBufferSource();
    src.buffer = getNoise(ac);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200 - i * 150;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.24 - i * 0.02, now + t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.06);
    src.connect(hp);
    hp.connect(g);
    g.connect(ac.destination);
    src.start(now + t);
    src.stop(now + t + 0.07);
  });

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(og);
  og.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Movimiento / deslizamiento (swish, agitar)
function playMove(ac: AudioContext) {
  const now = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, now);
  lp.frequency.exponentialRampToValueAtTime(400, now + 0.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.15);
  g.gain.setValueAtTime(0.22, now + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
  src.connect(lp);
  lp.connect(g);
  g.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.72);
}

// Glug de líquido (verter, agitar bebida)
function playGlug(ac: AudioContext) {
  const now = ac.currentTime;
  [0, 0.14, 0.28].forEach((t, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300 - i * 45, now + t);
    osc.frequency.exponentialRampToValueAtTime(120 - i * 20, now + t + 0.1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.2, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.14);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now + t);
    osc.stop(now + t + 0.16);
  });
}

// Tintineo de taza / cerámica
function playClink(ac: AudioContext) {
  const now = ac.currentTime;
  [1200, 1850, 2450].forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.13 - i * 0.02, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  });
}

// Hover sutil (al pasar el cursor sobre el platillo)
function playHover(ac: AudioContext) {
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(620, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.09);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

// Fizz efervescente (bebida con gas)
function playFizz(ac: AudioContext) {
  const now = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = getNoise(ac);
  src.loop = true;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3200;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.1);
  g.gain.setValueAtTime(0.12, now + 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  src.connect(hp);
  hp.connect(g);
  g.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.95);
}

function playSuccess(ac: AudioContext) {
  const now = ac.currentTime;
  const notes = [523.25, 783.99];
  notes.forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;
    const g = ac.createGain();
    const t = now + i * 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}

export function playFoley(type: FoleyType) {
  const ac = getContext();
  switch (type) {
    case 'touch':
      playTouch(ac);
      break;
    case 'squeeze':
      playSqueeze(ac);
      break;
    case 'move':
      playMove(ac);
      break;
    case 'crunch':
      playCrunch(ac);
      break;
    case 'breadCut':
      playBreadCut(ac);
      break;
    case 'glug':
      playGlug(ac);
      break;
    case 'clink':
      playClink(ac);
      break;
    case 'fizz':
      playFizz(ac);
      break;
    case 'hover':
      playHover(ac);
      break;
    case 'success':
      playSuccess(ac);
      break;
    default:
      break;
  }
}

export function useFoley() {
  return { playFoley };
}