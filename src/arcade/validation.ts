// Contrôles de cohérence des résultats envoyés par les tablettes.
// Le serveur ne rejoue pas la partie : il vérifie que le score reste sous le plafond théorique du jeu
// et qu'il est compatible avec les statistiques transmises (nombre de verres, de clients, d'objets, de notes).
// Limite connue : une tablette modifiée pourrait envoyer un score faux mais plausible. Les admins peuvent
// supprimer un score suspect ; les parties multijoueurs sont en plus encadrées par l'horloge du serveur.
import { GAMES } from './registry';
import type { GameKey, GameResult } from './types';

const n = (stats: Record<string, number>, k: string) => (Number.isFinite(stats[k]) ? Math.max(0, Math.floor(stats[k])) : 0);

export function isPlausible(game: GameKey, variant: string, result: GameResult): boolean {
  const { score, stats } = result;
  if (!Number.isInteger(score) || score < 0) return false;
  if (score > GAMES[game].maxScore(variant)) return false;
  switch (game) {
    case 'pour': {
      // 300 points au plus par verre (200 + bonus de série plafonné), un verre toutes les 2 secondes au mieux.
      const glasses = n(stats, 'glasses');
      return glasses <= 30 && score <= glasses * 300;
    }
    case 'barber': {
      // 200 points au plus par client, doublés par le multiplicateur, un client toutes les 4 secondes au mieux.
      const clients = n(stats, 'served');
      return clients <= 23 && score <= clients * 400;
    }
    case 'findit': {
      const found = n(stats, 'found');
      const scenes = n(stats, 'scenes');
      return found <= 45 && scenes <= 9 && score <= found * 150 + scenes * 200;
    }
    case 'beat': {
      const hits = n(stats, 'perfect') + n(stats, 'good');
      return hits <= n(stats, 'judgements') && score <= hits * 400;
    }
  }
}
