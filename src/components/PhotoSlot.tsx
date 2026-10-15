import type { ReactNode } from 'react';
import { resolvePhoto } from '../lib/photos';

/**
 * Emplacement photo : affiche l'image si une URL est renseignée dans l'admin,
 * sinon un visuel de remplacement aux couleurs du Cutshop.
 */
export function PhotoSlot({
  src,
  alt,
  icon,
  className = '',
  tone = 'green',
}: {
  src?: string | null;
  alt: string;
  icon?: ReactNode;
  className?: string;
  tone?: 'green' | 'gold' | 'dark';
}) {
  const url = resolvePhoto(src);
  if (url) {
    return <img src={url} alt={alt} loading="lazy" draggable={false} className={`object-cover ${className}`} />;
  }
  const bg =
    tone === 'gold'
      ? 'from-gold-600 via-gold-700 to-bottle-900'
      : tone === 'dark'
        ? 'from-bottle-800 via-bottle-900 to-black'
        : 'from-bottle-500 via-bottle-700 to-bottle-950';
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${bg} ${className}`} role="img" aria-label={alt}>
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, #F4EBD9 0 2px, transparent 2px 22px)',
        }}
      />
      <div className="absolute inset-0 grid place-items-center text-cream/80">{icon}</div>
    </div>
  );
}
