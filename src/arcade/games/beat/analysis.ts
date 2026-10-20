// Analyse d'une musique importée pour Beat Drop (exécutée une seule fois, dans l'admin, à l'import).
// 1. Enveloppes d'attaque par bande de fréquences (flux spectral) : basses (grosse caisse, basse),
//    médiums graves et aigus (voix, instruments), aigus (caisse claire, charleston).
// 2. Tempo et position du premier temps (autocorrélation puis peigne de temps).
// 3. Grille de doubles croches calée sur le tempo : chaque case reçoit la force de chaque bande.
// 4. Partitions FACILE, MOYEN, DIFFICILE : les cases les plus fortes, avec la même densité que les morceaux
//    de synthèse et sous le plafond de score du niveau. Aucune dépendance au navigateur : testable en Node.
import {
  BEAT_DIFFICULTIES,
  BEAT_MS,
  beatMaxScore,
  comboMultiplier,
  END_MARGIN_MS,
  judgementCount,
  MIN_LANE_GAP_MS,
  sanitizeBeatmap,
  type BeatDifficulty,
  type BeatNote,
} from './songs';

/** Fenêtre d'analyse de +/ 23 ms, quelle que soit la fréquence d'échantillonnage. */
const fftSizeFor = (sampleRate: number) => (sampleRate > 32000 ? 1024 : 512);
const HOP_SEC = 0.01;
/** Bornes des bandes (Hz). */
const BANDS = { low: [30, 160], midLow: [160, 700], midHigh: [700, 3000], high: [4000, 12000] } as const;
type Band = keyof typeof BANDS;
const BAND_KEYS = Object.keys(BANDS) as Band[];

export interface Envelopes {
  hopSec: number;
  /** Décalage (s) entre le début d'une trame et l'instant de l'attaque qu'elle détecte. */
  frameDelaySec: number;
  bands: Record<Band, Float32Array>;
  /** Énergie (RMS) par trame, pour repérer les sons tenus. */
  rms: Float32Array;
}

/** Mélange les canaux en mono. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  return out;
}

/** FFT réelle (radix 2, en place sur re / im). */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k];
        const ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Array.from(values).filter((v) => v > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] || 1;
}

/** Enveloppes d'attaque normalisées (+/ 1 pour une attaque franche) par bande. */
export function onsetEnvelopes(mono: Float32Array, sampleRate: number): Envelopes {
  const FFT_SIZE = fftSizeFor(sampleRate);
  const hop = Math.max(1, Math.round(sampleRate * HOP_SEC));
  const frames = Math.max(0, Math.floor((mono.length - FFT_SIZE) / hop) + 1);
  const window = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
  const binOf = (hz: number) => Math.max(1, Math.min(FFT_SIZE / 2 - 1, Math.round((hz * FFT_SIZE) / sampleRate)));
  const ranges = BAND_KEYS.map((b) => [binOf(BANDS[b][0]), binOf(BANDS[b][1])] as const);
  const bands = Object.fromEntries(BAND_KEYS.map((b) => [b, new Float32Array(frames)])) as Record<Band, Float32Array>;
  const rms = new Float32Array(frames);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  let prev = new Float64Array(FFT_SIZE / 2);
  let cur = new Float64Array(FFT_SIZE / 2);

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    let e = 0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const v = mono[off + i];
      e += v * v;
      re[i] = v * window[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(e / FFT_SIZE);
    fft(re, im);
    for (let k = 1; k < FFT_SIZE / 2; k++) cur[k] = Math.log1p(1000 * Math.hypot(re[k], im[k]));
    BAND_KEYS.forEach((b, bi) => {
      const [k0, k1] = ranges[bi];
      let flux = 0;
      for (let k = k0; k <= k1; k++) {
        const d = cur[k] - prev[k];
        if (d > 0) flux += d;
      }
      bands[b][f] = f === 0 ? 0 : flux / (k1 - k0 + 1);
    });
    [prev, cur] = [cur, prev];
  }

  // Seules les montées comptent : on retire la moyenne locale (+/ 0,3 s), puis on normalise par bande.
  for (const b of BAND_KEYS) {
    const env = bands[b];
    const out = new Float32Array(frames);
    const w = 15;
    let sum = 0;
    for (let i = 0; i < Math.min(frames, w); i++) sum += env[i];
    for (let i = 0; i < frames; i++) {
      if (i + w < frames) sum += env[i + w];
      if (i - w - 1 >= 0) sum -= env[i - w - 1];
      const count = Math.min(frames - 1, i + w) - Math.max(0, i - w) + 1;
      out[i] = Math.max(0, env[i] - sum / count);
    }
    const norm = percentile(out, 0.985);
    for (let i = 0; i < frames; i++) out[i] = Math.min(2, out[i] / norm);
    bands[b] = out;
  }
  // L'attaque est repérée au milieu de la fenêtre d'analyse, avec +/ 4 ms d'avance mesurés sur des sons de test.
  return { hopSec: hop / sampleRate, frameDelaySec: FFT_SIZE / 2 / sampleRate + 0.004, bands, rms };
}

