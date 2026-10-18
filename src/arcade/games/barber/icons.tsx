// Icônes vectorielles de Barber Rush : outils du barbier et produits coiffants (viewBox 64 x 64).
import type { ProductKind, Tool } from './engine';

export function ToolIcon({ tool, size = 48, color = '#F4EBD9' }: { tool: Tool; size?: number; color?: string }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {tool === 'clipper' && (
        <g {...s}>
          <path d="M22 18 L42 18 L40 52 Q32 58 24 52 Z" fill={color} fillOpacity={0.12} />
          <path d="M20 10 L44 10 L42 18 L22 18 Z" fill={color} fillOpacity={0.35} />
          <path d="M24 10 L24 6 M29 10 L29 6 M34 10 L34 6 M39 10 L39 6" />
          <path d="M28 30 L36 30 M28 36 L36 36" />
          <path d="M32 56 Q34 62 42 60" />
        </g>
      )}
      {tool === 'scissors' && (
        <g {...s}>
          <circle cx={18} cy={46} r={7} />
          <circle cx={36} cy={50} r={7} />
          <path d="M23 41 L50 10 M31 45 L44 12" />
          <circle cx={30} cy={34} r={1.6} fill={color} />
        </g>
      )}
      {tool === 'razor' && (
        <g {...s}>
          <path d="M10 44 L34 20 Q42 14 50 20 L28 42 Z" fill={color} fillOpacity={0.2} />
          <path d="M28 42 L44 56 Q48 58 50 54 L36 38" fill={color} fillOpacity={0.45} />
          <path d="M14 40 L36 18" strokeWidth={1.6} />
        </g>
      )}
      {tool === 'beard' && (
        <g {...s}>
          <path d="M12 22 Q12 52 32 58 Q52 52 52 22 L46 24 Q44 38 32 40 Q20 38 18 24 Z" fill={color} fillOpacity={0.25} />
          <path d="M22 34 Q32 28 42 34" />
          <path d="M10 10 L54 10 L54 16 L10 16 Z" fill={color} fillOpacity={0.4} />
          <path d="M16 16 L16 21 M24 16 L24 21 M32 16 L32 21 M40 16 L40 21 M48 16 L48 21" />
        </g>
      )}
      {tool === 'product' && (
        <g {...s}>
          <path d="M16 26 L48 26 L46 54 Q32 58 18 54 Z" fill={color} fillOpacity={0.18} />
          <path d="M14 16 L50 16 L50 26 L14 26 Z" fill={color} fillOpacity={0.45} />
          <path d="M24 38 L40 38 M26 44 L38 44" />
        </g>
      )}
      {tool === 'finish' && (
        <g {...s}>
          <ellipse cx={34} cy={24} rx={16} ry={18} fill={color} fillOpacity={0.15} />
          <path d="M28 14 Q34 10 40 14" strokeWidth={2.4} />
          <path d="M30 41 L22 58" strokeWidth={6} />
          <path d="M50 6 L52 11 L57 13 L52 15 L50 20 L48 15 L43 13 L48 11 Z" fill={color} stroke="none" />
        </g>
      )}
    </svg>
  );
}

export const PRODUCT_COLORS: Record<ProductKind, { main: string; lid: string }> = {
  wax: { main: '#E8B23A', lid: '#5A3B10' },
  pomade: { main: '#3D7BFF', lid: '#E9EEF8' },
  oil: { main: '#C8691E', lid: '#1C1C1C' },
  spray: { main: '#D9DEE6', lid: '#FF4FD8' },
  clay: { main: '#B5603E', lid: '#2E2420' },
};

export function ProductIcon({ kind, size = 64 }: { kind: ProductKind; size?: number }) {
  const c = PRODUCT_COLORS[kind];
  const edge = { stroke: '#0b0b0b', strokeOpacity: 0.55, strokeWidth: 1.6 };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {kind === 'wax' && (
        <g {...edge}>
          <ellipse cx={32} cy={44} rx={24} ry={9} fill={c.main} />
          <rect x={8} y={30} width={48} height={14} fill={c.main} />
          <ellipse cx={32} cy={30} rx={24} ry={9} fill={c.lid} />
          <ellipse cx={32} cy={29} rx={13} ry={4.5} fill={c.main} opacity={0.85} />
        </g>
      )}
      {kind === 'clay' && (
        <g {...edge}>
          <rect x={10} y={30} width={44} height={20} rx={4} fill={c.main} />
          <rect x={8} y={22} width={48} height={10} rx={3} fill={c.lid} />
          <path d="M20 40 L44 40" stroke="#F4EBD9" strokeWidth={3} />
        </g>
      )}
      {kind === 'pomade' && (
        <g {...edge}>
          <rect x={14} y={22} width={36} height={32} rx={6} fill={c.main} />
          <rect x={12} y={12} width={40} height={12} rx={3} fill={c.lid} />
          <rect x={20} y={32} width={24} height={12} rx={2} fill="#fff" opacity={0.85} />
        </g>
      )}
      {kind === 'oil' && (
        <g {...edge}>
          <path d="M20 30 Q20 24 26 24 L38 24 Q44 24 44 30 L44 54 Q44 58 40 58 L24 58 Q20 58 20 54 Z" fill={c.main} />
          <rect x={27} y={14} width={10} height={10} fill={c.lid} />
          <ellipse cx={32} cy={10} rx={6} ry={5} fill={c.lid} />
          <rect x={24} y={36} width={16} height={12} rx={2} fill="#F4EBD9" opacity={0.85} />
        </g>
      )}
      {kind === 'spray' && (
        <g {...edge}>
          <rect x={20} y={20} width={24} height={38} rx={6} fill={c.main} />
          <rect x={24} y={10} width={16} height={10} rx={2} fill={c.lid} />
          <rect x={40} y={12} width={8} height={4} fill={c.lid} />
          <path d="M24 32 L40 32 M24 38 L40 38" stroke={c.lid} strokeWidth={3} />
        </g>
      )}
    </svg>
  );
}
