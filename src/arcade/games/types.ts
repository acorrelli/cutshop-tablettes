// Contrat d'affichage commun à tous les mini jeux : la plateforme (solo ou salle multijoueur) fournit
// la graine, l'heure de départ synchronisée et l'horloge serveur ; le jeu renvoie son score en direct et son résultat.
import type { GameResult, TableNo } from '../types';

export interface GameSound {
  on: boolean;
  /** 0 à 1. */
  volume: number;
}

export interface GameProps {
  /** Graine commune : toutes les tablettes d'une partie reçoivent exactement la même séquence. */
  seed: number;
  variant: string;
  /** Horloge en millisecondes, alignée sur le serveur (Date.now() corrigé du décalage mesuré). */
  clock: () => number;
  /** Instant de départ (horloge ci dessus). Le jeu affiche son décompte jusqu'à cet instant. */
  startAt: number;
  durationMs: number;
  sound: GameSound;
  lang: 'fr' | 'en';
  /** Score courant, envoyé aux adversaires (affichage seulement). Le jeu l'appelle au plus quelques fois par seconde. */
  onLive: (score: number) => void;
  /** Fin de partie : appelé une seule fois, avec le résultat du moteur. */
  onEnd: (result: GameResult) => void;
  /** Find It, chasse compétitive : réclame un objet auprès du serveur (premier arrivé, premier servi). */
  claim?: (objectId: string) => Promise<{ won: boolean; owner: TableNo } | null>;
  /** Find It, chasse compétitive : objets déjà attribués (objet -> table). */
  claims?: Record<string, TableNo>;
  myTable?: TableNo | null;
  /** Beat Drop en solo : musique importée choisie par le joueur (sinon tirée de la graine). */
  track?: string | null;
}
