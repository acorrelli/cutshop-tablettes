// Décors des 4 scènes de Find It Cutshop (repère 1000 x 700). Les objets à trouver sont posés par-dessus
// depuis sceneData.ts ; les décors n'utilisent jamais un objet trouvable de la même scène (pas de faux doublon).
import { memo, type JSX } from 'react';

type Lang = 'fr' | 'en';
const DECOR_TXT = {
  fr: { tap: 'À LA PRESSION', labels: ['BARBE', 'CHEVEUX', 'DÉCO', 'CADEAUX'], friday: 'VENDREDI' },
  en: { tap: 'ON TAP', labels: ['BEARD', 'HAIR', 'DECOR', 'GIFTS'], friday: 'FRIDAY' },
};
import { Placed } from './art';
import { SCENE_H, SCENE_W, SCENES } from './sceneData';

function SceneDefs() {
  return (
    <defs>
      <linearGradient id="fiWallGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0f3226" />
        <stop offset="1" stopColor="#0a2219" />
      </linearGradient>
      <linearGradient id="fiWallWood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a1a10" />
        <stop offset="1" stopColor="#1a0f08" />
      </linearGradient>
      <linearGradient id="fiCounter" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b07a45" />
        <stop offset="0.25" stopColor="#7d4f27" />
        <stop offset="1" stopColor="#4b2c13" />
      </linearGradient>
      <linearGradient id="fiPanel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b2413" />
        <stop offset="1" stopColor="#1f120a" />
      </linearGradient>
      <linearGradient id="fiLeather" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7a2a22" />
        <stop offset="1" stopColor="#3f120d" />
      </linearGradient>
      <linearGradient id="fiMirrorGlass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3d5a66" />
        <stop offset="0.5" stopColor="#1d3540" />
        <stop offset="1" stopColor="#0f1f27" />
      </linearGradient>
      <linearGradient id="fiChalk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#25302b" />
        <stop offset="1" stopColor="#141b18" />
      </linearGradient>
      <linearGradient id="fiFloorFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.55" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="fiVignette" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>
      <radialGradient id="fiNeonPink" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff4fa3" stopOpacity="0.45" />
        <stop offset="1" stopColor="#ff4fa3" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="fiNeonGreen" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#3dffa0" stopOpacity="0.4" />
        <stop offset="1" stopColor="#3dffa0" stopOpacity="0" />
      </radialGradient>
      <pattern id="fiChecker" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="60" height="60" fill="#1a1a1a" />
        <rect width="30" height="30" fill="#c9bea8" />
        <rect x="30" y="30" width="30" height="30" fill="#c9bea8" />
      </pattern>
      <pattern id="fiStripes" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="#123d2d" />
        <rect width="20" height="40" fill="#10372a" />
      </pattern>
      <pattern id="fiPlanks" width="48" height="300" patternUnits="userSpaceOnUse">
        <rect width="48" height="300" fill="#2f1c0f" />
        <rect width="2" height="300" fill="#140b05" />
        <rect x="18" y="80" width="1.5" height="60" fill="#4a2e18" opacity="0.6" />
      </pattern>
      <pattern id="fiBrick" width="80" height="40" patternUnits="userSpaceOnUse">
        <rect width="80" height="40" fill="#2a120e" />
        <rect x="2" y="2" width="76" height="16" rx="2" fill="#5a2a1e" />
        <rect x="-38" y="22" width="76" height="16" rx="2" fill="#4e241a" />
        <rect x="42" y="22" width="76" height="16" rx="2" fill="#552719" />
      </pattern>
      <pattern id="fiDamask" width="56" height="56" patternUnits="userSpaceOnUse">
        <rect width="56" height="56" fill="#0f3226" />
        <path d="M28 6 L40 28 L28 50 L16 28 Z" fill="none" stroke="#d4a84b" strokeOpacity="0.16" strokeWidth="1.5" />
        <circle cx="28" cy="28" r="3" fill="#d4a84b" fillOpacity="0.18" />
        <circle cx="0" cy="0" r="2" fill="#d4a84b" fillOpacity="0.15" />
        <circle cx="56" cy="56" r="2" fill="#d4a84b" fillOpacity="0.15" />
      </pattern>
    </defs>
  );
}

