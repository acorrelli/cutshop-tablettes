// Sélection de produits selon le profil du client.

import type { Product, ProductProfile } from './types';

export function scoreProduct(p: Product, profile: ProductProfile): number {
  if (!p.active) return -1;
  // Un produit barbe n'est proposé qu'aux clients barbus.
  if (p.for_beard && !profile.beard) return -1;
  let score = 0;
  // Une liste vide signifie « convient à tous » : petit bonus, moins fort qu'une vraie correspondance.
  score += p.hair_types.length === 0 ? 1 : p.hair_types.includes(profile.hair) ? 3 : -2;
  score += p.scalp_types.length === 0 ? 1 : p.scalp_types.includes(profile.scalp) ? 3 : -2;
  score += p.effects.includes(profile.effect) ? 4 : 0;
  if (p.for_beard && profile.beard) score += 3;
  return score;
}

/** Retourne entre 2 et 4 produits, du plus pertinent au moins pertinent. */
export function matchProducts(products: Product[], profile: ProductProfile, min = 2, max = 4): Product[] {
  const scored = products
    .map((p) => ({ p, s: scoreProduct(p, profile) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s || a.p.sort - b.p.sort);
  const strong = scored.filter((x) => x.s >= 5);
  const picked = (strong.length >= min ? strong : scored).slice(0, max);
  // Si le profil a une barbe, on garantit au moins un produit barbe dans la sélection.
  if (profile.beard && !picked.some((x) => x.p.for_beard)) {
    const beard = scored.find((x) => x.p.for_beard);
    if (beard) {
      if (picked.length >= max) picked[picked.length - 1] = beard;
      else picked.push(beard);
    }
  }
  return picked.map((x) => x.p);
}
