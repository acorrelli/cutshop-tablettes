// Règles de la Battle : barème, sélection des questions et classement.

import type { Lang, QuizQuestion, QuizTheme } from './types';
import { seededRandom, shuffle } from './random';

export const QUESTION_COUNT = 10;
export const QUESTION_MS = 15000;
export const RESULT_MS = 5000;
export const LOBBY_MS = 30000;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export const BASE_POINTS = 500;
export const SPEED_BONUS = 500;

/**
 * Points d'une réponse : 0 si faux, sinon 500 points plus un bonus de rapidité
 * dégressif de 500 à 0 sur la durée de la question.
 */
export function computePoints(correct: boolean, elapsedMs: number, limitMs = QUESTION_MS): number {
  if (!correct || elapsedMs > limitMs) return 0;
  const ratio = 1 - Math.max(0, elapsedMs) / limitMs;
  return Math.round(BASE_POINTS + SPEED_BONUS * ratio);
}

/** Question prête à jouer : réponses mélangées, langue au choix au moment de l'affichage. */
export interface PlayQuestion {
  id: string;
  theme: QuizTheme;
  question_fr: string;
  question_en: string;
  answers_fr: string[];
  answers_en: string[];
  correct: number;
}

export function pickQuestions(
  pool: QuizQuestion[],
  seed: number,
  theme: QuizTheme | 'mix' = 'mix',
  count = QUESTION_COUNT,
): PlayQuestion[] {
  const rand = seededRandom(seed);
  const active = pool.filter((q) => q.active && q.answers_fr.length >= 2);
  let source = theme === 'mix' ? active : active.filter((q) => q.theme === theme);
  if (source.length < count) {
    // Thème trop court : on complète avec les autres questions.
    const extra = shuffle(active.filter((q) => !source.includes(q)), rand);
    source = source.concat(extra.slice(0, count - source.length));
  }
  return shuffle(source, rand)
    .slice(0, count)
    .map((q) => {
      const order = shuffle(
        q.answers_fr.map((_, i) => i),
        rand,
      );
      return {
        id: q.id,
        theme: q.theme,
        question_fr: q.question_fr,
        question_en: q.question_en,
        answers_fr: order.map((i) => q.answers_fr[i]),
        answers_en: order.map((i) => q.answers_en[i] ?? q.answers_fr[i]),
        correct: order.indexOf(q.correct_index),
      };
    });
}

export function questionText(q: PlayQuestion, lang: Lang): { question: string; answers: string[] } {
  return lang === 'en'
    ? { question: q.question_en, answers: q.answers_en }
    : { question: q.question_fr, answers: q.answers_fr };
}

export interface ScoreEntry {
  id: string;
  pseudo: string;
  total: number;
  /** Somme des temps de réponse corrects, pour départager les égalités. */
  time: number;
  correct: number;
  gone?: boolean;
}

/** Classement : points décroissants, puis rapidité cumulée, puis pseudo. */
export function rankScores(entries: ScoreEntry[]): ScoreEntry[] {
  return entries
    .slice()
    .sort((a, b) => b.total - a.total || a.time - b.time || a.pseudo.localeCompare(b.pseudo));
}

/** Fusion de deux tableaux de scores reçus de tablettes différentes (les totaux ne font que croître). */
export function mergeScore(a: ScoreEntry | undefined, b: ScoreEntry): ScoreEntry {
  if (!a) return b;
  if (b.total > a.total || (b.total === a.total && b.correct > a.correct)) return { ...b, gone: a.gone || b.gone };
  return a;
}

/** Nettoyage d'un pseudo saisi sur la tablette. */
export function cleanPseudo(raw: string): string {
  return raw.replace(/[‐-―-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 14);
}
