// Sons de Cutshop Arcade, entièrement générés par Web Audio (aucun fichier, aucune musique sous droits).
// Le son est coupé par défaut et ne démarre qu'après un geste du joueur (règle des navigateurs).
import type { GameSound } from './games/types';

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** À appeler dans un geste du joueur (bouton JOUER, réglage du son). */
export function unlockArcadeAudio(): void {
  audioContext();
}

export type Sfx = 'tap' | 'good' | 'perfect' | 'bad' | 'combo' | 'tick' | 'go' | 'end' | 'pour' | 'clip' | 'snip' | 'found';

interface Tone {
  f: number;
  to?: number;
  type: OscillatorType;
  dur: number;
  gain: number;
  delay?: number;
}

const SFX: Record<Sfx, Tone[]> = {
  tap: [{ f: 660, type: 'triangle', dur: 0.06, gain: 0.12 }],
  good: [{ f: 523, to: 784, type: 'triangle', dur: 0.14, gain: 0.16 }],
  perfect: [
    { f: 784, type: 'triangle', dur: 0.12, gain: 0.16 },
    { f: 1175, type: 'triangle', dur: 0.2, gain: 0.14, delay: 0.08 },
  ],
  bad: [{ f: 220, to: 150, type: 'sawtooth', dur: 0.22, gain: 0.09 }],
  combo: [
    { f: 659, type: 'square', dur: 0.08, gain: 0.07 },
    { f: 880, type: 'square', dur: 0.08, gain: 0.07, delay: 0.07 },
    { f: 1319, type: 'square', dur: 0.12, gain: 0.07, delay: 0.14 },
  ],
  tick: [{ f: 1200, type: 'square', dur: 0.04, gain: 0.06 }],
  go: [{ f: 880, to: 1760, type: 'square', dur: 0.25, gain: 0.08 }],
  end: [
    { f: 523, type: 'triangle', dur: 0.18, gain: 0.15 },
    { f: 659, type: 'triangle', dur: 0.18, gain: 0.15, delay: 0.14 },
    { f: 784, type: 'triangle', dur: 0.35, gain: 0.15, delay: 0.28 },
  ],
  pour: [{ f: 180, to: 120, type: 'sine', dur: 0.12, gain: 0.05 }],
  clip: [{ f: 95, type: 'sawtooth', dur: 0.09, gain: 0.05 }],
  snip: [
    { f: 2400, to: 1600, type: 'square', dur: 0.03, gain: 0.05 },
    { f: 2200, to: 1400, type: 'square', dur: 0.03, gain: 0.05, delay: 0.06 },
  ],
  found: [
    { f: 988, type: 'sine', dur: 0.1, gain: 0.16 },
    { f: 1480, type: 'sine', dur: 0.18, gain: 0.14, delay: 0.07 },
  ],
};

/** Joue un effet court si le son est activé. */
export function sfx(name: Sfx, sound: GameSound): void {
  if (!sound.on || sound.volume <= 0) return;
  const a = audioContext();
  if (!a) return;
  for (const tone of SFX[name]) {
    const t = a.currentTime + (tone.delay ?? 0);
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.f, t);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, t + tone.dur);
    const peak = Math.max(0.0002, tone.gain * sound.volume);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + tone.dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + tone.dur + 0.02);
  }
}
