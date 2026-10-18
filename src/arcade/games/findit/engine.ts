// Moteur de Find It Cutshop : séquence de scènes, objets à trouver, points et chasse compétitive. Aucune dépendance à l'affichage.
// race : chaque tablette joue seule la même suite de scènes (graine commune).
// hunt : tout le monde cherche les mêmes objets ; le serveur attribue chaque objet à la première table qui le réclame.
import { createRng, shuffle } from '../../rng';
import type { ArcadeGameEngine, GameResult, TableNo } from '../../types';
import { hitKeys, SCENES, type ObjectKey } from './sceneData';

export type FinditVariant = 'race' | 'hunt';

export const FINDIT_MS = 90000;
/** Objets à trouver par scène. */
export const ROUND_SIZE = 5;
/** Scènes au plus par partie (plafond de validation.ts). */
export const MAX_SCENES = 9;
/** Pause de célébration entre deux scènes. */
export const NEXT_MS = 1400;
/** Deux touchers ratés à moins de 250 ms : le second est ignoré (anti rafale). */
export const TAP_GAP_MS = 250;
/** Le bonus de vitesse décroît jusqu'à 0 en 20 s depuis le début de la scène. */
export const BONUS_MS = 20000;
export const FIND_POINTS = 100;
export const SPEED_BONUS_MAX = 50;
export const WRONG_PENALTY = 10;
export const CLEAN_BONUS = 200;
export const MAX_SCORE = 7000;
/** Chasse : une réclamation sans réponse est abandonnée après ce délai (le joueur peut réessayer). */
export const CLAIM_TIMEOUT_MS = 4000;

export interface RoundSpec {
  index: number;
  scene: number;
  targets: ObjectKey[];
}

