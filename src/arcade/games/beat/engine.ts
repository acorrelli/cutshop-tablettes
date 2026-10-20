// Moteur de Beat Drop : jugement des appuis, notes longues, combo et score. Aucune dépendance à l'affichage ni au son.
// Les instants passés au moteur sont ceux de l'horloge de la partie (ms) ; le temps du morceau vaut now - startAt - offset.
import type { ArcadeGameEngine, GameResult } from '../../types';
import {
  BEAT_DIFFICULTIES,
  BEAT_MS,
  buildBeatmap,
  comboMultiplier,
  GOOD_MS,
  judgementCount,
  LANES,
  PERFECT_MS,
  songForSeed,
  type BeatDifficulty,
  type BeatNote,
  type SongInfo,
} from './songs';
import { beatTrackById, beatTrackForSeed, type BeatTrack } from './tracks';

export type Judgement = 'perfect' | 'good' | 'miss';
export const JUDGEMENT_POINTS: Record<Judgement, number> = { perfect: 100, good: 50, miss: 0 };
/** Un appui trop tôt (entre GOOD_MS et EARLY_MISS_MS avant la note) la rate : le martèlement ne paie pas. */
export const EARLY_MISS_MS = 180;
/** Décalage de calibration accepté (ms). */
export const MAX_OFFSET_MS = 250;

export function asDifficulty(v: string): BeatDifficulty {
  return (BEAT_DIFFICULTIES as readonly string[]).includes(v) ? (v as BeatDifficulty) : 'easy';
}

export function judge(deltaMs: number): Judgement | null {
  const d = Math.abs(deltaMs);
  if (d <= PERFECT_MS) return 'perfect';
  if (d <= GOOD_MS) return 'good';
  return null;
}

/** État d'une note de la beatmap pendant la partie. */
export interface NoteState extends BeatNote {
  index: number;
  /** Jugement de l'attaque (null tant que la note n'est pas jouée). */
  head: Judgement | null;
  /** Jugement du relâché d'une note longue. */
  tail: Judgement | null;
  /** Note longue en cours de maintien. */
  holding: boolean;
}

/** Événement de jugement, lu par l'affichage (éclairs, textes). */
export interface BeatEvent {
  lane: number;
  judgement: Judgement;
  /** Temps du morceau (ms) au moment du jugement. */
  at: number;
  /** Relâché d'une note longue. */
  tail: boolean;
  combo: number;
  points: number;
}

export class BeatEngine implements ArcadeGameEngine {
  readonly seed: number;
  readonly difficulty: BeatDifficulty;
  readonly song: SongInfo;
  /** Musique importée jouée (null : morceau de synthèse). */
  readonly track: BeatTrack | null;
  readonly notes: NoteState[];
  readonly durationMs: number;
  readonly judgements: number;
  /** Calibration de la tablette : retard moyen du joueur (ms), soustrait avant jugement. */
  readonly offsetMs: number;
  startedAt = 0;
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judgement, number> = { perfect: 0, good: 0, miss: 0 };
  /** Événements non encore lus par l'affichage. */
  events: BeatEvent[] = [];
  /** Première note pas encore entièrement jugée (optimisation des parcours). */
  private cursor = 0;
  private held: boolean[] = new Array<boolean>(LANES).fill(false);
  private over = false;

