// Contrat client serveur de Cutshop Challenge (protocole ARCADE_PROTOCOL).
// Deux implémentations : démonstration (navigateur, plusieurs onglets) et Supabase (fonctions SQL autoritaires).
import type { ArcadeConfig, ArcadeSnapshot, GameKey, GameResult, Room, ScoreRow, SoloSession, TableNo, WeeklyChallenge } from '../types';
import type { CreateRoomInput } from './logic';

export interface AdminRoomRow {
  id: string;
  game: GameKey;
  variant: string;
  mode: 'duel' | 'battle';
  status: Room['status'];
  created_at: number;
  players: { table: TableNo; pseudo: string; state: string; score: number | null; rank: number | null; abandoned: boolean }[];
}

export interface ArcadeServer {
  readonly kind: 'demo' | 'supabase';
  /** Table de cette tablette (null tant qu'elle n'est pas associée par l'admin). */
  table(): TableNo | null;
  /** Signe de vie + état courant (tables, invitations reçues, partie en cours). */
  snapshot(): Promise<ArcadeSnapshot>;
  createRoom(input: CreateRoomInput): Promise<Room>;
  respond(roomId: string, accept: boolean, pseudo: string): Promise<void>;
  setReady(roomId: string, ready: boolean): Promise<void>;
  start(roomId: string): Promise<void>;
  leave(roomId: string): Promise<void>;
  submitResult(roomId: string, result: GameResult): Promise<void>;
  claim(roomId: string, objectId: string): Promise<{ won: boolean; owner: TableNo }>;
  rematch(roomId: string, pseudo: string): Promise<Room>;
  startSolo(game: GameKey, variant: string): Promise<SoloSession>;
  submitSolo(sessionId: string, pseudo: string, result: GameResult): Promise<void>;
  /** Scores servant aux classements depuis une date (meilleurs scores solo et parties multijoueurs). */
  scores(since: number): Promise<ScoreRow[]>;
  challenges(): Promise<WeeklyChallenge[]>;
  /** Réglages de l'Arcade (jeux actifs, délais), lus dans les réglages publics. */
  setConfig(config: ArcadeConfig): void;
  /** Appelé quand une autre tablette modifie l'état (invitation, prêt, départ...). */
  onChange(cb: () => void): () => void;

  // Administration (session admin requise)
  adminScores(limit: number): Promise<ScoreRow[]>;
  adminDeleteScore(id: string): Promise<void>;
  adminRenamePseudo(from: string, to: string): Promise<number>;
  adminResetScores(game: GameKey | null): Promise<number>;
  adminRooms(limit: number): Promise<AdminRoomRow[]>;
  adminSaveChallenge(c: WeeklyChallenge): Promise<void>;
  adminDeleteChallenge(id: string): Promise<void>;
  /** Associe cette tablette à une table (Supabase). En démonstration, la table vient du nom de la tablette. */
  adminPairDevice(table: TableNo): Promise<void>;
}
