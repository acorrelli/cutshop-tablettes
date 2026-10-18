import { describe, expect, it } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, type GameResult, type TableNo } from '../types';
import {
  claimObject,
  COUNTDOWN_MS,
  createRoom,
  emptyDb,
  heartbeat,
  leaveRoom,
  ONLINE_MS,
  rematch,
  respond,
  RESULT_GRACE_MS,
  setReady,
  snapshot,
  startRoom,
  startSolo,
  submitResult,
  submitSolo,
  tableStatus,
  type ArcadeDb,
  type Env,
} from './logic';

let clock = 1_800_000_000_000;
let ids = 0;
const env = (): Env => ({ now: clock, id: (p) => `${p}${++ids}`, seed: () => 42 });
const tick = (ms: number) => (clock += ms);
const db0 = (): ArcadeDb => {
  const db = emptyDb(structuredClone(DEFAULT_ARCADE_CONFIG));
  for (const t of [1, 2, 3, 4] as TableNo[]) heartbeat(db, env(), t);
  return db;
};
const pour = (score: number, glasses = 20): GameResult => ({ score, stats: { glasses }, durationMs: 60000 });
/** Signe de vie simultané de plusieurs tables (comme leurs battements réguliers toutes les 2 secondes). */
const alive = (db: ArcadeDb, ...tables: TableNo[]) => {
  for (const t of tables) db.seen[t] = clock;
  tables.forEach((t) => heartbeat(db, env(), t));
};

/** Crée un duel 1 contre 2 sur Perfect Pour, accepté et lancé. */
function startedDuel(db: ArcadeDb) {
  const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2] });
  respond(db, env(), 2, room.id, true, 'Bravo');
  setReady(db, env(), 2, room.id, true);
  startRoom(db, env(), 1, room.id);
  return room;
}

function playToEnd(db: ArcadeDb, roomId: string, scores: Partial<Record<TableNo, number>>) {
  const room = db.rooms.find((r) => r.id === roomId)!;
  clock = room.ends_at! + 100;
  for (const [t, s] of Object.entries(scores)) submitResult(db, env(), Number(t) as TableNo, roomId, pour(s!));
  return db.rooms.find((r) => r.id === roomId)!;
}

