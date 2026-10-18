import { describe, expect, it } from 'vitest';
import { isPlausible } from '../../validation';
import type { TableNo } from '../../types';
import {
  CLEAN_BONUS,
  FINDIT_MS,
  FinditEngine,
  MAX_SCENES,
  NEXT_MS,
  objectId,
  ROUND_SIZE,
  roundAt,
  speedBonus,
  TAP_GAP_MS,
} from './engine';
import { hitKeys, hitRadius, MIN_HIT_R, SCENE_H, SCENE_W, SCENES } from './sceneData';

const T0 = 1_000_000;

function placement(e: FinditEngine, key: string) {
  const p = SCENES[e.round.scene].objects.find((o) => o.key === key);
  if (!p) throw new Error(`objet absent : ${key}`);
  return p;
}

/** Point vide de la scène (aucune zone d'objet). */
function emptySpot(scene: number): { x: number; y: number } {
  for (let y = 20; y < SCENE_H; y += 20) for (let x = 20; x < SCENE_W; x += 20) if (hitKeys(scene, x, y).length === 0) return { x, y };
  throw new Error('scène pleine');
}

/** Joueur simulé : trouve chaque objet de la liste toutes les `gap` ms. */
function playRound(e: FinditEngine, t: number, gap: number): number {
  for (const key of [...e.round.targets]) {
    t += gap;
    const p = placement(e, key);
    e.tap(t, p.x, p.y);
  }
  t += NEXT_MS + 10;
  e.update(t);
  return t;
}

