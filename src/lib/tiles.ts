// Organisation de l'accueil : quatre grandes catégories regroupant les modules, puis les réseaux sociaux.
import {
  Beer,
  CalendarCheck,
  FerrisWheel,
  Gamepad2,
  Gift,
  Joystick,
  History,
  Puzzle,
  Receipt,
  Scissors,
  Sparkles,
  SprayCan,
  Swords,
  Ticket,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { ModuleKey } from './types';

export type IconType = LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

export interface TileDef {
  key: ModuleKey;
  to: string;
  icon: IconType;
  tone: string;
}

export const MODULE_TILES: Record<string, TileDef> = {
  arcade: { key: 'arcade', to: '/arcade', icon: Joystick, tone: 'from-[#0E1714] via-[#13241D] to-[#0A0F0D]' },
  battle: { key: 'battle', to: '/battle', icon: Swords, tone: 'from-gold-500 to-gold-700 text-bottle-950' },
  stop10: { key: 'stop10', to: '/stop10', icon: Timer, tone: 'from-bottle-600 to-bottle-900' },
  wheel: { key: 'wheel', to: '/roue', icon: FerrisWheel, tone: 'from-gold-600 to-bottle-800' },
  kids: { key: 'kids', to: '/kids', icon: Puzzle, tone: 'from-[#2F8F6B] via-[#D4A84B] to-[#C2553F]' },
  drinks: { key: 'drinks', to: '/boissons', icon: Beer, tone: 'from-gold-700 to-bottle-900' },
  products: { key: 'products', to: '/produits', icon: SprayCan, tone: 'from-bottle-400 to-bottle-800' },
  gift: { key: 'gift', to: '/cheques', icon: Gift, tone: 'from-cream-300 to-gold-500 text-bottle-900' },
  concept: { key: 'concept', to: '/concept', icon: History, tone: 'from-bottle-600 to-bottle-900' },
  events: { key: 'events', to: '/evenements', icon: Ticket, tone: 'from-bottle-500 to-bottle-700' },
  services: { key: 'services', to: '/services', icon: Scissors, tone: 'from-gold-600 to-bottle-900' },
  booking: { key: 'booking', to: '/rdv', icon: CalendarCheck, tone: 'from-cream-200 to-cream-400 text-bottle-900' },
  invoice: { key: 'invoice', to: '/factures', icon: Receipt, tone: 'from-bottle-800 to-bottle-950' },
};

export type CategoryKey = 'cutshop' | 'shop' | 'services' | 'games';

export interface CategoryDef {
  key: CategoryKey;
  to: string;
  icon: IconType;
  tone: string;
  /** Modules regroupés dans la catégorie. */
  items: ModuleKey[];
}

export const CATEGORIES: CategoryDef[] = [
  { key: 'cutshop', to: '/cutshop', icon: Sparkles, tone: 'from-bottle-500 to-bottle-800', items: ['concept', 'events'] },
  { key: 'shop', to: '/boissons-produits', icon: Beer, tone: 'from-gold-700 to-bottle-900', items: ['drinks', 'products', 'gift'] },
  { key: 'services', to: '/nos-services', icon: Scissors, tone: 'from-cream-200 to-gold-500 text-bottle-950', items: ['services', 'booking', 'invoice'] },
  { key: 'games', to: '/jeux', icon: Gamepad2, tone: 'from-gold-500 to-gold-700 text-bottle-950', items: ['arcade', 'battle', 'stop10', 'wheel', 'kids'] },
];

/** Catégorie d'un module, pour le bouton retour des pages. */
export function backFor(module: ModuleKey): string {
  return CATEGORIES.find((c) => c.items.includes(module))?.to ?? '/';
}