  /**
   * trackId : musique choisie en solo. Sans choix, la graine désigne une musique importée s'il y en a,
   * sinon un morceau de synthèse : toutes les tablettes d'une partie jouent donc le même morceau.
   */
  constructor(seed: number, variant: string, offsetMs = 0, durationMs = BEAT_MS, trackId: string | null = null) {
    this.seed = seed;
    this.difficulty = asDifficulty(variant);
    this.track = beatTrackById(trackId) ?? beatTrackForSeed(seed);
    let map: BeatNote[];
    if (this.track) {
      const tr = this.track;
      this.song = { id: tr.id, title: tr.title, artist: tr.artist, bpm: tr.bpm, hue: tr.hue, beatPhaseMs: tr.beatPhaseMs };
      map = tr.charts[this.difficulty];
    } else {
      const song = songForSeed(seed);
      this.song = song;
      map = buildBeatmap(song, this.difficulty);
    }
    this.notes = map.map((n, index) => ({ ...n, index, head: null, tail: null, holding: false }));
    this.judgements = judgementCount(map);
    this.durationMs = durationMs;
    this.offsetMs = Number.isFinite(offsetMs) ? Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, offsetMs)) : 0;
  }

  start(now: number): void {
    this.startedAt = now;
  }

  /** Temps du morceau corrigé de la calibration. */
  songTime(now: number): number {
    return now - this.startedAt - this.offsetMs;
  }

  isHeld(lane: number): boolean {
    return this.held[lane] ?? false;
  }

  press(lane: number, now: number): void {
    if (this.over || lane < 0 || lane >= LANES || now < this.startedAt) return;
    this.update(now);
    if (this.over) return;
    this.held[lane] = true;
    const t = this.songTime(now);
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t > EARLY_MISS_MS) break;
      if (n.lane !== lane || n.head !== null) continue;
      const delta = t - n.t;
      const j = judge(delta);
      if (j) {
        this.record(n, j, false, t);
        if (n.len > 0) n.holding = true;
      } else if (delta < 0) {
        // Trop tôt : la note est ratée, attaque et relâché.
        this.miss(n, t);
      }
      return;
    }
  }

  release(lane: number, now: number): void {
    if (lane < 0 || lane >= LANES) return;
    this.held[lane] = false;
    if (this.over) return;
    this.update(now);
    if (this.over) return;
    const t = this.songTime(now);
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t > GOOD_MS) break;
      if (n.lane !== lane || !n.holding) continue;
      n.holding = false;
      const end = n.t + n.len;
      this.record(n, judge(t - end) ?? 'miss', true, t);
    }
  }

  update(now: number): void {
    if (this.over) return;
    if (now >= this.startedAt + this.durationMs) {
      this.finish(now);
      return;
    }
    this.sweep(this.songTime(now));
  }

  /** Ratés automatiques et fins de notes longues tenues jusqu'au bout. */
  private sweep(t: number): void {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t > GOOD_MS) break;
      if (n.head === null && t - n.t > GOOD_MS) this.miss(n, t);
      // Tenue jusqu'au bout : relâché parfait.
      if (n.holding && t >= n.t + n.len) {
        n.holding = false;
        this.record(n, 'perfect', true, n.t + n.len);
      }
    }
    while (this.cursor < this.notes.length && this.done(this.notes[this.cursor])) this.cursor++;
  }

  private done(n: NoteState): boolean {
    return n.head !== null && (n.len === 0 || n.tail !== null);
  }

  private miss(n: NoteState, t: number): void {
    this.record(n, 'miss', false, t);
    if (n.len > 0) this.record(n, 'miss', true, t);
  }

  private record(n: NoteState, j: Judgement, tail: boolean, t: number): void {
    if (tail) n.tail = j;
    else n.head = j;
    let points = 0;
    if (j === 'miss') {
      this.combo = 0;
    } else {
      points = JUDGEMENT_POINTS[j] * comboMultiplier(this.combo);
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += points;
    }
    this.counts[j] += 1;
    if (this.events.length < 64) this.events.push({ lane: n.lane, judgement: j, at: t, tail, combo: this.combo, points });
  }

  /** Multiplicateur appliqué au prochain jugement réussi. */
  multiplier(): number {
    return comboMultiplier(this.combo);
  }

  drainEvents(): BeatEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  isOver(now: number): boolean {
    return this.over || now >= this.startedAt + this.durationMs;
  }

  finish(now: number): void {
    if (this.over) return;
    const t = this.songTime(now);
    this.sweep(t);
    // Notes restantes (abandon en cours de partie) : ratées, y compris le relâché d'une note longue encore tenue.
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.head === null) this.miss(n, t);
      else if (n.len > 0 && n.tail === null) {
        n.holding = false;
        this.record(n, 'miss', true, t);
      }
    }
    this.cursor = this.notes.length;
    this.held.fill(false);
    this.over = true;
  }

  result(): GameResult {
    return {
      score: this.score,
      stats: {
        perfect: this.counts.perfect,
        good: this.counts.good,
        miss: this.counts.miss,
        judgements: this.judgements,
        maxCombo: this.maxCombo,
      },
      durationMs: this.durationMs,
    };
  }

  dispose(): void {
    /* aucune ressource externe */
  }
}
