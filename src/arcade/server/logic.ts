// Règles autoritaires de Cutshop Challenge, sous forme de fonctions pures sur l'état du serveur.
// Le serveur de démonstration les exécute telles quelles ; la version Supabase (supabase/migrations/
// 20261018000002_arcade.sql) applique les mêmes règles en SQL. Toute modification doit être faite des deux côtés.
import { checkPseudo } from '../pseudo';
import { rankPlayers } from '../ranking';
import { GAMES, isValidVariant } from '../registry';
import { isPlausible } from '../validation';
import {
  ArcadeError,
  type ArcadeConfig,
  type ArcadeSnapshot,
  type GameKey,
  type GameResult,
  type Invitation,
  type Room,
  type RoomPlayer,
  type ScoreRow,
  type SoloSession,
  type TableInfo,
  type TableNo,
  type TableStatus,
  type WeeklyChallenge,
} from '../types';

export const TABLES: TableNo[] = [1, 2, 3, 4];
/** Compte à rebours entre la confirmation du lancement et le départ commun. */
export const COUNTDOWN_MS = 4000;
/** Une table sans signe de vie depuis ce délai est considérée comme déconnectée. */
export const ONLINE_MS = 15000;
/** Délai accordé après la fin d'une partie pour transmettre le résultat (reconnexion possible). */
export const RESULT_GRACE_MS = 20000;
/** Un résultat peut arriver un peu avant la fin officielle (décalage d'horloge). */
export const EARLY_MS = 2500;
/** Un lobby abandonné est fermé au bout de 10 minutes. */
export const LOBBY_TTL_MS = 10 * 60000;
/** Un résultat solo doit arriver dans la demi heure qui suit le départ. */
export const SOLO_TTL_MS = 30 * 60000;
/** Deux réclamations d'objet d'une même table doivent être espacées d'au moins 300 ms. */
export const CLAIM_GAP_MS = 300;
/** Une partie terminée reste affichée (résultats, revanche) pendant 3 minutes. */
export const FINISHED_VISIBLE_MS = 3 * 60000;

export interface SoloRecord {
  id: string;
  table: TableNo;
  game: GameKey;
  variant: string;
  seed: number;
  started_at: number;
  submitted: boolean;
}

export interface ArcadeDb {
  version: 1;
  rooms: Room[];
  solo: SoloRecord[];
  scores: ScoreRow[];
  seen: Partial<Record<TableNo, number>>;
  inviteLog: { from: TableNo; at: number }[];
  claimLog: { table: TableNo; at: number }[];
  challenges: WeeklyChallenge[];
  /** Mini jeux désactivés et délais (réglés dans l'admin). */
  config: ArcadeConfig;
}

export interface Env {
  now: number;
  id: (prefix: string) => string;
  seed: () => number;
}

export function emptyDb(config: ArcadeConfig): ArcadeDb {
  return { version: 1, rooms: [], solo: [], scores: [], seen: {}, inviteLog: [], claimLog: [], challenges: [], config };
}

const ACTIVE_PLAYER = new Set(['joined', 'ready']);

function isOnline(db: ArcadeDb, table: TableNo, now: number): boolean {
  const seen = db.seen[table];
  return seen !== undefined && now - seen <= ONLINE_MS;
}

/** Partie à laquelle la table participe (lobby ou en cours). Une table ne peut être que dans une seule. */
export function activeRoomOf(db: ArcadeDb, table: TableNo): Room | null {
  for (const r of db.rooms) {
    if (r.status === 'lobby' && r.players.some((p) => p.table === table && ACTIVE_PLAYER.has(p.state))) return r;
    if (r.status === 'playing' && r.players.some((p) => p.table === table && p.state === 'ready' && !p.abandoned && p.result_at === null)) return r;
  }
  return null;
}

