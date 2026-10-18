// Types partagés entre l'interface, la couche de données et les données d'exemple.
import type { ArcadeConfig } from '../arcade/types';

export type Lang = 'fr' | 'en';

export type ModuleKey =
  | 'concept'
  | 'booking'
  | 'services'
  | 'events'
  | 'arcade'
  | 'battle'
  | 'stop10'
  | 'wheel'
  | 'kids'
  | 'drinks'
  | 'products'
  | 'gift'
  | 'invoice'
  | 'instagram';

export const MODULE_KEYS: ModuleKey[] = [
  'concept',
  'booking',
  'services',
  'events',
  'arcade',
  'battle',
  'stop10',
  'wheel',
  'kids',
  'drinks',
  'products',
  'gift',
  'invoice',
  'instagram',
];

/** Réglages publics de l'application (une seule ligne en base, colonne jsonb). */
export interface AppSettings {
  salonkee_url: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  hours_fr: string;
  hours_en: string;
  concept_title_fr: string;
  concept_title_en: string;
  concept_body_fr: string;
  concept_body_en: string;
  concept_tagline_fr: string;
  concept_tagline_en: string;
  concept_photo_hero: string;
  concept_photo_1: string;
  concept_photo_2: string;
  concept_photo_3: string;
  block_barber_fr: string;
  block_barber_en: string;
  block_bar_fr: string;
  block_bar_en: string;
  block_events_fr: string;
  block_events_en: string;
  gift_title_fr: string;
  gift_title_en: string;
  gift_body_fr: string;
  gift_body_en: string;
  gift_amounts: string;
  gift_validity_fr: string;
  gift_validity_en: string;
  gift_conditions_fr: string;
  gift_conditions_en: string;
  invoice_title_fr: string;
  invoice_title_en: string;
  invoice_body_fr: string;
  invoice_body_en: string;
  privacy_fr: string;
  privacy_en: string;
  modules: Record<ModuleKey, boolean>;
  /** Délai avant la mise en veille et l'effacement de la session client, en secondes. */
  idle_seconds: number;
  /** Réglages de Cutshop Arcade. */
  arcade: ArcadeConfig;
}

export type EventKind = 'dj' | 'talk' | 'read' | 'mic' | 'run' | 'other';

export interface CutEvent {
  id: string;
  kind: EventKind;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  recurrence_fr: string;
  recurrence_en: string;
  starts_at: string; // ISO
  ends_at: string | null;
  image_url: string | null;
  capacity: number;
  published: boolean;
}

export interface CutEventWithSeats extends CutEvent {
  seats_left: number;
}

export interface Registration {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  email: string;
  seats: number;
  newsletter: boolean;
  tablet: string;
  created_at: string;
}

export interface NewsletterSubscriber {
  email: string;
  first_name: string;
  last_name: string;
  source: string;
  created_at: string;
}

export type ServiceCategory = 'cut' | 'cut_beard' | 'care' | 'kids';

/** Prestation du salon, avec son tarif classique et, le cas échéant, son tarif étudiant. */
export interface Service {
  id: string;
  category: ServiceCategory;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  duration_min: number | null;
  price: number;
  student_price: number | null;
  /** true : shampoing inclus, false : non inclus, null : non précisé. */
  shampoo_included: boolean | null;
  sort: number;
  active: boolean;
}

export type DrinkCategory = 'beer' | 'soft' | 'other';

export interface Drink {
  id: string;
  category: DrinkCategory;
  name: string;
  brand: string;
  style_fr: string;
  style_en: string;
  abv: number | null;
  description_fr: string;
  description_en: string;
  price: number;
  image_url: string | null;
  sort: number;
  active: boolean;
}

export interface Pairing {
  id: string;
  cut_fr: string;
  cut_en: string;
  drink_fr: string;
  drink_en: string;
  line_fr: string;
  line_en: string;
  sort: number;
  active: boolean;
}

export type HairType = 'fine' | 'thick' | 'curly' | 'coily';
export type ScalpType = 'normal' | 'dry' | 'oily';
export type EffectType = 'volume' | 'hold' | 'shine' | 'natural' | 'care';

export interface Product {
  id: string;
  name: string;
  brand: string;
  benefit_fr: string;
  benefit_en: string;
  usage_fr: string;
  usage_en: string;
  price: number;
  image_url: string | null;
  hair_types: HairType[];
  scalp_types: ScalpType[];
  for_beard: boolean;
  effects: EffectType[];
  sort: number;
  active: boolean;
}

export type QuizTheme = 'mons' | 'beer' | 'barber' | 'music' | 'general' | 'kids';
export const QUIZ_THEMES: QuizTheme[] = ['mons', 'beer', 'barber', 'music', 'general', 'kids'];

export interface QuizQuestion {
  id: string;
  theme: QuizTheme;
  question_fr: string;
  question_en: string;
  /** Quatre propositions. La bonne réponse est à l'index correct_index. */
  answers_fr: string[];
  answers_en: string[];
  correct_index: number;
  active: boolean;
}

export interface WheelPrize {
  id: string;
  label_fr: string;
  label_en: string;
  /** Probabilité relative en pourcentage (normalisée au tirage). */
  weight: number;
  /** null : stock illimité. */
  stock: number | null;
  is_losing: boolean;
  color: string;
  sort: number;
  active: boolean;
}

/** Segment public de la roue (sans probabilité ni stock). */
export interface WheelSegment {
  id: string;
  label_fr: string;
  label_en: string;
  color: string;
  is_losing: boolean;
}

export type SpinReason = 'staff' | 'battle' | 'stop10';

export interface WheelSpin {
  id: string;
  prize_id: string | null;
  label_fr: string;
  label_en: string;
  code: string | null;
  reason: SpinReason;
  tablet: string;
  created_at: string;
  redeemed_at: string | null;
}

export type SpinResult =
  | { ok: true; prize_id: string; label_fr: string; label_en: string; code: string | null; is_losing: boolean }
  | { ok: false; error: 'pin' | 'locked' | 'disabled' | 'rate' | 'empty' | 'network' };

export interface Stop10Score {
  id: string;
  pseudo: string;
  delta_ms: number;
  elapsed_ms: number;
  tablet: string;
  created_at: string;
}

export type RequestStatus = 'new' | 'done';

export interface ProductRequest {
  id: string;
  first_name: string;
  product_ids: string[];
  product_names: string[];
  profile: ProductProfile;
  tablet: string;
  status: RequestStatus;
  created_at: string;
}

export interface ProductProfile {
  hair: HairType;
  scalp: ScalpType;
  beard: boolean;
  effect: EffectType;
}

export interface InvoiceRequest {
  id: string;
  company: string;
  vat: string;
  address: string;
  email: string;
  first_name: string;
  last_name: string;
  tablet: string;
  status: RequestStatus;
  created_at: string;
}

export interface DeskRequest {
  id: string;
  kind: 'gift';
  tablet: string;
  status: RequestStatus;
  created_at: string;
}

export type GameKind = 'battle' | 'battle_solo' | 'stop10' | 'memory' | 'barber' | 'wheel';

export interface GamePlay {
  id: string;
  game: GameKind;
  players: number;
  ref: string | null;
  tablet: string;
  created_at: string;
}

export interface PublicContent {
  settings: AppSettings;
  events: CutEventWithSeats[];
  services: Service[];
  drinks: Drink[];
  pairings: Pairing[];
  products: Product[];
  questions: QuizQuestion[];
  segments: WheelSegment[];
}