function Glow({ x, y, r, o = 1 }: { x: number; y: number; r: number; o?: number }) {
  return <ellipse cx={x} cy={y} rx={r} ry={r * 0.8} fill="url(#fiWarm)" opacity={o} />;
}

function Pendant({ x, len = 60 }: { x: number; len?: number }) {
  return (
    <g>
      <path d={`M${x} 0 V${len}`} stroke="#111" strokeWidth={2} />
      <Glow x={x} y={len + 40} r={110} o={0.55} />
      <path d={`M${x - 26} ${len + 26} Q${x} ${len - 6} ${x + 26} ${len + 26} Z`} fill="url(#fiGold)" />
      <ellipse cx={x} cy={len + 28} rx={12} ry={5} fill="#fff4cf" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scène 0 : le salon de barbier

function BarberChair({ x }: { x: number }) {
  return (
    <g>
      <ellipse cx={x} cy={668} rx={70} ry={12} fill="#000" opacity={0.45} />
      <ellipse cx={x} cy={660} rx={56} ry={12} fill="url(#fiMetalV)" />
      <rect x={x - 9} y={575} width={18} height={85} fill="url(#fiMetalV)" />
      <path d={`M${x - 40} 600 H${x + 40} L${x + 30} 585 H${x - 30} Z`} fill="url(#fiMetalV)" />
      <rect x={x - 62} y={425} width={124} height={100} rx={22} fill="url(#fiLeather)" />
      <path d={`M${x - 40} 435 V515 M${x} 435 V515 M${x + 40} 435 V515`} stroke="#2a0b08" strokeWidth={2} opacity={0.6} />
      {[440, 470, 500].map((y) => [x - 20, x + 20].map((cx) => <circle key={`${cx}${y}`} cx={cx} cy={y} r={2.5} fill="#2a0b08" />))}
      <rect x={x - 76} y={515} width={152} height={44} rx={16} fill="url(#fiLeather)" />
      <rect x={x - 70} y={518} width={140} height={6} rx={3} fill="#fff" opacity={0.1} />
      <rect x={x - 92} y={500} width={30} height={12} rx={6} fill="url(#fiMetalV)" />
      <rect x={x + 62} y={500} width={30} height={12} rx={6} fill="url(#fiMetalV)" />
      <rect x={x - 86} y={510} width={8} height={40} fill="url(#fiMetalV)" />
      <rect x={x + 78} y={510} width={8} height={40} fill="url(#fiMetalV)" />
      <rect x={x - 50} y={556} width={100} height={10} rx={4} fill="#2a0b08" />
      <rect x={x - 40} y={610} width={80} height={8} rx={3} fill="url(#fiMetalV)" />
    </g>
  );
}

function ArchMirror({ x, w }: { x: number; w: number }) {
  const r = w / 2;
  const d = (pad: number) =>
    `M${x + pad} 330 V${70 + r} A${r - pad} ${r - pad} 0 0 1 ${x + w - pad} ${70 + r} V330 Z`;
  return (
    <g>
      <path d={d(-10)} fill="url(#fiGold)" />
      <path d={d(-4)} fill="#5c4415" />
      <path d={d(4)} fill="url(#fiMirrorGlass)" />
      <path d={`M${x + 30} 300 L${x + w - 60} 110`} stroke="#fff" strokeWidth={10} opacity={0.07} />
      <path d={`M${x + 70} 320 L${x + w - 20} 170`} stroke="#fff" strokeWidth={4} opacity={0.08} />
      <Glow x={x + w / 2} y={140} r={60} o={0.25} />
    </g>
  );
}

function SalonScene(_: { lang: Lang }) {
  return (
    <g>
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiStripes)" />
      <rect y={400} width={SCENE_W} height={170} fill="url(#fiPanel)" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={20 + i * 140} y={418} width={120} height={130} rx={4} fill="none" stroke="#5a3a20" strokeWidth={3} />
      ))}
      <rect y={560} width={SCENE_W} height={140} fill="url(#fiChecker)" opacity={0.85} />
      <rect y={560} width={SCENE_W} height={140} fill="url(#fiFloorFade)" />
      <rect y={392} width={SCENE_W} height={10} fill="#d4a84b" opacity={0.5} />
      <Pendant x={260} len={18} />
      <Pendant x={710} len={18} />
      <ArchMirror x={140} w={240} />
      <ArchMirror x={590} w={240} />
      {/* Applique et lettrage */}
      <text x={486} y={300} textAnchor="middle" fontSize={15} fontWeight={700} fill="#d4a84b" letterSpacing={6} opacity={0.85}>EST. MONS</text>
      {/* Console sous les miroirs */}
      <rect x={60} y={376} width={850} height={16} rx={3} fill="url(#fiCounter)" />
      <rect x={70} y={392} width={830} height={60} fill="#2c1a0e" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={80 + i * 166} y={400} width={150} height={44} rx={3} fill="#3d2414" stroke="#5a3a20" />
          <rect x={140 + i * 166} y={418} width={30} height={6} rx={3} fill="url(#fiGold)" />
        </g>
      ))}
      {/* Étagère murale de droite */}
      <rect x={872} y={268} width={128} height={10} rx={2} fill="url(#fiCounter)" />
      <rect x={958} y={206} width={30} height={62} rx={3} fill="#f4ebd9" />
      <rect x={958} y={220} width={30} height={10} fill="#164734" />
      <text x={973} y={250} textAnchor="middle" fontSize={6} fontWeight={700} fill="#164734">NISH</text>
      <rect x={880} y={232} width={18} height={36} rx={3} fill="#d4a84b" opacity={0.85} />
      {/* Plante suspendue */}
      <path d="M960 0 V40" stroke="#222" strokeWidth={2} />
      <path d="M940 40 H980 L974 70 H946 Z" fill="url(#fiTerra)" />
      <path d="M948 60 C930 90 936 120 926 150 M960 64 C962 100 950 130 956 170 M972 60 C990 90 984 110 992 140" stroke="#2f8a57" strokeWidth={4} fill="none" />
      {[[930, 100], [944, 130], [956, 110], [962, 150], [984, 100], [988, 128], [926, 140]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx={9} ry={5} fill="url(#fiLeaf)" transform={`rotate(${i * 40} ${x} ${y})`} />
      ))}
      {/* Plateau à roulettes */}
      <rect x={892} y={490} width={100} height={10} rx={3} fill="url(#fiMetalV)" />
      <rect x={898} y={500} width={6} height={140} fill="url(#fiMetalV)" />
      <rect x={980} y={500} width={6} height={140} fill="url(#fiMetalV)" />
      <rect x={892} y={570} width={100} height={8} rx={3} fill="url(#fiMetalV)" />
      <rect x={910} y={540} width={60} height={30} rx={4} fill="#f4ebd9" opacity={0.9} />
      <circle cx={901} cy={648} r={8} fill="#111" />
      <circle cx={983} cy={648} r={8} fill="#111" />
      {/* Tabouret de gauche */}
      <rect x={22} y={636} width={90} height={14} rx={5} fill="url(#fiCounter)" />
      <rect x={34} y={650} width={8} height={50} fill="#2c1a0e" />
      <rect x={92} y={650} width={8} height={50} fill="#2c1a0e" />
      <BarberChair x={260} />
      <BarberChair x={710} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scène 1 : le bar