function pendingInvites(db: ArcadeDb, table: TableNo, now: number): Room[] {
  return db.rooms.filter((r) => r.status === 'lobby' && r.players.some((p) => p.table === table && p.state === 'invited' && (p.expires_at ?? 0) > now));
}

export function tableStatus(db: ArcadeDb, table: TableNo, now: number): TableStatus {
  if (!isOnline(db, table, now)) return 'offline';
  const room = activeRoomOf(db, table);
  if (room?.status === 'playing') return 'playing';
  if (room) return room.players.find((p) => p.table === table)!.state === 'ready' ? 'ready' : 'waiting';
  if (pendingInvites(db, table, now).length > 0) return 'invited';
  return 'available';
}

function player(room: Room, table: TableNo): RoomPlayer {
  const p = room.players.find((x) => x.table === table);
  if (!p) throw new ArcadeError('not_allowed');
  return p;
}

function findRoom(db: ArcadeDb, roomId: string): Room {
  const r = db.rooms.find((x) => x.id === roomId);
  if (!r) throw new ArcadeError('not_found');
  return r;
}

function participants(room: Room): RoomPlayer[] {
  return room.players.filter((p) => p.state === 'ready');
}

// ---------------------------------------------------------------------------
// Entretien : expirations, déconnexions, fin des parties dont le délai est écoulé.

export function housekeeping(db: ArcadeDb, now: number): void {
  for (const room of db.rooms) {
    if (room.status === 'lobby') {
      for (const p of room.players) {
        if (p.state === 'invited' && (p.expires_at ?? 0) <= now) p.state = 'expired';
        // Une tablette déconnectée avant le départ quitte le lobby.
        if (ACTIVE_PLAYER.has(p.state) && !isOnline(db, p.table, now)) p.state = 'left';
      }
      const host = room.players.find((p) => p.table === room.host)!;
      if (host.state === 'left' || now - room.created_at > LOBBY_TTL_MS) room.status = 'cancelled';
    } else if (room.status === 'playing' && room.ends_at !== null && now > room.ends_at + RESULT_GRACE_MS) {
      finalize(db, room, now);
    }
  }
  // Rétention limitée : parties de plus de 7 jours, sessions solo de plus d'un jour, journaux de 10 minutes.
  db.rooms = db.rooms.filter((r) => now - r.created_at < 7 * 86400000);
  db.solo = db.solo.filter((s) => now - s.started_at < 86400000);
  db.inviteLog = db.inviteLog.filter((l) => now - l.at < 600000);
  db.claimLog = db.claimLog.filter((l) => now - l.at < 600000);
}

function finalize(db: ArcadeDb, room: Room, now: number): void {
  if (room.status !== 'playing') return;
  const parts = participants(room);
  for (const p of parts) if (p.result_at === null) p.abandoned = true;
  const ranked = rankPlayers(parts);
  ranked.forEach((p, i) => (p.rank = i + 1));
  for (const p of ranked) {
    if (p.abandoned || p.score === null) continue;
    db.scores.push({
      id: `${room.id}:${p.table}`,
      game: room.game,
      variant: room.variant,
      pseudo: p.pseudo,
      table: p.table,
      score: p.score,
      mode: room.mode,
      room_id: room.id,
      rank: p.rank,
      players: parts.length,
      created_at: p.result_at ?? now,
    });
  }
  room.status = 'finished';
  room.ends_at = room.ends_at ?? now;
}

// ---------------------------------------------------------------------------
// Présence et instantané

export function heartbeat(db: ArcadeDb, env: Env, table: TableNo): ArcadeSnapshot {
  db.seen[table] = env.now;
  housekeeping(db, env.now);
  return snapshot(db, env.now, table);
}

