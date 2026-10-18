// Moteur de Barber Rush : clients, commandes, outils, patience et notation. Aucune dépendance à l'affichage.
// Le composant gère la géométrie (zones, tracés, cibles) et transmet au moteur des événements horodatés :
// choix d'outil, progression d'un tracé (couverture et précision), tap sur une cible, choix de produit, appui long.
import { createRng, pick, shuffle } from '../../rng';
import type { ArcadeGameEngine, GameResult } from '../../types';

export type Tool = 'clipper' | 'scissors' | 'razor' | 'beard' | 'product' | 'finish';
/** Ordre de la barre d'outils et ordre canonique des étapes d'une coupe. */
export const TOOLS: Tool[] = ['clipper', 'scissors', 'razor', 'beard', 'product', 'finish'];

export type ProductKind = 'wax' | 'pomade' | 'oil' | 'spray' | 'clay';
export const PRODUCTS: ProductKind[] = ['wax', 'pomade', 'oil', 'spray', 'clay'];

export type HairStyle = 'quiff' | 'curly' | 'slick' | 'afro' | 'messy';
export const HAIR_STYLES: HairStyle[] = ['quiff', 'curly', 'slick', 'afro', 'messy'];
/** Tracés de contour possibles : ligne du front, pattes, ligne de barbe sur les joues. */
export type ContourKind = 'hairline' | 'sideburns' | 'beardline';

export const SKIN_TONES = ['#F2CDB0', '#E3B08C', '#C98E66', '#A86B45', '#7E4E31', '#5A3522'];
export const HAIR_COLORS = ['#1C1612', '#3B2618', '#6B4325', '#A8743E', '#C9B9A6', '#2B2B33'];

export interface ClientLook {
  skin: string;
  hair: string;
  style: HairStyle;
  /** Barbe à tailler (étape barbe), petite barbe de quelques jours, moustache ou rasé. */
  beard: 'full' | 'stubble' | 'mustache' | 'none';
  glasses: boolean;
  earring: boolean;
  /** Couleur de la cape (index dans la palette néon du composant). */
  cape: number;
}

export interface ClientSpec {
  index: number;
  look: ClientLook;
  steps: Tool[];
  patienceMs: number;
  /** Demi largeur tolérée autour du tracé de contour, en unités du dessin (tête large de 180 unités). */
  contourTol: number;
  contour: ContourKind;
  /** Cibles de coupe aux ciseaux : indices des points d'ancrage du composant, dans l'ordre à suivre. */
  snips: number[];
  /** Produits proposés et produit demandé. */
  products: ProductKind[];
  product: ProductKind;
}

export const BARBER_MS = 90000;
/** Nombre de points d'ancrage des ciseaux définis par le composant. */
export const SNIP_ANCHORS = 7;
/** Couverture nécessaire pour valider un tracé (tondeuse, barbe, contour). */
export const COVER_DONE = 0.9;
/** Durée de l'appui long de finition. */
export const HOLD_MS = 700;
/** Arrivée du client (entrées ignorées), célébration, départ fâché. */
export const ARRIVE_MS = 800;
export const DONE_MS = 900;
export const LEAVE_MS = 1100;
/** Plafond imposé par validation.ts (un client toutes les 4 secondes au mieux). */
export const MAX_SERVED = 23;
export const MAX_SCORE = 9000;

export const POINTS = { client: 100, precision: 50, speed: 50, wrongTool: 10, left: 30 };

