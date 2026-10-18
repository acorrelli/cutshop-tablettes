// Registre des mini jeux : tout ce que la plateforme doit savoir d'un jeu, sans dépendre de son affichage.
// Ajouter un jeu = ajouter une entrée ici, un moteur et un composant dans games/<jeu>/.
import { BEAT_DIFFICULTIES, beatMaxScore, BEAT_MS, type BeatDifficulty } from './games/beat/songs';
import type { GameKey } from './types';

export interface VariantDef {
  key: string;
  label_fr: string;
  label_en: string;
}

export interface GameDef {
  key: GameKey;
  title: string;
  tagline_fr: string;
  tagline_en: string;
  /** Durée affichée sur la carte. */
  duration_fr: string;
  duration_en: string;
  durationMs: (variant: string) => number;
  /** Plafond théorique du score : tout score supérieur est refusé par le serveur. */
  maxScore: (variant: string) => number;
  /** Variantes : difficulté (Beat Drop) ou mode multijoueur (Find It). */
  variants: VariantDef[];
  defaultVariant: string;
  /** Variantes proposées en solo (les autres sont réservées au multijoueur). */
  soloVariants: string[];
  needsAudio: boolean;
  /** Score donnant 1 000 points Challenge (voir challengePoints). */
  refScore: (variant: string) => number;
}

export const GAMES: Record<GameKey, GameDef> = {
  barber: {
    key: 'barber',
    title: 'Barber Rush',
    tagline_fr: 'Deviens le barbier le plus rapide.',
    tagline_en: 'Become the fastest barber.',
    duration_fr: '90 secondes',
    duration_en: '90 seconds',
    durationMs: () => 90000,
    maxScore: () => 9000,
    variants: [{ key: 'std', label_fr: 'Standard', label_en: 'Standard' }],
    defaultVariant: 'std',
    soloVariants: ['std'],
    needsAudio: false,
    refScore: () => 2400,
  },
  pour: {
    key: 'pour',
    title: 'Perfect Pour',
    tagline_fr: 'Sers la bière parfaite.',
    tagline_en: 'Pour the perfect beer.',
    duration_fr: '60 secondes',
    duration_en: '60 seconds',
    durationMs: () => 60000,
    maxScore: () => 8000,
    variants: [{ key: 'std', label_fr: 'Standard', label_en: 'Standard' }],
    defaultVariant: 'std',
    soloVariants: ['std'],
    needsAudio: false,
    refScore: () => 2600,
  },
  beat: {
    key: 'beat',
    title: 'Beat Drop',
    tagline_fr: 'Suis le rythme.',
    tagline_en: 'Follow the beat.',
    duration_fr: '72 secondes',
    duration_en: '72 seconds',
    durationMs: () => BEAT_MS,
    maxScore: (v) => beatMaxScore(asDifficulty(v)),
    variants: BEAT_DIFFICULTIES.map((d) => ({ key: d, label_fr: d.toUpperCase(), label_en: d.toUpperCase() })),
    defaultVariant: 'easy',
    soloVariants: [...BEAT_DIFFICULTIES],
    needsAudio: true,
    // Un score parfait vaut 1 000 points en EASY, 1 250 en MEDIUM et 1 500 en HARD.
    refScore: (v) => Math.round(beatMaxScore(asDifficulty(v)) / BEAT_WEIGHT[asDifficulty(v)]),
  },
  findit: {
    key: 'findit',
    title: 'Find It Cutshop',
    tagline_fr: 'Ouvre l’œil.',
    tagline_en: 'Keep your eyes open.',
    duration_fr: '90 secondes',
    duration_en: '90 seconds',
    durationMs: () => 90000,
    maxScore: () => 7000,
    variants: [
      { key: 'race', label_fr: 'Course au score', label_en: 'Score race' },
      { key: 'hunt', label_fr: 'Chasse compétitive', label_en: 'Competitive hunt' },
    ],
    defaultVariant: 'race',
    soloVariants: ['race'],
    needsAudio: false,
    refScore: () => 2200,
  },
};

const BEAT_WEIGHT: Record<BeatDifficulty, number> = { easy: 1, medium: 1.25, hard: 1.5 };

function asDifficulty(v: string): BeatDifficulty {
  return (BEAT_DIFFICULTIES as readonly string[]).includes(v) ? (v as BeatDifficulty) : 'easy';
}

export function isValidVariant(game: GameKey, variant: string): boolean {
  return GAMES[game].variants.some((v) => v.key === variant);
}

/** Points Challenge : score ramené sur 1 000 (plafonné à 1 500) pour comparer des jeux aux barèmes différents. */
export function challengePoints(game: GameKey, variant: string, score: number): number {
  const ref = GAMES[game].refScore(variant);
  if (ref <= 0 || score <= 0) return 0;
  return Math.round(Math.min(1500, (1000 * score) / ref));
}
