import { describe, expect, it } from 'vitest';
import { SEED_PRIZES } from '../data/seed';
import { seededRandom } from './random';
import type { WheelPrize } from './types';
import {
  CODE_ALPHABET,
  buildWheelSlots,
  easeOutQuart,
  eligiblePrizes,
  generateCode,
  pickWeighted,
  slotUnderPointer,
  targetRotation,
} from './wheel';

const prize = (id: string, weight: number, extra: Partial<WheelPrize> = {}): WheelPrize => ({
  id,
  label_fr: id,
  label_en: id,
  weight,
  stock: null,
  is_losing: false,
  color: '#000',
  sort: Number(id.replace(/\D/g, '')) || 0,
  active: true,
  ...extra,
});

describe('tirage pondéré de la roue', () => {
  it('respecte les bornes cumulées des poids', () => {
    const prizes = [prize('p1', 10), prize('p2', 30), prize('p3', 60)];
    expect(pickWeighted(prizes, 0)?.id).toBe('p1');
    expect(pickWeighted(prizes, 0.0999)?.id).toBe('p1');
    expect(pickWeighted(prizes, 0.1)?.id).toBe('p2');
    expect(pickWeighted(prizes, 0.3999)?.id).toBe('p2');
    expect(pickWeighted(prizes, 0.4)?.id).toBe('p3');
    expect(pickWeighted(prizes, 0.99999)?.id).toBe('p3');
    expect(pickWeighted(prizes, 1)?.id).toBe('p3');
  });

  it('suit les probabilités sur un grand nombre de tours', () => {
    const rand = seededRandom(42);
    const counts: Record<string, number> = {};
    const N = 100000;
    for (let i = 0; i < N; i++) {
      const p = pickWeighted(SEED_PRIZES, rand())!;
      counts[p.id] = (counts[p.id] ?? 0) + 1;
    }
    const total = SEED_PRIZES.reduce((s, p) => s + p.weight, 0);
    for (const p of SEED_PRIZES) {
      expect(Math.abs((counts[p.id] / N) * 100 - (p.weight / total) * 100)).toBeLessThan(0.6);
    }
  });

  it('ignore les gains inactifs, sans poids ou en rupture de stock', () => {
    const prizes = [
      prize('p1', 50, { active: false }),
      prize('p2', 0),
      prize('p3', 50, { stock: 0 }),
      prize('p4', 5, { stock: 2 }),
    ];
    expect(eligiblePrizes(prizes).map((p) => p.id)).toEqual(['p4']);
    for (let r = 0; r < 1; r += 0.05) expect(pickWeighted(prizes, r)?.id).toBe('p4');
  });

  it('ne tire rien quand aucun gain n’est disponible', () => {
    expect(pickWeighted([prize('p1', 10, { active: false })], 0.5)).toBeNull();
    expect(pickWeighted([], 0.5)).toBeNull();
  });

  it('génère des codes de 6 caractères sans caractères ambigus', () => {
    const rand = seededRandom(7);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const code = generateCode(rand);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(1990);
    expect(CODE_ALPHABET).not.toMatch(/[01IO]/);
  });

  it('arrête la roue sur la case tirée', () => {
    const slots = buildWheelSlots(SEED_PRIZES.map((p) => ({ ...p })), 8);
    expect(slots.length % SEED_PRIZES.length).toBe(0);
    expect(slots.length).toBeGreaterThanOrEqual(8);
    for (let index = 0; index < slots.length; index++) {
      for (const jitter of [0, 0.5, 1]) {
        const rot = targetRotation(index, slots.length, 1234, 6, jitter);
        expect(rot).toBeGreaterThan(1234 + 5 * 360);
        expect(slotUnderPointer(rot, slots.length)).toBe(index);
      }
    }
  });

  it('ralentit progressivement', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
    expect(easeOutQuart(0.5)).toBeGreaterThan(0.9);
    expect(easeOutQuart(0.9) - easeOutQuart(0.8)).toBeLessThan(easeOutQuart(0.2) - easeOutQuart(0.1));
  });
});