/** Spécification du n ième client : la même pour toutes les tablettes d'une partie (graine commune). */
export function clientAt(seed: number, index: number): ClientSpec {
  const rng = createRng(seed ^ Math.imul(index + 1, 0x9e3779b1));
  const d = Math.min(1, index / 14);
  // Nombre d'étapes : 2 au début, jusqu'à 4 en fin de partie.
  let count = 2;
  if (index >= 16) count = 4;
  else if (index >= 12) count = rng() < 0.5 ? 3 : 4;
  else if (index >= 6) count = 3;
  else if (index >= 2) count = rng() < 0.5 ? 2 : 3;
  // Étapes tirées au hasard, remises dans l'ordre canonique d'une coupe.
  const chosen = shuffle(rng, TOOLS).slice(0, count);
  const steps = TOOLS.filter((t) => chosen.includes(t));
  const style = pick(rng, HAIR_STYLES);
  const beardRoll = rng();
  const look: ClientLook = {
    skin: pick(rng, SKIN_TONES),
    hair: pick(rng, HAIR_COLORS),
    style,
    beard: steps.includes('beard') ? 'full' : beardRoll < 0.4 ? 'stubble' : beardRoll < 0.65 ? 'mustache' : 'none',
    glasses: rng() < 0.22,
    earring: rng() < 0.25,
    cape: Math.floor(rng() * 4),
  };
  const contours: ContourKind[] = look.beard === 'full' ? ['hairline', 'sideburns', 'beardline'] : ['hairline', 'sideburns'];
  const products = shuffle(rng, PRODUCTS).slice(0, 3);
  const nSnips = 3 + Math.round(2 * d);
  return {
    index,
    look,
    steps,
    // Patience : environ 4,5 s par étape au début, réduite de 35 % en fin de rampe.
    patienceMs: Math.round((5000 + 4500 * count) * (1 - 0.35 * d)),
    contourTol: Math.round(15 - 6 * d),
    contour: pick(rng, contours),
    snips: shuffle(rng, Array.from({ length: SNIP_ANCHORS }, (_, i) => i)).slice(0, nSnips),
    products,
    product: pick(rng, products),
  };
}

export type Phase = 'arrive' | 'work' | 'done' | 'leaving' | 'closed' | 'over';

export type BarberEvent =
  | { type: 'tool'; at: number; tool: Tool }
  | { type: 'wrongTool'; at: number; tool: Tool; penalty: number }
  | { type: 'miss'; at: number }
  | { type: 'hit'; at: number }
  | { type: 'step'; at: number; tool: Tool; precision: number }
  | { type: 'served'; at: number; points: number; base: number; precision: number; speed: number; multiplier: number; perfect: boolean }
  | { type: 'left'; at: number; penalty: number };

/** Résultat d'une action du joueur, pour les effets sonores et visuels du composant. */
export type ActionResult = 'ignored' | 'ok' | 'wrong' | 'miss' | 'step';

export class BarberEngine implements ArcadeGameEngine {
  readonly seed: number;
  readonly durationMs: number;
  startedAt = 0;
  lastUpdate = 0;
  index = 0;
  spec: ClientSpec;
  phase: Phase = 'arrive';
  phaseAt = 0;
  /** Début de l'attente du client courant (fin de son arrivée). */
  workAt = 0;
  stepIndex = 0;
  tool: Tool | null = null;
  /** Progression de l'étape en cours (0 à 1) et précision mesurée. */
  progress = 0;
  stepPrecision = 1;
  snipIndex = 0;
  stepMisses = 0;
  holdAt: number | null = null;
  /** Précisions des étapes terminées du client courant. */
  precisions: number[] = [];
  clientWrongTools = 0;
  score = 0;
  streak = 0;
  bestStreak = 0;
  stats = { served: 0, left: 0, wrongTool: 0, perfect: 0, steps: 0, misses: 0 };
  events: BarberEvent[] = [];
  private over = false;

  constructor(seed: number, durationMs = BARBER_MS) {
    this.seed = seed;
    this.durationMs = durationMs;
    this.spec = clientAt(seed, 0);
  }

  start(now: number): void {
    this.startedAt = now;
    this.lastUpdate = now;
    this.phaseAt = now;
    this.phase = 'arrive';
  }

  get step(): Tool | null {
    return this.phase === 'work' ? (this.spec.steps[this.stepIndex] ?? null) : null;
  }

  /** Multiplicateur appliqué au prochain client servi : x2 après 3 clients réussis d'affilée. */
  get multiplier(): number {
    return this.streak >= 3 ? 2 : 1;
  }

  remaining(now: number): number {
    return Math.max(0, this.startedAt + this.durationMs - now);
  }

