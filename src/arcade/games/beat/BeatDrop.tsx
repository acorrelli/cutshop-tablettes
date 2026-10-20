// Beat Drop : autoroute néon à 4 pistes en perspective, dessinée sur canvas. Multi touch (un doigt = une piste),
// clavier D F J K pour les tests. Le morceau (synthèse ou musique importée) est calé sur l'horloge de la partie.
import { useEffect, useRef } from 'react';
import { audioContext, sfx } from '../../audio';
import type { GameProps } from '../types';
import { BeatEngine, type Judgement } from './engine';
import { loadBeatOffset } from './offset';
import { LANES, songForSeed, stepMs } from './songs';
import { BeatSynth } from './synth';
import { loadTrackBuffer, TrackPlayer } from './trackAudio';

/** Ce que l'écran pilote du son : synthétiseur ou lecteur de musique importée. */
interface Player {
  tick?: () => void;
  setVolume: (v: number) => void;
  stop: () => void;
}

const TXT = {
  fr: {
    perfect: 'PARFAIT !',
    good: 'BIEN !',
    miss: 'RATÉ',
    hold: 'TIENS',
    combo: 'COMBO',
    next: 'Prochain bonus',
    max: 'Bonus maximal',
    nowPlaying: 'EN LECTURE',
    level: { easy: 'FACILE', medium: 'MOYEN', hard: 'DIFFICILE' },
    stats: { perfect: 'Parfait', good: 'Bien', miss: 'Raté' },
    soundOff: 'Son coupé : suis la pulsation',
  },
  en: {
    perfect: 'PERFECT !',
    good: 'GOOD !',
    miss: 'MISS',
    hold: 'HOLD',
    combo: 'COMBO',
    next: 'Next bonus',
    max: 'Max bonus',
    nowPlaying: 'NOW PLAYING',
    level: { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' },
    stats: { perfect: 'Perfect', good: 'Good', miss: 'Miss' },
    soundOff: 'Sound off: follow the pulse',
  },
} as const;

const LANE_COLORS = ['#25E8FF', '#FF3FD2', '#FFC94A', '#8C6BFF'];
const MULT_COLORS = ['#25E8FF', '#25E8FF', '#5CFF9D', '#FFC94A', '#FF3FD2'];
const KEYS: Record<string, number> = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
/** Temps de descente d'une note, du fond de l'autoroute à la ligne de frappe. */
const TRAVEL_MS = { easy: 1750, medium: 1500, hard: 1300 };
const FONT = '"Arial Black", Arial, Helvetica, sans-serif';

interface Layout {
  W: number;
  H: number;
  dpr: number;
  cx: number;
  hitY: number;
  topY: number;
  vY: number;
  /** Largeur de l'autoroute à la ligne de frappe. */
  hw: number;
  K: number;
  sFar: number;
  sBottom: number;
  dBottom: number;
}

function makeLayout(W: number, H: number, dpr: number): Layout {
  const hitY = H * 0.8;
  const topY = H * 0.035;
  const K = 2.6;
  const sFar = 1 / (1 + K);
  const vY = (topY - sFar * hitY) / (1 - sFar);
  const hw = Math.min(W * 0.56, H * 1.02);
  const sBottom = (H - vY) / (hitY - vY);
  const dBottom = (1 / sBottom - 1) / K;
  return { W, H, dpr, cx: W / 2, hitY, topY, vY, hw, K, sFar, sBottom, dBottom };
}

const scaleAt = (L: Layout, d: number) => 1 / (1 + L.K * d);
const yAt = (L: Layout, s: number) => L.vY + (L.hitY - L.vY) * s;
/** u : position horizontale de -1 (bord gauche) à 1 (bord droit). */
const xAt = (L: Layout, u: number, s: number) => L.cx + (u * L.hw * s) / 2;
const laneU = (lane: number) => (lane - (LANES - 1) / 2) / (LANES / 2);

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Note pré dessinée avec son halo (le flou de halo est coûteux : on ne le calcule qu'une fois). */
const SPRITE_W = 240;
const SPRITE_H = 92;
const CAP_W = 190;
function makeNoteSprite(color: string, dpr: number, dim = false): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = SPRITE_W * dpr;
  cv.height = SPRITE_H * dpr;
  const c = cv.getContext('2d')!;
  c.scale(dpr, dpr);
  const x = (SPRITE_W - CAP_W) / 2;
  const h = 42;
  const y = (SPRITE_H - h) / 2;
  c.shadowColor = dim ? 'rgba(0,0,0,0)' : color;
  c.shadowBlur = dim ? 0 : 22;
  roundRect(c, x, y, CAP_W, h, h / 2);
  const g = c.createLinearGradient(0, y, 0, y + h);
  if (dim) {
    g.addColorStop(0, 'rgba(120,120,140,0.7)');
    g.addColorStop(1, 'rgba(60,60,80,0.7)');
  } else {
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, color);
    g.addColorStop(1, hexA(color, 0.85));
  }
  c.fillStyle = g;
  c.fill();
  c.shadowBlur = 0;
  c.lineWidth = 3;
  c.strokeStyle = dim ? 'rgba(160,160,180,0.6)' : 'rgba(255,255,255,0.9)';
  c.stroke();
  // Reflet.
  roundRect(c, x + 16, y + 7, CAP_W - 32, 8, 4);
  c.fillStyle = dim ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)';
  c.fill();
  return cv;
}

