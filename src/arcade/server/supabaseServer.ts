// Serveur Supabase : chaque action passe par une fonction SQL (SECURITY DEFINER) qui applique les règles
// officielles (voir supabase/migrations/20261018000002_arcade.sql). La tablette s'identifie par un jeton
// d'appareil aléatoire, associé à une table par l'admin : l'interface client ne peut pas changer de table.
import { supabase } from '../../lib/supabase';
import { randomId } from '../../lib/random';
import { openChannel } from '../../lib/realtime/bus';
import { ArcadeError, type ArcadeErrorCode, type ArcadeSnapshot, type Room, type ScoreRow, type SoloSession, type TableNo, type WeeklyChallenge } from '../types';
import type { AdminRoomRow, ArcadeServer } from './types';

const DEVICE_KEY = 'cutshop.arcade.device';
const CODES: ArcadeErrorCode[] = ['not_paired', 'busy', 'unavailable', 'rate_limited', 'not_found', 'not_allowed', 'expired', 'not_ready', 'too_early', 'too_late', 'implausible', 'duplicate', 'taken', 'invalid'];

export function deviceToken(): string {
  try {
    let t = localStorage.getItem(DEVICE_KEY);
    if (!t) {
      t = randomId('dev_') + randomId();
      localStorage.setItem(DEVICE_KEY, t);
    }
    return t;
  } catch {
    return 'dev_unavailable';
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new ArcadeError('network');
  let res;
  try {
    res = await supabase.rpc(fn, args);
  } catch {
    throw new ArcadeError('network');
  }
  if (res.error) {
    const m = /arcade:([a-z_]+)/.exec(res.error.message);
    if (m && (CODES as string[]).includes(m[1])) throw new ArcadeError(m[1] as ArcadeErrorCode);
    if (/fetch|network|Failed/i.test(res.error.message)) throw new ArcadeError('network');
    throw new Error(res.error.message);
  }
  return res.data as T;
}

export function createSupabaseServer(): ArcadeServer {
  const token = deviceToken();
  let table: TableNo | null = null;
  const listeners = new Set<() => void>();
  const channel = openChannel('cutshop-arcade', `${token.slice(0, 12)}${randomId()}`, ['changed']);
  channel.on('changed', () => listeners.forEach((cb) => cb()));
  const changed = () => channel.send('changed', {});

  async function mutate<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const out = await rpc<T>(fn, { p_token: token, ...args });
    changed();
    return out;
  }

  return {
    kind: 'supabase',
    table: () => table,
    setConfig() {
      /* les réglages sont relus côté serveur dans la table settings */
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async snapshot() {
      const snap = await rpc<ArcadeSnapshot>('arcade_snapshot', { p_token: token });
      table = snap.table;
      return snap;
    },
    createRoom: (input) =>
      mutate<Room>('arcade_create_room', { p_pseudo: input.pseudo, p_game: input.game, p_variant: input.variant, p_invite: input.invite, p_rematch_of: input.rematchOf ?? null }),
    respond: (roomId, accept, pseudo) => mutate('arcade_respond', { p_room: roomId, p_accept: accept, p_pseudo: pseudo }),
    setReady: (roomId, ready) => mutate('arcade_set_ready', { p_room: roomId, p_ready: ready }),
    start: (roomId) => mutate('arcade_start', { p_room: roomId }),
    leave: (roomId) => mutate('arcade_leave', { p_room: roomId }),
    submitResult: (roomId, r) => mutate('arcade_submit_result', { p_room: roomId, p_score: r.score, p_stats: r.stats }),
    claim: (roomId, objectId) => mutate<{ won: boolean; owner: TableNo }>('arcade_claim', { p_room: roomId, p_object: objectId }),
    rematch: (roomId, pseudo) => mutate<Room>('arcade_rematch', { p_room: roomId, p_pseudo: pseudo }),
    startSolo: (game, variant) => rpc<SoloSession>('arcade_start_solo', { p_token: token, p_game: game, p_variant: variant }),
    submitSolo: (id, pseudo, r) => mutate('arcade_submit_solo', { p_session: id, p_pseudo: pseudo, p_score: r.score, p_stats: r.stats }),
    scores: (since) => rpc<ScoreRow[]>('arcade_scores', { p_since: since }),
    challenges: () => rpc<WeeklyChallenge[]>('arcade_challenges'),

    adminScores: (limit) => rpc<ScoreRow[]>('arcade_admin_scores', { p_limit: limit }),
    adminDeleteScore: (id) => rpc('arcade_admin_delete_score', { p_id: id }),
    adminRenamePseudo: (from, to) => rpc<number>('arcade_admin_rename', { p_from: from, p_to: to }),
    adminResetScores: (game) => rpc<number>('arcade_admin_reset', { p_game: game }),
    adminRooms: (limit) => rpc<AdminRoomRow[]>('arcade_admin_rooms', { p_limit: limit }),
    adminSaveChallenge: (c) => rpc('arcade_admin_save_challenge', { p_challenge: c }),
    adminDeleteChallenge: (id) => rpc('arcade_admin_delete_challenge', { p_id: id }),
    adminPairDevice: (t) => rpc('arcade_admin_pair_device', { p_token: token, p_table: t }),
  };
}
