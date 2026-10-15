import { describe, expect, it } from 'vitest';
import { SEED_PRODUCTS } from '../data/seed';
import { matchProducts } from './productMatch';

describe('sélection de produits', () => {
  it('propose entre 2 et 4 produits pour chaque profil', () => {
    for (const hair of ['fine', 'thick', 'curly', 'coily'] as const)
      for (const scalp of ['normal', 'dry', 'oily'] as const)
        for (const beard of [true, false])
          for (const effect of ['volume', 'hold', 'shine', 'natural', 'care'] as const) {
            const res = matchProducts(SEED_PRODUCTS, { hair, scalp, beard, effect });
            expect(res.length).toBeGreaterThanOrEqual(2);
            expect(res.length).toBeLessThanOrEqual(4);
            if (!beard) expect(res.some((p) => p.for_beard)).toBe(false);
            else expect(res.some((p) => p.for_beard)).toBe(true);
          }
  });

  it('met en avant le produit le plus adapté', () => {
    const res = matchProducts(SEED_PRODUCTS, { hair: 'fine', scalp: 'normal', beard: false, effect: 'volume' });
    expect(res[0].name).toMatch(/Poudre texturisante/);
  });
});
