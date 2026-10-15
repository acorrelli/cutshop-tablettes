// Icônes dessinées pour le Cutshop (marques et univers barber), en complément de lucide.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number | undefined, props: P) => ({
  width: size ?? 24,
  height: size ?? 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export function InstagramIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BarberPoleIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <rect x="8" y="5" width="8" height="14" rx="2" />
      <path d="M8 9l8-3M8 13l8-3M8 17l8-3" />
      <path d="M10 2h4M10 22h4M12 2v3M12 19v3" />
    </svg>
  );
}

export function CombIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <path d="M3 9h18v3H3z" />
      <path d="M5 12v6M8 12v6M11 12v6M14 12v6M17 12v6M20 12v4" />
    </svg>
  );
}

export function RazorIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 15l9-9a2 2 0 013 0l1 1a2 2 0 010 3l-9 9z" />
      <path d="M8 19l-3 3M14 8l2 2" />
    </svg>
  );
}

export function ClipperIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <rect x="7" y="7" width="10" height="15" rx="4" />
      <path d="M7 4h10v3H7zM9 4V2M12 4V2M15 4V2" />
      <circle cx="12" cy="14" r="1.5" />
    </svg>
  );
}

export function MustacheIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 11c-2-3-6-3-8-1-1 1-1 3 0 4 1-2 3-2 5-1s3 0 3-2zM12 11c2-3 6-3 8-1 1 1 1 3 0 4-1-2-3-2-5-1s-3 0-3-2z" />
    </svg>
  );
}

export function ShavingBrushIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <path d="M8 3c0 0-2 3-2 6s2 4 6 4 6-1 6-4-2-6-2-6z" />
      <path d="M9 13h6v2H9zM10 15h4l1 6H9z" />
    </svg>
  );
}

export function MirrorIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <ellipse cx="12" cy="9" rx="6" ry="7" />
      <path d="M12 16v6M9 22h6M9.5 6.5l2-2M10 10l4-4" />
    </svg>
  );
}

export function TowelIcon({ size, ...props }: P) {
  return (
    <svg {...base(size, props)}>
      <path d="M4 5h16v4H4z" />
      <path d="M6 9v10h12V9" />
      <path d="M6 15h12" />
    </svg>
  );
}
