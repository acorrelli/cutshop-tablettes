// Moteur de Perfect Pour : remplissage, mousse, débordement et notation. Aucune dépendance à l'affichage.
// Les niveaux sont exprimés en fraction de la hauteur du verre (0 = vide, 1 = bord).
import { createRng, pick } from '../../rng';
import type { ArcadeGameEngine, GameResult } from '../../types';

export type GlassKind = 'tulip' | 'straight' | 'ballon' | 'tasting';
export const GLASS_KINDS: GlassKind[] = ['tulip', 'straight', 'ballon', 'tasting'];

export interface GlassSpec {
  kind: GlassKind;
  /** Vitesse de montée du liquide versé, en hauteur de verre par seconde. */
  rate: number;
  /** Niveau total idéal (liquide + mousse). */
  target: number;
  /** Épaisseur de mousse idéale. */
  foam: number;
  /** Tolérance de base sur le niveau. */
  tol: number;
}

export const GLASSES: Record<GlassKind, GlassSpec> = {
  tulip: { kind: 'tulip', rate: 0.4, target: 0.9, foam: 0.15, tol: 0.04 },
  straight: { kind: 'straight', rate: 0.48, target: 0.92, foam: 0.09, tol: 0.045 },
  ballon: { kind: 'ballon', rate: 0.34, target: 0.86, foam: 0.2, tol: 0.038 },
  tasting: { kind: 'tasting', rate: 0.56, target: 0.88, foam: 0.12, tol: 0.035 },
};

export const POUR_MS = 60000;
/** Délai entre le relâchement et la notation (la mousse se pose). Un nouvel appui avant la note reprend le service. */
export const SETTLE_MS = 800;
/** Pause entre deux verres. */
export const NEXT_MS = 900;
/** La mousse prend plus de place que le liquide. */
const FOAM_VOLUME = 2.2;
/** Vitesse à laquelle la mousse retombe (par seconde). */
const SETTLE_RATE = 0.5;

export type Grade = 'perfect' | 'great' | 'ok' | 'miss' | 'overflow';
export const GRADE_POINTS: Record<Grade, number> = { perfect: 200, great: 150, ok: 75, miss: 0, overflow: 0 };

export interface GradeInfo {
  grade: Grade;
  points: number;
  bonus: number;
  /** Niveau total et mousse au moment de la note. */
  total: number;
  foam: number;
}

/** Spécification du n ième verre : le même pour toutes les tablettes d'une partie (graine commune). */
export function glassAt(seed: number, index: number): GlassSpec & { wobble: number; phase: number } {
  const rng = createRng(seed ^ Math.imul(index + 1, 0x9e3779b1));
  const base = GLASSES[pick(rng, GLASS_KINDS)];
  // Difficulté progressive : tolérance réduite jusqu'à 35 %, service plus rapide jusqu'à 25 %
  // et débit du fût de plus en plus irrégulier à partir du troisième verre.
  const p = Math.min(1, index / 16);
  const wobble = index < 2 ? 0 : 0.08 + 0.17 * p;
  return { ...base, tol: base.tol * (1 - 0.35 * p), rate: base.rate * (1 + 0.25 * p), wobble, phase: rng() * Math.PI * 2 };
}

/**
 * Part de mousse dans ce qui est versé, calculée pour qu'un verre relâché au bon moment
 * retombe exactement au niveau idéal une fois la mousse posée.
 */
export function foamShare(spec: GlassSpec): number {
  const s = Math.exp(-SETTLE_RATE * (SETTLE_MS / 1000));
  const foamAtRelease = spec.foam / s;
  const loss = foamAtRelease * (1 - s) * (1 - 1 / FOAM_VOLUME);
  return foamAtRelease / (spec.target + loss);
}

/** Niveau total auquel relâcher pour obtenir un verre parfait (la mousse retombe ensuite). */
export function releaseLevel(spec: GlassSpec): number {
  const s = Math.exp(-SETTLE_RATE * (SETTLE_MS / 1000));
  return spec.target + (spec.foam / s) * (1 - s) * (1 - 1 / FOAM_VOLUME);
}

export function gradeFor(spec: GlassSpec, total: number, foam: number): Grade {
  if (total > 1) return 'overflow';
  const e = Math.max(Math.abs(total - spec.target) / spec.tol, Math.abs(foam - spec.foam) / (spec.tol * 1.5));
  if (e <= 1) return 'perfect';
  if (e <= 2) return 'great';
  if (e <= 3.5) return 'ok';
  return 'miss';
}

/** Bonus de série : +25 par verre parfait consécutif à partir du deuxième, plafonné à +100. */
export function streakBonus(streak: number): number {
  return streak >= 2 ? Math.min(100, 25 * (streak - 1)) : 0;
}

