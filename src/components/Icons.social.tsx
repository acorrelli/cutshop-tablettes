// Pictogrammes Facebook et TikTok dessinés pour la page Nos réseaux.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

export function FacebookIcon({ size = 24, ...props }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
    </svg>
  );
}

export function TikTokIcon({ size = 24, ...props }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3c.4 2.8 2.2 4.6 5 5" />
    </svg>
  );
}