/** Enveloppe globale servant au tempo. */
function combined(env: Envelopes): Float32Array {
  const n = env.rms.length;
  const out = new Float32Array(n);
  const { low, midLow, midHigh, high } = env.bands;
  for (let i = 0; i < n; i++) out[i] = 1.2 * low[i] + midLow[i] + midHigh[i] + 0.7 * high[i];
  return out;
}

/** Valeur interpolée d'une enveloppe à un instant (s). */
function at(arr: Float32Array, env: Envelopes, sec: number): number {
  const x = (sec - env.frameDelaySec) / env.hopSec;
  const i = Math.floor(x);
  if (i < 0 || i + 1 >= arr.length) return 0;
  const f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

/** Maximum d'une enveloppe autour d'un instant (fenêtre en s). */
function peakNear(arr: Float32Array, env: Envelopes, sec: number, win: number): number {
  const a = Math.max(0, Math.floor((sec - win - env.frameDelaySec) / env.hopSec));
  const b = Math.min(arr.length - 1, Math.ceil((sec + win - env.frameDelaySec) / env.hopSec));
  let m = 0;
  for (let i = a; i <= b; i++) if (arr[i] > m) m = arr[i];
  return m;
}

export interface Tempo {
  bpm: number;
  /** Instant du premier temps (s), entre 0 et une période. */
  phaseSec: number;
  /** Netteté de la pulsation (0 à 1) : faible si le morceau n'a pas de tempo régulier. */
  confidence: number;
}

/** Tempo par autocorrélation (préférence douce autour de 120 BPM), affiné par un peigne sur toute la durée. */
export function estimateTempo(env: Envelopes): Tempo {
  const o = combined(env);
  const n = o.length;
  const durationSec = n * env.hopSec;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += o[i];
  mean /= Math.max(1, n);
  const centered = o.map((v) => v - mean);
  const lagOf = (bpm: number) => 60 / bpm / env.hopSec;
  let best = { bpm: 120, score: -Infinity };
  let energy = 0;
  for (let i = 0; i < n; i++) energy += centered[i] * centered[i];
  for (let lag = Math.floor(lagOf(200)); lag <= Math.ceil(lagOf(60)); lag++) {
    let ac = 0;
    for (let i = 0; i + lag < n; i++) ac += centered[i] * centered[i + lag];
    const bpm = 60 / (lag * env.hopSec);
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const score = (ac / Math.max(1e-9, energy)) * prior;
    if (score > best.score) best = { bpm, score };
  }

  // Peigne : tempo précis (au centième de BPM) et premier temps (à la milliseconde).
  const comb = (bpm: number, phase: number) => {
    const period = 60 / bpm;
    let s = 0;
    let count = 0;
    for (let t = phase; t < durationSec; t += period) {
      s += at(o, env, t);
      count++;
    }
    return count ? s / count : 0;
  };
  const searchPhase = (bpm: number, step: number, from = 0, to = 60 / bpm) => {
    let bp = from;
    let bs = -Infinity;
    for (let ph = from; ph < to; ph += step) {
      const s = comb(bpm, ph);
      if (s > bs) {
        bs = s;
        bp = ph;
      }
    }
    return { phase: bp, score: bs };
  };
  let top = { bpm: best.bpm, phase: 0, score: -Infinity };
  for (let bpm = best.bpm * 0.97; bpm <= best.bpm * 1.03; bpm += 0.05) {
    const r = searchPhase(bpm, 0.01);
    if (r.score > top.score) top = { bpm, phase: r.phase, score: r.score };
  }
  for (let bpm = top.bpm - 0.06; bpm <= top.bpm + 0.06; bpm += 0.01) {
    const r = searchPhase(bpm, 0.001, Math.max(0, top.phase - 0.015), top.phase + 0.015);
    if (r.score > top.score) top = { bpm, phase: r.phase, score: r.score };
  }
  // Le premier temps est le plus fort du couple (temps, contretemps) : évite une grille décalée d'une croche.
  const period = 60 / top.bpm;
  const off = comb(top.bpm, (top.phase + period / 2) % period);
  if (off > top.score) top = { ...top, phase: (top.phase + period / 2) % period, score: off };
  const avg = mean || 1;
  return {
    bpm: Math.round(top.bpm * 100) / 100,
    phaseSec: top.phase % period,
    confidence: Math.max(0, Math.min(1, (top.score / avg - 1) / 2)),
  };
}

/** Une case de la grille de doubles croches. */
export interface GridCell {
  /** Instant dans l'extrait (ms). */
  t: number;
  /** 0 : temps, 2 : croche, 1 ou 3 : double croche. */
  sub: number;
  /** Numéro de mesure (4 temps). */
  bar: number;
  low: number;
  midLow: number;
  midHigh: number;
  high: number;
  rms: number;
}

export function buildGrid(env: Envelopes, tempo: Tempo, durationMs = BEAT_MS): GridCell[] {
  const sixteenth = 60 / tempo.bpm / 4;
  const cells: GridCell[] = [];
  let maxRms = 0;
  for (let i = 0; i < env.rms.length; i++) maxRms = Math.max(maxRms, env.rms[i]);
  for (let k = 0; ; k++) {
    const sec = tempo.phaseSec + k * sixteenth;
    if (sec * 1000 >= durationMs) break;
    const win = Math.min(0.03, sixteenth * 0.4);
    cells.push({
      t: Math.round(sec * 1000),
      sub: k % 4,
      bar: Math.floor(k / 16),
      low: peakNear(env.bands.low, env, sec, win),
      midLow: peakNear(env.bands.midLow, env, sec, win),
      midHigh: peakNear(env.bands.midHigh, env, sec, win),
      high: peakNear(env.bands.high, env, sec, win),
      rms: maxRms > 0 ? at(env.rms, env, sec) / maxRms : 0,
    });
  }
  return cells;
}

/** Notes par temps, comme les morceaux de synthèse (FACILE +/ 1 note sur 1,3 temps, DIFFICILE +/ 2,3 par temps). */
const NOTES_PER_BEAT: Record<BeatDifficulty, number> = { easy: 0.75, medium: 1.55, hard: 2.3 };
/** Force minimale d'une case pour porter une note (évite les notes dans le silence). */
const MIN_STRENGTH: Record<BeatDifficulty, number> = { easy: 0.3, medium: 0.25, hard: 0.2 };
/** Écart minimal entre deux notes (en fraction de temps), toutes pistes confondues. */
const MIN_GAP_BEATS: Record<BeatDifficulty, number> = { easy: 0.95, medium: 0.45, hard: 0.24 };
/** Silence (en temps) après une note pour qu'elle devienne une note longue. */
const HOLD_GAP_BEATS: Record<BeatDifficulty, number> = { easy: 2, medium: 1.5, hard: 1.5 };

/** Nombre maximal de jugements sous le plafond de score du niveau. */
export function maxJudgements(difficulty: BeatDifficulty): number {
  const cap = beatMaxScore(difficulty);
  let total = 0;
  let j = 0;
  while (total + 100 * comboMultiplier(j) <= cap) total += 100 * comboMultiplier(j++);
  return j;
}

interface Candidate {
  cell: GridCell;
  value: number;
  lane: number;
  second: number | null;
}

function laneFor(cell: GridCell, difficulty: BeatDifficulty): { lane: number; second: number | null; value: number } {
  const w = { low: 1.1, midLow: 1, midHigh: 1, high: difficulty === 'hard' ? 0.8 : difficulty === 'medium' ? 0.55 : 0.4 };
  const scored = (['low', 'midLow', 'midHigh', 'high'] as const).map((b) => ({ b, v: cell[b] * w[b] })).sort((x, y) => y.v - x.v);
  const LANE: Record<string, number> = { low: 0, midLow: 1, midHigh: 2, high: 3 };
  // Caisse claire : attaque large (médiums aigus et aigus ensemble) sur la piste de droite.
  const snare = cell.midHigh > 0.55 && cell.high > 0.55 && cell.low < Math.max(cell.midHigh, cell.high);
  let lane = snare ? 3 : LANE[scored[0].b];
  if (difficulty === 'easy') {
    // FACILE : basses et caisse claire sur les pistes extérieures, le reste au centre, en alternant par mesure.
    const outer = lane === 0 || lane === 3;
    lane = outer ? (cell.bar % 2 === 0 ? 0 : 3) : cell.bar % 2 === 0 ? 1 : 2;
  }
  let second: number | null = null;
  if (difficulty === 'hard' && cell.sub % 2 === 0 && scored[1].v > 0.75) {
    const l2 = LANE[scored[1].b];
    if (l2 !== lane) second = l2;
  }
  const subBonus = cell.sub === 0 ? 1.25 : cell.sub === 2 ? 1 : 0.8;
  return { lane, second, value: scored[0].v * subBonus };
}

/** Partition d'un niveau à partir de la grille. */
export function buildChart(grid: GridCell[], bpm: number, difficulty: BeatDifficulty, durationMs = BEAT_MS): BeatNote[] {
  const beatMs = 60000 / bpm;
  const leadIn = Math.max(1500, beatMs * 2);
  const end = durationMs - END_MARGIN_MS;
  const allowed = (c: GridCell) => (difficulty === 'easy' ? c.sub === 0 : difficulty === 'medium' ? c.sub % 2 === 0 : true);
  const playable = grid.filter((c) => c.t >= leadIn && c.t <= end - 100);
  const beats = playable.filter((c) => c.sub === 0).length;
  const target = Math.min(maxJudgements(difficulty), Math.round(beats * NOTES_PER_BEAT[difficulty]));

  const candidates: Candidate[] = playable
    .filter(allowed)
    .map((cell) => ({ cell, ...laneFor(cell, difficulty) }))
    .filter((c) => c.value >= MIN_STRENGTH[difficulty])
    .sort((a, b) => b.value - a.value || a.cell.t - b.cell.t);

  const minGap = beatMs * MIN_GAP_BEATS[difficulty];
  const chosen: BeatNote[] = [];
  const fits = (t: number, lane: number) => {
    for (const n of chosen) {
      const dt = Math.abs(n.t - t);
      if (n.lane === lane && dt < Math.max(MIN_LANE_GAP_MS, minGap)) return false;
      // Notes simultanées autorisées en DIFFICILE seulement ; sinon écart minimal toutes pistes confondues.
      if (dt > 0 && dt < minGap) return false;
      if (dt === 0 && difficulty !== 'hard') return false;
    }
    return true;
  };
  let count = 0;
  for (const c of candidates) {
    if (count >= target) break;
    if (!fits(c.cell.t, c.lane)) continue;
    chosen.push({ t: c.cell.t, lane: c.lane, len: 0 });
    count++;
    if (c.second !== null && count < target && fits(c.cell.t, c.second)) {
      chosen.push({ t: c.cell.t, lane: c.second, len: 0 });
      count++;
    }
  }
  chosen.sort((a, b) => a.t - b.t || a.lane - b.lane);

  // Notes longues : une note suivie d'un long silence (sans autre note) alors que le son reste tenu.
  const holdGap = beatMs * HOLD_GAP_BEATS[difficulty];
  const rmsAt = (t: number) => {
    let best: GridCell | null = null;
    for (const c of grid) if (!best || Math.abs(c.t - t) < Math.abs(best.t - t)) best = c;
    return best?.rms ?? 0;
  };
  for (let i = 0; i < chosen.length; i++) {
    const n = chosen[i];
    if (i > 0 && chosen[i - 1].t === n.t) continue;
    if (i + 1 < chosen.length && chosen[i + 1].t === n.t) continue;
    const next = i + 1 < chosen.length ? chosen[i + 1].t : end;
    const gap = next - n.t;
    if (gap < holdGap) continue;
    const len = Math.min(beatMs * 2, gap - beatMs / 2);
    if (n.t + len > end) continue;
    if (rmsAt(n.t + len * 0.5) < 0.35 || rmsAt(n.t + len) < 0.25) continue;
    if (judgementCount(chosen) + 1 > maxJudgements(difficulty)) break;
    n.len = Math.round(len);
  }
  return sanitizeBeatmap(chosen);
}

export interface TrackAnalysis {
  bpm: number;
  beatPhaseMs: number;
  confidence: number;
  charts: Record<BeatDifficulty, BeatNote[]>;
}

/** Analyse complète d'un extrait (canaux PCM) : tempo, premier temps et trois partitions. */
export function analyzeTrack(channels: Float32Array[], sampleRate: number, durationMs = BEAT_MS): TrackAnalysis {
  const env = onsetEnvelopes(toMono(channels), sampleRate);
  const tempo = estimateTempo(env);
  const grid = buildGrid(env, tempo, durationMs);
  const charts = Object.fromEntries(BEAT_DIFFICULTIES.map((d) => [d, buildChart(grid, tempo.bpm, d, durationMs)])) as Record<BeatDifficulty, BeatNote[]>;
  return { bpm: tempo.bpm, beatPhaseMs: Math.round(tempo.phaseSec * 1000), confidence: tempo.confidence, charts };
}

/** Décale toutes les notes (réglage fin depuis l'admin) en restant dans les limites de la partie. */
export function shiftChart(notes: BeatNote[], deltaMs: number): BeatNote[] {
  return sanitizeBeatmap(notes.map((n) => ({ ...n, t: n.t + deltaMs })).filter((n) => n.t >= 1000));
}

/** Début d'extrait conseillé : la fenêtre de 72 secondes la plus énergique du morceau (pas de 0,5 s). */
export function suggestStart(mono: Float32Array, sampleRate: number, windowSec = BEAT_MS / 1000): number {
  const step = Math.floor(sampleRate / 2);
  const blocks: number[] = [];
  for (let i = 0; i + step <= mono.length; i += step) {
    let e = 0;
    for (let j = i; j < i + step; j += 4) e += mono[j] * mono[j];
    blocks.push(e);
  }
  const w = Math.round(windowSec * 2);
  if (blocks.length <= w) return 0;
  let sum = 0;
  for (let i = 0; i < w; i++) sum += blocks[i];
  let best = sum;
  let bestAt = 0;
  for (let i = w; i < blocks.length; i++) {
    sum += blocks[i] - blocks[i - w];
    if (sum > best) {
      best = sum;
      bestAt = i - w + 1;
    }
  }
  return bestAt / 2;
}
