// Calibration locale de chaque tablette : retard moyen entre le son et l'appui du joueur (ms).
import { MAX_OFFSET_MS } from './engine';

export const BEAT_OFFSET_KEY = 'cutshop.arcade.beatOffset';

export function clampOffset(ms: number): number {
  return Number.isFinite(ms) ? Math.round(Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, ms))) : 0;
}

export function loadBeatOffset(): number {
  try {
    const raw = window.localStorage.getItem(BEAT_OFFSET_KEY);
    return raw === null ? 0 : clampOffset(Number(raw));
  } catch {
    return 0;
  }
}

export function saveBeatOffset(ms: number): number {
  const v = clampOffset(ms);
  try {
    window.localStorage.setItem(BEAT_OFFSET_KEY, String(v));
  } catch {
    /* stockage indisponible : la calibration ne vaut que pour cette session */
  }
  return v;
}

/** Médiane (calibration robuste aux appuis ratés). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
