// Visuels de Cutshop Arcade (tirés des maquettes fournies par le Cutshop). Remplaçables par de vrais visuels.
import bgArcade from '../assets/arcade/bg-arcade.jpg';
import bgBarber from '../assets/arcade/bg-barber.jpg';
import bgBeat from '../assets/arcade/bg-beat.jpg';
import bgFindit from '../assets/arcade/bg-findit.jpg';
import bgPour from '../assets/arcade/bg-pour.jpg';
import cardBarber from '../assets/arcade/card-barber.jpg';
import cardBeat from '../assets/arcade/card-beat.jpg';
import cardFindit from '../assets/arcade/card-findit.jpg';
import cardPour from '../assets/arcade/card-pour.jpg';
import logo from '../assets/arcade/logo.png';
import type { GameKey } from './types';

export const ARCADE_LOGO = logo;
export const ARCADE_BG = bgArcade;

export const GAME_ART: Record<GameKey, { card: string; bg: string }> = {
  barber: { card: cardBarber, bg: bgBarber },
  pour: { card: cardPour, bg: bgPour },
  beat: { card: cardBeat, bg: bgBeat },
  findit: { card: cardFindit, bg: bgFindit },
};

export const ARCADE_CARDS = (['barber', 'pour', 'beat', 'findit'] as GameKey[]).map((key) => ({ key, src: GAME_ART[key].card }));
