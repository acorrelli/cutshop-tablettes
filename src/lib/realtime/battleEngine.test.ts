import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_QUESTIONS } from '../../data/seed';
import { LOBBY_MS, QUESTION_COUNT, QUESTION_MS, RESULT_MS } from '../battle';
import type { BusChannel, PresenceMeta } from './bus';
import { BattleEngine, COUNTDOWN_MS } from './battleEngine';

/** Bus en mémoire qui imite Supabase Realtime (présence + diffusion, latence de 30 ms). */
class MemoryHub {
  presence = new Map<string, PresenceMeta>();
  members = new Map<string, { handlers: Map<string, Set<(p: Record<string, unknown>) => void>>; presenceCbs: Set<(m: PresenceMeta[]) => void> }>();

  channel(key: string): BusChannel {
    const member = { handlers: new Map(), presenceCbs: new Set<(m: PresenceMeta[]) => void>() };
    this.members.set(key, member);
    const hub = this;
    return {
      track(meta) {
        hub.presence.set(key, { ...meta, key });
        hub.syncPresence();
      },
      onPresence(cb) {
        member.presenceCbs.add(cb);
        cb(Array.from(hub.presence.values()));
        return () => member.presenceCbs.delete(cb);
      },
      on(event, cb) {
        if (!member.handlers.has(event)) member.handlers.set(event, new Set());
        member.handlers.get(event)!.add(cb);
        return () => member.handlers.get(event)?.delete(cb);
      },
      send(event, payload) {
        const copy = JSON.parse(JSON.stringify(payload));
        setTimeout(() => {
          for (const [k, m] of hub.members) if (k !== key) m.handlers.get(event)?.forEach((h) => h(copy));
        }, 30);
      },
      close() {
        hub.disconnect(key);
      },
    };
  }

  disconnect(key: string) {
    this.members.delete(key);
    this.presence.delete(key);
    this.syncPresence();
  }

  syncPresence() {
    const list = Array.from(this.presence.values());
    setTimeout(() => {
      for (const m of this.members.values()) m.presenceCbs.forEach((cb) => cb(list));
    }, 30);
  }
}

function makeEngine(hub: MemoryHub, key: string) {
  return new BattleEngine({
    channel: hub.channel(key),
    key,
    tablet: `Tablette ${key}`,
    getQuestions: () => SEED_QUESTIONS,
    tickMs: 100,
  });
}

/** Fait répondre un joueur à la question en cours, juste ou faux, après un délai. */
function answerCurrent(engine: BattleEngine, right: boolean) {
  const s = engine.getState();
  const q = s.questions[s.q];
  engine.answer(right ? q.correct : (q.correct + 1) % q.answers_fr.length);
}

/** Avance l'horloge par pas de 100 ms jusqu'à ce que la condition soit vraie. */
function waitFor(cond: () => boolean, maxMs = 30000) {
  for (let t = 0; t <= maxMs; t += 100) {
    if (cond()) return;
    vi.advanceTimersByTime(100);
  }
  expect(cond()).toBe(true);
}

