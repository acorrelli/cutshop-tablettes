// Classements de Cutshop Challenge. Ces règles sont appliquées à l'identique par le serveur
// (pour le classement officiel d'une partie) et affichées aux joueurs.
//
// Égalités dans une partie : 1) score le plus haut ; 2) résultat validé le plus tôt ; 3) plus petit numéro de table.
// Égalités dans un classement : 1) valeur la plus haute ; 2) performance atteinte la plus tôt ; 3) pseudo (ordre alphabétique).
import { pseudoKey } from './pseudo';
import { challengePoints } from './registry';
import type { GameKey, Period, RoomPlayer, ScoreRow, TableNo } from './types';

export const TIE_RULES_FR = [
  'Score le plus élevé',
  'À égalité, le résultat validé en premier',
  'Puis le plus petit numéro de table',
];
export const TIE_RULES_EN = ['Highest score', 'If tied, the result validated first', 'Then the lowest table number'];

/** Classe les joueurs d'une partie terminée. Les abandons sont classés après les autres. */
export function rankPlayers<T extends Pick<RoomPlayer, 'table' | 'score' | 'result_at' | 'abandoned'>>(players: T[]): T[] {
  return players.slice().sort((a, b) => {
    if (a.abandoned !== b.abandoned) return a.abandoned ? 1 : -1;
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    if (sb !== sa) return sb - sa;
    const ta = a.result_at ?? Number.MAX_SAFE_INTEGER;
    const tb = b.result_at ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return a.table - b.table;
  });
}

// ---------------------------------------------------------------------------
// Périodes (heure de Bruxelles : la journée commence à minuit, la semaine le lundi)

function brusselsParts(ms: number) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), h: +p.hour, min: +p.minute, s: +p.second };
}

/** Début de la période en millisecondes (0 pour l'historique complet). */
export function periodStart(period: Period, now: number): number {
  if (period === 'all') return 0;
  const p = brusselsParts(now);
  const sinceMidnight = ((p.h * 60 + p.min) * 60 + p.s) * 1000 + (now % 1000);
  const midnight = now - sinceMidnight;
  if (period === 'today') return midnight;
  if (period === 'week') return midnight - p.wd * 86400000;
  return midnight - (p.d - 1) * 86400000;
}

// ---------------------------------------------------------------------------
// Classements

export interface BoardEntry {
  position: number;
  pseudo: string;
  game: GameKey | null;
  variant: string | null;
  value: number;
  /** Détail affiché (score brut, nombre de victoires...). */
  detail: Record<string, number>;
  table: TableNo | null;
  at: number;
}

function finalize(rows: Omit<BoardEntry, 'position'>[], limit: number): BoardEntry[] {
  return rows
    .sort((a, b) => b.value - a.value || a.at - b.at || a.pseudo.localeCompare(b.pseudo))
    .slice(0, limit)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

/** Meilleur score par pseudo pour un jeu (une ligne par joueur, pas par partie). */
export function bestScores(scores: ScoreRow[], game: GameKey, opts: { since?: number; until?: number; variant?: string; modes?: ScoreRow['mode'][]; limit?: number } = {}): BoardEntry[] {
  const best = new Map<string, ScoreRow>();
  for (const s of scores) {
    if (s.game !== game) continue;
    if (opts.variant && s.variant !== opts.variant) continue;
    if (opts.modes && !opts.modes.includes(s.mode)) continue;
    if (opts.since !== undefined && s.created_at < opts.since) continue;
    if (opts.until !== undefined && s.created_at > opts.until) continue;
    const k = pseudoKey(s.pseudo);
    const cur = best.get(k);
    if (!cur || s.score > cur.score || (s.score === cur.score && s.created_at < cur.created_at)) best.set(k, s);
  }
  return finalize(
    Array.from(best.values()).map((s) => ({ pseudo: s.pseudo, game: s.game, variant: s.variant, value: s.score, detail: {}, table: s.table, at: s.created_at })),
    opts.limit ?? 50,
  );
}

/**
 * Classement général en points Challenge (parties solo uniquement) : pour chaque jeu, seul le meilleur résultat
 * du joueur compte, ramené sur 1 000 points (1 500 au plus). Le total va donc de 0 à 6 000 :
 * rejouer cent fois ne rapporte rien de plus que réussir une bonne partie dans chaque jeu.
 */
export function challengeBoard(scores: ScoreRow[], opts: { since?: number; limit?: number } = {}): BoardEntry[] {
  const perPlayer = new Map<string, { pseudo: string; table: TableNo; perGame: Map<GameKey, { pts: number; at: number }> }>();
  for (const s of scores) {
    if (s.mode !== 'solo') continue;
    if (opts.since !== undefined && s.created_at < opts.since) continue;
    const k = pseudoKey(s.pseudo);
    if (!perPlayer.has(k)) perPlayer.set(k, { pseudo: s.pseudo, table: s.table, perGame: new Map() });
    const p = perPlayer.get(k)!;
    const pts = challengePoints(s.game, s.variant, s.score);
    const cur = p.perGame.get(s.game);
    if (!cur || pts > cur.pts || (pts === cur.pts && s.created_at < cur.at)) p.perGame.set(s.game, { pts, at: s.created_at });
  }
  return finalize(
    Array.from(perPlayer.values()).map((p) => {
      const games = Array.from(p.perGame.values());
      return {
        pseudo: p.pseudo,
        game: null,
        variant: null,
        value: games.reduce((n, g) => n + g.pts, 0),
        detail: { games: games.length },
        table: p.table,
        at: Math.max(...games.map((g) => g.at)),
      };
    }),
    opts.limit ?? 50,
  );
}

/** Barème multijoueur : duel gagné 3 points ; battle 5, 3 et 1 point pour les trois premiers. */
export function multiPoints(mode: 'duel' | 'battle', rank: number): number {
  if (mode === 'duel') return rank === 1 ? 3 : 0;
  return rank === 1 ? 5 : rank === 2 ? 3 : rank === 3 ? 1 : 0;
}

/** Classement des duels ou des battles : points, puis victoires, puis moins de parties jouées. */
export function multiBoard(scores: ScoreRow[], mode: 'duel' | 'battle', opts: { since?: number; limit?: number } = {}): BoardEntry[] {
  const per = new Map<string, { pseudo: string; table: TableNo; pts: number; wins: number; played: number; at: number }>();
  for (const s of scores) {
    if (s.mode !== mode || s.rank === null) continue;
    if (opts.since !== undefined && s.created_at < opts.since) continue;
    const k = pseudoKey(s.pseudo);
    if (!per.has(k)) per.set(k, { pseudo: s.pseudo, table: s.table, pts: 0, wins: 0, played: 0, at: 0 });
    const p = per.get(k)!;
    const pts = multiPoints(mode, s.rank);
    p.pts += pts;
    p.played += 1;
    if (s.rank === 1) p.wins += 1;
    if (pts > 0) p.at = Math.max(p.at, s.created_at);
  }
  return Array.from(per.values())
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.played - b.played || a.at - b.at || a.pseudo.localeCompare(b.pseudo))
    .slice(0, opts.limit ?? 50)
    .map((p, i) => ({ position: i + 1, pseudo: p.pseudo, game: null, variant: null, value: p.pts, detail: { wins: p.wins, played: p.played }, table: p.table, at: p.at }));
}
