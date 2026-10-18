// Morceaux originaux de Beat Drop, composés directement en code (aucun fichier audio, aucun droit à céder).
// Chaque morceau est décrit pas à pas (16 pas par mesure) : la musique ET la beatmap en découlent,
// ce qui garantit que les notes tombent exactement sur le son. Un morceau fourni par un DJ du Cutshop
// pourra être ajouté plus tard avec un fichier audio et une beatmap décrite au même format (BeatNote[]).

export const BEAT_MS = 72000;
export const BEAT_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type BeatDifficulty = (typeof BEAT_DIFFICULTIES)[number];
export const LANES = 4;

/** Une section : nombre de mesures et instruments actifs. */
interface Section {
  bars: number;
  kick: boolean;
  snare: boolean;
  hat: boolean;
  bass: boolean;
  lead: boolean;
  /** Section la plus intense (drop) : plus de notes à jouer. */
  drop?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  /** Motifs sur 16 pas (1 = frappe). */
  kick: number[];
  snare: number[];
  hat: number[];
  /** Notes MIDI de basse sur 16 pas (0 = silence), une ligne par mesure de la boucle. */
  bass: number[][];
  /** Notes MIDI de mélodie sur 16 pas (0 = silence). */
  lead: number[][];
  /** Accords de nappe, un par mesure de la boucle. */
  chords: number[][];
  sections: Section[];
  /** Couleur d'ambiance de l'écran. */
  hue: number;
}

const X = 1;
const _ = 0;

export const SONGS: Song[] = [
  {
    id: 'cut-session',
    title: 'Cut Session',
    artist: 'Cutshop Sound System',
    bpm: 120,
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, _],
    hat: [_, _, X, _, _, _, X, _, _, _, X, _, _, _, X, _],
    bass: [
      [45, 0, 0, 45, 0, 0, 45, 0, 0, 0, 45, 0, 48, 0, 0, 0],
      [41, 0, 0, 41, 0, 0, 41, 0, 0, 0, 41, 0, 43, 0, 0, 0],
      [43, 0, 0, 43, 0, 0, 43, 0, 0, 0, 43, 0, 47, 0, 0, 0],
      [40, 0, 0, 40, 0, 0, 40, 0, 0, 0, 40, 0, 43, 0, 0, 0],
    ],
    lead: [
      [69, 0, 0, 72, 0, 0, 76, 0, 0, 0, 74, 0, 72, 0, 0, 0],
      [65, 0, 0, 69, 0, 0, 72, 0, 0, 0, 71, 0, 69, 0, 0, 0],
      [67, 0, 0, 71, 0, 0, 74, 0, 0, 0, 72, 0, 71, 0, 0, 0],
      [64, 0, 0, 67, 0, 0, 71, 0, 72, 0, 71, 0, 67, 0, 64, 0],
    ],
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
      [52, 55, 59],
    ],
    sections: [
      { bars: 4, kick: true, snare: false, hat: true, bass: false, lead: false },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: false },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 4, kick: false, snare: false, hat: true, bass: false, lead: true },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 4, kick: true, snare: false, hat: false, bass: true, lead: false },
    ],
    hue: 285,
  },
  {
    id: 'mons-by-night',
    title: 'Mons by Night',
    artist: 'Cutshop Sound System',
    bpm: 100,
    kick: [X, _, _, _, _, _, _, X, _, _, X, _, _, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, _],
    hat: [X, _, X, _, X, _, X, _, X, _, X, _, X, _, X, _],
    bass: [
      [38, 0, 0, 0, 0, 0, 0, 38, 0, 0, 41, 0, 0, 0, 0, 0],
      [36, 0, 0, 0, 0, 0, 0, 36, 0, 0, 40, 0, 0, 0, 0, 0],
      [34, 0, 0, 0, 0, 0, 0, 34, 0, 0, 38, 0, 0, 0, 0, 0],
      [33, 0, 0, 0, 0, 0, 0, 33, 0, 0, 36, 0, 0, 0, 0, 0],
    ],
    lead: [
      [74, 0, 0, 0, 72, 0, 0, 0, 69, 0, 0, 0, 0, 0, 0, 0],
      [72, 0, 0, 0, 69, 0, 0, 0, 67, 0, 0, 0, 0, 0, 0, 0],
      [70, 0, 0, 0, 69, 0, 0, 0, 65, 0, 0, 0, 67, 0, 0, 0],
      [69, 0, 0, 0, 0, 0, 0, 0, 64, 0, 0, 0, 0, 0, 0, 0],
    ],
    chords: [
      [62, 65, 69],
      [60, 64, 67],
      [58, 62, 65],
      [57, 60, 64],
    ],
    sections: [
      { bars: 2, kick: false, snare: false, hat: true, bass: false, lead: true },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: false },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 4, kick: false, snare: true, hat: false, bass: true, lead: false },
      { bars: 6, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 2, kick: false, snare: false, hat: false, bass: true, lead: true },
    ],
    hue: 200,
  },
  {
    id: 'neon-fade',
    title: 'Neon Fade',
    artist: 'Cutshop Sound System',
    bpm: 128,
    kick: [X, _, _, _, X, _, _, _, X, _, _, _, X, _, _, _],
    snare: [_, _, _, _, X, _, _, _, _, _, _, _, X, _, _, X],
    hat: [_, _, X, X, _, _, X, _, _, _, X, X, _, _, X, _],
    bass: [
      [40, 0, 40, 0, 0, 40, 0, 40, 0, 0, 43, 0, 45, 0, 43, 0],
      [36, 0, 36, 0, 0, 36, 0, 36, 0, 0, 38, 0, 40, 0, 38, 0],
      [38, 0, 38, 0, 0, 38, 0, 38, 0, 0, 40, 0, 43, 0, 40, 0],
      [35, 0, 35, 0, 0, 35, 0, 35, 0, 0, 38, 0, 40, 0, 42, 0],
    ],
    lead: [
      [76, 0, 79, 0, 83, 0, 79, 0, 76, 0, 0, 0, 74, 0, 76, 0],
      [72, 0, 76, 0, 79, 0, 76, 0, 72, 0, 0, 0, 71, 0, 72, 0],
      [74, 0, 78, 0, 81, 0, 78, 0, 74, 0, 0, 0, 72, 0, 74, 0],
      [71, 0, 74, 0, 78, 0, 74, 0, 71, 0, 74, 0, 78, 0, 83, 0],
    ],
    chords: [
      [64, 67, 71],
      [60, 64, 67],
      [62, 66, 69],
      [59, 62, 66],
    ],
    sections: [
      { bars: 4, kick: true, snare: false, hat: false, bass: false, lead: false },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: false },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 4, kick: false, snare: false, hat: true, bass: true, lead: true },
      { bars: 8, kick: true, snare: true, hat: true, bass: true, lead: true, drop: true },
      { bars: 6, kick: true, snare: true, hat: false, bass: true, lead: false },
    ],
    hue: 160,
  },
];