describe('BattleEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('joue une Battle complète à 4 joueurs avec un classement identique partout', () => {
    const hub = new MemoryHub();
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((k) => makeEngine(hub, k));
    vi.advanceTimersByTime(200);

    a.host('Alpha', 'mix');
    vi.advanceTimersByTime(300);
    for (const e of [b, c, d]) expect(e.getState().invite?.hostPseudo).toBe('Alpha');

    b.join('Bravo');
    c.join('Charlie');
    d.join('Delta');
    vi.advanceTimersByTime(500);

    // Lobby complet à 4 : départ immédiat, sans attendre les 30 secondes.
    for (const e of [a, b, c, d]) {
      expect(e.getState().phase).toBe('countdown');
      expect(e.getState().players).toHaveLength(4);
    }
    // Tout le monde a les mêmes questions dans le même ordre.
    const ids = a.getState().questions.map((q) => q.id).join();
    for (const e of [b, c, d]) expect(e.getState().questions.map((q) => q.id).join()).toBe(ids);

    const all = [a, b, c, d];
    for (let q = 0; q < QUESTION_COUNT; q++) {
      waitFor(() => all.every((e) => e.getState().phase === 'question' && e.getState().q === q));
      vi.advanceTimersByTime(1000);
      answerCurrent(a, true);
      vi.advanceTimersByTime(3000);
      answerCurrent(b, true);
      answerCurrent(c, false);
      // D ne répond jamais : la question va jusqu'au bout du chrono.
      vi.advanceTimersByTime(QUESTION_MS - 4500);
      for (const e of all) expect(e.getState().phase).toBe('question');
      waitFor(() => all.every((e) => e.getState().phase === 'result'), QUESTION_MS);
    }
    waitFor(() => all.every((e) => e.getState().phase === 'podium'), RESULT_MS + 2000);

    for (const e of [a, b, c, d]) expect(e.getState().phase).toBe('podium');
    const ranking = a.ranking().map((r) => `${r.pseudo}:${r.total}`);
    for (const e of [b, c, d]) expect(e.ranking().map((r) => `${r.pseudo}:${r.total}`)).toEqual(ranking);
    expect(a.ranking()[0].pseudo).toBe('Alpha');
    expect(a.ranking()[1].pseudo).toBe('Bravo');
    expect(a.ranking().find((r) => r.pseudo === 'Charlie')?.total).toBe(0);
    expect(a.ranking()[0].total).toBeGreaterThan(9000);
  });

  it('passe à la question suivante dès que tout le monde a répondu', () => {
    const hub = new MemoryHub();
    const [a, b] = ['A', 'B'].map((k) => makeEngine(hub, k));
    vi.advanceTimersByTime(200);
    a.host('Alpha', 'kids');
    vi.advanceTimersByTime(300);
    b.join('Bravo');
    vi.advanceTimersByTime(300);
    a.startNow();
    vi.advanceTimersByTime(COUNTDOWN_MS + 300);
    expect(b.getState().phase).toBe('question');
    answerCurrent(a, true);
    answerCurrent(b, true);
    vi.advanceTimersByTime(500);
    expect(a.getState().phase).toBe('result');
    expect(b.getState().phase).toBe('result');
  });

  it('continue la partie quand l’hôte se déconnecte', () => {
    const hub = new MemoryHub();
    const [a, b, c] = ['A', 'B', 'C'].map((k) => makeEngine(hub, k));
    vi.advanceTimersByTime(200);
    a.host('Alpha', 'mix');
    vi.advanceTimersByTime(300);
    b.join('Bravo');
    c.join('Charlie');
    vi.advanceTimersByTime(LOBBY_MS);
    expect(b.getState().phase).toBe('countdown');
    vi.advanceTimersByTime(COUNTDOWN_MS + 200);

    // Deux questions jouées normalement.
    for (let i = 0; i < 2; i++) {
      answerCurrent(a, true);
      answerCurrent(b, true);
      answerCurrent(c, true);
      vi.advanceTimersByTime(500);
      vi.advanceTimersByTime(RESULT_MS + 300);
    }
    expect(b.getState().q).toBe(2);

    // L'hôte (coordinateur) quitte brutalement.
    a.destroy();
    hub.disconnect('A');
    vi.advanceTimersByTime(8000);
    expect(b.getState().gone.A).toBe(true);

    // Les deux autres terminent la partie, B devient coordinateur.
    for (let guard = 0; guard < 40 && b.getState().phase !== 'podium'; guard++) {
      if (b.getState().phase === 'question') {
        answerCurrent(b, true);
        answerCurrent(c, false);
      }
      vi.advanceTimersByTime(2000);
    }
    expect(b.getState().phase).toBe('podium');
    expect(c.getState().phase).toBe('podium');
    expect(b.ranking()[0].pseudo).toBe('Bravo');
    expect(b.ranking().find((r) => r.pseudo === 'Alpha')?.gone).toBe(true);
  });

  it('propose le solo quand personne ne rejoint', () => {
    const hub = new MemoryHub();
    const a = makeEngine(hub, 'A');
    makeEngine(hub, 'B');
    vi.advanceTimersByTime(200);
    a.host('Alpha', 'mix');
    vi.advanceTimersByTime(LOBBY_MS + 500);
    expect(a.getState().phase).toBe('alone');
  });

  it('joue une partie solo jusqu’au score final', () => {
    const hub = new MemoryHub();
    const a = makeEngine(hub, 'A');
    a.solo('Solo', 'beer');
    vi.advanceTimersByTime(COUNTDOWN_MS + 200);
    for (let i = 0; i < QUESTION_COUNT; i++) {
      expect(a.getState().phase).toBe('question');
      answerCurrent(a, i % 2 === 0);
      vi.advanceTimersByTime(300);
      expect(a.getState().phase).toBe('result');
      vi.advanceTimersByTime(RESULT_MS + 200);
    }
    expect(a.getState().phase).toBe('podium');
    expect(a.ranking()[0].correct).toBe(5);
  });

  it('refuse un cinquième joueur', () => {
    const hub = new MemoryHub();
    const engines = ['A', 'B', 'C', 'D', 'E'].map((k) => makeEngine(hub, k));
    vi.advanceTimersByTime(200);
    engines[0].host('Alpha', 'mix');
    vi.advanceTimersByTime(300);
    engines[1].join('B');
    engines[2].join('C');
    vi.advanceTimersByTime(300);
    engines[3].join('D');
    vi.advanceTimersByTime(80);
    // Le cinquième voit encore l'invitation au moment où il tente sa chance.
    engines[4].join('E');
    vi.advanceTimersByTime(1000);
    const players = engines[0].getState().players;
    expect(players).toHaveLength(4);
    expect(engines[4].getState().phase === 'idle' || engines[4].getState().notice === 'full').toBe(true);
  });
});
