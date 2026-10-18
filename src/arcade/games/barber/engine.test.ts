import { describe, expect, it } from 'vitest';
import { isPlausible } from '../../validation';
import { ARRIVE_MS, BARBER_MS, BarberEngine, clientAt, COVER_DONE, HOLD_MS, MAX_SCORE, TOOLS, type Tool } from './engine';

/** Réalise l'étape courante comme un joueur parfait, en `gap` ms par action. Renvoie l'heure atteinte. */
function doStep(e: BarberEngine, now: number, gap: number): number {
  const s = e.step as Tool;
  now += gap;
  e.selectTool(now, s);
  now += gap;
  if (s === 'clipper' || s === 'beard' || s === 'razor') {
    e.stroke(now, 0.5, 1);
    now += gap;
    e.stroke(now, 1, 1);
  } else if (s === 'scissors') {
    for (const a of e.spec.snips) {
      e.snip(now, a);
      now += gap / 2;
    }
  } else if (s === 'product') {
    e.chooseProduct(now, e.spec.product);
  } else {
    e.holdStart(now);
    now += HOLD_MS + 10;
    e.update(now);
    e.holdEnd(now);
  }
  return now;
}

/** Joue une partie entière avec un joueur scripté. */
function play(seed: number, gap: number): BarberEngine {
  const e = new BarberEngine(seed);
  let now = 1000;
  e.start(now);
  while (!e.isOver(now)) {
    now += 10;
    e.update(now);
    if (e.step) now = doStep(e, now, gap);
  }
  e.finish(now);
  return e;
}

describe('Barber Rush engine', () => {
  it('même graine, même séquence de clients', () => {
    for (let i = 0; i < 30; i++) expect(clientAt(42, i)).toEqual(clientAt(42, i));
    expect(clientAt(42, 3)).not.toEqual(clientAt(43, 3));
  });

  it('commandes valides et difficulté progressive', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (let i = 0; i < 30; i++) {
        const c = clientAt(seed, i);
        expect(c.steps.length).toBeGreaterThanOrEqual(2);
        expect(c.steps.length).toBeLessThanOrEqual(4);
        // Ordre canonique, sans doublon.
        const idx = c.steps.map((s) => TOOLS.indexOf(s));
        expect([...idx].sort((a, b) => a - b)).toEqual(idx);
        expect(new Set(c.steps).size).toBe(c.steps.length);
        expect(c.products).toContain(c.product);
        if (c.steps.includes('beard')) expect(c.look.beard).toBe('full');
        if (i < 2) expect(c.steps.length).toBe(2);
        if (i >= 16) expect(c.steps.length).toBe(4);
      }
    }
    const early = clientAt(7, 0);
    const late = clientAt(7, 20);
    expect(late.contourTol).toBeLessThan(early.contourTol);
    expect(late.snips.length).toBeGreaterThan(early.snips.length);
    expect(late.patienceMs / late.steps.length).toBeLessThan(early.patienceMs / early.steps.length);
  });

  it('un client servi rapporte 100 + bonus, mauvais outil -10', () => {
    const e = new BarberEngine(5);
    e.start(0);
    expect(e.selectTool(100, e.spec.steps[0])).toBe('ignored'); // arrivée du client
    e.update(ARRIVE_MS);
    const wrong = TOOLS.find((t) => t !== e.step) as Tool;
    expect(e.selectTool(ARRIVE_MS + 10, wrong)).toBe('wrong');
    expect(e.score).toBe(0); // jamais négatif
    let now = ARRIVE_MS + 20;
    while (e.phase === 'work') now = doStep(e, now, 50);
    expect(e.phase).toBe('done');
    const served = e.drain().find((x) => x.type === 'served');
    expect(served && served.type === 'served' && served.points).toBe(200);
    expect(served && served.type === 'served' && served.perfect).toBe(false);
    expect(e.score).toBe(200);
    expect(e.stats).toMatchObject({ served: 1, wrongTool: 1, perfect: 0 });
    // Nouvelle pénalité après des points.
    e.update(now + 2000);
    e.selectTool(e.lastUpdate, TOOLS.find((t) => t !== e.step) as Tool);
    expect(e.score).toBe(190);
  });

  it('tracé validé à la couverture requise avec sa précision', () => {
    let seed = 1;
    while (!['clipper', 'beard', 'razor'].includes(clientAt(seed, 0).steps[0])) seed++;
    const e = new BarberEngine(seed);
    e.start(0);
    e.update(ARRIVE_MS);
    const s = e.step as Tool;
    expect(e.stroke(ARRIVE_MS + 5, 0.5, 1)).toBe('ignored'); // pas encore le bon outil
    e.selectTool(ARRIVE_MS + 10, s);
    expect(e.stroke(ARRIVE_MS + 20, COVER_DONE - 0.01, 0.6)).toBe('ok');
    expect(e.stroke(ARRIVE_MS + 30, COVER_DONE, 0.6)).toBe('step');
    expect(e.precisions).toEqual([0.6]);
    expect(e.tool).toBeNull();
  });

  it('client parti : -30, série remise à zéro, client suivant', () => {
    const e = new BarberEngine(9);
    e.start(0);
    e.update(ARRIVE_MS + e.spec.patienceMs + 5);
    expect(e.phase).toBe('leaving');
    expect(e.stats.left).toBe(1);
    expect(e.score).toBe(0);
    e.update(ARRIVE_MS + e.spec.patienceMs + 5000);
    expect(e.index).toBe(1);
  });

  it('multiplicateur x2 après 3 clients réussis', () => {
    const e = new BarberEngine(11);
    e.start(0);
    let now = 0;
    const pts: number[] = [];
    while (pts.length < 5) {
      now += 10;
      e.update(now);
      if (e.step) now = doStep(e, now, 40);
      for (const ev of e.drain()) if (ev.type === 'served') pts.push(ev.multiplier);
    }
    expect(pts).toEqual([1, 1, 1, 2, 2]);
  });

  it('partie déterministe, fin à la durée, résultat plausible', () => {
    const a = play(1234, 120);
    const b = play(1234, 120);
    expect(a.result()).toEqual(b.result());
    expect(a.isOver(1000 + BARBER_MS)).toBe(true);
    expect(a.result().durationMs).toBe(BARBER_MS);
    for (const seed of [1, 2, 3, 99, 2024, 777777]) {
      for (const gap of [60, 150, 400]) {
        const r = play(seed, gap).result();
        expect(r.stats.served).toBeGreaterThan(5);
        expect(r.score).toBeLessThanOrEqual(MAX_SCORE);
        expect(isPlausible('barber', 'std', r)).toBe(true);
      }
    }
  });

  it('joueur inactif : clients partis, score nul', () => {
    const e = new BarberEngine(3);
    e.start(0);
    e.update(BARBER_MS + 10);
    const r = e.result();
    expect(r.score).toBe(0);
    expect(r.stats.left).toBeGreaterThan(2);
    expect(isPlausible('barber', 'std', r)).toBe(true);
  });
});