export function snapshot(db: ArcadeDb, now: number, table: TableNo | null): ArcadeSnapshot {
  const tables: TableInfo[] = TABLES.map((t) => ({ table: t, status: tableStatus(db, t, now), last_seen: db.seen[t] ?? null }));
  if (table === null) return { now, table, tables, invites: [], room: null };
  const invites: Invitation[] = pendingInvites(db, table, now).map((r) => {
    const host = r.players.find((p) => p.table === r.host)!;
    return {
      room_id: r.id,
      game: r.game,
      variant: r.variant,
      mode: r.mode,
      host: r.host,
      host_pseudo: host.pseudo,
      expires_at: r.players.find((p) => p.table === table)!.expires_at!,
    };
  });
  let room = activeRoomOf(db, table);
  if (!room) {
    // Dernière partie terminée ou annulée récemment : résultats, refus, revanche.
    room =
      db.rooms
        .filter(
          (r) =>
            (r.status === 'finished' || r.status === 'cancelled' || (r.status === 'playing' && r.players.some((p) => p.table === table && p.state === 'ready'))) &&
            r.players.some((p) => p.table === table && (p.state === 'ready' || p.table === r.host)) &&
            now - (r.ends_at ?? r.created_at) < FINISHED_VISIBLE_MS,
        )
        .sort((a, b) => b.created_at - a.created_at)[0] ?? null;
  }
  return { now, table, tables, invites, room: room ? structuredClone(room) : null };
}

// ---------------------------------------------------------------------------
// Création, invitations, préparation

export interface CreateRoomInput {
  pseudo: string;
  game: GameKey;
  variant: string;
  invite: TableNo[];
  rematchOf?: string | null;
}

function validPseudo(raw: string): string {
  const c = checkPseudo(raw);
  if (!c.ok) throw new ArcadeError('invalid');
  return c.pseudo;
}

export function createRoom(db: ArcadeDb, env: Env, table: TableNo, input: CreateRoomInput): Room {
  housekeeping(db, env.now);
  const { now } = env;
  const pseudo = validPseudo(input.pseudo);
  if (!GAMES[input.game] || !db.config.games[input.game] || !isValidVariant(input.game, input.variant)) throw new ArcadeError('invalid');
  const invite = Array.from(new Set(input.invite)).filter((t) => t !== table);
  if (invite.length < 1 || invite.length > 3 || invite.some((t) => !TABLES.includes(t))) throw new ArcadeError('invalid');
  if (activeRoomOf(db, table)) throw new ArcadeError('busy');
  for (const t of invite) {
    const st = tableStatus(db, t, now);
    if (st !== 'available' && st !== 'invited') throw new ArcadeError('unavailable');
  }
  const recent = db.inviteLog.filter((l) => l.from === table && now - l.at < 120000).length;
  if (recent + invite.length > db.config.invite_max_per_2min) throw new ArcadeError('rate_limited');

  const expires = now + db.config.invite_timeout_s * 1000;
  const room: Room = {
    id: env.id('r'),
    game: input.game,
    variant: input.variant,
    seed: env.seed(),
    mode: invite.length === 1 ? 'duel' : 'battle',
    host: table,
    status: 'lobby',
    created_at: now,
    starts_at: null,
    ends_at: null,
    duration_ms: GAMES[input.game].durationMs(input.variant),
    rematch_of: input.rematchOf ?? null,
    players: [
      { table, pseudo, state: 'joined', invited_at: now, expires_at: null, score: null, result_at: null, abandoned: false, rank: null },
      ...invite.map((t): RoomPlayer => ({ table: t, pseudo: '', state: 'invited', invited_at: now, expires_at: expires, score: null, result_at: null, abandoned: false, rank: null })),
    ],
    claims: {},
  };
  db.rooms.push(room);
  for (let i = 0; i < invite.length; i++) db.inviteLog.push({ from: table, at: now });
  return room;
}

