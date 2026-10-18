import { describe, expect, it } from 'vitest';
import { isPlausible } from '../../validation';
import { glassAt, gradeFor, GLASSES, NEXT_MS, POUR_MS, PourEngine, releaseLevel, SETTLE_MS, streakBonus } from './engine';

/** Joueur simulé : verse jusqu'au niveau visé (en anticipant la retombée de mousse), relâche, attend la note. */
function playGlass(e: PourEngine, t: number, aim = 0): number {
  e.update(t);
  e.press(t);
  const level = releaseLevel(e.spec) + aim;
  while (e.phase === 'pouring' && e.total < level) {
    t += 10;
    e.update(t);
  }
  e.release(t);
  t += SETTLE_MS + NEXT_MS + 20;
  e.update(t);
  return t;
}

describe('Perfect Pour', () => {
  it('donne la même suite de verres à toutes les tablettes d’une partie', () => {
    const a = Array.from({ length: 20 }, (_, i) => glassAt(1234, i));
    const b = Array.from({ length: 20 }, (_, i) => glassAt(1234, i));
    expect(a).toEqual(b);
    const c = Array.from({ length: 20 }, (_, i) => glassAt(999, i).kind);
    expect(c).not.toEqual(a.map((g) => g.kind));
  });

  it('resserre la tolérance au fil des verres', () => {
    const first = glassAt(7, 0);
    const late = glassAt(7, 30);
    expect(late.tol / GLASSES[late.kind].tol).toBeCloseTo(0.65, 5);
    expect(first.tol).toBe(GLASSES[first.kind].tol);
  });

  it('note le service selon l’écart au niveau et à la mousse idéals', () => {
    const s = GLASSES.tulip;
    expect(gradeFor(s, s.target, s.foam)).toBe('perfect');
    expect(gradeFor(s, s.target + s.tol * 1.5, s.foam)).toBe('great');
    expect(gradeFor(s, s.target - s.tol * 3, s.foam)).toBe('ok');
    expect(gradeFor(s, 0.4, 0.05)).toBe('miss');
    expect(gradeFor(s, 1.01, s.foam)).toBe('overflow');
  });

  it('plafonne le bonus de série', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(2)).toBe(25);
    expect(streakBonus(5)).toBe(100);
    expect(streakBonus(12)).toBe(100);
  });

  it('fait déborder un verre tenu trop longtemps', () => {
    const e = new PourEngine(42);
    e.start(0);
    e.press(0);
    e.update(8000);
    expect(e.counts.overflow).toBe(1);
    expect(e.last?.grade).toBe('overflow');
    expect(e.streak).toBe(0);
  });

  it('ignore les appuis avant le départ et termine à la fin du temps', () => {
    const e = new PourEngine(5);
    e.start(1000);
    e.press(500);
    expect(e.phase).toBe('ready');
    e.update(1000 + POUR_MS + 5);
    expect(e.isOver(1000 + POUR_MS)).toBe(true);
    expect(e.phase).toBe('over');
    e.press(1000 + POUR_MS + 10);
    expect(e.phase).toBe('over');
  });

  it('reste déterministe quelle que soit la cadence d’affichage', () => {
    const run = (frame: number) => {
      const e = new PourEngine(77);
      e.start(0);
      let t = 0;
      e.press(0);
      while (t < 1700) {
        t += frame;
        e.update(t);
      }
      e.release(1700);
      e.update(4000);
      return { score: e.score, counts: { ...e.counts }, liquid: e.liquid };
    };
    expect(run(16)).toEqual(run(10));
    expect(run(33)).toEqual(run(10));
  });

  it('récompense le joueur qui anticipe la retombée de la mousse', () => {
    const grades = (aim: number) => {
      const e = new PourEngine(31);
      e.start(0);
      playGlass(e, 0, aim);
      return e.last?.grade;
    };
    expect(grades(0)).toBe('perfect');
    // Relâcher pile sur la zone sans anticiper : un bon verre, pas parfait.
    const e = new PourEngine(31);
    expect(grades(e.spec.target - releaseLevel(e.spec))).toBe('great');
    expect(grades(-0.3)).toBe('miss');
  });

  it('produit un résultat plausible pour un excellent joueur', () => {
    const e = new PourEngine(2026);
    e.start(0);
    let t = 0;
    while (!e.isOver(t)) t = playGlass(e, t);
    e.update(t);
    const r = e.result();
    expect(r.stats.glasses).toBeGreaterThan(10);
    expect(r.stats.perfect + r.stats.great).toBeGreaterThan(r.stats.glasses / 2);
    expect(r.score).toBeGreaterThan(1500);
    expect(isPlausible('pour', 'std', r)).toBe(true);
  });
});
