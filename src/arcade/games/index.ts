// Composants des mini jeux, chargés à la demande (chaque jeu pèse sur le premier affichage de l'Arcade sinon).
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameKey } from '../types';
import type { GameProps } from './types';

export const GAME_COMPONENTS: Partial<Record<GameKey, LazyExoticComponent<ComponentType<GameProps>>>> = {
  pour: lazy(() => import('./pour/PerfectPour')),
};