export function respond(db: ArcadeDb, env: Env, table: TableNo, roomId: string, accept: boolean, rawPseudo: string): Room {
  housekeeping(db, env.now);
  const room = findRoom(db, roomId);
  const p = player(room, table);
  if (room.status !== 'lobby' || p.state !== 'invited') throw new ArcadeError('expired');
  if (!accept) {
    p.state = 'declined';
    return room;
  }
  const pseudo = validPseudo(rawPseudo);
  if (activeRoomOf(db, table)) throw new ArcadeError('busy');
  p.state = 'joined';
  p.pseudo = pseudo;
  // Accepter une invitation refuse implicitement les autres invitations en attente.
  for (const other of pendingInvites(db, table, env.now)) if (other.id !== room.id) player(other, table).state = 'declined';
  return room;
}

export function setReady(db: ArcadeDb, env: Env, table: TableNo, roomId: string, ready: boolean): Room {
  housekeeping(db, env.now);
  const room = findRoom(db, roomId);
  const p = player(room, table);
  if (room.status !== 'lobby' || !ACTIVE_PLAYER.has(p.state)) throw new ArcadeError('not_allowed');
  p.state = ready ? 'ready' : 'joined';
  return room;
}

/** L'organisateur confirme le lancement : départ commun fixé par l'horloge du serveur. */
export function startRoom(db: ArcadeDb, env: Env, table: TableNo, roomId: string): Room {
  housekeeping(db, env.now);
  const room = findRoom(db, roomId);
  if (room.host !== table) throw new ArcadeError('not_allowed');
  if (room.status !== 'lobby') throw new ArcadeError('not_allowed');
  const host = player(room, table);
  if (host.state === 'joined') host.state = 'ready';
  if (room.players.some((p) => p.state === 'joined')) throw new ArcadeError('not_ready');
  const ready = participants(room);
  if (ready.length < 2) throw new ArcadeError('not_ready');
  for (const p of room.players) if (p.state === 'invited') p.state = 'expired';
  room.mode = ready.length === 2 ? 'duel' : 'battle';
  room.status = 'playing';
  room.starts_at = env.now + COUNTDOWN_MS;
  room.ends_at = room.starts_at + room.duration_ms;
  return room;
}

export function leaveRoom(db: ArcadeDb, env: Env, table: TableNo, roomId: string): Room {
  const room = findRoom(db, roomId);
  const p = player(room, table);
  if (room.status === 'lobby') {
    if (room.host === table) room.status = 'cancelled';
    else if (p.state === 'invited') p.state = 'declined';
    else p.state = 'left';
  } else if (room.status === 'playing' && p.state === 'ready' && p.result_at === null) {
    p.abandoned = true;
    if (participants(room).every((x) => x.abandoned || x.result_at !== null)) finalize(db, room, env.now);
  }
  return room;
}

// ---------------------------------------------------------------------------
// Résultats

export function submitResult(db: ArcadeDb, env: Env, table: TableNo, roomId: string, result: GameResult): Room {
  const { now } = env;
  housekeeping(db, now);
  const room = findRoom(db, roomId);
  const p = player(room, table);
  if (p.state !== 'ready') throw new ArcadeError('not_allowed');
  if (p.result_at !== null) throw new ArcadeError('duplicate');
  if (room.status === 'finished' || p.abandoned) throw new ArcadeError('too_late');
  if (room.status !== 'playing' || room.ends_at === null) throw new ArcadeError('not_allowed');
  if (now < room.ends_at - EARLY_MS) throw new ArcadeError('too_early');
  if (now > room.ends_at + RESULT_GRACE_MS) throw new ArcadeError('too_late');

  let score = result.score;
  if (room.game === 'findit' && room.variant === 'hunt') {
    // Chasse compétitive : le score officiel vient des objets attribués par le serveur.
    const claimed = Object.values(room.claims).filter((t) => t === table).length;
    score = Math.max(0, claimed * 100 - 10 * Math.min(50, Math.max(0, Math.floor(result.stats.wrong ?? 0))));
  } else if (!isPlausible(room.game, room.variant, result)) {
    throw new ArcadeError('implausible');
  }
  p.score = score;
  p.result_at = now;
  if (participants(room).every((x) => x.abandoned || x.result_at !== null)) finalize(db, room, now);
  return room;
}

