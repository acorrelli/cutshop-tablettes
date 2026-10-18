// Dessins vectoriels des objets de Find It Cutshop. Chaque dessin tient dans la boîte -50..50 (centre 0,0) :
// la scène le place et le met à l'échelle, la liste l'affiche en icône. Dégradés partagés dans <ArtDefs />.
import type { JSX } from 'react';
import type { ObjectKey } from './sceneData';

/** Dégradés et motifs communs (un seul exemplaire dans la page suffit, les autres SVG y font référence). */
export function ArtDefs() {
  return (
    <defs>
      <linearGradient id="fiMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6f8fa" />
        <stop offset="0.45" stopColor="#a7b0b8" />
        <stop offset="0.6" stopColor="#e9edf0" />
        <stop offset="1" stopColor="#68717a" />
      </linearGradient>
      <linearGradient id="fiMetalV" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7d868f" />
        <stop offset="0.3" stopColor="#f2f5f7" />
        <stop offset="0.55" stopColor="#b9c1c8" />
        <stop offset="1" stopColor="#5b636b" />
      </linearGradient>
      <linearGradient id="fiGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fbe7a6" />
        <stop offset="0.45" stopColor="#d4a84b" />
        <stop offset="1" stopColor="#8f6b22" />
      </linearGradient>
      <linearGradient id="fiBlack" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a4d52" />
        <stop offset="1" stopColor="#121315" />
      </linearGradient>
      <linearGradient id="fiBeer" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd56e" />
        <stop offset="0.6" stopColor="#e39a1c" />
        <stop offset="1" stopColor="#a7600b" />
      </linearGradient>
      <linearGradient id="fiGlass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.25" />
      </linearGradient>
      <linearGradient id="fiWood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#5b3519" />
        <stop offset="0.5" stopColor="#9a6436" />
        <stop offset="1" stopColor="#4d2c14" />
      </linearGradient>
      <linearGradient id="fiWoodH" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8723f" />
        <stop offset="1" stopColor="#5e3819" />
      </linearGradient>
      <linearGradient id="fiAmber" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#3d1b05" />
        <stop offset="0.45" stopColor="#8a4610" />
        <stop offset="1" stopColor="#2c1303" />
      </linearGradient>
      <linearGradient id="fiLeaf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7fd08a" />
        <stop offset="1" stopColor="#1f6b45" />
      </linearGradient>
      <linearGradient id="fiRed" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff6b5e" />
        <stop offset="1" stopColor="#a3160f" />
      </linearGradient>
      <linearGradient id="fiCream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffaf0" />
        <stop offset="1" stopColor="#d9c7a3" />
      </linearGradient>
      <linearGradient id="fiTerra" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9c4a26" />
        <stop offset="0.5" stopColor="#d77a48" />
        <stop offset="1" stopColor="#8a3d1c" />
      </linearGradient>
      <radialGradient id="fiMirror" cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#e9f6ff" />
        <stop offset="0.5" stopColor="#8fb3c9" />
        <stop offset="1" stopColor="#3e5b6d" />
      </radialGradient>
      <radialGradient id="fiDisco" cx="0.35" cy="0.3" r="0.75">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.5" stopColor="#b6c3cf" />
        <stop offset="1" stopColor="#3f4a55" />
      </radialGradient>
      <radialGradient id="fiFlame" cx="0.5" cy="0.7" r="0.6">
        <stop offset="0" stopColor="#fffbe0" />
        <stop offset="0.5" stopColor="#ffd25a" />
        <stop offset="1" stopColor="#ff7a1a" />
      </radialGradient>
      <radialGradient id="fiWarm" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
        <stop offset="1" stopColor="#ffb340" stopOpacity="0" />
      </radialGradient>
      <pattern id="fiPoleStripes" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
        <rect width="24" height="24" fill="#f6f1e6" />
        <rect width="8" height="24" fill="#c4271c" />
        <rect x="12" width="6" height="24" fill="#1f4f9c" />
      </pattern>
    </defs>
  );
}

const combTeeth = Array.from({ length: 20 }, (_, i) => {
  const x = -42 + i * 4.4;
  return `M${x.toFixed(1)} -3V${i < 9 ? 15 : 12}`;
}).join('');

const vinylGrooves = [40, 34, 28, 22].map((r) => <circle key={r} r={r} fill="none" stroke="#3a3a3a" strokeWidth={1} />);

