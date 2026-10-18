// Serveur de démonstration : l'état partagé est stocké dans le navigateur (localStorage), protégé par un verrou
// (Web Locks) pour que plusieurs onglets, simulant plusieurs tablettes, ne s'écrasent jamais.
// Les mêmes règles que le serveur Supabase s'appliquent (logic.ts). Pratique pour tester 4 tables
// dans 4 onglets : ouvrir l'application avec ?tablet=Tablette%201, ?tablet=Tablette%202, etc.
import { randomId } from '../../lib/random';
import { getTabletName } from '../../lib/tablet';
import { pseudoKey } from '../pseudo';
import { newSeed } from '../rng';
import { ArcadeError, DEFAULT_ARCADE_CONFIG, type ArcadeConfig, type TableNo, type WeeklyChallenge } from '../types';
import * as L from './logic';
import type { AdminRoomRow, ArcadeServer } from './types';

const KEY = 'cutshop.arcade.v1';
const LOCK = 'cutshop-arcade';

function weekBounds(now: number): { start: string; end: string } {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  end.setMinutes(end.getMinutes() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Challenge de la semaine proposé par défaut en démonstration (modifiable dans l'admin). */
function demoChallenge(now: number): WeeklyChallenge {
  const { start, end } = weekBounds(now);
  return {
    id: 'demo-week',
    game: 'pour',
    title_fr: 'Perfect Pour Challenge',
    title_en: 'Perfect Pour Challenge',
    description_fr: 'Cette semaine, sers la bière parfaite. Le meilleur score de la semaine l’emporte.',
    description_en: 'This week, pour the perfect beer. The best score of the week wins.',
    reward_fr: 'Une bière offerte au bar',
    reward_en: 'A free beer at the bar',
    starts_at: start,
    ends_at: end,
    active: true,
  };
}

export function tableFromName(name: string | null): TableNo | null {
  const m = name?.match(/([1-4])\s*$/);
  return m ? (Number(m[1]) as TableNo) : null;
}

export function createDemoServer(): ArcadeServer {
  let config: ArcadeConfig = structuredClone(DEFAULT_ARCADE_CONFIG);
  const listeners = new Set<() => void>();
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('cutshop:arcade');
    bc.onmessage = () => listeners.forEach((cb) => cb());
  } catch {
    bc = null;
  }

  const read = (): L.ArcadeDb => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw) as L.ArcadeDb;
        if (db.version === 1) return db;
      }
    } catch {
      /* stockage indisponible ou corrompu */
    }
    const db = L.emptyDb(config);
    db.challenges.push(demoChallenge(Date.now()));
    return db;
  };
  let memory: L.ArcadeDb | null = null;
  const write = (db: L.ArcadeDb) => {
    memory = db;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* mémoire seule */
    }
  };
  const load = () => {
    try {
      return read();
    } catch {
      return memory ?? read();
    }
  };

  /** Lecture, modification et écriture sous verrou, puis notification des autres onglets. */
  async function tx<T>(fn: (db: L.ArcadeDb, env: L.Env) => T, notify = true): Promise<T> {
    const run = () => {
      const db = load();
      db.config = config;
      const env: L.Env = { now: Date.now(), id: (p) => randomId(p), seed: newSeed };
      const out = fn(db, env);
      write(db);
      return out;
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const out = locks ? await locks.request(LOCK, async () => run()) : run();
    if (notify) bc?.postMessage('changed');
    return structuredClone(out);
  }

  const me = (): TableNo => {
    const t = tableFromName(getTabletName());
    if (!t) throw new ArcadeError('not_paired');
    return t;
  };

  return {
    kind: 'demo',
    table: () => tableFromName(getTabletName()),
    setConfig(c) {
      config = structuredClone(c);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot: () => {
      const t = tableFromName(getTabletName());
      return tx((db, env) => (t ? L.heartbeat(db, env, t) : L.snapshot(db, env.now, null)), false);
    },
    createRoom: (input) => tx((db, env) => L.createRoom(db, env, me(), input)),
    respond: async (roomId, accept, pseudo) => {
      await tx((db, env) => L.respond(db, env, me(), roomId, accept, pseudo));
    },
    setReady: async (roomId, ready) => {
      await tx((db, env) => L.setReady(db, env, me(), roomId, ready));
    },
    start: async (roomId) => {
      await tx((db, env) => L.startRoom(db, env, me(), roomId));
    },
    leave: async (roomId) => {
      await tx((db, env) => L.leaveRoom(db, env, me(), roomId));
    },
    submitResult: async (roomId, result) => {
      await tx((db, env) => L.submitResult(db, env, me(), roomId, result));
    },
    claim: (roomId, objectId) => tx((db, env) => L.claimObject(db, env, me(), roomId, objectId)),
    rematch: (roomId, pseudo) => tx((db, env) => L.rematch(db, env, me(), roomId, pseudo)),
    startSolo: (game, variant) => tx((db, env) => L.startSolo(db, env, me(), game, variant), false),
    submitSolo: async (id, pseudo, result) => {
      await tx((db, env) => L.submitSolo(db, env, me(), id, pseudo, result));
    },
    scores: (since) => tx((db) => db.scores.filter((s) => s.created_at >= since), false),
    challenges: () => tx((db) => db.challenges, false),

    adminScores: (limit) => tx((db) => db.scores.slice().sort((a, b) => b.created_at - a.created_at).slice(0, limit), false),
    adminDeleteScore: async (id) => {
      await tx((db) => {
        db.scores = db.scores.filter((s) => s.id !== id);
      });
    },
    adminRenamePseudo: (from, to) =>
      tx((db) => {
        let n = 0;
        for (const s of db.scores)
          if (pseudoKey(s.pseudo) === pseudoKey(from)) {
            s.pseudo = to;
            n++;
          }
        return n;
      }),
    adminResetScores: (game) =>
      tx((db) => {
        const before = db.scores.length;
        db.scores = game ? db.scores.filter((s) => s.game !== game) : [];
        return before - db.scores.length;
      }),
    adminRooms: (limit) =>
      tx(
        (db): AdminRoomRow[] =>
          db.rooms
            .slice()
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, limit)
            .map((r) => ({
              id: r.id,
              game: r.game,
              variant: r.variant,
              mode: r.mode,
              status: r.status,
              created_at: r.created_at,
              players: r.players.map((p) => ({ table: p.table, pseudo: p.pseudo, state: p.state, score: p.score, rank: p.rank, abandoned: p.abandoned })),
            })),
        false,
      ),
    adminSaveChallenge: async (c) => {
      await tx((db) => {
        db.challenges = [...db.challenges.filter((x) => x.id !== c.id), c];
      });
    },
    adminDeleteChallenge: async (id) => {
      await tx((db) => {
        db.challenges = db.challenges.filter((x) => x.id !== id);
      });
    },
    adminPairDevice: async () => {
      /* en démonstration, la table est déduite du nom de la tablette (Tablette 1 à 4) */
    },
  };
}
