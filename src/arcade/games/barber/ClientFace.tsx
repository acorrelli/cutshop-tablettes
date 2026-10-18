// Illustration vectorielle d'un client vu de face (unités du dessin : x de 0 à 400, visage de 110 à 290).
// L'état de la coupe (côtés, longueurs, barbe, contour, produit, finition) modifie le dessin en direct.
import { memo } from 'react';
import type { ClientLook, HairStyle } from './engine';
import { polyPath, type Pt } from './geometry';

export interface CutState {
  /** Côtés encore touffus (étape tondeuse à faire). */
  bushySides: boolean;
  /** Côtés dégradés (tondeuse faite). */
  fadedSides: boolean;
  /** Longueur en trop sur le dessus, de 0 (net) à 1 (pas encore coupé). */
  untidy: number;
  /** Mèches rebelles restant à couper (pointes des ciseaux). */
  strands: Pt[];
  /** Barbe encore en broussaille. */
  wildBeard: boolean;
  /** Contour net tracé. */
  sharpLine: boolean;
  shine: boolean;
  sparkle: boolean;
}

export const NEAT: CutState = {
  bushySides: false,
  fadedSides: true,
  untidy: 0,
  strands: [],
  wildBeard: false,
  sharpLine: true,
  shine: true,
  sparkle: false,
};

/** Humeur : 1 = ravi, 0 = furieux. */
interface Props {
  look: ClientLook;
  cut: CutState;
  mood: number;
  uid: string;
  /** Traits de tondeuse et de taille de barbe (masquent les longueurs en trop). */
  clipTrails?: Pt[][];
  beardTrails?: Pt[][];
  /** Version des traits : force le rendu quand ils changent. */
  ver?: number;
}

export const CAPES = [
  { fill: '#15181d', trim: '#39f5a6' },
  { fill: '#1a1420', trim: '#ff4fd8' },
  { fill: '#10171f', trim: '#45c8ff' },
  { fill: '#1d1712', trim: '#f2c14e' },
];

export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Bas de la chevelure (ligne du front), commun à toutes les coupes.
const HAIRLINE = 'L282 172 Q200 108 118 172 Z';

const HAIR_TOP: Record<HairStyle, string> = {
  quiff: `M110 178 C98 128 114 92 150 74 C172 50 220 38 256 52 C286 64 302 104 294 142 C292 156 291 166 290 178 ${HAIRLINE}`,
  slick: `M108 180 C100 118 134 70 200 66 C266 70 300 118 292 180 ${HAIRLINE}`,
  afro: `M104 186 C76 120 108 34 200 30 C292 34 324 120 296 186 ${HAIRLINE}`,
  curly: `M106 182 C96 124 126 72 200 66 C274 72 304 124 294 182 ${HAIRLINE}`,
  messy: `M108 182 C100 142 104 112 120 94 L114 70 L142 80 L150 52 L172 70 L188 42 L204 66 L224 40 L234 68 L258 52 L260 80 L286 74 L282 100 C298 122 298 152 292 182 ${HAIRLINE}`,
};

const CURLS: Pt[] = [
  { x: 112, y: 150 },
  { x: 118, y: 118 },
  { x: 134, y: 92 },
  { x: 158, y: 74 },
  { x: 186, y: 64 },
  { x: 214, y: 64 },
  { x: 242, y: 74 },
  { x: 266, y: 92 },
  { x: 282, y: 118 },
  { x: 288, y: 150 },
];

const SIDE_NEAT_L = 'M111 150 C105 176 106 200 112 216 L123 213 C120 190 121 168 127 150 Z';
const SIDE_BUSHY_L =
  'M116 134 C92 140 82 166 90 190 C84 200 90 218 104 226 C96 214 100 206 106 204 L124 214 C120 190 121 168 128 146 Z';
const BEARD_NEAT =
  'M112 228 C112 300 148 370 200 386 C252 370 288 300 288 228 L272 232 C268 266 254 290 232 296 C216 300 184 300 168 296 C146 290 132 266 128 232 Z';
export const BEARD_WILD =
  'M102 222 C96 300 126 380 158 400 L168 414 L180 402 L192 418 L204 404 L216 416 L226 400 L240 410 C276 380 306 300 298 222 L272 232 C268 266 254 290 232 296 C216 300 184 300 168 296 C146 290 132 266 128 232 Z';