function mix(seed: number, salt: number): number {
  return (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
}

/** Ordre des scènes par blocs de 4 (chaque scène une fois par bloc), sans répéter la même scène deux fois de suite. */
function sceneOrder(seed: number, upTo: number): number[] {
  const out: number[] = [];
  const ids = SCENES.map((_, i) => i);
  for (let block = 0; out.length <= upTo; block++) {
    const order = shuffle(createRng(mix(seed, 1000 + block)), ids);
    if (out.length && order[0] === out[out.length - 1]) [order[0], order[1]] = [order[1], order[0]];
    out.push(...order);
  }
  return out;
}

/** Scène et objets de la manche n : identiques sur toutes les tablettes d'une partie. */
export function roundAt(seed: number, index: number): RoundSpec {
  const scene = sceneOrder(seed, index)[index];
  const keys = SCENES[scene].objects.map((o) => o.key);
  const targets = shuffle(createRng(mix(seed, index)), keys).slice(0, ROUND_SIZE);
  return { index, scene, targets };
}

/** Identifiant d'objet envoyé au serveur en chasse : "manche:clé". */
export function objectId(round: number, key: ObjectKey): string {
  return `${round}:${key}`;
}

export function speedBonus(elapsedMs: number): number {
  return Math.round(SPEED_BONUS_MAX * Math.max(0, 1 - Math.max(0, elapsedMs) / BONUS_MS));
}

export type TapOutcome =
  | { kind: 'found'; key: ObjectKey; points: number; bonus: number; cleared: boolean; clean: boolean }
  | { kind: 'claim'; key: ObjectKey; id: string }
  | { kind: 'taken'; key: ObjectKey; owner: TableNo }
  | { kind: 'wrong'; penalty: number }
  | { kind: 'ignored' };

/** play : on cherche ; cleared : scène terminée, pause avant la suivante ; done : toutes les scènes faites ; over : fin. */
export type Phase = 'play' | 'cleared' | 'done' | 'over';

export interface Claimed {
  owner: TableNo;
  at: number;
}

export class FinditEngine implements ArcadeGameEngine {
  readonly seed: number;
  readonly variant: FinditVariant;
  readonly durationMs: number;
  readonly me: TableNo;
  startedAt = 0;
  phase: Phase = 'play';
  phaseAt = 0;
  round: RoundSpec;
  roundStartedAt = 0;
  /** Course : objets trouvés dans la manche (clé -> instant). */
  found = new Map<ObjectKey, number>();
  wrongInRound = 0;
  score = 0;
  foundTotal = 0;
  scenesDone = 0;
  cleanScenes = 0;
  wrong = 0;
  /** Dernière scène terminée (affichage de la célébration). */
  lastClear: { clean: boolean; bonus: number } | null = null;
  /** Chasse : objets attribués (identifiant -> table), fusion du serveur et des réponses reçues. */
  claims = new Map<string, Claimed>();
  /** Chasse : réclamations en attente de réponse (identifiant -> instant). */
  pending = new Map<string, number>();
  /** Incrémenté à chaque changement visible : l'affichage ne se redessine que dans ce cas. */
  version = 0;
  private lastTapAt = -Infinity;
  private over = false;

  constructor(seed: number, variant: string, durationMs = FINDIT_MS, me: TableNo | null = null) {
    this.seed = seed >>> 0;
    this.variant = variant === 'hunt' ? 'hunt' : 'race';
    this.durationMs = durationMs;
    this.me = me ?? 1;
    this.round = roundAt(this.seed, 0);
  }

  start(now: number): void {
    this.startedAt = now;
    this.phaseAt = now;
    this.roundStartedAt = now;
    this.version++;
  }

  remaining(now: number): number {
    return Math.max(0, this.startedAt + this.durationMs - now);
  }

  // ---------------------------------------------------------------------------
  // Toucher

  /** Toucher en (x, y), coordonnées de scène. */
  tap(now: number, x: number, y: number): TapOutcome {
    const hits = hitKeys(this.round.scene, x, y);
    return this.tapKeys(now, hits);
  }

  /** Toucher sur une liste d'objets candidats (du plus proche au plus lointain), vide si rien n'est touché. */
  tapKeys(now: number, hits: ObjectKey[]): TapOutcome {
    this.update(now);
    if (this.over || now < this.startedAt || this.phase !== 'play') return { kind: 'ignored' };
    const gap = now - this.lastTapAt;
    this.lastTapAt = now;
    const targets = this.round.targets;
    // Indulgence : si le doigt couvre un objet de la liste encore libre, c'est lui qui compte.
    const open = hits.find((k) => targets.includes(k) && !this.isDone(k));
    if (open) return this.variant === 'race' ? this.findRace(now, open) : this.findHunt(now, open);
    const done = hits.find((k) => targets.includes(k));
    if (done) {
      const c = this.variant === 'hunt' ? this.claims.get(objectId(this.round.index, done)) : undefined;
      return c && c.owner !== this.me ? { kind: 'taken', key: done, owner: c.owner } : { kind: 'ignored' };
    }
    if (gap < TAP_GAP_MS) return { kind: 'ignored' };
    this.wrong++;
    this.wrongInRound++;
    const before = this.score;
    if (this.variant === 'race') this.score = Math.max(0, this.score - WRONG_PENALTY);
    this.version++;
    return { kind: 'wrong', penalty: this.variant === 'race' ? before - this.score : WRONG_PENALTY };
  }

  /** Objet de la manche déjà trouvé (course), attribué ou en cours de réclamation (chasse). */
  isDone(key: ObjectKey): boolean {
    if (this.variant === 'race') return this.found.has(key);
    const id = objectId(this.round.index, key);
    return this.claims.has(id) || this.pending.has(id);
  }

  private findRace(now: number, key: ObjectKey): TapOutcome {
    const bonus = speedBonus(now - this.roundStartedAt);
    this.found.set(key, now);
    this.foundTotal++;
    this.score += FIND_POINTS + bonus;
    let cleared = false;
    let clean = false;
    if (this.found.size >= ROUND_SIZE) {
      cleared = true;
      clean = this.wrongInRound === 0;
      this.scenesDone++;
      if (clean) {
        this.cleanScenes++;
        this.score += CLEAN_BONUS;
      }
      this.lastClear = { clean, bonus: clean ? CLEAN_BONUS : 0 };
      this.setPhase(this.scenesDone >= MAX_SCENES ? 'done' : 'cleared', now);
    }
    this.version++;
    return { kind: 'found', key, points: FIND_POINTS, bonus, cleared, clean };
  }

  private findHunt(now: number, key: ObjectKey): TapOutcome {
    const id = objectId(this.round.index, key);
    this.pending.set(id, now);
    this.version++;
    return { kind: 'claim', key, id };
  }

  // ---------------------------------------------------------------------------
  // Chasse compétitive

  /** Réponse du serveur à une réclamation (null : erreur ou limite de cadence, le joueur peut réessayer). */
  resolveClaim(now: number, id: string, res: { won: boolean; owner: TableNo } | null): void {
    this.pending.delete(id);
    if (res && !this.claims.has(id)) this.claims.set(id, { owner: res.owner, at: now });
    this.version++;
    this.update(now);
  }

  /** Attributions connues du serveur (rafraîchies régulièrement) : elles font foi. */
  syncClaims(now: number, server: Record<string, TableNo> | undefined): void {
    if (!server) return;
    let changed = false;
    for (const [id, owner] of Object.entries(server)) {
      const c = this.claims.get(id);
      if (!c || c.owner !== owner) {
        this.claims.set(id, { owner, at: c?.at ?? now });
        changed = true;
      }
      if (this.pending.delete(id)) changed = true;
    }
    if (changed) {
      this.version++;
      this.update(now);
    }
  }

  ownerOf(key: ObjectKey): TableNo | null {
    return this.claims.get(objectId(this.round.index, key))?.owner ?? null;
  }

  /** Manches entièrement attribuées depuis le début (déduit des attributions : identique pour tous). */
  completedRounds(): number {
    let r = 0;
    while (r < 99 && roundAt(this.seed, r).targets.every((k) => this.claims.has(objectId(r, k)))) r++;
    return r;
  }

  myClaims(): number {
    let n = 0;
    for (const c of this.claims.values()) if (c.owner === this.me) n++;
    return n;
  }

  // ---------------------------------------------------------------------------
  // Temps

  update(now: number): void {
    if (this.over) return;
    if (now >= this.startedAt + this.durationMs) {
      this.finish(now);
      return;
    }
    if (this.variant === 'hunt') {
      for (const [id, at] of this.pending) {
        if (now - at > CLAIM_TIMEOUT_MS) {
          this.pending.delete(id);
          this.version++;
        }
      }
      if (this.phase === 'play' && this.completedRounds() > this.round.index) {
        this.scenesDone = Math.min(MAX_SCENES, this.round.index + 1);
        this.lastClear = { clean: false, bonus: 0 };
        this.setPhase('cleared', now);
      }
    }
    if (this.phase === 'cleared' && now - this.phaseAt >= NEXT_MS) this.nextRound(this.phaseAt + NEXT_MS);
  }

  private nextRound(t: number): void {
    this.round = roundAt(this.seed, this.round.index + 1);
    this.found = new Map();
    this.wrongInRound = 0;
    this.roundStartedAt = t;
    this.setPhase('play', t);
  }

  private setPhase(p: Phase, t: number): void {
    this.phase = p;
    this.phaseAt = t;
    this.version++;
  }

  isOver(now: number): boolean {
    return this.over || now >= this.startedAt + this.durationMs;
  }

  finish(now: number): void {
    if (this.over) return;
    this.over = true;
    this.setPhase('over', now);
  }

  /** Score affiché : course plafonnée à 7 000 ; chasse = 100 par objet remporté moins 10 par erreur (50 erreurs au plus). */
  liveScore(): number {
    if (this.variant === 'hunt') return Math.max(0, FIND_POINTS * this.myClaims() - WRONG_PENALTY * Math.min(50, this.wrong));
    return Math.min(MAX_SCORE, this.score);
  }

  result(): GameResult {
    const hunt = this.variant === 'hunt';
    const found = hunt ? this.myClaims() : this.foundTotal;
    const scenes = hunt ? this.completedRounds() : this.scenesDone;
    return {
      score: this.liveScore(),
      stats: {
        found: Math.min(45, found),
        scenes: Math.min(MAX_SCENES, scenes),
        wrong: this.wrong,
        clean: this.cleanScenes,
      },
      durationMs: this.durationMs,
    };
  }

  dispose(): void {
    /* aucune ressource externe */
  }
}