describe('Cutshop Challenge : règles du serveur', () => {
  it('duel complet : invitation, prêt, départ synchronisé, résultat identique pour les deux tables', () => {
    const db = db0();
    const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2] });
    expect(tableStatus(db, 2, clock)).toBe('invited');
    expect(snapshot(db, clock, 2).invites[0]).toMatchObject({ room_id: room.id, host: 1, host_pseudo: 'Alpha', game: 'pour' });
    respond(db, env(), 2, room.id, true, 'Bravo');
    expect(tableStatus(db, 2, clock)).toBe('waiting');
    // L'organisateur ne peut pas lancer tant que son adversaire n'est pas prêt.
    expect(() => startRoom(db, env(), 1, room.id)).toThrow('not_ready');
    setReady(db, env(), 2, room.id, true);
    expect(() => startRoom(db, env(), 2, room.id)).toThrow('not_allowed');
    startRoom(db, env(), 1, room.id);
    expect(room.starts_at).toBe(clock + COUNTDOWN_MS);
    expect(room.ends_at).toBe(room.starts_at! + 60000);
    expect(tableStatus(db, 1, clock)).toBe('playing');
    expect(snapshot(db, clock, 1).room?.seed).toBe(snapshot(db, clock, 2).room?.seed);

    const done = playToEnd(db, room.id, { 1: 1200, 2: 1500 });
    expect(done.status).toBe('finished');
    expect(done.players.find((p) => p.table === 2)?.rank).toBe(1);
    expect(snapshot(db, clock, 1).room?.players).toEqual(snapshot(db, clock, 2).room?.players);
    expect(db.scores.filter((s) => s.room_id === room.id)).toHaveLength(2);
    expect(db.scores.find((s) => s.table === 2)).toMatchObject({ mode: 'duel', rank: 1, players: 2 });
  });

  it('battle à quatre tables avec podium', () => {
    const db = db0();
    const room = createRoom(db, env(), 3, { pseudo: 'Charlie', game: 'pour', variant: 'std', invite: [1, 2, 4] });
    expect(room.mode).toBe('battle');
    for (const [t, n] of [[1, 'Alpha'], [2, 'Bravo'], [4, 'Delta']] as [TableNo, string][]) {
      respond(db, env(), t, room.id, true, n);
      setReady(db, env(), t, room.id, true);
    }
    startRoom(db, env(), 3, room.id);
    const done = playToEnd(db, room.id, { 1: 900, 2: 2100, 3: 1500, 4: 300 });
    expect(done.players.map((p) => [p.table, p.rank])).toEqual([[3, 2], [1, 3], [2, 1], [4, 4]]);
  });

  it('refus : la table refuse, l’organisateur ne peut pas lancer seul', () => {
    const db = db0();
    const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2] });
    respond(db, env(), 2, room.id, false, '');
    expect(room.players.find((p) => p.table === 2)?.state).toBe('declined');
    expect(tableStatus(db, 2, clock)).toBe('available');
    expect(() => startRoom(db, env(), 1, room.id)).toThrow('not_ready');
  });

  it('invitation expirée au bout du délai configuré, puis plus acceptable', () => {
    const db = db0();
    const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2] });
    tick(DEFAULT_ARCADE_CONFIG.invite_timeout_s * 1000 + 1);
    alive(db, 1, 2);
    expect(snapshot(db, clock, 2).invites).toHaveLength(0);
    expect(() => respond(db, env(), 2, room.id, true, 'Bravo')).toThrow('expired');
  });

  it('limite les invitations répétées et refuse une table déjà occupée', () => {
    const db = db0();
    const r1 = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2, 3, 4] });
    expect(() => createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2] })).toThrow('busy');
    leaveRoom(db, env(), 1, r1.id);
    createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2, 3] }).id;
    expect(() => createRoom(db, env(), 4, { pseudo: 'Delta', game: 'pour', variant: 'std', invite: [1] })).toThrow('unavailable');
    const r3 = db.rooms[db.rooms.length - 1];
    leaveRoom(db, env(), 1, r3.id);
    // 5 invitations déjà envoyées en moins de 2 minutes : la suivante dépasse la limite de 6.
    expect(() => createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2, 3] })).toThrow('rate_limited');
    tick(121000);
    alive(db, 1, 2, 3, 4);
    expect(createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2, 3] }).status).toBe('lobby');
  });

  it('déconnexion avant le départ : la table quitte le lobby ; celle de l’organisateur annule la partie', () => {
    const db = db0();
    const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'pour', variant: 'std', invite: [2, 3] });
    respond(db, env(), 2, room.id, true, 'Bravo');
    respond(db, env(), 3, room.id, true, 'Charlie');
    setReady(db, env(), 2, room.id, true);
    setReady(db, env(), 3, room.id, true);
    tick(ONLINE_MS + 1000);
    alive(db, 1, 2); // la table 3 ne donne plus signe de vie
    expect(room.players.find((p) => p.table === 3)?.state).toBe('left');
    startRoom(db, env(), 1, room.id);
    expect(room.mode).toBe('duel');

    alive(db, 3, 4);
    const r2 = createRoom(db, env(), 4, { pseudo: 'Delta', game: 'pour', variant: 'std', invite: [3] });
    tick(ONLINE_MS + 1000);
    alive(db, 3);
    expect(r2.status).toBe('cancelled');
  });

  it('déconnexion pendant la partie : abandon à l’échéance, l’autre joueur gagne', () => {
    const db = db0();
    const room = startedDuel(db);
    clock = room.ends_at! + 200;
    submitResult(db, env(), 1, room.id, pour(400));
    expect(room.status).toBe('playing');
    tick(RESULT_GRACE_MS);
    alive(db, 1);
    expect(room.status).toBe('finished');
    expect(room.players.find((p) => p.table === 2)).toMatchObject({ abandoned: true, rank: 2 });
    expect(room.players.find((p) => p.table === 1)?.rank).toBe(1);
    expect(db.scores.filter((s) => s.room_id === room.id)).toHaveLength(1);
  });

  it('reconnexion dans le délai de grâce : le résultat est accepté', () => {
    const db = db0();
    const room = startedDuel(db);
    clock = room.ends_at! + RESULT_GRACE_MS - 500;
    submitResult(db, env(), 2, room.id, pour(700));
    expect(room.players.find((p) => p.table === 2)?.score).toBe(700);
  });

  it('égalité : départage par l’ordre de validation, puis par la table', () => {
    const db = db0();
    const room = startedDuel(db);
    clock = room.ends_at! + 100;
    submitResult(db, env(), 2, room.id, pour(1000));
    tick(50);
    submitResult(db, env(), 1, room.id, pour(1000));
    expect(room.players.find((p) => p.table === 2)?.rank).toBe(1);
  });

  it('refuse un résultat envoyé deux fois, trop tôt, trop tard ou invraisemblable', () => {
    const db = db0();
    const room = startedDuel(db);
    clock = room.starts_at! + 5000;
    expect(() => submitResult(db, env(), 1, room.id, pour(500))).toThrow('too_early');
    clock = room.ends_at!;
    expect(() => submitResult(db, env(), 1, room.id, pour(99999))).toThrow('implausible');
    expect(() => submitResult(db, env(), 1, room.id, pour(3000, 5))).toThrow('implausible');
    submitResult(db, env(), 1, room.id, pour(500));
    expect(() => submitResult(db, env(), 1, room.id, pour(900))).toThrow('duplicate');
    expect(room.players.find((p) => p.table === 1)?.score).toBe(500);
    clock = room.ends_at! + RESULT_GRACE_MS + 1;
    expect(() => submitResult(db, env(), 2, room.id, pour(500))).toThrow('too_late');
  });

  it('revanche : une nouvelle partie qui attend la confirmation de l’adversaire', () => {
    const db = db0();
    const room = startedDuel(db);
    playToEnd(db, room.id, { 1: 100, 2: 200 });
    alive(db, 1, 2);
    const again = rematch(db, env(), 2, room.id, 'Bravo');
    expect(again).toMatchObject({ status: 'lobby', host: 2, rematch_of: room.id, game: 'pour' });
    expect(again.players.find((p) => p.table === 1)?.state).toBe('invited');
    expect(() => startRoom(db, env(), 2, again.id)).toThrow('not_ready');
  });

  it('Find It, chasse compétitive : chaque objet n’est attribué qu’une fois, au premier', () => {
    const db = db0();
    const room = createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'findit', variant: 'hunt', invite: [2] });
    respond(db, env(), 2, room.id, true, 'Bravo');
    setReady(db, env(), 2, room.id, true);
    startRoom(db, env(), 1, room.id);
    clock = room.starts_at! + 1000;
    expect(claimObject(db, env(), 2, room.id, '0:comb')).toEqual({ won: true, owner: 2 });
    expect(claimObject(db, env(), 1, room.id, '0:comb')).toEqual({ won: false, owner: 2 });
    expect(() => claimObject(db, env(), 2, room.id, '0:vinyl')).toThrow('rate_limited');
    tick(400);
    claimObject(db, env(), 2, room.id, '0:vinyl');
    tick(400);
    claimObject(db, env(), 1, room.id, '0:mic');
    clock = room.ends_at! + 10;
    // Le score officiel vient des objets attribués, pas de ce que la tablette annonce.
    submitResult(db, env(), 2, room.id, { score: 99999, stats: { wrong: 1 }, durationMs: 90000 });
    submitResult(db, env(), 1, room.id, { score: 5000, stats: { wrong: 0 }, durationMs: 90000 });
    expect(room.players.find((p) => p.table === 2)).toMatchObject({ score: 190, rank: 1 });
    expect(room.players.find((p) => p.table === 1)).toMatchObject({ score: 100, rank: 2 });
  });

  it('solo : session imprévisible, durée minimale, un seul enregistrement, pseudo filtré', () => {
    const db = db0();
    const s = startSolo(db, env(), 1, 'pour', 'std');
    expect(() => submitSolo(db, env(), 1, s.id, 'Léa', pour(800))).toThrow('too_early');
    tick(59000);
    expect(() => submitSolo(db, env(), 2, s.id, 'Léa', pour(800))).toThrow('not_found');
    expect(() => submitSolo(db, env(), 1, s.id, 'connard', pour(800))).toThrow('invalid');
    submitSolo(db, env(), 1, s.id, 'Léa', pour(800));
    expect(() => submitSolo(db, env(), 1, s.id, 'Léa', pour(800))).toThrow('duplicate');
    expect(db.scores).toHaveLength(1);
    expect(db.scores[0]).toMatchObject({ mode: 'solo', pseudo: 'Léa', table: 1, score: 800 });
  });

  it('un mini jeu désactivé par l’admin ne peut plus être lancé', () => {
    const db = db0();
    db.config.games.beat = false;
    expect(() => startSolo(db, env(), 1, 'beat', 'easy')).toThrow('invalid');
    expect(() => createRoom(db, env(), 1, { pseudo: 'Alpha', game: 'beat', variant: 'easy', invite: [2] })).toThrow('invalid');
  });
});