const MUSTACHE = 'M166 302 C178 290 194 290 200 296 C206 290 222 290 234 302 C222 310 210 306 200 304 C190 306 178 310 166 302 Z';
const FACE =
  'M110 168 C108 250 120 310 150 345 C170 368 185 376 200 376 C215 376 230 368 250 345 C280 310 292 250 290 168 C290 110 250 84 200 84 C150 84 110 110 110 168 Z';

function Hair({ look, untidy, uid, shine }: { look: ClientLook; untidy: number; uid: string; shine: boolean }) {
  const sx = 1 + 0.04 * untidy;
  const sy = 1 + 0.12 * untidy;
  const tf = `translate(200 178) scale(${sx} ${sy}) translate(-200 -178)`;
  const dark = shade(look.hair, -0.35);
  const light = shade(look.hair, 0.28);
  return (
    <g transform={tf}>
      <path d={HAIR_TOP[look.style]} fill={`url(#${uid}hair)`} stroke={dark} strokeWidth={2} />
      {look.style === 'curly' &&
        CURLS.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={17} fill={look.hair} stroke={dark} strokeWidth={2} />)}
      {look.style === 'afro' && (
        <g fill="none" stroke={light} strokeOpacity={0.35} strokeWidth={3}>
          <path d="M140 70 q8 -8 16 0 M182 50 q8 -8 16 0 M226 54 q8 -8 16 0 M262 82 q8 -8 16 0 M120 112 q8 -8 16 0 M270 120 q8 -8 16 0 M196 96 q8 -8 16 0" />
        </g>
      )}
      {look.style === 'slick' && (
        <g fill="none" stroke={light} strokeOpacity={0.4} strokeWidth={2.5} strokeLinecap="round">
          <path d="M130 140 C150 96 200 82 262 104 M140 152 C162 112 210 100 270 122 M124 120 C150 84 200 74 250 84" />
        </g>
      )}
      {look.style === 'quiff' && (
        <g fill="none" stroke={light} strokeOpacity={0.45} strokeWidth={2.5} strokeLinecap="round">
          <path d="M150 120 C160 86 210 62 270 78 M168 128 C182 98 222 84 280 104 M132 140 C140 110 170 90 210 82" />
        </g>
      )}
      {look.style === 'messy' && (
        <g fill="none" stroke={light} strokeOpacity={0.4} strokeWidth={2.5} strokeLinecap="round">
          <path d="M150 120 L160 84 M184 116 L192 70 M214 116 L226 72 M244 122 L256 86" />
        </g>
      )}
      {shine && (
        <g fill="none" stroke="#fff" strokeLinecap="round" opacity={0.55}>
          <path d="M152 92 C176 76 214 72 240 82" strokeWidth={5} />
          <path d="M136 112 C142 104 150 98 158 94" strokeWidth={3} />
        </g>
      )}
    </g>
  );
}

