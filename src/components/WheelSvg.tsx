import type { Lang, WheelSegment } from '../lib/types';

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Coupe un libellé en deux lignes équilibrées si besoin. */
function splitLabel(label: string): string[] {
  if (label.length <= 11) return [label];
  const words = label.split(' ');
  let best = [label];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [a, b];
    }
  }
  return best;
}

const C = 200;
const R = 186;

function arc(i: number, n: number): string {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  const x0 = C + R * Math.cos(a0);
  const y0 = C + R * Math.sin(a0);
  const x1 = C + R * Math.cos(a1);
  const y1 = C + R * Math.sin(a1);
  return `M${C},${C} L${x0},${y0} A${R},${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
}

/** Roue dessinée en SVG ; la case i commence en haut et tourne dans le sens horaire. */
export function WheelSvg({ slots, rotation, lang }: { slots: WheelSegment[]; rotation: number; lang: Lang }) {
  const n = slots.length;
  const step = 360 / n;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(520px,calc(100dvh-210px))]">
      {/* Pointeur */}
      <svg viewBox="0 0 60 70" className="absolute left-1/2 top-[-6px] z-10 w-14 -translate-x-1/2 drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]">
        <path d="M30 68 L6 14 A26 26 0 0 1 54 14 Z" fill="#F4EBD9" stroke="#0A2219" strokeWidth="3" />
        <circle cx="30" cy="20" r="7" fill="#D4A84B" />
      </svg>
      <svg viewBox="0 0 400 400" className="h-full w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)]" data-testid="wheel-svg">
        <circle cx={C} cy={C} r={198} fill="#0A2219" stroke="#D4A84B" strokeWidth="4" />
        <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '200px 200px' }}>
          {slots.map((s, i) => {
            const label = lang === 'en' ? s.label_en || s.label_fr : s.label_fr;
            const lines = splitLabel(label.toUpperCase());
            const textColor = luminance(s.color) > 0.35 ? '#0A2219' : '#F4EBD9';
            const mid = i * step + step / 2;
            // Texte écrit le long du rayon, du bord vers le centre, taille ajustée à la place disponible.
            const longest = Math.max(...lines.map((l) => l.length));
            const fontSize = Math.min(16, Math.max(10, 116 / (longest * 0.66)));
            const gap = fontSize + 2;
            return (
              <g key={i}>
                <path d={arc(i, n)} fill={s.color} stroke="#0A2219" strokeWidth="2" />
                <g transform={`rotate(${mid - 90} ${C} ${C})`}>
                  {lines.map((line, li) => (
                    <text
                      key={li}
                      x={C + R - 16}
                      y={C + (li - (lines.length - 1) / 2) * gap + fontSize * 0.35}
                      fill={textColor}
                      fontSize={fontSize}
                      fontWeight={800}
                      fontFamily="Arial, Helvetica, sans-serif"
                      textAnchor="end"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              </g>
            );
          })}
          {slots.map((_, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            return <circle key={`b${i}`} cx={C + 192 * Math.cos(a)} cy={C + 192 * Math.sin(a)} r="4.5" fill="#F4EBD9" stroke="#8F6B22" strokeWidth="1.5" />;
          })}
        </g>
        <circle cx={C} cy={C} r="46" fill="#F4EBD9" stroke="#D4A84B" strokeWidth="6" />
        <circle cx={C} cy={C} r="30" fill="#164734" />
        <text x={C} y={C + 6} textAnchor="middle" fontSize="15" fontWeight={900} fill="#F4EBD9" fontFamily="Arial, Helvetica, sans-serif" style={{ letterSpacing: '0.1em' }}>
          CUT
        </text>
      </svg>
    </div>
  );
}