describe('Find It Cutshop : données des scènes', () => {
  it('a 4 scènes de 10 à 12 objets aux clés valides pour le serveur', () => {
    expect(SCENES).toHaveLength(4);
    for (const s of SCENES) {
      expect(s.objects.length).toBeGreaterThanOrEqual(10);
      expect(s.objects.length).toBeLessThanOrEqual(12);
      const keys = s.objects.map((o) => o.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(objectId(12, k)).toMatch(/^\d{1,2}:[a-z]{2,12}$/);
    }
  });

  it('garde des zones de toucher généreuses et qui ne se chevauchent pas trop', () => {
    SCENES.forEach((s, i) => {
      for (const o of s.objects) {
        expect(hitRadius(o)).toBeGreaterThanOrEqual(MIN_HIT_R);
        // Le centre de chaque objet désigne bien cet objet en premier.
        expect(hitKeys(i, o.x, o.y)[0]).toBe(o.key);
      }
    });
  });
});

describe('Find It Cutshop : séquence', () => {
  it('donne la même suite de scènes et d’objets à toutes les tablettes', () => {
    const a = Array.from({ length: 12 }, (_, i) => roundAt(42, i));
    const b = Array.from({ length: 12 }, (_, i) => roundAt(42, i));
    expect(a).toEqual(b);
    const c = Array.from({ length: 12 }, (_, i) => roundAt(43, i));
    expect(c).not.toEqual(a);
  });

  it('propose 5 objets distincts de la scène, sans répéter une scène deux fois de suite', () => {
    for (const seed of [1, 2, 3, 99, 123456]) {
      for (let i = 0; i < 20; i++) {
        const r = roundAt(seed, i);
        expect(new Set(r.targets).size).toBe(ROUND_SIZE);
        const keys = SCENES[r.scene].objects.map((o) => o.key);
        for (const k of r.targets) expect(keys).toContain(k);
        if (i > 0) expect(roundAt(seed, i - 1).scene).not.toBe(r.scene);
      }
    }
  });
});

describe('Find It Cutshop : course au score', () => {
  it('compte 100 points par objet plus un bonus de vitesse décroissant', () => {
    expect(speedBonus(0)).toBe(50);
    expect(speedBonus(10000)).toBe(25);
    expect(speedBonus(30000)).toBe(0);
    const e = new FinditEngine(7, 'race');
    e.start(T0);
    const p = placement(e, e.round.targets[0]);
    const out = e.tap(T0 + 2000, p.x, p.y);
    expect(out).toMatchObject({ kind: 'found', points: 100, bonus: 45 });
    expect(e.score).toBe(145);
    // Toucher à nouveau un objet déjà trouvé n'est ni compté ni pénalisé.
    expect(e.tap(T0 + 3000, p.x, p.y).kind).toBe('ignored');
    expect(e.score).toBe(145);
  });

  it('pénalise les touchers ratés (score jamais négatif) et ignore les rafales', () => {
    const e = new FinditEngine(7, 'race');
    e.start(T0);
    const spot = emptySpot(e.round.scene);
    expect(e.tap(T0 + 1000, spot.x, spot.y).kind).toBe('wrong');
    expect(e.score).toBe(0);
    expect(e.tap(T0 + 1000 + TAP_GAP_MS - 1, spot.x, spot.y).kind).toBe('ignored');
    expect(e.wrong).toBe(1);
    const p = placement(e, e.round.targets[0]);
    e.tap(T0 + 2000, p.x, p.y);
    const s = e.score;
    e.tap(T0 + 3000, spot.x, spot.y);
    expect(e.score).toBe(s - 10);
    expect(e.wrong).toBe(2);
  });

  it('ignore les touchers avant le départ', () => {
    const e = new FinditEngine(7, 'race');
    e.start(T0);
    const p = placement(e, e.round.targets[0]);
    expect(e.tap(T0 - 100, p.x, p.y).kind).toBe('ignored');
  });

  it('donne +200 pour une scène propre puis passe à la suivante', () => {
    const e = new FinditEngine(11, 'race');
    e.start(T0);
    const first = e.round;
    let t = T0;
    for (const key of first.targets) {
      t += 1000;
      const p = placement(e, key);
      e.tap(t, p.x, p.y);
    }
    expect(e.phase).toBe('cleared');
    expect(e.lastClear).toEqual({ clean: true, bonus: CLEAN_BONUS });
    expect(e.score).toBe(5 * 100 + [1, 2, 3, 4, 5].reduce((a, k) => a + speedBonus(k * 1000), 0) + CLEAN_BONUS);
    e.update(t + NEXT_MS);
    expect(e.phase).toBe('play');
    expect(e.round.index).toBe(1);
    expect(e.roundStartedAt).toBe(t + NEXT_MS);
  });

  it('refuse le bonus de scène propre après une erreur', () => {
    const e = new FinditEngine(11, 'race');
    e.start(T0);
    const spot = emptySpot(e.round.scene);
    e.tap(T0 + 500, spot.x, spot.y);
    playRound(e, T0 + 500, 1000);
    expect(e.scenesDone).toBe(1);
    expect(e.cleanScenes).toBe(0);
  });

  it('reste plausible pour un joueur très fort et plafonne à 9 scènes', () => {
    const e = new FinditEngine(2024, 'race');
    e.start(T0);
    let t = T0;
    while (!e.isOver(t) && e.phase !== 'done') t = playRound(e, t, 400);
    expect(e.scenesDone).toBe(MAX_SCENES);
    const spot = emptySpot(e.round.scene);
    expect(e.tap(t + 1000, spot.x, spot.y).kind).toBe('ignored');
    e.update(T0 + FINDIT_MS);
    expect(e.isOver(T0 + FINDIT_MS)).toBe(true);
    const r = e.result();
    expect(r.stats.found).toBe(45);
    expect(r.stats.scenes).toBe(9);
    expect(r.score).toBeLessThanOrEqual(7000);
    expect(isPlausible('findit', 'race', r)).toBe(true);
  });

  it('reste plausible pour un joueur moyen et se termine à la fin du temps', () => {
    const e = new FinditEngine(5, 'race');
    e.start(T0);
    let t = T0;
    while (!e.isOver(t)) {
      const spot = emptySpot(e.round.scene);
      t += 900;
      e.tap(t, spot.x, spot.y);
      t = playRound(e, t, 2500);
    }
    e.finish(t);
    expect(e.phase).toBe('over');
    const r = e.result();
    expect(r.stats.scenes).toBeGreaterThan(2);
    expect(r.stats.wrong).toBeGreaterThan(2);
    expect(isPlausible('findit', 'race', r)).toBe(true);
  });

  it('rejoue exactement la même partie avec la même graine', () => {
    const run = () => {
      const e = new FinditEngine(77, 'race');
      e.start(T0);
      let t = T0;
      for (let i = 0; i < 5; i++) t = playRound(e, t, 1300 + i * 100);
      return e.result();
    };
    expect(run()).toEqual(run());
  });
});

describe('Find It Cutshop : chasse compétitive', () => {
  function huntEngine(me: TableNo = 2) {
    const e = new FinditEngine(31, 'hunt', FINDIT_MS, me);
    e.start(T0);
    return e;
  }

  it('réclame l’objet au serveur avec un identifiant valide et attend la réponse', () => {
    const e = huntEngine();
    const key = e.round.targets[0];
    const p = placement(e, key);
    const out = e.tap(T0 + 1000, p.x, p.y);
    expect(out).toEqual({ kind: 'claim', key, id: `0:${key}` });
    expect(e.isDone(key)).toBe(true);
    // Pendant l'attente, un second toucher ne réclame pas deux fois.
    expect(e.tap(T0 + 1400, p.x, p.y).kind).toBe('ignored');
    e.resolveClaim(T0 + 1500, `0:${key}`, { won: true, owner: 2 });
    expect(e.ownerOf(key)).toBe(2);
    expect(e.liveScore()).toBe(100);
  });

  it('libère la réclamation en cas d’erreur pour permettre de réessayer', () => {
    const e = huntEngine();
    const key = e.round.targets[0];
    const p = placement(e, key);
    e.tap(T0 + 1000, p.x, p.y);
    e.resolveClaim(T0 + 1100, `0:${key}`, null);
    expect(e.isDone(key)).toBe(false);
    expect(e.tap(T0 + 1500, p.x, p.y).kind).toBe('claim');
  });

  it('montre les objets pris par une autre table et passe à la manche suivante quand tout est attribué', () => {
    const e = huntEngine(2);
    const [a, b, c, d, f] = e.round.targets;
    e.syncClaims(T0 + 1000, { [`0:${a}`]: 3, [`0:${b}`]: 1 });
    expect(e.ownerOf(a)).toBe(3);
    const pa = placement(e, a);
    expect(e.tap(T0 + 1200, pa.x, pa.y)).toEqual({ kind: 'taken', key: a, owner: 3 });
    e.syncClaims(T0 + 2000, { [`0:${a}`]: 3, [`0:${b}`]: 1, [`0:${c}`]: 2, [`0:${d}`]: 4, [`0:${f}`]: 2 });
    expect(e.phase).toBe('cleared');
    e.update(T0 + 2000 + NEXT_MS);
    expect(e.round.index).toBe(1);
    expect(e.phase).toBe('play');
    const r = e.result();
    expect(r.stats).toMatchObject({ found: 2, scenes: 1, wrong: 0 });
    expect(r.score).toBe(200);
  });

  it('calcule le score comme le serveur : 100 par objet moins 10 par erreur', () => {
    const e = huntEngine(1);
    const spot = emptySpot(e.round.scene);
    for (let i = 0; i < 3; i++) e.tap(T0 + 1000 + i * 400, spot.x, spot.y);
    e.syncClaims(T0 + 3000, { [`0:${e.round.targets[0]}`]: 1, [`0:${e.round.targets[1]}`]: 1 });
    expect(e.result()).toMatchObject({ score: 170, stats: { found: 2, wrong: 3 } });
  });

  it('donne la même manche à toutes les tablettes quelles que soient les attributions reçues', () => {
    const claims: Record<string, TableNo> = {};
    for (let r = 0; r < 3; r++) for (const k of roundAt(31, r).targets) claims[objectId(r, k)] = ((r % 4) + 1) as TableNo;
    const a = huntEngine(1);
    const b = huntEngine(4);
    a.syncClaims(T0 + 1000, claims);
    b.syncClaims(T0 + 1500, claims);
    for (let t = T0 + 1000; t < T0 + 10000; t += 100) {
      a.update(t);
      b.update(t);
    }
    expect(a.round.index).toBe(3);
    expect(b.round.index).toBe(3);
    expect(a.completedRounds()).toBe(3);
  });
});