function ClientFaceBase({ look, cut, mood, uid, clipTrails, beardTrails }: Props) {
  const skinDark = shade(look.skin, -0.18);
  const skinDeep = shade(look.skin, -0.32);
  const hairDark = shade(look.hair, -0.35);
  const cape = CAPES[look.cape % CAPES.length];
  // Expression : sourcils et bouche suivent la patience.
  const brow = mood > 0.5 ? 0 : mood > 0.25 ? 4 : 9;
  const mouth = mood > 0.6 ? 'M180 318 Q200 334 220 318' : mood > 0.3 ? 'M184 322 Q200 326 216 322' : 'M184 328 Q200 314 216 328';
  const beardColor = look.hair === '#C9B9A6' ? '#B8A794' : look.hair;
  const trailPath = (trails: Pt[][] | undefined) => (trails ?? []).filter((t) => t.length > 0).map((t) => polyPath(t.length === 1 ? [t[0], { x: t[0].x + 0.1, y: t[0].y }] : t));
  return (
    <g>
      <defs>
        <radialGradient id={`${uid}skin`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor={shade(look.skin, 0.12)} />
          <stop offset="0.7" stopColor={look.skin} />
          <stop offset="1" stopColor={skinDark} />
        </radialGradient>
        <linearGradient id={`${uid}hair`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={shade(look.hair, 0.18)} />
          <stop offset="1" stopColor={look.hair} />
        </linearGradient>
        <linearGradient id={`${uid}fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.hair} stopOpacity={0.95} />
          <stop offset="0.65" stopColor={look.hair} stopOpacity={0.35} />
          <stop offset="1" stopColor={look.hair} stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id={`${uid}cape`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(cape.fill, 0.1)} />
          <stop offset="1" stopColor={cape.fill} />
        </linearGradient>
        <mask id={`${uid}clipmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="480">
          <rect x="0" y="0" width="400" height="480" fill="#fff" />
          {trailPath(clipTrails).map((d, i) => (
            <path key={i} d={d} stroke="#000" strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </mask>
        <mask id={`${uid}beardmask`} maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="480">
          <rect x="0" y="0" width="400" height="480" fill="#fff" />
          {trailPath(beardTrails).map((d, i) => (
            <path key={i} d={d} stroke="#000" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </mask>
      </defs>

      {/* Cape et cou */}
      <path d="M168 340 L168 412 L232 412 L232 340 Z" fill={skinDeep} />
      <path d="M20 480 C30 430 90 404 160 396 L200 436 L240 396 C310 404 370 430 380 480" fill="none" stroke={cape.trim} strokeOpacity={0.25} strokeWidth={12} />
      <path d="M20 480 C30 430 90 404 160 396 L200 436 L240 396 C310 404 370 430 380 480 Z" fill={`url(#${uid}cape)`} stroke={cape.trim} strokeWidth={3} />
      <path d="M160 396 L200 436 L240 396 L230 390 L200 420 L170 390 Z" fill="#f4f1ea" />

      {/* Oreilles */}
      <ellipse cx={103} cy={232} rx={13} ry={25} fill={skinDark} />
      <ellipse cx={297} cy={232} rx={13} ry={25} fill={skinDark} />
      <ellipse cx={105} cy={232} rx={6} ry={14} fill={skinDeep} opacity={0.6} />
      <ellipse cx={295} cy={232} rx={6} ry={14} fill={skinDeep} opacity={0.6} />
      {look.earring && <circle cx={101} cy={258} r={4.5} fill="#f2c14e" stroke="#8f6b22" strokeWidth={1.5} />}

      {/* Visage */}
      <path d={FACE} fill={`url(#${uid}skin)`} stroke={skinDeep} strokeWidth={2} />

      {/* Côtés */}
      {cut.fadedSides ? (
        <g fill={`url(#${uid}fade)`}>
          <path d={SIDE_NEAT_L} />
          <path d={SIDE_NEAT_L} transform="translate(400 0) scale(-1 1)" />
        </g>
      ) : (
        <g fill={look.hair} opacity={0.9}>
          <path d={SIDE_NEAT_L} />
          <path d={SIDE_NEAT_L} transform="translate(400 0) scale(-1 1)" />
        </g>
      )}
      {cut.bushySides && (
        <g mask={`url(#${uid}clipmask)`}>
          {[0, 1].map((k) => (
            <g key={k} transform={k ? 'translate(400 0) scale(-1 1)' : undefined}>
              <path d={SIDE_BUSHY_L} fill={shade(look.hair, 0.06)} stroke={hairDark} strokeWidth={2} />
              <path
                d="M96 170 l-8 -6 M94 190 l-9 2 M100 210 l-8 8 M108 150 l-6 -10 M112 176 l-4 14 M116 156 l-2 16"
                stroke={hairDark}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
            </g>
          ))}
        </g>
      )}

      {/* Barbe */}
      {look.beard === 'full' && (
        <g>
          {cut.wildBeard && (
            <g mask={`url(#${uid}beardmask)`}>
              <path d={BEARD_WILD} fill={shade(beardColor, 0.14)} stroke={hairDark} strokeWidth={2} />
              <path
                d="M116 250 q-4 20 2 40 M126 300 q-2 22 8 40 M150 340 q2 20 14 34 M184 360 q4 18 2 36 M216 360 q-4 18 -2 36 M250 340 q-2 20 -14 34 M274 300 q2 22 -8 40 M284 250 q4 20 -2 40"
                stroke={hairDark}
                strokeOpacity={0.6}
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M130 330 l-6 16 M160 366 l-4 16 M200 380 l0 18 M240 366 l4 16 M270 330 l6 16 M114 280 l-8 10 M286 280 l8 10"
                stroke={hairDark}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          )}
          <path d={BEARD_NEAT} fill={shade(beardColor, -0.08)} stroke={hairDark} strokeWidth={cut.sharpLine ? 2.5 : 1.5} />
          <path d={MUSTACHE} fill={beardColor} stroke={hairDark} strokeWidth={1.5} />
        </g>
      )}
      {look.beard === 'stubble' && (
        <g opacity={0.2}>
          <path d={BEARD_NEAT} fill={beardColor} />
          <path d={MUSTACHE} fill={beardColor} />
        </g>
      )}
      {look.beard === 'mustache' && <path d={MUSTACHE} fill={beardColor} stroke={hairDark} strokeWidth={1.5} />}

      {/* Yeux, sourcils, nez, bouche */}
      <g>
        <ellipse cx={166} cy={226} rx={14} ry={8.5} fill="#fbf8f2" />
        <ellipse cx={234} cy={226} rx={14} ry={8.5} fill="#fbf8f2" />
        <circle cx={167} cy={226} r={6.5} fill="#3a2516" />
        <circle cx={233} cy={226} r={6.5} fill="#3a2516" />
        <circle cx={167} cy={226} r={3} fill="#0d0907" />
        <circle cx={233} cy={226} r={3} fill="#0d0907" />
        <circle cx={169.5} cy={223.5} r={1.8} fill="#fff" />
        <circle cx={235.5} cy={223.5} r={1.8} fill="#fff" />
        <path d="M151 223 Q166 212 181 223" stroke={skinDeep} strokeWidth={2.5} fill="none" />
        <path d="M219 223 Q234 212 249 223" stroke={skinDeep} strokeWidth={2.5} fill="none" />
        <path d={`M146 ${206 - brow} Q164 ${194} 184 ${204 + brow}`} stroke={hairDark} strokeWidth={7} strokeLinecap="round" fill="none" />
        <path d={`M216 ${204 + brow} Q236 ${194} 254 ${206 - brow}`} stroke={hairDark} strokeWidth={7} strokeLinecap="round" fill="none" />
        <path d="M200 234 C197 252 190 262 192 268 C196 276 206 276 210 268" stroke={skinDeep} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d={mouth} stroke="#6e2f2a" strokeWidth={5} fill="none" strokeLinecap="round" />
        {mood > 0.6 && (
          <g fill="#e0705a" opacity={0.18}>
            <ellipse cx={146} cy={262} rx={16} ry={9} />
            <ellipse cx={254} cy={262} rx={16} ry={9} />
          </g>
        )}
      </g>
      {look.glasses && (
        <g fill="rgba(160,220,255,0.12)" stroke="#111" strokeWidth={4}>
          <rect x={144} y={210} width={46} height={32} rx={10} />
          <rect x={210} y={210} width={46} height={32} rx={10} />
          <path d="M190 222 Q200 216 210 222" fill="none" />
        </g>
      )}

      {/* Cheveux */}
      <Hair look={look} untidy={cut.untidy} uid={uid} shine={cut.shine} />
      {cut.sharpLine && (
        <path d="M120 172 Q200 108 280 172" fill="none" stroke={shade(look.hair, -0.5)} strokeWidth={3} opacity={0.8} />
      )}
      {cut.strands.length > 0 && (
        <g fill="none" stroke={look.hair} strokeWidth={5} strokeLinecap="round">
          {cut.strands.map((p, i) => {
            const dx = p.x - 200;
            const dy = p.y - 190;
            const l = Math.hypot(dx, dy) || 1;
            const ex = p.x + (dx / l) * 26;
            const ey = p.y + (dy / l) * 26;
            return <path key={i} d={`M${p.x} ${p.y} Q${(p.x + ex) / 2 + 8} ${(p.y + ey) / 2 - 6} ${ex} ${ey}`} stroke={hairDark} />;
          })}
        </g>
      )}
      {cut.sparkle && (
        <g fill="#fff6c8" stroke="#ffe27a" strokeWidth={2}>
          {[
            [92, 92, 1],
            [312, 120, 0.8],
            [300, 300, 0.7],
            [84, 300, 0.9],
          ].map(([x, y, s], i) => (
            <path key={i} transform={`translate(${x} ${y}) scale(${s})`} d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" />
          ))}
        </g>
      )}
    </g>
  );
}

export const ClientFace = memo(ClientFaceBase);
