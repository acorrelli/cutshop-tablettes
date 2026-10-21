// Identité de la tablette. Le nom (Tablette 1 à 4) est un réglage d'appareil, pas une donnée personnelle :
// il est stocké localement. L'identifiant d'instance change à chaque chargement de page.

import { randomId } from './random';

const KEY = 'cutshop.tablet';

export const INSTANCE_ID = randomId('i');

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function getTabletName(): string | null {
  // Le paramètre ?tablet= (stocké pour l'onglet) permet de simuler plusieurs tablettes dans un navigateur.
  const fromSession = safeGet(typeof sessionStorage !== 'undefined' ? sessionStorage : undefined, KEY);
  if (fromSession) return fromSession;
  return safeGet(typeof localStorage !== 'undefined' ? localStorage : undefined, KEY);
}

export function setTabletName(name: string): void {
  try {
    localStorage.setItem(KEY, name);
    sessionStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le nom reste en mémoire pour la session */
  }
}

export function applyTabletFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tablet');
    if (t) sessionStorage.setItem(KEY, t.slice(0, 30));
  } catch {
    /* ignoré */
  }
}

export const TABLET_NAMES = ['Tablette 1', 'Tablette 2', 'Tablette 3', 'Tablette 4'];

const STAFF_KEY = 'cutshop.staff';
/** Adresse au chargement de la page : un appui long sur le logo d'une tablette ne compte pas comme ouverture directe. */
const INITIAL_HASH = typeof window === 'undefined' ? '' : window.location.hash;

/**
 * Poste de l'équipe (Chromebook) : aucun nom de tablette, ou application ouverte directement sur l'admin
 * (raccourci #/admin, sans ?tablet= dans l'adresse). Ce second cas est mémorisé : le poste reste reconnu
 * même s'il a reçu un nom de tablette par erreur.
 */
export function isStaffDevice(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('tablet')) return false;
    if (localStorage.getItem(STAFF_KEY) === '1') return true;
    if (INITIAL_HASH.startsWith('#/admin') && !sessionStorage.getItem(KEY)) {
      localStorage.setItem(STAFF_KEY, '1');
      return true;
    }
  } catch {
    /* stockage indisponible : décision sur le nom de tablette */
  }
  return !getTabletName();
}