export type Phase = 'ready' | 'pouring' | 'settling' | 'graded' | 'over';

export class PourEngine implements ArcadeGameEngine {
  readonly seed: number;
  readonly durationMs: number;
  startedAt = 0;
  lastUpdate = 0;
  index = 0;
  spec: ReturnType<typeof glassAt>;
  /** Temps passé à verser ce verre (le débit varie avec lui). */
  pourMs = 0;
  liquid = 0;
  foam = 0;
  phase: Phase = 'ready';
  phaseAt = 0;
  score = 0;
  streak = 0;
  last: GradeInfo | null = null;
  counts: Record<Grade, number> = { perfect: 0, great: 0, ok: 0, miss: 0, overflow: 0 };
  private over = false;

  constructor(seed: number, durationMs = POUR_MS) {
    this.seed = seed;
    this.durationMs = durationMs;
    this.spec = glassAt(seed, 0);
  }

  get total(): number {
    return this.liquid + this.foam;
  }

  start(now: number): void {
    this.startedAt = now;
    this.lastUpdate = now;
    this.phaseAt = now;
  }

  remaining(now: number): number {
    return Math.max(0, this.startedAt + this.durationMs - now);
  }

  press(now: number): void {
    this.update(now);
    if (this.over || now < this.startedAt) return;
    if (this.phase === 'ready' || this.phase === 'settling') {
      this.phase = 'pouring';
      this.phaseAt = now;
    }
  }

  release(now: number): void {
    this.update(now);
    if (this.phase === 'pouring') {
      this.phase = 'settling';
      this.phaseAt = now;
    }
  }

  update(now: number): void {
    if (this.over) return;
    // Simulation par pas de 10 ms : même résultat quelle que soit la fréquence d'affichage.
    while (this.lastUpdate < now) {
      const step = Math.min(10, now - this.lastUpdate);
      this.lastUpdate += step;
      this.simulate(step / 1000, this.lastUpdate);
      if (this.over) return;
    }
  }

  private simulate(dt: number, t: number): void {
    if (t >= this.startedAt + this.durationMs) {
      this.finish(t);
      return;
    }
    if (this.phase === 'pouring') {
      this.pourMs += dt * 1000;
      const inflow = this.flow() * dt;
      // Le volume versé se partage entre bière et mousse (la mousse occupe plus de place).
      const share = foamShare(this.spec);
      this.foam += inflow * share;
      this.liquid += inflow * (1 - share);
      if (this.total > 1) this.grade(t, 'overflow');
    } else if (this.phase === 'settling' || this.phase === 'ready') {
      // La mousse retombe et redevient liquide.
      const settle = this.foam * SETTLE_RATE * dt;
      this.foam -= settle;
      this.liquid += settle / FOAM_VOLUME;
      if (this.phase === 'settling' && t - this.phaseAt >= SETTLE_MS) this.grade(t, null);
    } else if (this.phase === 'graded' && t - this.phaseAt >= NEXT_MS) {
      this.index += 1;
      this.spec = glassAt(this.seed, this.index);
      this.liquid = 0;
      this.foam = 0;
      this.pourMs = 0;
      this.phase = 'ready';
      this.phaseAt = t;
    }
  }

  /** Débit du fût (hauteur de verre par seconde), irrégulier sur les verres avancés. */
  flow(): number {
    const { rate, wobble, phase } = this.spec;
    return rate * (1 + wobble * Math.sin(phase + (this.pourMs / 1000) * 3.1));
  }

  private grade(t: number, forced: Grade | null): void {
    const grade = forced ?? gradeFor(this.spec, this.total, this.foam);
    this.streak = grade === 'perfect' ? this.streak + 1 : 0;
    const bonus = grade === 'perfect' ? streakBonus(this.streak) : 0;
    const points = GRADE_POINTS[grade];
    this.score += points + bonus;
    this.counts[grade] += 1;
    this.last = { grade, points, bonus, total: Math.min(1, this.total), foam: this.foam };
    this.phase = 'graded';
    this.phaseAt = t;
  }

  isOver(now: number): boolean {
    return this.over || now >= this.startedAt + this.durationMs;
  }

  finish(now: number): void {
    if (this.over) return;
    // Un verre en cours au coup de sifflet n'est pas noté.
    this.over = true;
    this.phase = 'over';
    this.phaseAt = now;
  }

  served(): number {
    return Object.values(this.counts).reduce((a, b) => a + b, 0);
  }

  result(): GameResult {
    return {
      score: this.score,
      stats: { glasses: this.served(), ...this.counts },
      durationMs: this.durationMs,
    };
  }

  dispose(): void {
    /* aucune ressource externe */
  }
}
