// Lecture des musiques importées : téléchargement (gardé en mémoire), décodage, puis lecture calée sur
// l'horloge de la partie, avec la même correspondance horloge / AudioContext que le synthétiseur.
import { contextOffset } from './synth';

const bytes = new Map<string, Promise<ArrayBuffer>>();
/** Derniers extraits décodés (un extrait décodé pèse +/ 25 Mo : on n'en garde que deux). */
const decoded: { url: string; buffer: Promise<AudioBuffer> }[] = [];

/** Télécharge l'extrait en avance (sans le décoder) : appelé dès que le joueur choisit un morceau. */
export function preloadTrackAudio(url: string): Promise<ArrayBuffer> {
  let p = bytes.get(url);
  if (!p) {
    p = fetch(url, { cache: 'force-cache' }).then((r) => {
      if (!r.ok) throw new Error(`audio ${r.status}`);
      return r.arrayBuffer();
    });
    p.catch(() => bytes.delete(url));
    bytes.set(url, p);
  }
  return p;
}

export function loadTrackBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const hit = decoded.find((d) => d.url === url);
  if (hit) return hit.buffer;
  // decodeAudioData détache le tableau reçu : on lui passe une copie.
  const buffer = preloadTrackAudio(url).then((data) => ctx.decodeAudioData(data.slice(0)));
  const entry = { url, buffer };
  buffer.catch(() => {
    const i = decoded.indexOf(entry);
    if (i >= 0) decoded.splice(i, 1);
  });
  decoded.unshift(entry);
  if (decoded.length > 2) decoded.length = 2;
  return buffer;
}

export interface TrackPlayerOptions {
  ctx: AudioContext;
  buffer: AudioBuffer;
  volume: number;
  /** Instant de départ du morceau, dans le domaine performance.now() (ms). */
  startPerf: number;
}

export class TrackPlayer {
  private readonly ctx: AudioContext;
  private readonly gain: GainNode;
  private source: AudioBufferSourceNode | null = null;

  constructor(private readonly opts: TrackPlayerOptions) {
    this.ctx = opts.ctx;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = Math.max(0, Math.min(1, opts.volume));
    this.gain.connect(this.ctx.destination);
  }

  /** Programme la lecture : à l'heure si on est en avance, sinon reprend au bon endroit de l'extrait. */
  start(): void {
    const { ctx, buffer, startPerf } = this.opts;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const perfNow = performance.now();
    const when = startPerf / 1000 + contextOffset(ctx, perfNow);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);
    const lead = when - ctx.currentTime;
    if (lead >= 0) src.start(when);
    else if (-lead < buffer.duration - 0.5) src.start(ctx.currentTime + 0.02, -lead + 0.02);
    else return;
    this.source = src;
  }

  setVolume(v: number): void {
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), t, 0.05);
  }

  stop(): void {
    try {
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setTargetAtTime(0, t, 0.08);
      this.source?.stop(t + 0.4);
    } catch {
      /* déjà arrêtée */
    }
    this.source = null;
    setTimeout(() => this.gain.disconnect(), 600);
  }
}