/** Calque fixe : corps de l'autoroute, pistes, rails. Recalculé au redimensionnement seulement. */
function makeStatic(L: Layout): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.round(L.W * L.dpr);
  cv.height = Math.round(L.H * L.dpr);
  const c = cv.getContext('2d')!;
  c.scale(L.dpr, L.dpr);
  const sb = L.sBottom;
  const sf = L.sFar;
  const poly = (u0: number, u1: number) => {
    c.beginPath();
    c.moveTo(xAt(L, u0, sf), L.topY);
    c.lineTo(xAt(L, u1, sf), L.topY);
    c.lineTo(xAt(L, u1, sb), L.H);
    c.lineTo(xAt(L, u0, sb), L.H);
    c.closePath();
  };
  // Halo sous l'autoroute.
  c.save();
  c.shadowColor = 'rgba(140,80,255,0.55)';
  c.shadowBlur = 50;
  poly(-1.02, 1.02);
  c.fillStyle = 'rgba(6,4,18,0.78)';
  c.fill();
  c.restore();
  poly(-1, 1);
  const body = c.createLinearGradient(0, L.topY, 0, L.H);
  body.addColorStop(0, 'rgba(14,8,40,0.55)');
  body.addColorStop(0.7, 'rgba(8,6,26,0.82)');
  body.addColorStop(1, 'rgba(4,3,14,0.92)');
  c.fillStyle = body;
  c.fill();
  // Teinte de chaque piste.
  for (let i = 0; i < LANES; i++) {
    const u0 = -1 + (2 * i) / LANES;
    poly(u0, u0 + 2 / LANES);
    const g = c.createLinearGradient(0, L.topY, 0, L.hitY);
    g.addColorStop(0, hexA(LANE_COLORS[i], 0));
    g.addColorStop(1, hexA(LANE_COLORS[i], 0.1));
    c.fillStyle = g;
    c.fill();
  }
  // Séparations.
  c.lineWidth = 1.5;
  for (let i = 1; i < LANES; i++) {
    const u = -1 + (2 * i) / LANES;
    const g = c.createLinearGradient(0, L.topY, 0, L.H);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0.08)');
    c.strokeStyle = g;
    c.beginPath();
    c.moveTo(xAt(L, u, sf), L.topY);
    c.lineTo(xAt(L, u, sb), L.H);
    c.stroke();
  }
  // Rails néon.
  for (const side of [-1, 1]) {
    const g = c.createLinearGradient(0, L.topY, 0, L.H);
    g.addColorStop(0, side < 0 ? 'rgba(37,232,255,0.1)' : 'rgba(255,63,210,0.1)');
    g.addColorStop(0.75, side < 0 ? 'rgba(37,232,255,0.95)' : 'rgba(255,63,210,0.95)');
    g.addColorStop(1, side < 0 ? 'rgba(140,107,255,0.9)' : 'rgba(140,107,255,0.9)');
    c.save();
    c.shadowColor = side < 0 ? '#25E8FF' : '#FF3FD2';
    c.shadowBlur = 16;
    c.strokeStyle = g;
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(xAt(L, side, sf), L.topY);
    c.lineTo(xAt(L, side, sb), L.H);
    c.stroke();
    c.restore();
  }
  // Fondu au loin.
  const fog = c.createLinearGradient(0, L.topY, 0, L.topY + (L.hitY - L.topY) * 0.18);
  fog.addColorStop(0, 'rgba(6,4,18,0.95)');
  fog.addColorStop(1, 'rgba(6,4,18,0)');
  poly(-1.03, 1.03);
  c.save();
  c.clip();
  c.fillStyle = fog;
  c.fillRect(0, L.topY - 2, L.W, (L.hitY - L.topY) * 0.18 + 2);
  c.restore();
  // Zone de frappe plus sombre.
  c.beginPath();
  c.moveTo(xAt(L, -1, 1.0), L.hitY);
  c.lineTo(xAt(L, 1, 1.0), L.hitY);
  c.lineTo(xAt(L, 1, sb), L.H);
  c.lineTo(xAt(L, -1, sb), L.H);
  c.closePath();
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fill();
  return cv;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Popup {
  judgement: Judgement;
  at: number;
  combo: number;
  lane: number;
}