  /** Patience restante du client courant (1 = pleine). */
  patience(now: number): number {
    if (this.phase === 'arrive') return 1;
    if (this.phase !== 'work') return this.phase === 'leaving' ? 0 : this.lastPatience;
    return Math.max(0, 1 - (now - this.workAt) / this.spec.patienceMs);
  }
  private lastPatience = 1;

  /** Progression de l'appui long de finition (0 à 1). */
  holdProgress(now: number): number {
    return this.holdAt === null ? 0 : Math.min(1, (now - this.holdAt) / HOLD_MS);
  }

  private canAct(now: number): boolean {
    this.update(now);
    return !this.over && this.phase === 'work' && now >= this.startedAt;
  }

  private emit(e: BarberEvent): void {
    this.events.push(e);
  }

  /** Vide la file d'événements (le composant s'en sert pour les messages et les sons). */
  drain(): BarberEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private penalize(points: number): void {
    this.score = Math.max(0, this.score - points);
  }

  selectTool(now: number, tool: Tool): ActionResult {
    if (!this.canAct(now)) return 'ignored';
    if (this.tool === tool) return 'ok';
    if (tool !== this.step) {
      this.penalize(POINTS.wrongTool);
      this.stats.wrongTool += 1;
      this.clientWrongTools += 1;
      this.emit({ type: 'wrongTool', at: now, tool, penalty: POINTS.wrongTool });
      return 'wrong';
    }
    this.tool = tool;
    this.emit({ type: 'tool', at: now, tool });
    return 'ok';
  }

  /** Tracé (tondeuse, barbe, contour) : couverture de la zone et précision mesurées par le composant, de 0 à 1. */
  stroke(now: number, coverage: number, precision: number): ActionResult {
    if (!this.canAct(now)) return 'ignored';
    const s = this.step;
    if (this.tool !== s || (s !== 'clipper' && s !== 'beard' && s !== 'razor')) return 'ignored';
    this.progress = Math.max(this.progress, clamp01(coverage));
    this.stepPrecision = clamp01(precision);
    if (this.progress >= COVER_DONE) {
      this.completeStep(now, this.stepPrecision);
      return 'step';
    }
    return 'ok';
  }

  /** Tap aux ciseaux : index du point d'ancrage touché, ou -1 à côté de toute cible. */
  snip(now: number, anchor: number): ActionResult {
    if (!this.canAct(now) || this.step !== 'scissors' || this.tool !== 'scissors') return 'ignored';
    if (anchor !== this.spec.snips[this.snipIndex]) {
      this.stepMisses += 1;
      this.stats.misses += 1;
      this.emit({ type: 'miss', at: now });
      return 'miss';
    }
    this.snipIndex += 1;
    this.progress = this.snipIndex / this.spec.snips.length;
    if (this.snipIndex >= this.spec.snips.length) {
      this.completeStep(now, Math.max(0, 1 - 0.25 * this.stepMisses));
      return 'step';
    }
    this.emit({ type: 'hit', at: now });
    return 'ok';
  }

  chooseProduct(now: number, product: ProductKind): ActionResult {
    if (!this.canAct(now) || this.step !== 'product' || this.tool !== 'product') return 'ignored';
    if (product !== this.spec.product) {
      this.stepMisses += 1;
      this.stats.misses += 1;
      this.emit({ type: 'miss', at: now });
      return 'miss';
    }
    this.completeStep(now, Math.max(0, 1 - 0.5 * this.stepMisses));
    return 'step';
  }

  /** Appui long de finition : la validation se fait dans update après HOLD_MS. */
  holdStart(now: number): ActionResult {
    if (!this.canAct(now) || this.step !== 'finish' || this.tool !== 'finish') return 'ignored';
    if (this.holdAt === null) this.holdAt = now;
    return 'ok';
  }

  holdEnd(now: number): void {
    this.update(now);
    // Relâché trop tôt : on recommence l'appui, sans pénalité.
    this.holdAt = null;
    if (this.step === 'finish') this.progress = 0;
  }

  update(now: number): void {
    if (this.over) return;
    // Pas de 10 ms : mêmes transitions quelle que soit la fréquence d'affichage.
    while (this.lastUpdate < now) {
      const step = Math.min(10, now - this.lastUpdate);
      this.lastUpdate += step;
      this.simulate(this.lastUpdate);
      if (this.over) return;
    }
  }