/** Dessins des objets, boîte -50..50. */
export const ART: Record<ObjectKey, () => JSX.Element> = {
  comb: () => (
    <g>
      <path d={combTeeth} stroke="#17181a" strokeWidth={2.8} strokeLinecap="round" />
      <rect x={-46} y={-18} width={92} height={17} rx={5} fill="url(#fiBlack)" />
      <rect x={-44} y={-16} width={88} height={4} rx={2} fill="#fff" opacity={0.22} />
      <text x={0} y={-5.5} textAnchor="middle" fontSize={8} fontWeight={700} fill="#d4a84b" letterSpacing={2}>CUTSHOP</text>
    </g>
  ),
  scissors: () => (
    <g>
      <path d="M-4 -3 L46 -14 Q50 -12 47 -9 L2 6 Z" fill="url(#fiMetal)" stroke="#59626b" strokeWidth={1} />
      <path d="M-4 3 L46 14 Q50 12 47 9 L2 -6 Z" fill="url(#fiMetal)" stroke="#59626b" strokeWidth={1} />
      <path d="M-4 -3 L-16 -10 M-4 3 L-16 10" stroke="#2a2a2a" strokeWidth={6} strokeLinecap="round" />
      <circle cx={-27} cy={-14} r={11} fill="none" stroke="url(#fiGold)" strokeWidth={6} />
      <circle cx={-27} cy={14} r={11} fill="none" stroke="url(#fiGold)" strokeWidth={6} />
      <path d="M-38 20 Q-46 24 -46 30" stroke="url(#fiGold)" strokeWidth={4} fill="none" strokeLinecap="round" />
      <circle r={4} fill="#2b2b2b" stroke="#d4a84b" strokeWidth={1.5} />
    </g>
  ),
  clipper: () => (
    <g>
      <path d="M0 44 C0 54 18 52 30 46" stroke="#1d1d1d" strokeWidth={4} fill="none" strokeLinecap="round" />
      <rect x={-17} y={-34} width={34} height={80} rx={15} fill="url(#fiBlack)" />
      <rect x={-17} y={-10} width={34} height={7} fill="url(#fiGold)" />
      <rect x={-17} y={20} width={34} height={4} fill="url(#fiGold)" opacity={0.8} />
      <rect x={-12} y={-30} width={6} height={60} rx={3} fill="#fff" opacity={0.14} />
      <rect x={-19} y={-46} width={38} height={14} rx={3} fill="url(#fiMetal)" stroke="#5b636b" strokeWidth={1} />
      <path d="M-17 -46 V-50 M-13 -46 V-50 M-9 -46 V-50 M-5 -46 V-50 M-1 -46 V-50 M3 -46 V-50 M7 -46 V-50 M11 -46 V-50 M15 -46 V-50" stroke="#8a939b" strokeWidth={2} />
      <circle cy={8} r={5} fill="#d4a84b" stroke="#6b4e15" strokeWidth={1} />
    </g>
  ),
  brush: () => (
    <g>
      <path d="M-16 4 C-34 -18 -24 -48 0 -50 C24 -48 34 -18 16 4 Z" fill="url(#fiCream)" />
      <path d="M-16 4 C-30 -10 -28 -22 -24 -30 C-14 -26 -6 -20 0 2 Z" fill="#8c7b66" opacity={0.35} />
      <path d="M-8 -44 C-2 -47 6 -47 12 -42" stroke="#fff" strokeWidth={3} fill="none" opacity={0.7} strokeLinecap="round" />
      <rect x={-18} y={0} width={36} height={8} rx={2} fill="url(#fiGold)" />
      <path d="M-15 8 L15 8 L19 42 Q0 50 -19 42 Z" fill="url(#fiWood)" />
      <path d="M-10 12 L-12 40" stroke="#fff" strokeWidth={3} opacity={0.18} strokeLinecap="round" />
    </g>
  ),
  razor: () => (
    <g>
      <path d="M-48 10 Q-14 -2 6 2 L4 11 Q-14 10 -46 18 Z" fill="url(#fiBlack)" />
      <path d="M-44 13 Q-20 6 0 6" stroke="#fff" strokeWidth={1.5} opacity={0.3} fill="none" />
      <path d="M2 0 L44 -18 Q52 -14 48 -6 L8 10 Z" fill="url(#fiMetal)" stroke="#4f575f" strokeWidth={1} />
      <path d="M8 10 L48 -6" stroke="#ffffff" strokeWidth={1.4} />
      <circle cx={4} cy={5} r={4} fill="url(#fiGold)" />
    </g>
  ),
  spray: () => (
    <g>
      <path d="M-18 -10 L18 -10 L20 44 Q20 48 16 48 L-16 48 Q-20 48 -20 44 Z" fill="#9fd3ef" opacity={0.55} stroke="#d8f0ff" strokeWidth={1.5} />
      <path d="M-18 6 L18 6 L20 44 Q20 48 16 48 L-16 48 Q-20 48 -20 44 Z" fill="#3e8fc2" opacity={0.55} />
      <rect x={-14} y={14} width={28} height={18} rx={2} fill="#0e2f23" />
      <text y={26} textAnchor="middle" fontSize={7} fontWeight={700} fill="#d4a84b">AQUA</text>
      <rect x={-8} y={-22} width={16} height={13} fill="url(#fiBlack)" />
      <path d="M-10 -22 L-10 -38 L22 -38 L26 -30 L10 -30 L10 -22 Z" fill="url(#fiBlack)" />
      <path d="M2 -30 Q0 -18 -10 -14" stroke="#222" strokeWidth={4} fill="none" strokeLinecap="round" />
      <path d="M-13 -6 L-13 40" stroke="#fff" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
    </g>
  ),
  handmirror: () => (
    <g>
      <rect x={-6} y={14} width={12} height={36} rx={5} fill="url(#fiWood)" />
      <rect x={-8} y={12} width={16} height={6} rx={2} fill="url(#fiGold)" />
      <circle cy={-14} r={30} fill="url(#fiGold)" />
      <circle cy={-14} r={24} fill="url(#fiMirror)" />
      <path d="M-16 -22 L-2 -36 M-12 -12 L6 -30" stroke="#fff" strokeWidth={3} opacity={0.6} strokeLinecap="round" />
    </g>
  ),
  pole: () => (
    <g>
      <rect x={-16} y={-50} width={32} height={10} rx={3} fill="url(#fiGold)" />
      <circle cy={-52} r={7} fill="url(#fiGold)" />
      <rect x={-12} y={-40} width={24} height={80} fill="url(#fiPoleStripes)" />
      <rect x={-12} y={-40} width={24} height={80} fill="url(#fiGlass)" />
      <rect x={-12} y={-40} width={5} height={80} fill="#fff" opacity={0.35} />
      <rect x={-16} y={40} width={32} height={10} rx={3} fill="url(#fiGold)" />
    </g>
  ),
  mustache: () => (
    <g>
      <path
        d="M0 -4 C-8 -16 -24 -16 -34 -6 C-40 0 -46 2 -50 -8 C-50 6 -38 14 -24 10 C-14 8 -6 4 0 2 C6 4 14 8 24 10 C38 14 50 6 50 -8 C46 2 40 0 34 -6 C24 -16 8 -16 0 -4 Z"
        fill="#2a170c"
        stroke="#120904"
        strokeWidth={1.5}
      />
      <path d="M-30 -8 C-22 -12 -12 -10 -6 -4 M30 -8 C22 -12 12 -10 6 -4" stroke="#7a4a2a" strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  ),
  towel: () => (
    <g>
      <rect x={-44} y={6} width={88} height={30} rx={8} fill="url(#fiCream)" stroke="#bfa985" strokeWidth={1.5} />
      <rect x={-44} y={26} width={88} height={4} fill="#1d5a43" />
      <rect x={-40} y={-24} width={80} height={30} rx={8} fill="url(#fiCream)" stroke="#bfa985" strokeWidth={1.5} />
      <rect x={-40} y={-4} width={80} height={4} fill="#1d5a43" />
      <path d="M-34 -18 H30 M-38 12 H34" stroke="#fff" strokeWidth={2} opacity={0.8} strokeLinecap="round" />
    </g>
  ),
  pomade: () => (
    <g>
      <path d="M-40 -6 L-40 26 Q0 40 40 26 L40 -6 Z" fill="url(#fiMetalV)" />
      <rect x={-40} y={2} width={80} height={16} fill="#0e2f23" />
      <text y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d4a84b" letterSpacing={1.5}>POMADE</text>
      <ellipse cy={-6} rx={40} ry={12} fill="url(#fiGold)" stroke="#8f6b22" strokeWidth={1} />
      <ellipse cy={-7} rx={28} ry={7} fill="#f4dc95" opacity={0.6} />
    </g>
  ),
  clock: () => (
    <g>
      <circle r={46} fill="url(#fiWood)" />
      <circle r={39} fill="#f8f2e6" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-1.5} y={-36} width={3} height={i % 3 === 0 ? 9 : 5} fill="#1a1a1a" transform={`rotate(${i * 30})`} />
      ))}
      <path d="M0 0 L0 -26" stroke="#111" strokeWidth={4} strokeLinecap="round" transform="rotate(-50)" />
      <path d="M0 0 L0 -32" stroke="#111" strokeWidth={2.5} strokeLinecap="round" transform="rotate(70)" />
      <path d="M0 6 L0 -34" stroke="#c4271c" strokeWidth={1.2} transform="rotate(160)" />
      <circle r={3.5} fill="#d4a84b" />
    </g>
  ),
  tulip: () => (
    <g>
      <path d="M-20 -34 C-28 -18 -26 -2 -14 8 C-8 12 -6 16 -6 22 L6 22 C6 16 8 12 14 8 C26 -2 28 -18 20 -34 Z" fill="url(#fiBeer)" />
      <path d="M-21 -36 C-25 -44 -14 -50 -4 -46 C4 -52 18 -48 21 -38 C24 -32 -24 -30 -21 -36 Z" fill="#fff8e6" />
      <path d="M-22 -46 C-30 -24 -30 -2 -14 10 C-8 14 -4 18 -4 24 L-4 38 L-18 44 L18 44 L4 38 L4 24 C4 18 8 14 14 10 C30 -2 30 -24 22 -46" fill="none" stroke="#e8f3ff" strokeWidth={2} strokeLinejoin="round" />
      <ellipse cy={44} rx={18} ry={3} fill="#e8f3ff" opacity={0.8} />
      <path d="M-16 -24 C-20 -12 -16 -2 -10 4" stroke="#fff" strokeWidth={3} opacity={0.55} fill="none" strokeLinecap="round" />
      <circle cx={6} cy={-10} r={1.5} fill="#fff" opacity={0.7} />
      <circle cx={2} cy={-2} r={1.2} fill="#fff" opacity={0.7} />
    </g>
  ),
  pint: () => (
    <g>
      <path d="M-19 -30 L19 -30 L15 46 L-15 46 Z" fill="url(#fiBeer)" />
      <path d="M-21 -36 C-22 -46 -10 -50 -2 -46 C8 -51 22 -46 21 -36 L19 -28 L-19 -28 Z" fill="#fff8e6" />
      <path d="M-21 -44 L21 -44 L16 48 L-16 48 Z" fill="url(#fiGlass)" stroke="#e8f3ff" strokeWidth={2} strokeLinejoin="round" />
      <path d="M-13 -20 L-10 40" stroke="#fff" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
      <circle cx={4} cy={10} r={1.5} fill="#fff" opacity={0.7} />
      <circle cx={8} cy={24} r={1.2} fill="#fff" opacity={0.7} />
    </g>
  ),
  bottle: () => (
    <g>
      <path d="M-6 -42 L6 -42 L6 -24 C6 -14 16 -10 16 2 L16 44 Q16 48 12 48 L-12 48 Q-16 48 -16 44 L-16 2 C-16 -10 -6 -14 -6 -24 Z" fill="url(#fiAmber)" />
      <rect x={-7} y={-50} width={14} height={9} rx={2} fill="url(#fiGold)" />
      <rect x={-16} y={8} width={32} height={26} fill="#f4ebd9" />
      <rect x={-16} y={8} width={32} height={5} fill="#0e2f23" />
      <text y={26} textAnchor="middle" fontSize={8} fontWeight={700} fill="#0e2f23">IPA</text>
      <rect x={-6} y={-32} width={12} height={8} fill="#d4a84b" />
      <path d="M-11 -2 L-11 44" stroke="#fff" strokeWidth={3} opacity={0.35} strokeLinecap="round" />
    </g>
  ),
  opener: () => (
    <g>
      <path fillRule="evenodd" d="M-46 -12 H20 C40 -12 48 -4 48 0 C48 4 40 12 20 12 H-46 Q-50 12 -50 8 V-8 Q-50 -12 -46 -12 Z M18 -6 C30 -6 36 -2 36 0 C36 2 30 6 18 6 C14 6 12 2 12 0 C12 -2 14 -6 18 -6 Z" fill="url(#fiMetal)" stroke="#4f575f" strokeWidth={1} />
      <rect x={-46} y={-9} width={46} height={18} rx={4} fill="url(#fiWoodH)" />
      <text x={-23} y={4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#f4dc95" letterSpacing={1}>CUT</text>
    </g>
  ),
  coaster: () => (
    <g>
      <circle r={46} fill="#f4ebd9" stroke="#c9b48c" strokeWidth={2} />
      <circle r={38} fill="none" stroke="#1d5a43" strokeWidth={5} />
      <circle r={28} fill="#164734" />
      <text y={5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#d4a84b">CUT</text>
      <path d="M-14 -14 L-6 -18 M6 -18 L14 -14" stroke="#d4a84b" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  hops: () => (
    <g>
      <path d="M0 -50 Q4 -40 0 -32" stroke="#3a5a2a" strokeWidth={3} fill="none" />
      <path d="M2 -40 C20 -54 40 -40 34 -26 C24 -30 12 -32 2 -40 Z" fill="url(#fiLeaf)" />
      {[
        [0, -24, 14],
        [-10, -10, 13],
        [10, -10, 13],
        [0, 2, 14],
        [-11, 14, 12],
        [11, 14, 12],
        [0, 26, 12],
        [0, 38, 9],
      ].map(([x, y, r], i) => (
        <path key={i} d={`M${x - r} ${y} Q${x} ${y - r * 1.4} ${x + r} ${y} Q${x} ${y + r * 0.9} ${x - r} ${y} Z`} fill="url(#fiLeaf)" stroke="#1d5a35" strokeWidth={1} />
      ))}
    </g>
  ),
  keg: () => (
    <g>
      <rect x={-34} y={-40} width={68} height={86} rx={10} fill="url(#fiMetalV)" stroke="#59626b" strokeWidth={1.5} />
      <rect x={-36} y={-30} width={72} height={6} rx={3} fill="#8a939b" />
      <rect x={-36} y={26} width={72} height={6} rx={3} fill="#8a939b" />
      <rect x={-20} y={-50} width={40} height={12} rx={4} fill="url(#fiMetalV)" stroke="#59626b" strokeWidth={1} />
      <rect x={-6} y={-54} width={12} height={8} rx={2} fill="#1d5a43" />
      <rect x={-22} y={-8} width={44} height={20} rx={3} fill="#0e2f23" />
      <text y={6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#d4a84b">CUT</text>
    </g>
  ),
  pretzel: () => (
    <g>
      <path
        d="M-30 22 C-50 8 -44 -30 -18 -28 C2 -26 6 -4 0 8 C-6 -4 -2 -26 18 -28 C44 -30 50 8 30 22 M-30 22 C-16 30 -6 18 0 8 C6 18 16 30 30 22"
        fill="none"
        stroke="#7a3e12"
        strokeWidth={15}
        strokeLinecap="round"
      />
      <path
        d="M-30 22 C-50 8 -44 -30 -18 -28 C2 -26 6 -4 0 8 C-6 -4 -2 -26 18 -28 C44 -30 50 8 30 22 M-30 22 C-16 30 -6 18 0 8 C6 18 16 30 30 22"
        fill="none"
        stroke="#b8642a"
        strokeWidth={9}
        strokeLinecap="round"
      />
      {[[-32, -12], [-20, -22], [24, -20], [34, -4], [-6, 14], [10, 20], [-38, 6], [20, 4]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width={3} height={3} fill="#fffaf0" transform={`rotate(30 ${x} ${y})`} />
      ))}
    </g>
  ),
  lemon: () => (
    <g>
      <circle r={42} fill="#f5d33a" stroke="#d9a90f" strokeWidth={3} />
      <circle r={35} fill="#fff4b0" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d="M0 -4 L-9 -31 Q0 -35 9 -31 Z" fill="#f8de55" transform={`rotate(${i * 45})`} />
      ))}
      <circle r={4} fill="#fff8d2" />
    </g>
  ),
  shaker: () => (
    <g>
      <path d="M-18 -10 L18 -10 L22 46 L-22 46 Z" fill="url(#fiMetalV)" stroke="#59626b" strokeWidth={1} />
      <path d="M-14 -30 L14 -30 L18 -10 L-18 -10 Z" fill="url(#fiMetalV)" stroke="#59626b" strokeWidth={1} />
      <rect x={-7} y={-46} width={14} height={16} rx={4} fill="url(#fiMetalV)" stroke="#59626b" strokeWidth={1} />
      <rect x={-20} y={10} width={40} height={4} fill="#d4a84b" />
      <path d="M-12 -4 L-15 40" stroke="#fff" strokeWidth={3} opacity={0.6} strokeLinecap="round" />
    </g>
  ),
  candle: () => (
    <g>
      <ellipse cy={-40} rx={18} ry={22} fill="url(#fiWarm)" />
      <path d="M0 -50 C8 -40 8 -30 0 -26 C-8 -30 -8 -40 0 -50 Z" fill="url(#fiFlame)" />
      <path d="M0 -26 V-18" stroke="#222" strokeWidth={2} />
      <path d="M-18 -18 L18 -18 L18 40 Q0 48 -18 40 Z" fill="url(#fiCream)" />
      <path d="M-18 -18 C-14 -10 -10 -12 -8 -4 C-6 -10 -2 -14 2 -18" fill="#fffaf0" />
      <ellipse cy={-18} rx={18} ry={5} fill="#fff6e2" />
      <rect x={-22} y={34} width={44} height={10} rx={4} fill="url(#fiGold)" />
    </g>
  ),
  beardoil: () => (
    <g>
      <rect x={-18} y={-10} width={36} height={56} rx={7} fill="url(#fiAmber)" />
      <rect x={-18} y={4} width={36} height={28} fill="#f4ebd9" />
      <rect x={-18} y={4} width={36} height={6} fill="#164734" />
      <text y={25} textAnchor="middle" fontSize={7} fontWeight={700} fill="#164734">BEARD</text>
      <rect x={-10} y={-22} width={20} height={14} rx={2} fill="url(#fiBlack)" />
      <path d="M-8 -22 C-8 -46 8 -46 8 -22 Z" fill="url(#fiBlack)" />
      <path d="M-12 -4 V40" stroke="#fff" strokeWidth={2.5} opacity={0.3} strokeLinecap="round" />
    </g>
  ),
  perfume: () => (
    <g>
      <rect x={-28} y={-14} width={56} height={60} rx={6} fill="#c8e6f2" opacity={0.55} stroke="#eaf7ff" strokeWidth={2} />
      <rect x={-22} y={-2} width={44} height={42} rx={4} fill="#d9b56a" opacity={0.75} />
      <rect x={-14} y={8} width={28} height={18} fill="#0e2f23" />
      <text y={20} textAnchor="middle" fontSize={7} fontWeight={700} fill="#d4a84b">N°7</text>
      <rect x={-8} y={-24} width={16} height={10} fill="url(#fiGold)" />
      <rect x={-14} y={-46} width={28} height={22} rx={3} fill="url(#fiBlack)" />
      <path d="M-22 -8 V40" stroke="#fff" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
    </g>
  ),
  plant: () => (
    <g>
      <path d="M0 10 C-4 -10 -30 -30 -42 -20 C-40 -4 -20 6 0 10 Z" fill="url(#fiLeaf)" />
      <path d="M0 10 C6 -16 34 -34 44 -22 C40 -6 20 6 0 10 Z" fill="url(#fiLeaf)" />
      <path d="M0 10 C-8 -20 -6 -44 4 -50 C16 -40 12 -14 0 10 Z" fill="url(#fiLeaf)" />
      <path d="M0 10 C-14 -4 -40 0 -44 10 C-30 18 -14 16 0 10 Z" fill="#2f8a57" />
      <path d="M0 10 C12 -2 38 0 44 8 C30 18 14 16 0 10 Z" fill="#2f8a57" />
      <path d="M0 10 L-30 -20 M0 10 L34 -22 M0 10 L4 -44" stroke="#174a2f" strokeWidth={1.4} opacity={0.6} />
      <path d="M-24 10 L24 10 L18 48 L-18 48 Z" fill="url(#fiTerra)" />
      <rect x={-27} y={6} width={54} height={8} rx={2} fill="#b45a2e" />
    </g>
  ),
  cactus: () => (
    <g>
      <path d="M-10 18 V-30 C-10 -46 10 -46 10 -30 V18 Z" fill="url(#fiLeaf)" stroke="#1d5a35" strokeWidth={1.2} />
      <path d="M-10 0 H-20 C-30 0 -30 -8 -30 -14 V-24 C-30 -32 -22 -32 -22 -24 V-10 H-10" fill="url(#fiLeaf)" stroke="#1d5a35" strokeWidth={1.2} />
      <path d="M10 -6 H20 C28 -6 28 -14 28 -18 V-28 C28 -36 20 -36 20 -28 V-16 H10" fill="url(#fiLeaf)" stroke="#1d5a35" strokeWidth={1.2} />
      <path d="M0 -38 V14" stroke="#1d5a35" strokeWidth={1.2} opacity={0.6} />
      <circle cy={-42} r={5} fill="#ff6fa1" />
      <path d="M-22 16 L22 16 L17 48 L-17 48 Z" fill="url(#fiCream)" stroke="#bfa985" strokeWidth={1} />
      <rect x={-22} y={24} width={44} height={4} fill="#164734" />
    </g>
  ),
  book: () => (
    <g>
      <rect x={-44} y={18} width={88} height={18} rx={2} fill="#1d5a43" />
      <rect x={-40} y={20} width={4} height={14} fill="#d4a84b" />
      <rect x={-38} y={-2} width={80} height={18} rx={2} fill="#8f2d22" />
      <rect x={-36} y={2} width={76} height={2} fill="#d4a84b" />
      <rect x={-36} y={10} width={76} height={2} fill="#d4a84b" />
      <rect x={-34} y={-22} width={70} height={18} rx={2} fill="#26313f" />
      <text x={2} y={-9} textAnchor="middle" fontSize={8} fontWeight={700} fill="#f4dc95" letterSpacing={1}>BARBER</text>
      <rect x={-44} y={34} width={88} height={4} fill="#f4ebd9" />
    </g>
  ),
  hat: () => (
    <g>
      <ellipse cy={18} rx={48} ry={14} fill="#2b2622" />
      <path d="M-28 16 C-30 -10 -24 -32 -10 -32 C-4 -26 4 -26 10 -32 C24 -32 30 -10 28 16 Z" fill="#3b342e" />
      <path d="M-28 6 C-10 12 10 12 28 6 L28 16 C10 22 -10 22 -28 16 Z" fill="#8f2d22" />
      <path d="M-20 -14 C-18 -24 -12 -28 -6 -26" stroke="#fff" strokeWidth={2} opacity={0.2} fill="none" />
      <ellipse cy={18} rx={48} ry={14} fill="none" stroke="#000" strokeWidth={1} opacity={0.5} />
    </g>
  ),
  sunglasses: () => (
    <g>
      <path d="M-48 -8 L-44 -14 M48 -8 L44 -14" stroke="#111" strokeWidth={4} strokeLinecap="round" />
      <path d="M-44 -12 H-6 C-6 6 -12 18 -26 18 C-40 18 -46 6 -44 -12 Z" fill="#141414" stroke="#d4a84b" strokeWidth={2.5} />
      <path d="M44 -12 H6 C6 6 12 18 26 18 C40 18 46 6 44 -12 Z" fill="#141414" stroke="#d4a84b" strokeWidth={2.5} />
      <path d="M-6 -8 Q0 -14 6 -8" stroke="#d4a84b" strokeWidth={3} fill="none" />
      <path d="M-36 -6 L-24 -6 M30 -6 L38 -6" stroke="#6fc3df" strokeWidth={3} opacity={0.7} strokeLinecap="round" />
    </g>
  ),
  frame: () => (
    <g>
      <rect x={-38} y={-46} width={76} height={92} rx={3} fill="url(#fiGold)" stroke="#6b4e15" strokeWidth={1.5} />
      <rect x={-29} y={-37} width={58} height={74} fill="#e8d9bc" />
      <circle cy={-10} r={13} fill="#3b2a1e" />
      <path d="M-22 30 C-20 8 20 8 22 30 Z" fill="#3b2a1e" />
      <path d="M-8 -4 C-4 -7 4 -7 8 -4" stroke="#e8d9bc" strokeWidth={2.5} strokeLinecap="round" fill="none" />
    </g>
  ),
  bowtie: () => (
    <g>
      <path d="M-6 -6 L-44 -24 Q-50 0 -44 24 L-6 6 Z" fill="url(#fiRed)" />
      <path d="M6 -6 L44 -24 Q50 0 44 24 L6 6 Z" fill="url(#fiRed)" />
      <path d="M-40 -12 L-12 -2 M40 -12 L12 -2" stroke="#fff" strokeWidth={2} opacity={0.3} />
      {[[-30, 8], [-22, -8], [28, 6], [20, -8], [-36, -2], [36, -2]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill="#fff" opacity={0.7} />
      ))}
      <rect x={-8} y={-10} width={16} height={20} rx={4} fill="#8a1810" />
    </g>
  ),
  camera: () => (
    <g>
      <rect x={-46} y={-22} width={92} height={56} rx={6} fill="url(#fiBlack)" />
      <rect x={-46} y={-14} width={92} height={10} fill="#8b6a46" />
      <rect x={-46} y={14} width={92} height={10} fill="#8b6a46" />
      <path d="M-20 -22 L-14 -34 L14 -34 L20 -22 Z" fill="url(#fiMetalV)" />
      <rect x={24} y={-30} width={14} height={8} rx={2} fill="url(#fiMetalV)" />
      <circle cy={6} r={22} fill="url(#fiMetalV)" />
      <circle cy={6} r={16} fill="#111" />
      <circle cy={6} r={10} fill="#22313f" />
      <circle cx={-4} cy={2} r={4} fill="#9fd3ef" opacity={0.7} />
    </g>
  ),
  watch: () => (
    <g>
      <rect x={-12} y={-50} width={24} height={100} rx={6} fill="#6b3d1f" />
      <path d="M-12 -40 H12 M-12 -32 H12 M-12 32 H12 M-12 40 H12" stroke="#4a2810" strokeWidth={1.5} />
      <circle r={24} fill="url(#fiGold)" />
      <circle r={19} fill="#0e2f23" />
      <path d="M0 0 V-13 M0 0 L9 5" stroke="#f4ebd9" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={22} y={-4} width={6} height={8} rx={1} fill="url(#fiGold)" />
      <circle r={2} fill="#d4a84b" />
    </g>
  ),
  vinyl: () => (
    <g>
      <circle r={48} fill="#111" />
      {vinylGrooves}
      <path d="M-30 -30 A42 42 0 0 1 10 -42" stroke="#fff" strokeWidth={3} opacity={0.25} fill="none" strokeLinecap="round" />
      <circle r={15} fill="#c4271c" />
      <circle r={15} fill="none" stroke="#d4a84b" strokeWidth={1.5} />
      <circle r={2.5} fill="#000" />
    </g>
  ),
  headphones: () => (
    <g>
      <path d="M-36 8 C-40 -40 40 -40 36 8" stroke="url(#fiBlack)" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M-36 8 C-40 -40 40 -40 36 8" stroke="#666" strokeWidth={2} fill="none" opacity={0.5} />
      <rect x={-48} y={0} width={22} height={36} rx={9} fill="url(#fiBlack)" />
      <rect x={26} y={0} width={22} height={36} rx={9} fill="url(#fiBlack)" />
      <rect x={-30} y={4} width={6} height={28} rx={3} fill="#d4a84b" />
      <rect x={24} y={4} width={6} height={28} rx={3} fill="#d4a84b" />
    </g>
  ),
  mic: () => (
    <g>
      <rect x={-8} y={4} width={16} height={46} rx={5} fill="url(#fiBlack)" />
      <rect x={-10} y={2} width={20} height={6} rx={2} fill="url(#fiGold)" />
      <circle cy={-22} r={24} fill="url(#fiMetal)" stroke="#59626b" strokeWidth={1.5} />
      <path d="M-20 -30 H20 M-23 -22 H23 M-20 -14 H20 M-14 -40 V-4 M-6 -45 V2 M2 -45 V2 M10 -42 V-2 M18 -36 V-8" stroke="#59626b" strokeWidth={1.2} />
      <rect x={-24} y={-24} width={48} height={5} fill="#c4271c" />
    </g>
  ),
  speaker: () => (
    <g>
      <rect x={-34} y={-48} width={68} height={96} rx={6} fill="url(#fiBlack)" stroke="#000" strokeWidth={1} />
      <circle cy={14} r={24} fill="#1c1c1c" stroke="#555" strokeWidth={3} />
      <circle cy={14} r={11} fill="#333" />
      <circle cy={14} r={4} fill="#555" />
      <circle cy={-26} r={10} fill="#1c1c1c" stroke="#555" strokeWidth={2} />
      <circle cy={-26} r={4} fill="#d4a84b" />
      <circle cx={22} cy={-40} r={2.5} fill="#5bff9a" />
    </g>
  ),
  cassette: () => (
    <g>
      <rect x={-48} y={-30} width={96} height={60} rx={5} fill="#2d2d33" />
      <rect x={-40} y={-24} width={80} height={32} rx={3} fill="#f4ebd9" />
      <rect x={-40} y={-24} width={80} height={8} fill="#c4271c" />
      <rect x={-24} y={-8} width={48} height={14} rx={7} fill="#1a1a1a" />
      <circle cx={-14} cy={-1} r={5} fill="#fff" stroke="#999" strokeWidth={1.5} />
      <circle cx={14} cy={-1} r={5} fill="#fff" stroke="#999" strokeWidth={1.5} />
      <path d="M-26 30 L-20 16 L20 16 L26 30 Z" fill="#45454d" />
    </g>
  ),
  discoball: () => (
    <g>
      <path d="M0 -50 V-38" stroke="#bbb" strokeWidth={2} />
      <circle cy={4} r={42} fill="url(#fiDisco)" />
      {[-28, -14, 0, 14, 28].map((y) => (
        <path key={`h${y}`} d={`M${-Math.sqrt(42 * 42 - y * y)} ${4 + y} H${Math.sqrt(42 * 42 - y * y)}`} stroke="#4a5560" strokeWidth={1} opacity={0.6} />
      ))}
      {[-30, -15, 0, 15, 30].map((x) => (
        <ellipse key={`v${x}`} cx={0} cy={4} rx={Math.abs(x) + 0.5} ry={42} fill="none" stroke="#4a5560" strokeWidth={1} opacity={0.5} />
      ))}
      <path d="M-18 -18 L-12 -18 L-12 -12 L-18 -12 Z M-4 -26 L2 -26 L2 -20 L-4 -20 Z" fill="#fff" />
      <path d="M22 26 L28 26 L28 32 L22 32 Z" fill="#9fd3ef" opacity={0.8} />
    </g>
  ),
  sneaker: () => (
    <g>
      <path d="M-44 20 L-42 -20 C-40 -30 -26 -32 -22 -24 L-14 -6 C-2 -2 20 2 34 8 C46 12 48 20 46 24 L-44 24 Z" fill="url(#fiRed)" stroke="#6e0f09" strokeWidth={1.2} />
      <path d="M-44 20 H46 V28 Q46 32 42 32 H-42 Q-46 32 -46 28 Z" fill="#f8f2e6" stroke="#bfa985" strokeWidth={1} />
      <path d="M-46 24 H46" stroke="#c4271c" strokeWidth={1.5} />
      <path d="M-30 -18 L-14 -12 M-28 -10 L-10 -6 M-24 -2 L-4 0" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={-34} cy={4} r={6} fill="#f8f2e6" />
      <path d="M10 10 C20 12 30 14 40 18" stroke="#f8f2e6" strokeWidth={2} fill="none" opacity={0.7} />
    </g>
  ),
  lamp: () => (
    <g>
      <path d="M22 -20 L48 30 L-4 30 Z" fill="#ffd98a" opacity={0.25} />
      <ellipse cx={-24} cy={44} rx={20} ry={6} fill="url(#fiBlack)" />
      <path d="M-24 42 L-10 0 L18 -24" stroke="#1d5a43" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={-10} cy={0} r={4} fill="url(#fiGold)" />
      <path d="M10 -40 L40 -18 L24 -2 Z" fill="#1d5a43" stroke="#0e2f23" strokeWidth={1} />
      <path d="M24 -2 L40 -18" stroke="#ffe7a8" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  cap: () => (
    <g>
      <path d="M-34 10 C-36 -26 30 -30 32 8 Z" fill="#164734" stroke="#0a2219" strokeWidth={1.2} />
      <path d="M-2 -24 C-2 -10 -2 0 -2 8" stroke="#0a2219" strokeWidth={1.2} opacity={0.6} />
      <circle cx={-2} cy={-24} r={3.5} fill="#0a2219" />
      <path d="M-34 8 C-10 14 20 14 32 8 C44 10 52 16 48 22 C30 22 -10 20 -34 14 Z" fill="#0e2f23" />
      <text x={-4} y={-2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#d4a84b">C</text>
    </g>
  ),
  skate: () => (
    <g>
      <rect x={-48} y={-14} width={96} height={28} rx={14} fill="url(#fiWoodH)" stroke="#3a2210" strokeWidth={1} />
      <rect x={-34} y={-10} width={68} height={20} rx={4} fill="#c4271c" opacity={0.9} />
      <text y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f4ebd9" letterSpacing={2}>MONS</text>
      <circle cx={-30} cy={-17} r={5} fill="#f4dc95" />
      <circle cx={30} cy={-17} r={5} fill="#f4dc95" />
      <circle cx={-30} cy={17} r={5} fill="#f4dc95" />
      <circle cx={30} cy={17} r={5} fill="#f4dc95" />
    </g>
  ),
  guitar: () => (
    <g>
      <rect x={-4} y={-50} width={8} height={50} fill="#4a2810" />
      <rect x={-6} y={-54} width={12} height={10} rx={2} fill="#2a170c" />
      <path d="M-2 -46 V20 M2 -46 V20" stroke="#ddd" strokeWidth={0.8} />
      <path d="M0 -4 C-18 -6 -22 8 -14 16 C-28 22 -26 46 0 46 C26 46 28 22 14 16 C22 8 18 -6 0 -4 Z" fill="url(#fiWood)" stroke="#3a2210" strokeWidth={1.2} />
      <circle cy={16} r={7} fill="#1a0e06" />
      <rect x={-10} y={32} width={20} height={4} rx={1} fill="#1a0e06" />
      <path d="M-2 -4 V34 M2 -4 V34" stroke="#eee" strokeWidth={0.8} />
    </g>
  ),
};

/** Objet placé dans la scène. */
export function Placed({ x, y, s, r = 0, k }: { x: number; y: number; s: number; r?: number; k: ObjectKey }) {
  const Art = ART[k];
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <Art />
    </g>
  );
}

/** Icône de la liste (même dessin que dans la scène). */
export function ObjectIcon({ k, size = 52 }: { k: ObjectKey; size?: number }) {
  const Art = ART[k];
  return (
    <svg width={size} height={size} viewBox="-54 -54 108 108" aria-hidden>
      <Art />
    </svg>
  );
}
