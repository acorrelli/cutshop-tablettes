// Calibration de Beat Drop : le joueur tape en rythme sur un métronome, la médiane de ses écarts devient le
// décalage local de la tablette (latence du son et de l'écran tactile). Affichable depuis l'écran de tutoriel.
import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../audio';
import type { GameSound } from '../types';
import { BEAT_OFFSET_KEY, loadBeatOffset, median, saveBeatOffset } from './offset';
import { contextOffset } from './synth';

export { BEAT_OFFSET_KEY, loadBeatOffset, saveBeatOffset };

const TXT = {
  fr: {
    title: 'Calibration du rythme',
    intro: 'Tape sur le grand bouton en même temps que chaque bip. Huit appuis suffisent.',
    noSound: 'Le son est coupé : tape sur chaque éclair lumineux.',
    start: 'Commencer',
    ready: 'Écoute le tempo…',
    tap: 'Tape !',
    taps: (n: number) => `${n} / 8`,
    perfect: 'Ta tablette est parfaitement calée.',
    late: (ms: number) => `Tu tapes en moyenne ${ms} ms après le temps.`,
    early: (ms: number) => `Tu tapes en moyenne ${ms} ms avant le temps.`,
    fail: 'Pas assez d’appuis en rythme. Réessaie !',
    save: 'Enregistrer',
    retry: 'Recommencer',
    reset: 'Remettre à zéro',
    close: 'Fermer',
    current: (ms: number) => (ms === 0 ? 'Réglage actuel : aucun décalage' : `Réglage actuel : ${Math.abs(ms)} ms ${ms > 0 ? 'de retard' : 'd’avance'}`),
    saved: 'Calibration enregistrée',
  },
  en: {
    title: 'Rhythm calibration',
    intro: 'Tap the big button together with each beep. Eight taps are enough.',
    noSound: 'Sound is off: tap on each light flash.',
    start: 'Start',
    ready: 'Listen to the tempo…',
    tap: 'Tap!',
    taps: (n: number) => `${n} / 8`,
    perfect: 'Your tablet is perfectly in sync.',
    late: (ms: number) => `On average you tap ${ms} ms after the beat.`,
    early: (ms: number) => `On average you tap ${ms} ms before the beat.`,
    fail: 'Not enough taps on the beat. Try again!',
    save: 'Save',
    retry: 'Try again',
    reset: 'Reset to zero',
    close: 'Close',
    current: (ms: number) => (ms === 0 ? 'Current setting: no offset' : `Current setting: ${Math.abs(ms)} ms ${ms > 0 ? 'late' : 'early'}`),
    saved: 'Calibration saved',
  },
} as const;

const BEAT_MS = 600;
const LEAD_IN = 4;
const TAPS = 8;
const MAX_BEATS = LEAD_IN + 18;
const WINDOW_MS = 300;

type Phase = 'idle' | 'running' | 'done' | 'fail';

export interface BeatCalibrationProps {
  lang: 'fr' | 'en';
  /** Son du jeu (par défaut activé, volume 0,8). */
  sound?: GameSound;
  /** Appelé après l'enregistrement, avec le décalage retenu (ms). */
  onDone?: (offsetMs: number) => void;
  onClose?: () => void;
}