  private simulate(t: number): void {
    if (t >= this.startedAt + this.durationMs) {
      this.finish(t);
      return;
    }
    if (this.phase === 'arrive') {
      if (t - this.phaseAt >= ARRIVE_MS) {
        this.phase = 'work';
        this.phaseAt = t;
        this.workAt = t;
      }
    } else if (this.phase === 'work') {
      if (this.holdAt !== null && this.step === 'finish') {
        this.progress = this.holdProgress(t);
        if (t - this.holdAt >= HOLD_MS) {
          this.holdAt = null;
          this.completeStep(t, 1);
          return;
        }
      }
      if (t - this.workAt >= this.spec.patienceMs) this.clientLeaves(t);
    } else if (this.phase === 'done' && t - this.phaseAt >= DONE_MS) {
      this.nextClient(t);
    } else if (this.phase === 'leaving' && t - this.phaseAt >= LEAVE_MS) {
      this.nextClient(t);
    }
  }

  private completeStep(t: number, precision: number): void {
    const tool = this.spec.steps[this.stepIndex];
    this.precisions.push(precision);
    this.stats.steps += 1;
    this.emit({ type: 'step', at: t, tool, precision });
    this.stepIndex += 1;
    this.resetStep();
    if (this.stepIndex >= this.spec.steps.length) this.serve(t);
  }

  private resetStep(): void {
    this.tool = null;
    this.progress = 0;
    this.stepPrecision = 1;
    this.snipIndex = 0;
    this.stepMisses = 0;
    this.holdAt = null;
  }

  private serve(t: number): void {
    const precision = this.precisions.reduce((a, b) => a + b, 0) / this.precisions.length;
    const left = Math.max(0, 1 - (t - this.workAt) / this.spec.patienceMs);
    this.lastPatience = left;
    const precisionBonus = Math.round(POINTS.precision * precision);
    // Bonus de vitesse plein si le client est servi avec au moins 75 % de sa patience.
    const speedBonus = Math.round(POINTS.speed * Math.min(1, left / 0.75));
    const multiplier = this.multiplier;
    const points = (POINTS.client + precisionBonus + speedBonus) * multiplier;
    const perfect = precision >= 0.9 && this.clientWrongTools === 0;
    this.score += points;
    this.streak += 1;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.stats.served += 1;
    if (perfect) this.stats.perfect += 1;
    this.emit({ type: 'served', at: t, points, base: POINTS.client, precision: precisionBonus, speed: speedBonus, multiplier, perfect });
    this.phase = 'done';
    this.phaseAt = t;
  }

  private clientLeaves(t: number): void {
    this.penalize(POINTS.left);
    this.stats.left += 1;
    this.streak = 0;
    this.lastPatience = 0;
    this.resetStep();
    this.emit({ type: 'left', at: t, penalty: POINTS.left });
    this.phase = 'leaving';
    this.phaseAt = t;
  }

  private nextClient(t: number): void {
    if (this.stats.served >= MAX_SERVED) {
      // Salon complet : plus aucun client (plafond de validation.ts, en pratique inaccessible).
      this.phase = 'closed';
      this.phaseAt = t;
      return;
    }
    this.index += 1;
    this.spec = clientAt(this.seed, this.index);
    this.stepIndex = 0;
    this.precisions = [];
    this.clientWrongTools = 0;
    this.lastPatience = 1;
    this.resetStep();
    this.phase = 'arrive';
    this.phaseAt = t;
  }

  isOver(now: number): boolean {
    return this.over || now >= this.startedAt + this.durationMs;
  }

  finish(now: number): void {
    if (this.over) return;
    // Un client en cours au coup de sifflet n'est ni servi ni compté comme parti.
    this.over = true;
    this.phase = 'over';
    this.phaseAt = now;
    this.holdAt = null;
  }

  result(): GameResult {
    return {
      score: Math.min(MAX_SCORE, this.score),
      stats: { ...this.stats, bestStreak: this.bestStreak, clients: this.index + 1 },
      durationMs: this.durationMs,
    };
  }

  dispose(): void {
    /* aucune ressource externe */
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
