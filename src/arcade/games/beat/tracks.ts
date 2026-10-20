// Musiques importées dans Beat Drop depuis l'admin : un extrait MP3 de 72 secondes et ses trois partitions,
// calculées une fois pour toutes à l'import (voir analysis.ts). Toutes les tablettes lisent la même liste :
// une partie multijoueur tire son morceau de la graine commune, exactement comme les morceaux de synthèse.
import { BEAT_DIFFICULTIES, BEAT_MS, beatMaxScore, LANES, maxScoreForMap, sanitizeBeatmap, type BeatDifficulty, type BeatNote } from './songs';

/** Partition compacte stockée en base : [instant ms, piste, durée ms]. */
export type CompactNote = [number, number, number];

export interface BeatTrackRow {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  /** Extrait MP3 de 72 secondes (fondus compris), prêt à jouer. */
  audio_url: string;
  bpm: number;
  /** Instant du premier temps dans l'extrait (ms), pour caler la pulsation visuelle. */
  beat_phase_ms: number;
  charts: Partial<Record<BeatDifficulty, CompactNote[]>>;
  /** Niveau de la musique : elle n'apparaît que dans ce niveau sur les tablettes. */
  level: BeatDifficulty;
  active: boolean;
  sort: number;
  created_at?: string;
}

/** Morceau prêt à jouer (partitions vérifiées). */
export interface BeatTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  audioUrl: string;
  bpm: number;
  beatPhaseMs: number;
  hue: number;
  level: BeatDifficulty;
  charts: Record<BeatDifficulty, BeatNote[]>;
}

/** Couleur d'ambiance stable, tirée du titre. */
export function hueFor(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function toCompact(notes: BeatNote[]): CompactNote[] {
  return notes.map((n) => [Math.round(n.t), n.lane, Math.round(n.len)]);
}

/** Relit une partition stockée : notes valides seulement, triées, plafonnées au score maximal du niveau. */
export function chartFromCompact(raw: unknown, difficulty: BeatDifficulty): BeatNote[] {
  if (!Array.isArray(raw)) return [];
  const notes: BeatNote[] = [];
  for (const item of raw) {
    if (!Array.isArray(item) || item.length < 2) continue;
    const t = Number(item[0]);
    const lane = Number(item[1]);
    const len = Number(item[2] ?? 0);
    if (!Number.isFinite(t) || !Number.isInteger(lane) || lane < 0 || lane >= LANES || !Number.isFinite(len)) continue;
    if (t < 0 || t >= BEAT_MS || len < 0) continue;
    notes.push({ t: Math.round(t), lane, len: Math.round(len) });
  }
  const clean = sanitizeBeatmap(notes);
  // Le serveur refuse tout score au dessus du plafond du niveau : une partition trop dense est raccourcie.
  const cap = beatMaxScore(difficulty);
  while (clean.length > 0 && maxScoreForMap(clean) > cap) clean.pop();
  return clean;
}

export function trackFromRow(row: BeatTrackRow): BeatTrack | null {
  if (!row || !row.id || !row.audio_url) return null;
  const charts = {} as Record<BeatDifficulty, BeatNote[]>;
  for (const d of BEAT_DIFFICULTIES) {
    charts[d] = chartFromCompact(row.charts?.[d], d);
    if (charts[d].length < 8) return null;
  }
  const bpm = Number(row.bpm);
  return {
    id: row.id,
    title: (row.title || '').trim() || 'Sans titre',
    artist: (row.artist || '').trim(),
    coverUrl: row.cover_url || null,
    audioUrl: row.audio_url,
    bpm: Number.isFinite(bpm) && bpm >= 50 && bpm <= 220 ? bpm : 120,
    beatPhaseMs: Number.isFinite(Number(row.beat_phase_ms)) ? Math.max(0, Number(row.beat_phase_ms)) : 0,
    hue: hueFor(row.title || row.id),
    level: (BEAT_DIFFICULTIES as readonly string[]).includes(row.level) ? row.level : 'medium',
    charts,
  };
}

let tracks: BeatTrack[] = [];

/** Liste des morceaux actifs, dans un ordre identique sur toutes les tablettes (par identifiant). */
export function setBeatTracks(rows: BeatTrackRow[]): void {
  tracks = rows
    .filter((r) => r && r.active !== false)
    .map(trackFromRow)
    .filter((t): t is BeatTrack => t !== null)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Musiques d'un niveau (toutes si aucun niveau n'est donné). */
export function beatTracks(level?: BeatDifficulty): BeatTrack[] {
  return level ? tracks.filter((t) => t.level === level) : tracks;
}

export function beatTrackById(id: string | null | undefined): BeatTrack | null {
  return (id && tracks.find((t) => t.id === id)) || null;
}

/**
 * Morceau d'une partie au hasard ou multijoueur : la graine choisit parmi les musiques du niveau joué,
 * identiques sur toutes les tablettes. Aucune musique à ce niveau : morceaux de synthèse.
 */
export function beatTrackForSeed(seed: number, level: BeatDifficulty): BeatTrack | null {
  const list = beatTracks(level);
  if (list.length === 0) return null;
  return list[(seed >>> 0) % list.length];
}