export function BeatCalibration({ lang, sound, onDone, onClose }: BeatCalibrationProps) {
  const T = TXT[lang === 'en' ? 'en' : 'fr'];
  const soundOn = sound ? sound.on && sound.volume > 0 : true;
  const volume = sound ? sound.volume : 0.8;
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [measured, setMeasured] = useState(0);
  const [current, setCurrent] = useState(() => loadBeatOffset());
  const [saved, setSaved] = useState(false);
  const [beat, setBeat] = useState(-1);
  const padRef = useRef<HTMLButtonElement>(null);
  const run = useRef<{ t0: number; deltas: number[] } | null>(null);
  const stopRef = useRef<() => void>(() => undefined);

  useEffect(() => () => stopRef.current(), []);

  const finish = (deltas: number[]) => {
    stopRef.current();
    run.current = null;
    if (deltas.length >= 5) {
      setMeasured(Math.round(median(deltas)));
      setPhase('done');
    } else setPhase('fail');
  };

  const start = () => {
    stopRef.current();
    const t0 = performance.now() + 500;
    run.current = { t0, deltas: [] };
    setCount(0);
    setSaved(false);
    setBeat(-1);
    setPhase('running');

    const actx = soundOn ? audioContext() : null;
    let next = 0;
    const out = actx ? actx.createGain() : null;
    if (actx && out) {
      out.gain.value = Math.pow(Math.max(0, Math.min(1, volume)), 1.4) * 0.8;
      out.connect(actx.destination);
    }
    const schedule = () => {
      if (!actx || !out || actx.state !== 'running') return;
      const perf = performance.now();
      const off = contextOffset(actx, perf);
      while (next < MAX_BEATS && t0 + next * BEAT_MS < perf + 120) {
        const at = t0 + next * BEAT_MS;
        if (at >= perf - 20) {
          const t = Math.max(actx.currentTime, at / 1000 + off);
          const o = actx.createOscillator();
          const g = actx.createGain();
          o.type = 'sine';
          o.frequency.value = next % 4 === 0 ? 1568 : 1046;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.6, t + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 0.1);
        }
        next++;
      }
    };
    schedule();
    const timer = setInterval(schedule, 25);
    let raf = 0;
    let shown = -1;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const perf = performance.now();
      const k = Math.floor((perf - t0) / BEAT_MS);
      const phaseMs = perf - t0 - k * BEAT_MS;
      const pad = padRef.current;
      if (pad) {
        const f = k >= 0 ? Math.exp(-phaseMs / 110) : 0;
        pad.style.boxShadow = `0 0 ${30 + 60 * f}px rgba(255,63,210,${0.35 + 0.6 * f}), inset 0 0 ${20 + 40 * f}px rgba(37,232,255,${0.25 + 0.5 * f})`;
        pad.style.transform = `scale(${1 + 0.05 * f})`;
      }
      if (k !== shown) {
        shown = k;
        setBeat(k);
      }
      if (k >= MAX_BEATS && run.current) finish(run.current.deltas);
    };
    raf = requestAnimationFrame(frame);
    stopRef.current = () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      if (out) setTimeout(() => out.disconnect(), 300);
      stopRef.current = () => undefined;
    };
  };

  const onTap = (e: React.PointerEvent) => {
    e.preventDefault();
    const r = run.current;
    if (phase !== 'running' || !r) return;
    const perf = performance.now();
    const t = Number.isFinite(e.timeStamp) && Math.abs(e.timeStamp - perf) < 500 ? e.timeStamp : perf;
    const k = Math.round((t - r.t0) / BEAT_MS);
    const delta = t - (r.t0 + k * BEAT_MS);
    if (k < LEAD_IN || Math.abs(delta) > WINDOW_MS) return;
    r.deltas.push(delta);
    setCount(r.deltas.length);
    if (r.deltas.length >= TAPS) finish(r.deltas);
  };

  const save = (v: number) => {
    const stored = saveBeatOffset(v);
    setCurrent(stored);
    setSaved(true);
    onDone?.(stored);
  };

  const result = Math.abs(measured) <= 10 ? T.perfect : measured > 0 ? T.late(measured) : T.early(-measured);
  const leadIn = phase === 'running' && beat < LEAD_IN;

  return (
    <div className="relative flex h-full w-full select-none touch-none flex-col items-center justify-center gap-6 p-6 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-fuchsia-400/40 bg-[#0B0820]/85 p-8 text-center shadow-[0_0_40px_rgba(168,85,247,0.35)]">
        <h2 className="text-3xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300">
          {T.title}
        </h2>
        <p className="mt-3 text-lg text-white/80">{soundOn ? T.intro : T.noSound}</p>
        <p className="mt-1 text-sm text-white/50">{T.current(current)}</p>

        <div className="mt-6 flex items-center justify-center">
          <button
            ref={padRef}
            type="button"
            onPointerDown={onTap}
            disabled={phase !== 'running'}
            className="flex h-52 w-52 items-center justify-center rounded-full border-4 border-cyan-300/80 bg-[radial-gradient(circle,rgba(255,63,210,0.35),rgba(20,10,50,0.9))] text-3xl font-black italic transition-colors"
            style={{ boxShadow: '0 0 30px rgba(255,63,210,0.35)' }}
          >
            {phase === 'running' ? (leadIn ? LEAD_IN - Math.max(0, beat) : T.tap) : <span className="text-6xl not-italic">♪</span>}
          </button>
        </div>

        <div className="mt-5 min-h-[3.5rem] text-xl font-bold">
          {phase === 'running' && (leadIn ? <span className="text-white/70">{T.ready}</span> : <span className="text-cyan-300">{T.taps(count)}</span>)}
          {phase === 'done' && <span className="text-amber-300">{result}</span>}
          {phase === 'fail' && <span className="text-rose-400">{T.fail}</span>}
          {saved && <div className="mt-1 text-base text-emerald-300">{T.saved}</div>}
        </div>

        <div className="mt-4 flex min-h-[64px] flex-wrap items-center justify-center gap-3">
          {phase === 'idle' && (
            <button type="button" onClick={start} className="min-h-[64px] rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-8 text-xl font-black text-white shadow-lg">
              {T.start}
            </button>
          )}
          {phase === 'done' && !saved && (
            <button type="button" onClick={() => save(measured)} className="min-h-[64px] rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 px-8 text-xl font-black text-[#1a1030] shadow-lg">
              {T.save}
            </button>
          )}
          {(phase === 'done' || phase === 'fail') && (
            <button type="button" onClick={start} className="min-h-[64px] rounded-2xl border-2 border-cyan-300/70 px-6 text-lg font-bold text-cyan-200">
              {T.retry}
            </button>
          )}
          {phase !== 'running' && current !== 0 && (
            <button type="button" onClick={() => save(0)} className="min-h-[64px] rounded-2xl border-2 border-white/30 px-6 text-lg font-bold text-white/80">
              {T.reset}
            </button>
          )}
          {onClose && phase !== 'running' && (
            <button type="button" onClick={onClose} className="min-h-[64px] rounded-2xl border-2 border-white/30 px-6 text-lg font-bold text-white/80">
              {T.close}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BeatCalibration;
