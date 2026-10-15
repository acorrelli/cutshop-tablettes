import { describe, expect, it } from 'vitest';
import { SEED_QUESTIONS } from '../data/seed';
import {
  BASE_POINTS,
  QUESTION_MS,
  SPEED_BONUS,
  cleanPseudo,
  computePoints,
  mergeScore,
  pickQuestions,
  rankScores,
} from './battle';

describe('score de la Battle', () => {
  it('donne 0 point pour une mauvaise réponse', () => {
    expect(computePoints(false, 500)).toBe(0);
    expect(computePoints(false, 14000)).toBe(0);
  });

  it('récompense la justesse et la rapidité', () => {
    expect(computePoints(true, 0)).toBe(BASE_POINTS + SPEED_BONUS);
    expect(computePoints(true, QUESTION_MS / 2)).toBe(BASE_POINTS + SPEED_BONUS / 2);
    expect(computePoints(true, QUESTION_MS)).toBe(BASE_POINTS);
    expect(computePoints(true, 3000)).toBe(900);
    expect(computePoints(true, 1000)).toBeGreaterThan(computePoints(true, 2000));
  });

  it('refuse une réponse hors délai et borne les temps négatifs', () => {
    expect(computePoints(true, QUESTION_MS + 1)).toBe(0);
    expect(computePoints(true, -50)).toBe(1000);
  });

  it('classe par points puis par rapidité', () => {
    const ranked = rankScores([
      { id: 'a', pseudo: 'Ana', total: 1800, time: 9000, correct: 2 },
      { id: 'b', pseudo: 'Bob', total: 2500, time: 6000, correct: 3 },
      { id: 'c', pseudo: 'Cid', total: 1800, time: 4000, correct: 2 },
    ]);
    expect(ranked.map((r) => r.pseudo)).toEqual(['Bob', 'Cid', 'Ana']);
  });

  it('fusionne les scores reçus en gardant le plus avancé', () => {
    const older = { id: 'a', pseudo: 'Ana', total: 900, time: 3000, correct: 1 };
    const newer = { id: 'a', pseudo: 'Ana', total: 1800, time: 6000, correct: 2 };
    expect(mergeScore(older, newer)).toEqual(newer);
    expect(mergeScore(newer, older)).toEqual(newer);
    expect(mergeScore(undefined, older)).toEqual(older);
  });

  it('sélectionne 10 questions identiques pour une même graine, avec la bonne réponse suivie', () => {
    const a = pickQuestions(SEED_QUESTIONS, 1234, 'mix');
    const b = pickQuestions(SEED_QUESTIONS, 1234, 'mix');
    expect(a).toHaveLength(10);
    expect(a).toEqual(b);
    expect(new Set(a.map((q) => q.id)).size).toBe(10);
    for (const q of a) {
      const source = SEED_QUESTIONS.find((s) => s.id === q.id)!;
      expect(q.answers_fr[q.correct]).toBe(source.answers_fr[source.correct_index]);
      expect(q.answers_en[q.correct]).toBe(source.answers_en[source.correct_index]);
    }
  });

  it('mélange la position de la bonne réponse', () => {
    const positions = new Set(pickQuestions(SEED_QUESTIONS, 99, 'mix').map((q) => q.correct));
    expect(positions.size).toBeGreaterThan(1);
  });

  it('respecte le thème choisi', () => {
    const kids = pickQuestions(SEED_QUESTIONS, 5, 'kids');
    expect(kids.every((q) => q.theme === 'kids')).toBe(true);
  });

  it('nettoie les pseudos', () => {
    expect(cleanPseudo('  Barbe   Noire  ')).toBe('Barbe Noire');
    expect(cleanPseudo('Jean-Luc')).toBe('Jean Luc');
    expect(cleanPseudo('Unpseudobeaucouptroplong')).toHaveLength(14);
  });
});
