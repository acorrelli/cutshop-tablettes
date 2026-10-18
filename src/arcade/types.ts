// Contrats communs de Cutshop Arcade : jeux, parties, salles, classements.
// Version du protocole client serveur : à incrémenter à chaque changement incompatible des échanges.
export const ARCADE_PROTOCOL = 1;

export type GameKey = 'pour' | 'barber' | 'findit' | 'beat';
export const GAME_KEYS: GameKey[] = ['barber', 'pour', 'beat', 'findit'];

/** solo : partie libre ; duel : 2 tables ; battle : 3 ou 4 tables. */
export type PlayMode = 'solo' | 'duel' | 'battle';

/** Numéro de table (1 à 4), attribué par l'admin à chaque tablette. */
export type TableNo = 1 | 2 | 3 | 4;

/** Résultat d'une partie, produit par le moteur du jeu. */
export interface GameResult {
  score: number;
  /** Statistiques propres au jeu (verres servis, notes parfaites...). Servent aux contrôles de cohérence. */
  stats: Record<string, number>;
  durationMs: number;
}

/**
 * Contrat commun des moteurs de jeu (logique pure, sans affichage) :
 * initialisation par le constructeur (graine, variante), puis start, update, finish, result, dispose.
 */
export interface ArcadeGameEngine {
  /** Démarre la partie à l'instant donné (horloge en millisecondes). */
  start(now: number): void;
  /** Fait avancer la simulation jusqu'à l'instant donné. */
  update(now: number): void;
  /** Vrai quand le temps est écoulé ou que la partie est terminée. */
  isOver(now: number): boolean;
  /** Termine la partie (abandon ou fin du temps). */
  finish(now: number): void;
  result(): GameResult;
  /** Libère les ressources (minuteries, sons). */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Salles multijoueurs

export type RoomStatus = 'lobby' | 'playing' | 'finished' | 'cancelled';

/**
 * invited : invitation en attente ; joined : a accepté ; ready : prêt ;
 * declined : a refusé ; expired : invitation expirée ; left : parti ou déconnecté avant le départ.
 */
export type PlayerState = 'invited' | 'joined' | 'ready' | 'declined' | 'expired' | 'left';

export interface RoomPlayer {
  table: TableNo;
  pseudo: string;
  state: PlayerState;
  invited_at: number;
  expires_at: number | null;
  /** Score officiel une fois la partie terminée et validée. */
  score: number | null;
  result_at: number | null;
  /** Abandon ou déconnexion pendant la partie. */
  abandoned: boolean;
  /** Classement final (1 = vainqueur). */
  rank: number | null;
}

export interface Room {
  id: string;
  game: GameKey;
  variant: string;
  seed: number;
  mode: Exclude<PlayMode, 'solo'>;
  host: TableNo;
  status: RoomStatus;
  created_at: number;
  starts_at: number | null;
  ends_at: number | null;
  duration_ms: number;
  rematch_of: string | null;
  players: RoomPlayer[];
  /** Find It, chasse compétitive : objet -> table qui l'a trouvé en premier. */
  claims: Record<string, TableNo>;
}

/** États d'une table vus depuis l'accueil Cutshop Challenge. */
export type TableStatus = 'available' | 'invited' | 'waiting' | 'ready' | 'playing' | 'offline';

export interface TableInfo {
  table: TableNo;
  status: TableStatus;
  last_seen: number | null;
}

export interface Invitation {
  room_id: string;
  game: GameKey;
  variant: string;
  mode: Exclude<PlayMode, 'solo'>;
  host: TableNo;
  host_pseudo: string;
  expires_at: number;
}

/** Instantané renvoyé par le serveur à chaque rafraîchissement (sert aussi de signal de présence). */
export interface ArcadeSnapshot {
  now: number;
  table: TableNo | null;
  tables: TableInfo[];
  invites: Invitation[];
  room: Room | null;
}

export interface SoloSession {
  id: string;
  seed: number;
  started_at: number;
  now: number;
}

// ---------------------------------------------------------------------------
// Scores et classements

export interface ScoreRow {
  id: string;
  game: GameKey;
  variant: string;
  pseudo: string;
  table: TableNo;
  score: number;
  mode: PlayMode;
  room_id: string | null;
  /** Classement dans la partie multijoueur (1 = vainqueur), null en solo. */
  rank: number | null;
  /** Nombre de joueurs classés de la partie (pour le barème des battles). */
  players: number | null;
  created_at: number;
}

export type Period = 'today' | 'week' | 'month' | 'all';

export interface WeeklyChallenge {
  id: string;
  game: GameKey;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  reward_fr: string;
  reward_en: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
}

export interface ArcadeConfig {
  games: Record<GameKey, boolean>;
  /** Délai d'expiration d'une invitation, en secondes. */
  invite_timeout_s: number;
  /** Nombre maximal d'invitations envoyées par une table sur 2 minutes. */
  invite_max_per_2min: number;
}

export const DEFAULT_ARCADE_CONFIG: ArcadeConfig = {
  games: { barber: true, pour: true, beat: true, findit: true },
  invite_timeout_s: 45,
  invite_max_per_2min: 6,
};

/** Erreurs métier renvoyées par le serveur (mêmes codes en démo et avec Supabase). */
export type ArcadeErrorCode =
  | 'not_paired'
  | 'busy'
  | 'unavailable'
  | 'rate_limited'
  | 'not_found'
  | 'not_allowed'
  | 'expired'
  | 'not_ready'
  | 'too_early'
  | 'too_late'
  | 'implausible'
  | 'duplicate'
  | 'taken'
  | 'invalid'
  | 'network';

export class ArcadeError extends Error {
  constructor(public code: ArcadeErrorCode) {
    super(code);
  }
}
