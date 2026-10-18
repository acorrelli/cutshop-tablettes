import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { IconType } from '../lib/tiles';

/** Grande tuile illustrée de l'accueil et des catégories. */
export function Tile({
  to,
  icon: Icon,
  tone,
  title,
  sub,
  index = 0,
  className = '',
  testId,
  inline = false,
  children,
}: {
  to: string;
  icon: IconType;
  tone: string;
  title: string;
  sub: string;
  index?: number;
  className?: string;
  testId?: string;
  /** Icône à côté du titre plutôt qu'en haut : pour les tuiles basses aux textes longs. */
  inline?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className={`group relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-4 shadow-tile ring-1 ring-white/10 transition active:scale-[0.97] lg:px-6 lg:py-5 ${tone} ${tone.includes('text-') ? '' : 'text-cream'} ${className}`}
      style={{ animation: `fade-up 0.45s ease-out ${index * 0.04}s both` }}
    >
      <Icon size={190} strokeWidth={1} className="pointer-events-none absolute -right-8 -top-8 opacity-[0.15] transition group-active:rotate-6" />
      {inline ? (
        <span className="mt-auto flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/20 ring-1 ring-white/15">
            <Icon size={26} strokeWidth={2} />
          </span>
          <span className="block text-[1.45rem] font-black uppercase leading-[1.1] tracking-wide">{title}</span>
        </span>
      ) : (
        <>
          <span className="mb-auto grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/20 ring-1 ring-white/15">
            <Icon size={30} strokeWidth={2} />
          </span>
          <span className="mt-3 block text-[1.45rem] font-black uppercase leading-[1.1] tracking-wide">{title}</span>
        </>
      )}
      <span className="mt-1 block text-base font-bold opacity-80">{sub}</span>
      {children}
    </Link>
  );
}