/** Find It, chasse compétitive : le premier qui trouve l'objet le remporte pour tout le monde. */
export function claimObject(db: ArcadeDb, env: Env, table: TableNo, roomId: string, objectId: string): { won: boolean; owner: TableNo } {
  const { now } = env;
  const room = findRoom(db, roomId);
  const p = player(room, table);
  if (room.game !== 'findit' || room.variant !== 'hunt' || room.status !== 'playing' || p.state !== 'ready' || p.abandoned) throw new ArcadeError('not_allowed');
  if (room.starts_at === null || room.ends_at === null || now < room.starts_at || now > room.ends_at + 500) throw new ArcadeError('not_allowed');
  if (!/^\d{1,2}:[a-z]{2,12}$/.test(objectId)) throw new ArcadeError('invalid');
  const owner = room.claims[objectId];
  if (owner !== undefined) return { won: owner === table, owner };
  const last = db.claimLog.filter((l) => l.table === table).reduce((m, l) => Math.max(m, l.at), 0);
  if (now - last < CLAIM_GAP_MS) throw new ArcadeError('rate_limited');
  room.claims[objectId] = table;
  db.claimLog.push({ table, at: now });
  return { won: true, owner: table };
}

/** Revanche : nouvelle salle, mêmes jeu et adversaires, qui doivent tous accepter à nouveau. */
export function rematch(db: ArcadeDb, env: Env, table: TableNo, roomId: string, pseudo: string): Room {
  const room = findRoom(db, roomId);
  if (room.status !== 'finished') throw new ArcadeError('not_allowed');
  const me = player(room, table);
  if (me.state !== 'ready') throw new ArcadeError('not_allowed');
  const others = participants(room)
    .filter((p) => p.table !== table)
    .map((p) => p.table);
  return createRoom(db, env, table, { pseudo, game: room.game, variant: room.variant, invite: others, rematchOf: room.id });
}

// ---------------------------------------------------------------------------
// Solo

export function startSolo(db: ArcadeDb, env: Env, table: TableNo, game: GameKey, variant: string): SoloSession {
  if (!GAMES[game] || !db.config.games[game] || !isValidVariant(game, variant) || !GAMES[game].soloVariants.includes(variant)) throw new ArcadeError('invalid');
  const recent = db.solo.find((s) => s.table === table && env.now - s.started_at < 3000);
  if (recent) throw new ArcadeError('rate_limited');
  const rec: SoloRecord = { id: env.id('s'), table, game, variant, seed: env.seed(), started_at: env.now, submitted: false };
  db.solo.push(rec);
  return { id: rec.id, seed: rec.seed, started_at: rec.started_at, now: env.now };
}

export function submitSolo(db: ArcadeDb, env: Env, table: TableNo, sessionId: string, rawPseudo: string, result: GameResult): ScoreRow {
  const s = db.solo.find((x) => x.id === sessionId && x.table === table);
  if (!s) throw new ArcadeError('not_found');
  if (s.submitted) throw new ArcadeError('duplicate');
  const elapsed = env.now - s.started_at;
  if (elapsed < GAMES[s.game].durationMs(s.variant) - EARLY_MS) throw new ArcadeError('too_early');
  if (elapsed > SOLO_TTL_MS) throw new ArcadeError('too_late');
  if (!isPlausible(s.game, s.variant, result)) throw new ArcadeError('implausible');
  const pseudo = validPseudo(rawPseudo);
  s.submitted = true;
  const row: ScoreRow = {
    id: s.id,
    game: s.game,
    variant: s.variant,
    pseudo,
    table,
    score: result.score,
    mode: 'solo',
    room_id: null,
    rank: null,
    players: null,
    created_at: env.now,
  };
  db.scores.push(row);
  return row;
}
