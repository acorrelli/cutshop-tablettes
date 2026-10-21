import type { BeatTrackRow } from '../../arcade/games/beat/tracks';
import type {
  AppSettings,
  CutEvent,
  CutEventWithSeats,
  DeskRequest,
  Drink,
  Service,
  GameKind,
  GamePlay,
  InvoiceRequest,
  NewsletterSubscriber,
  Pairing,
  Product,
  ProductProfile,
  ProductRequest,
  QuizQuestion,
  Registration,
  RequestStatus,
  SpinReason,
  SpinResult,
  Stop10Score,
  WheelPrize,
  WheelSegment,
  WheelSpin,
} from '../types';

/** Erreur réseau : la demande peut être remise en file d'attente. */
export class NetworkError extends Error {
  constructor(message = 'network') {
    super(message);
    this.name = 'NetworkError';
  }
}

export type RegisterResult =
  | { ok: true; seats_left: number }
  | { ok: false; error: 'full' | 'not_enough' | 'closed' | 'invalid' | 'consent'; seats_left?: number };

export interface RegisterInput {
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  seats: number;
  newsletter: boolean;
  consent: boolean;
  tablet: string;
}

export interface InvoiceInput {
  company: string;
  vat: string;
  address: string;
  email: string;
  first_name: string;
  last_name: string;
  consent: boolean;
  tablet: string;
}

export type PinCheck = { ok: true } | { ok: false; error: 'pin' | 'locked' | 'disabled' | 'network' };

export type RedeemResult =
  | { ok: true; label_fr: string; created_at: string }
  | { ok: false; error: 'unknown' | 'used' | 'forbidden'; label_fr?: string; redeemed_at?: string };

/** Tables gérées par le CRUD générique de l'admin. */
export type AdminTable =
  | 'events'
  | 'services'
  | 'drinks'
  | 'drink_pairings'
  | 'products'
  | 'quiz_questions'
  | 'wheel_prizes'
  | 'beat_tracks';

export interface AdminTableRow {
  events: CutEvent;
  services: Service;
  drinks: Drink;
  drink_pairings: Pairing;
  products: Product;
  quiz_questions: QuizQuestion;
  wheel_prizes: WheelPrize;
  beat_tracks: BeatTrackRow;
}

export type RequestTable = 'product_requests' | 'invoice_requests' | 'desk_requests';

export interface StatsRows {
  plays: GamePlay[];
  registrations: Pick<Registration, 'event_id' | 'seats' | 'tablet' | 'created_at'>[];
  spins: Pick<WheelSpin, 'reason' | 'tablet' | 'created_at' | 'code' | 'redeemed_at'>[];
  productRequests: Pick<ProductRequest, 'tablet' | 'created_at'>[];
}

export interface AdminSession {
  email: string;
  isAdmin: boolean;
}

export interface Api {
  readonly mode: 'supabase' | 'demo';

  // Contenus publics
  getSettings(): Promise<AppSettings>;
  getEvents(): Promise<CutEventWithSeats[]>;
  getServices(): Promise<Service[]>;
  getDrinks(): Promise<Drink[]>;
  getPairings(): Promise<Pairing[]>;
  getProducts(): Promise<Product[]>;
  getQuestions(): Promise<QuizQuestion[]>;
  getWheelSegments(): Promise<WheelSegment[]>;
  getStop10Today(): Promise<Stop10Score[]>;
  /** Musiques importées de Beat Drop (actives). Liste vide si la table n'existe pas encore. */
  getBeatTracks(): Promise<BeatTrackRow[]>;

  // Envois depuis la tablette
  registerEvent(input: RegisterInput): Promise<RegisterResult>;
  submitProductRequest(firstName: string, products: Product[], profile: ProductProfile, tablet: string): Promise<void>;
  submitInvoiceRequest(input: InvoiceInput): Promise<void>;
  submitDeskRequest(kind: 'gift', tablet: string): Promise<void>;
  addStop10Score(pseudo: string, deltaMs: number, elapsedMs: number, tablet: string): Promise<void>;
  logPlay(game: GameKind, players: number, ref: string | null, tablet: string): Promise<void>;
  verifyPin(pin: string, tablet: string): Promise<PinCheck>;
  spinWheel(reason: SpinReason, pin: string | null, tablet: string): Promise<SpinResult>;

  // Authentification admin
  signIn(email: string, password: string): Promise<AdminSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AdminSession | null>;

  // Administration
  adminList<T extends AdminTable>(table: T): Promise<AdminTableRow[T][]>;
  adminUpsert<T extends AdminTable>(table: T, row: Partial<AdminTableRow[T]>): Promise<AdminTableRow[T]>;
  /** Modifie seulement les champs donnés d'une ligne existante. */
  adminUpdate<T extends AdminTable>(table: T, id: string, patch: Partial<AdminTableRow[T]>): Promise<AdminTableRow[T]>;
  adminDelete(table: AdminTable, id: string): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  getStaffPin(): Promise<string>;
  setStaffPin(pin: string): Promise<void>;
  listRegistrations(eventId?: string): Promise<Registration[]>;
  listNewsletter(): Promise<NewsletterSubscriber[]>;
  deleteNewsletter(email: string): Promise<void>;
  listSpins(limit?: number): Promise<WheelSpin[]>;
  redeemCode(code: string): Promise<RedeemResult>;
  listRequests(table: 'product_requests'): Promise<ProductRequest[]>;
  listRequests(table: 'invoice_requests'): Promise<InvoiceRequest[]>;
  listRequests(table: 'desk_requests'): Promise<DeskRequest[]>;
  setRequestStatus(table: RequestTable, id: string, status: RequestStatus): Promise<void>;
  deleteRequest(table: RequestTable, id: string): Promise<void>;
  statsSince(sinceIso: string): Promise<StatsRows>;
  /** Stop à 10 secondes : tous les scores du jour (classement), suppression d'un score ou de toute la journée. */
  listStop10Today(): Promise<Stop10Score[]>;
  deleteStop10(id: string): Promise<void>;
  clearStop10Today(): Promise<number>;
  uploadImage(file: File): Promise<string>;
  /** Extrait MP3 de Beat Drop : renvoie son adresse publique. */
  uploadAudio(file: Blob): Promise<string>;
  /** Supprime un fichier envoyé (photo ou musique) à partir de son adresse. Sans effet si l'adresse est externe. */
  removeMedia(url: string): Promise<void>;
  purgePersonalData(): Promise<Record<string, number>>;
}