export function songForSeed(seed: number): Song {
  return SONGS[(seed >>> 0) % SONGS.length];
}

export function stepMs(song: Song): number {
  return 60000 / song.bpm / 4;
}

/** Pas joués dans le morceau (index absolu, section) en s'arrêtant à BEAT_MS. */
export function* songSteps(song: Song): Generator<{ step: number; bar: number; s: number; section: Section; sectionIndex: number }> {
  let bar = 0;
  const per = stepMs(song);
  for (let si = 0; si < song.sections.length; si++) {
    const section = song.sections[si];
    for (let b = 0; b < section.bars; b++, bar++) {
      for (let s = 0; s < 16; s++) {
        const step = bar * 16 + s;
        if (step * per >= BEAT_MS) return;
        yield { step, bar, s, section, sectionIndex: si };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Beatmaps

export interface BeatNote {
  /** Instant de la note depuis le début du morceau, en millisecondes. */
  t: number;
  lane: number;
  /** Durée d'une note longue (0 pour une note simple). */
  len: number;
}

/** Écart minimal entre deux notes d'une même piste, et marge avant la fin du morceau. */
export const MIN_LANE_GAP_MS = 150;
const END_MARGIN_MS = 1500;
/** Mesures d'introduction sans note : le joueur entend le tempo avant la première note (pas de note sur le GO). */
export const LEAD_IN_BARS = 1;

export function buildBeatmap(song: Song, difficulty: BeatDifficulty): BeatNote[] {
  const per = stepMs(song);
  const notes: BeatNote[] = [];
  const add = (step: number, lane: number, lenSteps = 0) => notes.push({ t: Math.round(step * per), lane, len: Math.round(lenSteps * per) });

  for (const { step, bar, s, section } of songSteps(song)) {
    if (bar < LEAD_IN_BARS) continue;
    const loop = bar % 4;
    const leadNote = song.lead[loop][s];
    const bassNote = song.bass[loop][s];
    const onBeat = s % 4 === 0;
    const drop = !!section.drop;

    if (difficulty === 'easy') {
      // Une note par temps au plus : la grosse caisse et la caisse claire, sur des pistes qui tournent doucement.
      if (!onBeat) continue;
      if (section.kick && song.kick[s] && s % 8 === 0) add(step, (bar + s / 8) % 2 === 0 ? 0 : 3);
      else if (section.snare && song.snare[s]) add(step, bar % 2 === 0 ? 1 : 2);
      else if (!section.kick && !section.snare && section.lead && leadNote && s === 0) add(step, 2, 8);
      continue;
    }

    if (difficulty === 'medium') {
      if (section.kick && song.kick[s] && onBeat) add(step, 0);
      if (section.snare && song.snare[s]) add(step, 3);
      if (section.lead && leadNote && (drop ? s % 2 === 0 : onBeat)) add(step, leadNote >= 72 ? 2 : 1);
      // Notes longues sur la basse en dehors des drops.
      if (!drop && section.bass && bassNote && s === 0 && !section.kick) add(step, 1, 6);
      continue;
    }

    // HARD : basse, caisse claire, mélodie et charleston sur les drops, notes doubles et longues.
    if (section.kick && song.kick[s]) add(step, 0);
    if (section.snare && song.snare[s]) add(step, 3);
    if (section.lead && leadNote) add(step, leadNote >= 74 ? 2 : 1);
    if (drop && section.hat && song.hat[s] && !leadNote && !song.kick[s] && !song.snare[s]) add(step, s % 4 === 2 ? 2 : 1);
    if (!drop && section.bass && bassNote && s === 0) add(step, 1, 4);
  }

  return sanitize(notes);
}

/** Retire les doublons, les notes trop rapprochées sur une piste, et celles trop proches de la fin. */
function sanitize(notes: BeatNote[]): BeatNote[] {
  const sorted = notes.filter((n) => n.t + n.len <= BEAT_MS - END_MARGIN_MS).sort((a, b) => a.t - b.t || a.lane - b.lane);
  const lastEnd = new Array<number>(LANES).fill(-Infinity);
  const out: BeatNote[] = [];
  for (const n of sorted) {
    if (n.t - lastEnd[n.lane] < MIN_LANE_GAP_MS) continue;
    // Jamais plus de deux notes simultanées.
    if (out.filter((o) => o.t === n.t).length >= 2) continue;
    out.push(n);
    lastEnd[n.lane] = n.t + n.len;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Barème

export const PERFECT_MS = 60;
export const GOOD_MS = 120;
export const COMBO_STEP = 10;
export const MAX_MULT = 4;

export function comboMultiplier(comboBefore: number): number {
  return Math.min(MAX_MULT, 1 + Math.floor(comboBefore / COMBO_STEP));
}

/** Nombre de jugements d'une beatmap : une note simple = 1, une note longue = 2 (attaque et relâche). */
export function judgementCount(map: BeatNote[]): number {
  return map.reduce((n, note) => n + (note.len > 0 ? 2 : 1), 0);
}

/** Score maximal possible : tout en PERFECT, combo jamais cassé. */
export function maxScoreForMap(map: BeatNote[]): number {
  let total = 0;
  const count = judgementCount(map);
  for (let i = 0; i < count; i++) total += 100 * comboMultiplier(i);
  return total;
}

const MAX_CACHE = new Map<BeatDifficulty, number>();

/** Plafond par difficulté : le meilleur morceau possible (sert à la validation serveur). */
export function beatMaxScore(difficulty: BeatDifficulty): number {
  if (!MAX_CACHE.has(difficulty)) MAX_CACHE.set(difficulty, Math.max(...SONGS.map((s) => maxScoreForMap(buildBeatmap(s, difficulty)))));
  return MAX_CACHE.get(difficulty)!;
}
