// Synthétiseur de Beat Drop : joue en Web Audio les morceaux originaux décrits dans songs.ts (aucun fichier audio).
// Ordonnanceur à anticipation (~120 ms) calé sur l'horloge de la partie : chaque pas du morceau est programmé à
// l'instant AudioContext qui correspond à startAt + pas * durée, quelle que soit la fluidité de l'onglet.
import { songSteps, stepMs, type Song } from './songs';

const LOOKAHEAD_MS = 120;
const TIMER_MS = 25;
/** Un pas en retard de plus de 30 ms (onglet gelé) est sauté plutôt que joué à contretemps. */
const LATE_SKIP_MS = 30;

interface StepInfo {
  step: number;
  bar: number;
  s: number;
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bass: boolean;
  lead: boolean;
  drop: boolean;
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Générateur déterministe pour le bruit (aucun aléa dans le son d'une partie à l'autre). */
function noiseRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 2147483648 - 1;
  };
}

/**
 * Décalage (s) entre le temps AudioContext et performance.now() / 1000, mesuré au point d'écoute :
 * un son programmé à perf / 1000 + décalage sort du haut parleur à l'instant perf (latence de sortie comprise).
 */
export function contextOffset(ctx: AudioContext, perfNow = performance.now()): number {
  const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null;
  if (ts && ts.contextTime && ts.performanceTime && Math.abs(ts.performanceTime - perfNow) < 1000) {
    return ts.contextTime - ts.performanceTime / 1000;
  }
  const latency = Math.min(0.15, (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0);
  return ctx.currentTime - latency - perfNow / 1000;
}

export interface BeatSynthOptions {
  ctx: AudioContext;
  song: Song;
  /** Volume 0 à 1. */
  volume: number;
  /** Instant de départ du morceau, dans le domaine performance.now() (ms). */
  startPerf: number;
}

export class BeatSynth {
  private readonly ctx: AudioContext;
  private readonly song: Song;
  private readonly steps: StepInfo[];
  private readonly stepSec: number;
  private readonly startPerf: number;
  private next = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Estimation lissée de (temps AudioContext en s) moins (performance.now() en s), au point d'écoute. */
  private mapOffset: number | null = null;
  private stopped = false;

  private readonly master: GainNode;
  private readonly comp: DynamicsCompressorNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly drums: GainNode;
  private readonly padBus: GainNode;
  private readonly duck: GainNode;
  private readonly leadBus: GainNode;
  private readonly bassBus: GainNode;
  private readonly reverbSend: GainNode;
  private readonly delaySend: GainNode;
  private readonly noise: AudioBuffer;

  constructor(opts: BeatSynthOptions) {
    const ctx = opts.ctx;
    this.ctx = ctx;
    this.song = opts.song;
    this.stepSec = stepMs(opts.song) / 1000;
    this.startPerf = opts.startPerf;
    this.steps = [];
    for (const { step, bar, s, section } of songSteps(opts.song)) {
      this.steps.push({
        step,
        bar,
        s,
        kick: section.kick,
        snare: section.snare,
        hat: section.hat,
        bass: section.bass,
        lead: section.lead,
        drop: !!section.drop,
      });
    }

    // Chaîne de sortie : volume, compresseur de bus, limiteur.
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 3;
    this.comp.attack.value = 0.008;
    this.comp.release.value = 0.18;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.1;
    this.master.connect(this.comp).connect(this.limiter).connect(ctx.destination);

    this.drums = this.bus(0.9, this.master);
    this.bassBus = this.bus(0.55, this.master);
    this.duck = this.bus(1, this.master);
    this.padBus = this.bus(0.5, this.duck);
    this.leadBus = this.bus(0.42, this.master);

    // Réverbération (réponse impulsionnelle générée) et écho au temps pointé.
    const verb = ctx.createConvolver();
    verb.buffer = this.impulse(1.9);
    const verbOut = this.bus(0.28, this.master);
    this.reverbSend = this.bus(1, verb);
    verb.connect(verbOut);

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = this.stepSec * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    const delayOut = this.bus(0.3, this.master);
    this.delaySend = this.bus(1, delay);
    delay.connect(tone).connect(fb).connect(delay);
    tone.connect(delayOut);
    this.leadBus.connect(this.delaySend);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    const r = noiseRng(7);
    for (let i = 0; i < data.length; i++) data[i] = r();

    this.setVolume(opts.volume);
  }

  private bus(gain: number, to: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(to);
    return g;
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const r = noiseRng(101 + c);
      for (let i = 0; i < len; i++) d[i] = r() * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    // Courbe perceptive : un volume à 0,5 reste bien audible.
    this.master.gain.setTargetAtTime(Math.pow(v, 1.4) * 0.6, this.ctx.currentTime, 0.05);
  }

  start(): void {
    if (this.timer || this.stopped) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), TIMER_MS);
  }

  /** Appelable aussi depuis la boucle d'affichage : programme les pas des ~120 prochaines ms. */
  tick(): void {
    if (this.stopped) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
      return;
    }
    if (ctx.state !== 'running') return;
    const perfNow = performance.now();
    this.updateMapping(perfNow);
    const off = this.mapOffset ?? 0;
    const horizon = perfNow + LOOKAHEAD_MS;
    while (this.next < this.steps.length) {
      const st = this.steps[this.next];
      const at = this.startPerf + st.step * this.stepSec * 1000;
      if (at > horizon) break;
      this.next++;
      if (at < perfNow - LATE_SKIP_MS) continue;
      this.playStep(st, Math.max(ctx.currentTime, at / 1000 + off));
    }
  }

  /**
   * Correspondance performance.now() vers temps AudioContext. getOutputTimestamp tient compte de la latence de sortie ;
   * l'estimation est lissée (dérive lente) mais recalée d'un coup après une suspension ou un gel de l'onglet.
   */
  private updateMapping(perfNow: number): void {
    const raw = contextOffset(this.ctx, perfNow);
    if (this.mapOffset === null || Math.abs(raw - this.mapOffset) > 0.04) this.mapOffset = raw;
    else this.mapOffset += (raw - this.mapOffset) * 0.05;
  }

  private playStep(st: StepInfo, t: number): void {
    const song = this.song;
    const s = st.s;
    const loop = st.bar % 4;
    if (st.kick && song.kick[s]) this.kick(t);
    if (st.snare && song.snare[s]) this.snare(t, s % 4 !== 0 ? 0.55 : 1);
    if (st.hat && song.hat[s]) this.hat(t, s % 4 === 2 ? 1 : 0.7);
    // Charleston fermé discret sur les doubles croches pendant les drops.
    if (st.drop && st.hat && !song.hat[s] && s % 2 === 1) this.hat(t, 0.35);
    const bassNote = song.bass[loop][s];
    if (st.bass && bassNote) this.bass(t, bassNote, this.length(song.bass[loop], s, 4));
    const leadNote = song.lead[loop][s];
    if (st.lead && leadNote) this.lead(t, leadNote, this.length(song.lead[loop], s, 6));
    // Nappe d'accords : une par mesure, plus discrète quand le morceau respire.
    if (s === 0) this.pad(t, song.chords[loop], st.bass || st.lead ? 1 : 0.6);
  }

  /** Durée d'une note (en s) : jusqu'à la note suivante de la mesure, plafonnée. */
  private length(row: number[], s: number, max: number): number {
    let n = 1;
    while (s + n < 16 && n < max && !row[s + n]) n++;
    return n * this.stepSec;
  }

  private env(g: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): void {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.setValueAtTime(peak, t + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  private kick(t: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.45);
    // Attaque claquante.
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200;
    const ng = ctx.createGain();
    this.env(ng.gain, t, 0.25, 0.001, 0, 0.018);
    n.connect(f).connect(ng).connect(this.drums);
    n.start(t, 0.3);
    n.stop(t + 0.03);
    // Pompage de la nappe (effet sidechain).
    const d = this.duck.gain;
    d.cancelScheduledValues(t);
    d.setValueAtTime(1, t);
    d.linearRampToValueAtTime(0.35, t + 0.01);
    d.linearRampToValueAtTime(1, t + 0.26);
  }

  private snare(t: number, vel: number): void {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    this.env(g.gain, t, 0.55 * vel, 0.002, 0.01, 0.17);
    n.connect(f).connect(g);
    g.connect(this.drums);
    g.connect(this.reverbSend);
    n.start(t, 0.1);
    n.stop(t + 0.25);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    this.env(og.gain, t, 0.4 * vel, 0.002, 0, 0.1);
    o.connect(og).connect(this.drums);
    o.start(t);
    o.stop(t + 0.14);
  }

  private hat(t: number, vel: number): void {
    const ctx = this.ctx;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    this.env(g.gain, t, 0.22 * vel, 0.001, 0, 0.045);
    n.connect(f).connect(g).connect(this.drums);
    n.start(t, 0.6);
    n.stop(t + 0.07);
  }

  private bass(t: number, note: number, dur: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(220, t);
    f.frequency.exponentialRampToValueAtTime(1100, t + 0.015);
    f.frequency.exponentialRampToValueAtTime(260, t + Math.max(0.05, dur * 0.8));
    const g = ctx.createGain();
    const len = Math.max(0.06, dur * 0.92);
    this.env(g.gain, t, 0.7, 0.006, Math.max(0, len - 0.08), 0.07);
    f.connect(g).connect(this.bassBus);
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = midi(note);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = midi(note - 12);
    const subG = ctx.createGain();
    subG.gain.value = 0.8;
    saw.connect(f);
    sub.connect(subG).connect(g);
    for (const o of [saw, sub]) {
      o.start(t);
      o.stop(t + len + 0.1);
    }
  }

  private lead(t: number, note: number, dur: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(3600, t + 0.02);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
    const g = ctx.createGain();
    const len = Math.max(0.08, dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.15);
    g.gain.setValueAtTime(0.3, t + len);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.12);
    f.connect(g);
    g.connect(this.leadBus);
    g.connect(this.reverbSend);
    const freq = midi(note);
    const voices: [OscillatorType, number, number][] = [
      ['square', -6, 0.5],
      ['sawtooth', 7, 0.5],
      ['triangle', 1200, 0.35],
    ];
    for (const [type, detune, level] of voices) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const vg = ctx.createGain();
      vg.gain.value = level;
      o.connect(vg).connect(f);
      o.start(t);
      o.stop(t + len + 0.15);
    }
  }

  private pad(t: number, chord: number[], level: number): void {
    const ctx = this.ctx;
    const dur = this.stepSec * 16;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1500, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(900, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * level, t + 0.18);
    g.gain.setValueAtTime(0.32 * level, t + dur - 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    f.connect(g);
    g.connect(this.padBus);
    g.connect(this.reverbSend);
    for (const n of chord) {
      for (const detune of [-9, 9]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(n);
        o.detune.value = detune;
        const vg = ctx.createGain();
        vg.gain.value = 0.16;
        o.connect(vg).connect(f);
        o.start(t);
        o.stop(t + dur + 0.3);
      }
    }
  }

  /** Coupe le son en douceur et libère le graphe audio. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const now = this.ctx.currentTime;
    try {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.04);
    } catch {
      /* contexte fermé */
    }
    setTimeout(() => {
      try {
        this.master.disconnect();
        this.limiter.disconnect();
      } catch {
        /* déjà déconnecté */
      }
    }, 350);
  }
}