export default function BeatDrop(props: GameProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const synthRef = useRef<Player | null>(null);
  /** Démarre le synthétiseur (au montage, ou quand le son est réactivé en cours de partie). */
  const ensureSynthRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const p = propsRef.current;
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const c = ctx2d;

    // Horloge lisse : décalage horloge serveur / performance.now() mesuré une seule fois au montage.
    const clockOffset = p.clock() - performance.now();
    const now = () => performance.now() + clockOffset;
    const eventTime = (ts: number) => {
      const perf = performance.now();
      return (Number.isFinite(ts) && ts > 0 && Math.abs(ts - perf) < 500 ? ts : perf) + clockOffset;
    };
    const startAt = p.startAt;
    const lang = p.lang === 'en' ? 'en' : 'fr';
    const T = TXT[lang];

    const engine = new BeatEngine(p.seed, p.variant, loadBeatOffset(), p.durationMs, p.track ?? null);
    engine.start(startAt);
    const song = engine.song;
    const beatMs = stepMs(song) * 4;
    root.dataset.song = song.title;
    /** Décalage du premier temps : la pulsation visuelle tombe sur les temps de la musique importée. */
    const beatPhase = (((song.beatPhaseMs ?? 0) % beatMs) + beatMs) % beatMs;
    let disposed = false;
    let loading = false;
    const travel = TRAVEL_MS[engine.difficulty];

    ensureSynthRef.current = () => {
      const snd = propsRef.current.sound;
      if (synthRef.current || !snd.on || snd.volume <= 0) return;
      if (now() > startAt + p.durationMs) return;
      const actx = audioContext();
      if (!actx) return;
      const track = engine.track;
      if (track) {
        // Musique importée : décodage asynchrone (déjà téléchargée pendant le choix du morceau, en général).
        if (loading) return;
        loading = true;
        loadTrackBuffer(actx, track.audioUrl)
          .then((buffer) => {
            loading = false;
            const cur = propsRef.current.sound;
            if (disposed || synthRef.current || !cur.on || cur.volume <= 0 || now() > startAt + p.durationMs - 1000) return;
            const player = new TrackPlayer({ ctx: actx, buffer, volume: cur.volume, startPerf: startAt - clockOffset });
            player.start();
            synthRef.current = player;
          })
          .catch(() => {
            // Pas de son (réseau) : la partie continue, les notes suivent la pulsation.
            loading = false;
            audioFailed = true;
          });
        return;
      }
      try {
        const s = new BeatSynth({ ctx: actx, song: songForSeed(engine.seed), volume: snd.volume, startPerf: startAt - clockOffset });
        s.start();
        synthRef.current = s;
      } catch {
        synthRef.current = null;
      }
    };
    let audioFailed = false;
    ensureSynthRef.current();

    // Mise en page et calques pré dessinés.
    let L = makeLayout(1280, 720, 1);
    let staticLayer: HTMLCanvasElement | null = null;
    let sprites: HTMLCanvasElement[] = [];
    let dimSprite: HTMLCanvasElement | null = null;
    const resize = () => {
      const r = root.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(320, r.width);
      const H = Math.max(240, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      L = makeLayout(W, H, dpr);
      staticLayer = makeStatic(L);
      sprites = LANE_COLORS.map((col) => makeNoteSprite(col, dpr));
      dimSprite = makeNoteSprite('#888899', dpr, true);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    // Effets visuels.
    const sparks: Spark[] = [];
    const flashes = new Array<{ at: number; j: Judgement }>(LANES).fill({ at: -1e9, j: 'good' });
    let popup: Popup | null = null;
    let multFlashAt = -1e9;
    let lastMult = 1;
    let lastScore = -1;
    let ended = false;
    let firstVisible = 0;

    const burst = (lane: number, j: Judgement) => {
      const x = xAt(L, laneU(lane), 1);
      const n = j === 'perfect' ? 18 : 10;
      for (let i = 0; i < n && sparks.length < 220; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const v = (j === 'perfect' ? 420 : 300) * (0.4 + Math.random() * 0.8);
        sparks.push({
          x: x + (Math.random() - 0.5) * L.hw * 0.08,
          y: L.hitY,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0,
          max: 0.35 + Math.random() * 0.35,
          color: j === 'perfect' && i % 3 === 0 ? '#FFFFFF' : LANE_COLORS[lane],
          size: 2 + Math.random() * 3,
        });
      }
    };

    // Entrées : chaque pointeur reste attaché à la piste où il s'est posé.
    const pointerLane = new Map<number, number>();
    const laneHolds = new Array<number>(LANES).fill(0);
    const laneOf = (clientX: number) => {
      const r = root.getBoundingClientRect();
      const x = clientX - r.left;
      const left = L.cx - L.hw / 2;
      return Math.max(0, Math.min(LANES - 1, Math.floor(((x - left) / L.hw) * LANES)));
    };
    const down = (lane: number, t: number) => {
      laneHolds[lane] += 1;
      if (t < startAt || ended) return;
      engine.press(lane, t);
    };
    const up = (lane: number, t: number) => {
      laneHolds[lane] = Math.max(0, laneHolds[lane] - 1);
      if (laneHolds[lane] === 0) engine.release(lane, t);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* capture indisponible */
      }
      if (pointerLane.has(e.pointerId)) return;
      const lane = laneOf(e.clientX);
      pointerLane.set(e.pointerId, lane);
      down(lane, eventTime(e.timeStamp));
    };
    const onPointerUp = (e: PointerEvent) => {
      const lane = pointerLane.get(e.pointerId);
      if (lane === undefined) return;
      pointerLane.delete(e.pointerId);
      up(lane, eventTime(e.timeStamp));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const lane = KEYS[e.code];
      if (lane === undefined || e.repeat) return;
      e.preventDefault();
      down(lane, eventTime(e.timeStamp));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const lane = KEYS[e.code];
      if (lane === undefined) return;
      up(lane, eventTime(e.timeStamp));
    };
    const noMenu = (e: Event) => e.preventDefault();
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('lostpointercapture', onPointerUp);
    root.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Boucle d'affichage.
    let raf = 0;
    let lastPerf = performance.now();
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const perf = performance.now();
      const dt = Math.min(0.05, (perf - lastPerf) / 1000);
      lastPerf = perf;
      const tNow = now();
      const props = propsRef.current;
      synthRef.current?.tick?.();

      if (!ended) {
        engine.update(tNow);
        for (const ev of engine.drainEvents()) {
          if (ev.judgement !== 'miss') {
            flashes[ev.lane] = { at: perf, j: ev.judgement };
            burst(ev.lane, ev.judgement);
          } else flashes[ev.lane] = { at: perf, j: 'miss' };
          popup = { judgement: ev.judgement, at: perf, combo: ev.combo, lane: ev.lane };
        }
        const mult = engine.multiplier();
        if (mult > lastMult) {
          multFlashAt = perf;
          sfx('combo', props.sound);
        }
        lastMult = mult;
        if (engine.score !== lastScore) {
          lastScore = engine.score;
          props.onLive(engine.score);
        }
        if (props.clock() >= startAt + props.durationMs) {
          ended = true;
          engine.finish(tNow);
          if (engine.score !== lastScore) props.onLive(engine.score);
          props.onEnd(engine.result());
          synthRef.current?.stop();
        }
      }

      draw(perf, tNow - startAt, dt);
    };

    const draw = (perf: number, vt: number, dt: number) => {
      const { W, H, dpr } = L;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      if (staticLayer) c.drawImage(staticLayer, 0, 0, W, H);

      const vg = vt - beatPhase;
      const phase = vg >= 0 ? (vg % beatMs) / beatMs : 1;
      const pulse = vt >= 0 ? Math.exp(-phase * 5) : 0;
      const soundOff = !propsRef.current.sound.on || propsRef.current.sound.volume <= 0 || audioFailed;

      // Lignes de temps qui défilent (pulsation visuelle, même sans le son).
      c.save();
      const k0 = Math.max(0, Math.floor((vg + L.dBottom * travel) / beatMs));
      const k1 = Math.floor((vg + travel) / beatMs);
      for (let k = k0; k <= k1; k++) {
        const d = (k * beatMs - vg) / travel;
        if (d < L.dBottom || d > 1) continue;
        const s = scaleAt(L, d);
        const y = yAt(L, s);
        const bar = k % 4 === 0;
        const fade = Math.min(1, (1 - d) * 4);
        c.strokeStyle = bar ? `rgba(200,170,255,${0.32 * fade})` : `rgba(255,255,255,${0.1 * fade})`;
        c.lineWidth = bar ? 2.5 * s : 1.2 * s;
        c.beginPath();
        c.moveTo(xAt(L, -1, s), y);
        c.lineTo(xAt(L, 1, s), y);
        c.stroke();
      }
      c.restore();

      // Faisceaux de frappe.
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let lane = 0; lane < LANES; lane++) {
        const f = flashes[lane];
        const age = (perf - f.at) / 1000;
        const held = laneHolds[lane] > 0;
        const a = f.j === 'miss' ? 0 : Math.max(0, 1 - age / 0.28) * (f.j === 'perfect' ? 1 : 0.7);
        const strength = Math.max(a, held ? 0.28 : 0);
        if (strength <= 0) continue;
        const u0 = laneU(lane) - 1 / LANES;
        const u1 = laneU(lane) + 1 / LANES;
        const sTop = scaleAt(L, 0.55);
        const yTop = yAt(L, sTop);
        const g = c.createLinearGradient(0, L.hitY, 0, yTop);
        g.addColorStop(0, hexA(LANE_COLORS[lane], 0.55 * strength));
        g.addColorStop(1, hexA(LANE_COLORS[lane], 0));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(xAt(L, u0, 1), L.hitY);
        c.lineTo(xAt(L, u1, 1), L.hitY);
        c.lineTo(xAt(L, u1, sTop), yTop);
        c.lineTo(xAt(L, u0, sTop), yTop);
        c.closePath();
        c.fill();
      }
      c.restore();

      // Notes : de la plus lointaine à la plus proche.
      const notes = engine.notes;
      while (firstVisible < notes.length) {
        const n = notes[firstVisible];
        const gone = n.t + n.len - vt < L.dBottom * travel - 200;
        const done = n.head !== null && n.head !== 'miss' && (n.len === 0 || (n.tail !== null && !n.holding));
        if (gone || (done && n.t + n.len < vt - 300)) firstVisible++;
        else break;
      }
      let last = firstVisible;
      while (last < notes.length && notes[last].t - vt <= travel) last++;
      for (let i = last - 1; i >= firstVisible; i--) {
        const n = notes[i];
        const hitDone = n.head !== null && n.head !== 'miss';
        const missed = n.head === 'miss';
        if (hitDone && n.len === 0) continue;
        if (hitDone && n.len > 0 && n.tail !== null && n.tail !== 'miss') continue;
        const u = laneU(n.lane);
        const holding = n.holding;
        const dHead = holding ? 0 : (n.t - vt) / travel;
        const dTail = (n.t + n.len - vt) / travel;
        const lw = L.hw / LANES;
        // Traînée des notes longues.
        if (n.len > 0) {
          const d0 = Math.max(L.dBottom, Math.min(1, dHead));
          const d1 = Math.max(L.dBottom, Math.min(1, dTail));
          if (d1 > d0) {
            const s0 = scaleAt(L, d0);
            const s1 = scaleAt(L, d1);
            const half = 0.26 / LANES;
            const col = LANE_COLORS[n.lane];
            const dim = missed || n.tail === 'miss';
            const g = c.createLinearGradient(0, yAt(L, s0), 0, yAt(L, s1));
            const a = dim ? 0.18 : holding ? 0.8 + 0.2 * pulse : 0.5;
            g.addColorStop(0, dim ? `rgba(130,130,150,${a})` : hexA(col, a));
            g.addColorStop(1, dim ? 'rgba(130,130,150,0.05)' : hexA(col, a * 0.35));
            c.fillStyle = g;
            c.beginPath();
            c.moveTo(xAt(L, u - half, s0), yAt(L, s0));
            c.lineTo(xAt(L, u + half, s0), yAt(L, s0));
            c.lineTo(xAt(L, u + half, s1), yAt(L, s1));
            c.lineTo(xAt(L, u - half, s1), yAt(L, s1));
            c.closePath();
            c.fill();
            if (!dim) {
              c.strokeStyle = holding ? 'rgba(255,255,255,0.9)' : hexA(col, 0.9);
              c.lineWidth = 2;
              c.beginPath();
              c.moveTo(xAt(L, u, s0), yAt(L, s0));
              c.lineTo(xAt(L, u, s1), yAt(L, s1));
              c.stroke();
            }
            // Embout de fin.
            if (dTail <= 1 && dTail >= L.dBottom) {
              const sp = dim ? dimSprite : sprites[n.lane];
              if (sp) {
                const w = lw * s1 * 0.5 * (SPRITE_W / CAP_W);
                c.globalAlpha = dim ? 0.4 : 0.85;
                c.drawImage(sp, xAt(L, u, s1) - w / 2, yAt(L, s1) - (w * SPRITE_H) / SPRITE_W / 2, w, (w * SPRITE_H) / SPRITE_W);
                c.globalAlpha = 1;
              }
            }
          }
        }
        // Attaque déjà réussie d'une note longue relâchée : il ne reste que la traînée.
        if (hitDone && !holding) continue;
        if (dHead > 1 || dHead < L.dBottom) continue;
        const s = scaleAt(L, dHead);
        const sp = missed ? dimSprite : sprites[n.lane];
        if (!sp) continue;
        const w = lw * s * 0.84 * (SPRITE_W / CAP_W);
        const h = (w * SPRITE_H) / SPRITE_W;
        c.globalAlpha = (missed ? 0.45 : 1) * Math.min(1, (1 - dHead) * 6);
        c.drawImage(sp, xAt(L, u, s) - w / 2, yAt(L, s) - h / 2, w, h);
        c.globalAlpha = 1;
      }

      // Ligne de frappe.
      c.save();
      c.shadowColor = '#FFFFFF';
      c.shadowBlur = 12 + 14 * pulse * (soundOff ? 1.6 : 1);
      c.strokeStyle = `rgba(255,255,255,${0.55 + 0.4 * pulse})`;
      c.lineWidth = 3 + (soundOff ? 2 * pulse : pulse);
      c.beginPath();
      c.moveTo(xAt(L, -1, 1), L.hitY);
      c.lineTo(xAt(L, 1, 1), L.hitY);
      c.stroke();
      c.restore();

      // Pastilles des pistes.
      const lw = L.hw / LANES;
      for (let lane = 0; lane < LANES; lane++) {
        const x = xAt(L, laneU(lane), 1);
        const rx = lw * 0.38;
        const ry = rx * 0.4;
        const col = LANE_COLORS[lane];
        const held = laneHolds[lane] > 0;
        const f = flashes[lane];
        const age = (perf - f.at) / 1000;
        const missFlash = f.j === 'miss' ? Math.max(0, 1 - age / 0.35) : 0;
        const hitFlash = f.j !== 'miss' ? Math.max(0, 1 - age / 0.2) : 0;
        c.save();
        c.beginPath();
        c.ellipse(x, L.hitY, rx, ry, 0, 0, Math.PI * 2);
        const fill = c.createRadialGradient(x, L.hitY, 0, x, L.hitY, rx);
        const inner = held ? 0.45 : 0.12 + 0.1 * pulse;
        fill.addColorStop(0, hexA(col, inner + 0.4 * hitFlash));
        fill.addColorStop(1, hexA(col, 0.04));
        c.fillStyle = fill;
        c.fill();
        c.shadowColor = missFlash > 0 ? '#FF3355' : col;
        c.shadowBlur = 14 + 18 * Math.max(hitFlash, held ? 0.6 : 0, 0.5 * pulse);
        c.lineWidth = 4 + 2 * hitFlash;
        c.strokeStyle = missFlash > 0 ? `rgba(255,60,90,${0.6 + 0.4 * missFlash})` : held ? '#FFFFFF' : col;
        c.stroke();
        c.restore();
        if (held && engine.notes.some((n) => n.holding && n.lane === lane)) {
          c.font = `900 ${Math.round(lw * 0.13)}px ${FONT}`;
          c.textAlign = 'center';
          c.fillStyle = `rgba(255,255,255,${0.7 + 0.3 * pulse})`;
          c.fillText(T.hold, x, L.hitY - ry - 10);
        }
      }

      // Étincelles.
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life += dt;
        if (sp.life >= sp.max) {
          sparks.splice(i, 1);
          continue;
        }
        sp.vy += 700 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        const a = 1 - sp.life / sp.max;
        c.fillStyle = hexA(sp.color.startsWith('#') ? sp.color : '#FFFFFF', a);
        c.beginPath();
        c.arc(sp.x, sp.y, sp.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        c.fill();
      }
      c.restore();

      // Texte de jugement.
      if (popup) {
        const age = (perf - popup.at) / 1000;
        if (age > 0.75) popup = null;
        else {
          const pop = age < 0.09 ? 1.35 - (age / 0.09) * 0.35 : 1;
          const alpha = age > 0.5 ? 1 - (age - 0.5) / 0.25 : 1;
          const size = Math.round(Math.min(L.H * 0.085, L.hw * 0.11) * pop);
          const y = L.hitY - L.H * 0.2 - age * 18;
          const label = popup.judgement === 'perfect' ? T.perfect : popup.judgement === 'good' ? T.good : T.miss;
          c.save();
          c.globalAlpha = alpha;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = `italic 900 ${size}px ${FONT}`;
          const g = c.createLinearGradient(0, y - size / 2, 0, y + size / 2);
          if (popup.judgement === 'perfect') {
            g.addColorStop(0, '#FFF7C2');
            g.addColorStop(0.5, '#FFD45A');
            g.addColorStop(1, '#FF9F2E');
          } else if (popup.judgement === 'good') {
            g.addColorStop(0, '#E6FDFF');
            g.addColorStop(1, '#25E8FF');
          } else {
            g.addColorStop(0, '#FFB3C0');
            g.addColorStop(1, '#FF3355');
          }
          c.lineWidth = Math.max(4, size * 0.1);
          c.strokeStyle = 'rgba(10,4,24,0.9)';
          c.lineJoin = 'round';
          c.strokeText(label, L.cx, y);
          c.shadowColor = popup.judgement === 'perfect' ? '#FFB020' : popup.judgement === 'good' ? '#25E8FF' : '#FF3355';
          c.shadowBlur = 24;
          c.fillStyle = g;
          c.fillText(label, L.cx, y);
          if (popup.judgement !== 'miss' && popup.combo >= 2) {
            c.shadowBlur = 12;
            c.shadowColor = '#FF3FD2';
            const s2 = Math.round(size * 0.42);
            c.font = `italic 900 ${s2}px ${FONT}`;
            c.strokeStyle = 'rgba(10,4,24,0.9)';
            c.lineWidth = Math.max(3, s2 * 0.12);
            const t2 = `${T.combo} ${popup.combo}`;
            c.strokeText(t2, L.cx, y + size * 0.78);
            c.fillStyle = '#FFFFFF';
            c.fillText(t2, L.cx, y + size * 0.78);
          }
          c.restore();
        }
      }

      drawPanels(perf, pulse, soundOff);
    };

    const drawPanels = (perf: number, pulse: number, soundOff: boolean) => {
      const { W, H } = L;
      const gap = Math.max(18, W * 0.02);
      const y0 = H * 0.2;
      const ph = Math.min(250, H * 0.36);
      // Largeur de l'autoroute au bas des panneaux (la perspective l'élargit vers le bas).
      const sPanel = (y0 + ph - L.vY) / (L.hitY - L.vY);
      const right = L.cx + (L.hw * sPanel) / 2 + gap;
      const sideW = Math.min(250, W - right - gap);
      const left = L.cx - (L.hw * sPanel) / 2 - gap - sideW;
      if (sideW < 130) return;
      const mult = engine.multiplier();
      const mcol = MULT_COLORS[mult] ?? '#25E8FF';
      const flash = Math.max(0, 1 - (perf - multFlashAt) / 600);

      // Combo et multiplicateur (à droite).
      c.save();
      roundRect(c, right, y0, sideW, ph, 22);
      c.fillStyle = 'rgba(8,6,24,0.72)';
      c.fill();
      c.shadowColor = mcol;
      c.shadowBlur = 18 + 24 * flash;
      c.lineWidth = 3;
      c.strokeStyle = hexA(mcol, 0.85);
      c.stroke();
      c.restore();
      c.save();
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const mx = right + sideW / 2;
      c.font = `900 ${Math.round(ph * 0.08)}px ${FONT}`;
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillText(T.combo, mx, y0 + ph * 0.13);
      c.font = `900 ${Math.round(ph * 0.22)}px ${FONT}`;
      c.fillStyle = '#FFFFFF';
      c.fillText(String(engine.combo), mx, y0 + ph * 0.32);
      c.font = `italic 900 ${Math.round(ph * (0.26 + 0.06 * flash))}px ${FONT}`;
      c.shadowColor = mcol;
      c.shadowBlur = 20;
      c.fillStyle = mcol;
      c.fillText(`x${mult}`, mx, y0 + ph * 0.6);
      c.shadowBlur = 0;
      // Progression vers le multiplicateur suivant.
      const bx = right + sideW * 0.14;
      const bw = sideW * 0.72;
      const by = y0 + ph * 0.8;
      roundRect(c, bx, by, bw, 10, 5);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fill();
      const prog = mult >= 4 ? 1 : (engine.combo % 10) / 10;
      if (prog > 0) {
        roundRect(c, bx, by, Math.max(10, bw * prog), 10, 5);
        c.fillStyle = mcol;
        c.fill();
      }
      c.font = `700 ${Math.round(ph * 0.055)}px Arial, sans-serif`;
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillText(mult >= 4 ? T.max : T.next, mx, by + 26);
      c.restore();

      // Morceau, niveau et compteurs (à gauche).
      c.save();
      roundRect(c, left, y0, sideW, ph, 22);
      c.fillStyle = 'rgba(8,6,24,0.72)';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(140,107,255,0.6)';
      c.stroke();
      const px = left + 20;
      const maxW = sideW - 40;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.font = `700 ${Math.round(ph * 0.05)}px Arial, sans-serif`;
      c.fillStyle = `hsla(${song.hue},100%,75%,${0.75 + 0.25 * pulse})`;
      c.fillText(`♪ ${T.nowPlaying}`, px, y0 + ph * 0.11, maxW);
      c.font = `900 ${Math.round(ph * 0.1)}px ${FONT}`;
      c.fillStyle = '#FFFFFF';
      c.fillText(song.title.toUpperCase(), px, y0 + ph * 0.24, maxW);
      c.font = `400 ${Math.round(ph * 0.058)}px Arial, sans-serif`;
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillText(song.artist, px, y0 + ph * 0.35, maxW);
      // Badge de niveau.
      const lvl = T.level[engine.difficulty];
      c.font = `900 ${Math.round(ph * 0.055)}px ${FONT}`;
      const bwid = c.measureText(lvl).width + 24;
      roundRect(c, px, y0 + ph * 0.43, bwid, ph * 0.1, ph * 0.05);
      c.fillStyle = 'rgba(212,168,75,0.18)';
      c.fill();
      c.strokeStyle = '#D4A84B';
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#EBCB85';
      c.fillText(lvl, px + 12, y0 + ph * 0.48);
      const rows: [string, number, string][] = [
        [T.stats.perfect, engine.counts.perfect, '#FFD45A'],
        [T.stats.good, engine.counts.good, '#25E8FF'],
        [T.stats.miss, engine.counts.miss, '#FF5470'],
      ];
      rows.forEach(([label, v, col], i) => {
        const y = y0 + ph * (0.65 + i * 0.11);
        c.font = `700 ${Math.round(ph * 0.062)}px Arial, sans-serif`;
        c.fillStyle = col;
        c.textAlign = 'left';
        c.fillText(label, px, y);
        c.textAlign = 'right';
        c.font = `900 ${Math.round(ph * 0.066)}px ${FONT}`;
        c.fillStyle = '#FFFFFF';
        c.fillText(String(v), left + sideW - 20, y);
      });
      c.restore();

      if (soundOff) {
        c.save();
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const sy = y0 + ph + 34;
        c.font = `700 ${Math.round(Math.min(18, sideW * 0.075))}px Arial, sans-serif`;
        c.fillStyle = `rgba(255,255,255,${0.55 + 0.45 * pulse})`;
        c.fillText(T.soundOff, left + sideW / 2, sy, sideW);
        c.shadowColor = '#FF3FD2';
        c.shadowBlur = 18 * pulse;
        c.lineWidth = 3;
        c.strokeStyle = `rgba(255,63,210,${0.35 + 0.6 * pulse})`;
        c.beginPath();
        c.arc(left + sideW / 2, sy + 40, 12 + 12 * (1 - pulse), 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = `rgba(255,63,210,${0.4 + 0.6 * pulse})`;
        c.beginPath();
        c.arc(left + sideW / 2, sy + 40, 7, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerUp);
      root.removeEventListener('lostpointercapture', onPointerUp);
      root.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      disposed = true;
      synthRef.current?.stop();
      synthRef.current = null;
      ensureSynthRef.current = () => undefined;
      engine.dispose();
    };
    // Une partie = une graine, une variante, un départ : le reste est lu via propsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.seed, props.variant, props.startAt, props.durationMs, props.track]);

  // Son activé, coupé ou volume changé en cours de partie.
  useEffect(() => {
    const s = synthRef.current;
    if (s) s.setVolume(props.sound.on ? props.sound.volume : 0);
    else if (props.sound.on) ensureSynthRef.current();
  }, [props.sound.on, props.sound.volume]);

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden select-none touch-none" data-testid="beat-root">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