function Can({ x, y, c, h = 40 }: { x: number; y: number; c: string; h?: number }) {
  return (
    <g>
      <rect x={x - 11} y={y - h} width={22} height={h} rx={3} fill={c} />
      <rect x={x - 11} y={y - h} width={22} height={4} rx={2} fill="url(#fiMetalV)" />
      <rect x={x - 11} y={y - h * 0.62} width={22} height={h * 0.3} fill="#f4ebd9" opacity={0.85} />
      <rect x={x - 8} y={y - h + 6} width={3} height={h - 10} fill="#fff" opacity={0.2} />
    </g>
  );
}

function Growler({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x - 8} ${y - 62} H${x + 8} V${y - 50} C${x + 22} ${y - 44} ${x + 24} ${y - 34} ${x + 24} ${y - 26} V${y - 4} Q${x + 24} ${y} ${x + 20} ${y} H${x - 20} Q${x - 24} ${y} ${x - 24} ${y - 4} V${y - 26} C${x - 24} ${y - 34} ${x - 22} ${y - 44} ${x - 8} ${y - 50} Z`} fill="#2a4a1e" opacity={0.95} />
      <path d={`M${x + 10} ${y - 48} C${x + 34} ${y - 50} ${x + 34} ${y - 28} ${x + 22} ${y - 26}`} stroke="#2a4a1e" strokeWidth={4} fill="none" />
      <rect x={x - 9} y={y - 68} width={18} height={7} rx={2} fill="#111" />
      <rect x={x - 18} y={y - 30} width={36} height={18} fill="#f4ebd9" opacity={0.85} />
      <path d={`M${x - 16} ${y - 40} V${y - 6}`} stroke="#fff" strokeWidth={3} opacity={0.25} />
    </g>
  );
}

function TapTower() {
  const handles = ['#c4271c', '#d4a84b', '#1d5a43', '#f4ebd9', '#26313f'];
  return (
    <g>
      <rect x={380} y={300} width={240} height={22} rx={8} fill="url(#fiMetalV)" />
      <rect x={490} y={322} width={20} height={74} fill="url(#fiMetalV)" />
      <ellipse cx={500} cy={396} rx={40} ry={6} fill="url(#fiMetalV)" />
      {handles.map((c, i) => {
        const x = 404 + i * 48;
        return (
          <g key={i}>
            <rect x={x - 7} y={236} width={14} height={64} rx={6} fill={c} stroke="#000" strokeOpacity={0.3} />
            <rect x={x - 4} y={244} width={3} height={44} fill="#fff" opacity={0.25} />
            <rect x={x - 4} y={322} width={8} height={20} rx={2} fill="url(#fiMetalV)" />
          </g>
        );
      })}
      <rect x={430} y={384} width={140} height={10} rx={2} fill="#222" />
    </g>
  );
}

function BarScene({ lang }: { lang: Lang }) {
  return (
    <g>
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiPlanks)" />
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiWallWood)" opacity={0.45} />
      {/* Guirlande de houblon décorative (feuilles seulement) */}
      <path d="M0 30 Q250 70 500 26 T1000 34" stroke="#2f5a2a" strokeWidth={3} fill="none" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 160 + i * 54;
        const y = 44 + Math.sin(i * 1.3) * 12;
        return <ellipse key={i} cx={x} cy={y} rx={12} ry={6} fill="url(#fiLeaf)" transform={`rotate(${(i % 2 ? 30 : -30)} ${x} ${y})`} />;
      })}
      <Pendant x={300} len={70} />
      <Pendant x={700} len={70} />
      {/* Ardoise */}
      <rect x={376} y={62} width={248} height={150} rx={6} fill="url(#fiCounter)" />
      <rect x={386} y={72} width={228} height={130} rx={3} fill="url(#fiChalk)" />
      <text x={500} y={98} textAnchor="middle" fontSize={16} fontWeight={700} fill="#f4ebd9" letterSpacing={2}>{DECOR_TXT[lang].tap}</text>
      {[
        ['BLONDE CUT', '4,50'],
        ['IPA DE MONS', '5,50'],
        ['TRIPLE DORÉE', '6'],
        ['STOUT', '5,50'],
      ].map(([n, p], i) => (
        <g key={n}>
          <text x={402} y={124 + i * 20} fontSize={12} fill="#e8d9bc" opacity={0.9}>{n}</text>
          <text x={598} y={124 + i * 20} textAnchor="end" fontSize={12} fill="#d4a84b">{p}</text>
        </g>
      ))}
      {/* Étagères arrière */}
      {[160, 262].map((y) => (
        <g key={y}>
          <rect x={150} y={y} width={220} height={10} rx={2} fill="url(#fiCounter)" />
          <rect x={630} y={y} width={300} height={10} rx={2} fill="url(#fiCounter)" />
        </g>
      ))}
      <Glow x={260} y={150} r={130} o={0.25} />
      <Glow x={780} y={150} r={150} o={0.25} />
      <Can x={175} y={160} c="#c4271c" />
      <Can x={202} y={160} c="#1d5a43" />
      <Can x={229} y={160} c="#d4a84b" />
      <Growler x={290} y={160} />
      <Can x={345} y={160} c="#26313f" />
      <Growler x={190} y={262} />
      <Can x={250} y={262} c="#8f2d22" />
      <Can x={277} y={262} c="#3c8c6c" />
      <Can x={304} y={262} c="#c4271c" />
      <Can x={340} y={262} c="#d4a84b" h={48} />
      <Can x={655} y={160} c="#3c8c6c" />
      <Can x={682} y={160} c="#26313f" />
      <Growler x={745} y={160} />
      <Can x={810} y={160} c="#d4a84b" />
      <Can x={837} y={160} c="#c4271c" />
      <Can x={864} y={160} c="#1d5a43" />
      <Growler x={908} y={160} />
      <Can x={655} y={262} c="#c4271c" h={48} />
      <Can x={690} y={262} c="#f4ebd9" />
      <Growler x={752} y={262} />
      <Can x={900} y={262} c="#26313f" />
      {/* Caisse sous le fût */}
      <rect x={30} y={332} width={104} height={70} rx={3} fill="url(#fiCounter)" stroke="#2c1a0e" strokeWidth={2} />
      <path d="M30 352 H134 M30 376 H134" stroke="#2c1a0e" strokeWidth={2} />
      <TapTower />
      {/* Comptoir */}
      <rect x={0} y={396} width={SCENE_W} height={30} fill="url(#fiCounter)" />
      <rect x={0} y={396} width={SCENE_W} height={4} fill="#e2b77a" opacity={0.6} />
      <rect x={0} y={426} width={SCENE_W} height={274} fill="url(#fiPlanks)" />
      <rect x={0} y={426} width={SCENE_W} height={40} fill="#000" opacity={0.35} />
      {[20, 270, 520, 770].map((x) => (
        <rect key={x} x={x} y={470} width={210} height={128} rx={6} fill="#000" fillOpacity={0.18} stroke="#d4a84b" strokeOpacity={0.45} strokeWidth={2} />
      ))}
      <rect x={300} y={486} width={400} height={100} rx={8} fill="#140b05" stroke="#d4a84b" strokeWidth={2} />
      <text x={500} y={540} textAnchor="middle" fontSize={44} fontWeight={700} fill="#d4a84b" opacity={0.85} letterSpacing={10}>CUTSHOP</text>
      <text x={500} y={572} textAnchor="middle" fontSize={14} fill="#e8d9bc" opacity={0.7} letterSpacing={8}>CRAFT BEER BAR</text>
      <rect x={0} y={618} width={SCENE_W} height={8} rx={4} fill="url(#fiGold)" />
      {[120, 380, 620, 880].map((x) => (
        <rect key={x} x={x} y={606} width={8} height={30} fill="url(#fiGold)" />
      ))}
      {/* Tabourets */}
      {[200, 500, 800].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={690} rx={70} ry={22} fill="#1a0f08" />
          <ellipse cx={x} cy={684} rx={66} ry={18} fill="url(#fiLeather)" />
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scène 2 : l'étagère des produits

function ProductBox({ x, y, w = 44, h = 56, c = '#f4ebd9', label = 'NISHMAN' }: { x: number; y: number; w?: number; h?: number; c?: string; label?: string }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h} width={w} height={h} rx={2} fill={c} stroke="#000" strokeOpacity={0.25} />
      <rect x={x - w / 2} y={y - h + 8} width={w} height={10} fill="#164734" />
      <text x={x} y={y - h / 2 + 8} textAnchor="middle" fontSize={Math.min(8, w / 6)} fontWeight={700} fill="#164734">{label}</text>
      <rect x={x - w / 2 + 3} y={y - h + 2} width={4} height={h - 4} fill="#fff" opacity={0.25} />
    </g>
  );
}

function Tin({ x, y, r = 22, c = '#164734' }: { x: number; y: number; r?: number; c?: string }) {
  return (
    <g>
      <rect x={x - r} y={y - 18} width={r * 2} height={18} fill={c} />
      <ellipse cx={x} cy={y} rx={r} ry={5} fill={c} />
      <ellipse cx={x} cy={y - 18} rx={r} ry={5} fill="url(#fiMetalV)" />
      <text x={x} y={y - 6} textAnchor="middle" fontSize={6} fontWeight={700} fill="#d4a84b">CUT</text>
    </g>
  );
}

function Jar({ x, y, c = '#e8d9bc' }: { x: number; y: number; c?: string }) {
  return (
    <g>
      <rect x={x - 16} y={y - 40} width={32} height={40} rx={6} fill={c} opacity={0.75} stroke="#fff" strokeOpacity={0.4} />
      <rect x={x - 17} y={y - 48} width={34} height={10} rx={2} fill="url(#fiBlack)" />
      <rect x={x - 12} y={y - 30} width={24} height={14} fill="#164734" />
    </g>
  );
}

function ShelfScene({ lang }: { lang: Lang }) {
  const planks = [190, 340, 500, 650];
  return (
    <g>
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiDamask)" />
      <rect x={30} y={20} width={940} height={680} fill="#1a0f08" />
      <rect x={44} y={34} width={912} height={666} fill="url(#fiDamask)" />
      <rect x={44} y={34} width={912} height={666} fill="#000" opacity={0.35} />
      {planks.map((y, i) => (
        <g key={y}>
          <rect x={44} y={y - 70} width={912} height={70} fill="url(#fiFloorFade)" opacity={0.25} transform={`rotate(180 500 ${y - 35})`} />
          <rect x={44} y={y} width={912} height={14} fill="url(#fiCounter)" />
          <rect x={44} y={y + 14} width={912} height={6} fill="#000" opacity={0.35} />
          <rect x={44} y={y + 20} width={912} height={3} fill="#ffd98a" opacity={0.18} />
          {[200, 520, 820].map((x, j) => (
            <g key={x}>
              <rect x={x + i * 14} y={y + 2} width={46} height={11} rx={1.5} fill="#f4ebd9" />
              <text x={x + i * 14 + 23} y={y + 10.5} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#164734">{DECOR_TXT[lang].labels[(i + j) % 4]}</text>
            </g>
          ))}
        </g>
      ))}
      <rect x={30} y={20} width={14} height={680} fill="url(#fiCounter)" />
      <rect x={956} y={20} width={14} height={680} fill="url(#fiCounter)" />
      <rect x={30} y={20} width={940} height={16} fill="url(#fiCounter)" />
      <rect x={672} y={36} width={10} height={154} fill="url(#fiCounter)" />
      <rect x={340} y={204} width={10} height={136} fill="url(#fiCounter)" />
      <rect x={672} y={354} width={10} height={146} fill="url(#fiCounter)" />
      <rect x={250} y={514} width={10} height={136} fill="url(#fiCounter)" />
      {/* Rangée 1 */}
      <ProductBox x={84} y={190} />
      <Tin x={214} y={190} c="#8f2d22" />
      <Jar x={388} y={190} />
      <ProductBox x={560} y={190} w={60} h={70} c="#e8d9bc" />
      <Tin x={624} y={190} r={18} />
      <ProductBox x={740} y={190} w={40} h={50} c="#d4a84b" label="CUT" />
      <Tin x={940 - 14} y={190} r={14} c="#26313f" />
      {/* Rangée 2 */}
      <Jar x={80} y={340} c="#d4a84b" />
      <Jar x={124} y={340} />
      <ProductBox x={178} y={340} w={40} h={62} />
      <Tin x={404} y={340} c="#26313f" />
      <ProductBox x={470} y={340} w={56} h={44} c="#f4ebd9" />
      <Tin x={530} y={340} r={16} c="#8f2d22" />
      <ProductBox x={724} y={340} w={44} h={72} c="#e8d9bc" />
      <Jar x={780} y={340} c="#9fd3ef" />
      <Tin x={930} y={340} r={16} />
      {/* Rangée 3 */}
      <ProductBox x={70} y={500} w={36} h={56} c="#d4a84b" label="CUT" />
      <Tin x={230} y={500} />
      <ProductBox x={288} y={500} w={48} h={70} />
      <Jar x={470} y={500} />
      <Jar x={512} y={500} c="#d4a84b" />
      <ProductBox x={578} y={500} w={56} h={58} c="#e8d9bc" />
      <Tin x={644} y={500} r={16} c="#8f2d22" />
      <ProductBox x={900} y={500} w={60} h={80} />
      {/* Rangée 4 */}
      <ProductBox x={90} y={650} w={64} h={84} c="#e8d9bc" />
      <Tin x={176} y={650} c="#26313f" />
      <Jar x={330} y={650} />
      <ProductBox x={404} y={650} w={56} h={60} c="#d4a84b" label="CUT" />
      <Tin x={660} y={650} r={18} />
      <Jar x={720} y={650} c="#9fd3ef" />
      <ProductBox x={920} y={650} w={50} h={70} />
      {/* Fronton */}
      <rect x={350} y={0} width={300} height={34} rx={4} fill="#0a2219" stroke="#d4a84b" strokeWidth={2} />
      <text x={500} y={23} textAnchor="middle" fontSize={16} fontWeight={700} fill="#d4a84b" letterSpacing={8}>NISHMAN</text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scène 3 : le coin DJ

function DjScene({ lang }: { lang: Lang }) {
  const bulbs = Array.from({ length: 22 }, (_, i) => {
    const x = 20 + i * 46;
    const y = 30 + Math.sin((i / 21) * Math.PI) * 26;
    return { x, y, c: ['#ffd98a', '#ff4fa3', '#3dffa0', '#6fc3ff'][i % 4] };
  });
  return (
    <g>
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiBrick)" />
      <rect width={SCENE_W} height={SCENE_H} fill="#0a0507" opacity={0.35} />
      <path d={`M0 30 ${bulbs.map((b) => `L${b.x} ${b.y}`).join(' ')} L1000 30`} stroke="#111" strokeWidth={2} fill="none" />
      {bulbs.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y + 8} r={14} fill={b.c} opacity={0.18} />
          <circle cx={b.x} cy={b.y + 8} r={5} fill={b.c} />
        </g>
      ))}
      <path d="M500 0 V58" stroke="#aaa" strokeWidth={2} />
      {/* Néon */}
      <ellipse cx={500} cy={196} rx={230} ry={70} fill="url(#fiNeonPink)" />
      <text x={500} y={214} textAnchor="middle" fontSize={64} fontWeight={700} fill="none" stroke="#ff4fa3" strokeWidth={9} opacity={0.35} letterSpacing={6}>CUTSHOP</text>
      <text x={500} y={214} textAnchor="middle" fontSize={64} fontWeight={700} fill="none" stroke="#ffd1e8" strokeWidth={2.5} letterSpacing={6}>CUTSHOP</text>
      <ellipse cx={500} cy={262} rx={140} ry={26} fill="url(#fiNeonGreen)" />
      <text x={500} y={270} textAnchor="middle" fontSize={22} fontWeight={700} fill="none" stroke="#bfffe0" strokeWidth={1.6} letterSpacing={10}>DJ SET</text>
      {/* Affiche */}
      <rect x={640} y={290} width={110} height={96} fill="#f4ebd9" transform="rotate(3 695 338)" />
      <g transform="rotate(3 695 338)">
        <rect x={648} y={298} width={94} height={50} fill="#164734" />
        <circle cx={695} cy={323} r={18} fill="#d4a84b" />
        <text x={695} y={364} textAnchor="middle" fontSize={11} fontWeight={700} fill="#164734">VINYL NIGHT</text>
        <text x={695} y={378} textAnchor="middle" fontSize={9} fill="#164734">{DECOR_TXT[lang].friday}</text>
      </g>
      {/* Crochet de la casquette */}
      <circle cx={90} cy={206} r={4} fill="url(#fiGold)" />
      {/* Support guitare */}
      <rect x={207} y={160} width={36} height={8} rx={3} fill="url(#fiBlack)" />
      <rect x={221} y={150} width={8} height={12} fill="url(#fiBlack)" />
      {/* Plancher */}
      <rect y={640} width={SCENE_W} height={60} fill="url(#fiPlanks)" />
      <rect y={640} width={SCENE_W} height={60} fill="#000" opacity={0.3} />
      {/* Sellette de la plante */}
      <rect x={30} y={432} width={64} height={10} rx={2} fill="url(#fiCounter)" />
      <rect x={40} y={442} width={6} height={210} fill="#2c1a0e" />
      <rect x={78} y={442} width={6} height={210} fill="#2c1a0e" />
      {/* Bac à vinyles */}
      <rect x={60} y={566} width={170} height={110} rx={4} fill="url(#fiCounter)" stroke="#2c1a0e" strokeWidth={2} />
      {['#c4271c', '#d4a84b', '#f4ebd9', '#1d5a43', '#26313f', '#8f2d22', '#3c8c6c', '#e8d9bc'].map((c, i) => (
        <rect key={i} x={70 + i * 19} y={548 - (i % 3) * 6} width={16} height={40} rx={1} fill={c} stroke="#000" strokeOpacity={0.3} />
      ))}
      <rect x={60} y={588} width={170} height={20} fill="#3d2414" />
      <text x={145} y={640} textAnchor="middle" fontSize={14} fontWeight={700} fill="#f4dc95" letterSpacing={3}>RECORDS</text>
      {/* Pied de micro */}
      <path d="M812 320 L800 640 M770 650 L800 640 L830 650" stroke="url(#fiBlack)" strokeWidth={5} fill="none" strokeLinecap="round" />
      {/* Cabine DJ */}
      <path d="M250 412 L760 412 L776 440 L234 440 Z" fill="#1c1c1f" />
      <ellipse cx={400} cy={424} rx={62} ry={11} fill="#0b0b0c" />
      <ellipse cx={400} cy={423} rx={52} ry={8} fill="#1d5a43" />
      <ellipse cx={400} cy={423} rx={10} ry={2.5} fill="#d4a84b" />
      <path d="M446 414 L466 404" stroke="url(#fiMetalV)" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={612} cy={424} rx={62} ry={11} fill="#0b0b0c" />
      <ellipse cx={612} cy={423} rx={52} ry={8} fill="#1d5a43" />
      <ellipse cx={612} cy={423} rx={10} ry={2.5} fill="#d4a84b" />
      <path d="M658 414 L678 404" stroke="url(#fiMetalV)" strokeWidth={4} strokeLinecap="round" />
      <rect x={472} y={414} width={68} height={20} rx={3} fill="#2a2a30" />
      {[484, 498, 512, 526].map((x) => (
        <circle key={x} cx={x} cy={422} r={3} fill="#3dffa0" />
      ))}
      <rect x={234} y={440} width={542} height={260} fill="#141416" />
      <rect x={234} y={440} width={542} height={10} fill="url(#fiGold)" opacity={0.8} />
      <ellipse cx={505} cy={560} rx={200} ry={70} fill="url(#fiNeonGreen)" />
      <text x={505} y={574} textAnchor="middle" fontSize={40} fontWeight={700} fill="none" stroke="#3dffa0" strokeWidth={2} letterSpacing={8}>CUTSHOP</text>
      <text x={505} y={606} textAnchor="middle" fontSize={13} fill="#bfffe0" opacity={0.8} letterSpacing={10}>SOUND SYSTEM</text>
    </g>
  );
}

const SCENE_ART: ((p: { lang: Lang }) => JSX.Element)[] = [SalonScene, BarScene, ShelfScene, DjScene];

/** Scène complète : décor puis objets trouvables. Mémoïsée : ne se redessine qu'au changement de scène. */
export const SceneArt = memo(function SceneArt({ scene, lang }: { scene: number; lang: Lang }) {
  const Decor = SCENE_ART[scene];
  return (
    <g>
      <SceneDefs />
      <Decor lang={lang} />
      {SCENES[scene].objects.map((o) => (
        <Placed key={o.key} k={o.key} x={o.x} y={o.y} s={o.s} r={o.r} />
      ))}
      <rect width={SCENE_W} height={SCENE_H} fill="url(#fiVignette)" pointerEvents="none" />
    </g>
  );
});
