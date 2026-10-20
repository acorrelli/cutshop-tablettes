// Outils audio de l'admin pour Beat Drop : découpe de l'extrait de 72 secondes (fondus compris),
// encodage MP3 (+/ 1,2 Mo, rapide à charger sur les tablettes) et écoute de contrôle avec repères sonores.
import { BEAT_MS, type BeatNote } from '../arcade/games/beat/songs';

export const EXTRACT_SEC = BEAT_MS / 1000;
const RATE = 44100;
const FADE_IN_SEC = 0.06;
const FADE_OUT_SEC = 2.5;

let shared: AudioContext | null = null;
export function adminAudioContext(): AudioContext {
  if (!shared || shared.state === 'closed') shared = new AudioContext();
  if (shared.state === 'suspended') void shared.resume().catch(() => undefined);
  return shared;
}

export async function decodeFile(file: Blob): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return await adminAudioContext().decodeAudioData(data);
}

/** Extrait stéréo de 72 s à 44,1 kHz, avec un fondu d'entrée très court et un fondu de sortie. */
export async function renderExtract(source: AudioBuffer, startSec: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.round(EXTRACT_SEC * RATE), RATE);
  const src = ctx.createBufferSource();
  src.buffer = source;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, FADE_IN_SEC);
  gain.gain.setValueAtTime(1, EXTRACT_SEC - FADE_OUT_SEC);
  gain.gain.linearRampToValueAtTime(0, EXTRACT_SEC - 0.05);
  src.connect(gain).connect(ctx.destination);
  src.start(0, startSec, EXTRACT_SEC);
  return await ctx.startRendering();
}

const toInt16 = (f: Float32Array) => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
};

/** Encodage MP3 128 kbit/s par blocs, sans figer l'écran (progress de 0 à 1). */
export async function encodeMp3(buffer: AudioBuffer, progress?: (p: number) => void): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const left = toInt16(buffer.getChannelData(0));
  const right = toInt16(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
  const enc = new Mp3Encoder(2, buffer.sampleRate, 128);
  const parts: Uint8Array[] = [];
  const block = 1152 * 40;
  for (let i = 0; i < left.length; i += block) {
    const chunk = enc.encodeBuffer(left.subarray(i, i + block), right.subarray(i, i + block));
    if (chunk.length) parts.push(new Uint8Array(chunk));
    progress?.(Math.min(1, i / left.length));
    // Rend la main au navigateur pour garder l'écran réactif.
    if ((i / block) % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  progress?.(1);
  return new Blob(parts as BlobPart[], { type: 'audio/mpeg' });
}

export function channelsOf(buffer: AudioBuffer): Float32Array[] {
  return Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
}

/** Lecture d'un passage du morceau original (choix du début de l'extrait). */
export function playFrom(buffer: AudioBuffer, startSec: number, seconds = 12): () => void {
  const ctx = adminAudioContext();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.9;
  src.connect(gain).connect(ctx.destination);
  src.start(ctx.currentTime + 0.05, Math.max(0, startSec), seconds);
  return () => {
    try {
      src.stop();
    } catch {
      /* déjà terminée */
    }
  };
}

const LANE_HZ = [880, 1175, 1480, 1975];

/** Écoute de contrôle : l'extrait et un « clic » sur chaque note, pour vérifier que les notes tombent juste. */
export function playWithCues(extract: AudioBuffer, notes: BeatNote[], onEnd: () => void): () => void {
  const ctx = adminAudioContext();
  const t0 = ctx.currentTime + 0.2;
  const master = ctx.createGain();
  master.connect(ctx.destination);
  const music = ctx.createBufferSource();
  music.buffer = extract;
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.75;
  music.connect(musicGain).connect(master);
  music.start(t0);
  const clicks: OscillatorNode[] = [];
  for (const n of notes) {
    const at = t0 + n.t / 1000;
    const osc = ctx.createOscillator();
    osc.frequency.value = LANE_HZ[n.lane] ?? 1000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.35, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + 0.07);
    clicks.push(osc);
  }
  music.onended = onEnd;
  return () => {
    music.onended = null;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    setTimeout(() => {
      try {
        music.stop();
        clicks.forEach((c) => c.stop());
      } catch {
        /* déjà arrêtés */
      }
      master.disconnect();
    }, 150);
  };
}

/** Durée lisible : 1:05. */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Titre et artiste devinés à partir du nom de fichier « Artiste - Titre.mp3 ». */
export function guessFromFileName(name: string): { title: string; artist: string } {
  const base = name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' ').trim() };
  return { title: base, artist: '' };
}
