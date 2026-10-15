// Logique de la roue de la fortune.
// Le tirage officiel est fait côté serveur (fonction Postgres spin_wheel). Cette version TypeScript
// reproduit exactement la même règle : elle sert au mode démonstration et aux tests.

import type { WheelPrize, WheelSegment } from './types';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Gains réellement tirables : actifs, poids positif, stock non épuisé. */
export function eligiblePrizes(prizes: WheelPrize[]): WheelPrize[] {
  return prizes.filter((p) => p.active && p.weight > 0 && (p.stock === null || p.stock > 0));
}

/**
 * Tirage pondéré. `r` est un nombre dans [0, 1[.
 * On parcourt les gains dans l'ordre (sort, puis id) et on cumule les poids.
 */
export function pickWeighted(prizes: WheelPrize[], r: number): WheelPrize | null {
  const pool = eligiblePrizes(prizes).sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id));
  const total = pool.reduce((sum, p) => sum + p.weight, 0);
  if (total <= 0) return null;
  let target = Math.min(Math.max(r, 0), 0.999999999) * total;
  for (const p of pool) {
    if (target < p.weight) return p;
    target -= p.weight;
  }
  return pool[pool.length - 1];
}

/** Code gagnant de 6 caractères, sans caractères ambigus (0, O, 1, I). */
export function generateCode(rand: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return code;
}

/** Répète les segments pour obtenir une roue visuellement riche (au moins `min` cases). */
export function buildWheelSlots(segments: WheelSegment[], min = 8): WheelSegment[] {
  if (segments.length === 0) return [];
  const slots: WheelSegment[] = [];
  while (slots.length < min || slots.length % segments.length !== 0) {
    slots.push(segments[slots.length % segments.length]);
  }
  return slots;
}

/**
 * Angle final (en degrés, sens horaire) pour que la case `slotIndex` s'arrête sous le pointeur placé en haut.
 * La case i occupe [i * step, (i + 1) * step[ en partant du haut.
 */
export function targetRotation(slotIndex: number, slotCount: number, currentRotation: number, turns = 6, jitter = 0.5): number {
  const step = 360 / slotCount;
  const center = slotIndex * step + step / 2 + (jitter - 0.5) * step * 0.7;
  const base = currentRotation - (currentRotation % 360);
  return base + turns * 360 + (360 - center);
}

/** Courbe de ralentissement réaliste (rapide au départ, très lente à la fin). */
export function easeOutQuart(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - x, 4);
}

/** Index de la case située sous le pointeur pour une rotation donnée. */
export function slotUnderPointer(rotation: number, slotCount: number): number {
  const step = 360 / slotCount;
  const angle = ((360 - (rotation % 360)) % 360 + 360) % 360;
  return Math.floor(angle / step) % slotCount;
}
