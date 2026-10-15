import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LOGO_SRC = `${import.meta.env.BASE_URL}logo_cutshop.png`;
const HOLD_MS = 5000;

/**
 * Logo du Cutshop (public/logo_cutshop.png, noir sur fond transparent) posé sur une pastille crème.
 * Appui long de 5 secondes : ouverture discrète de l'espace admin.
 */
export function Logo({ size = 56, secret = false, className = '' }: { size?: number; secret?: boolean; className?: string }) {
  const navigate = useNavigate();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);

  const start = () => {
    if (!secret) return;
    cancel();
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      navigate('/admin');
    }, HOLD_MS);
  };

  return (
    <div
      className={`relative grid shrink-0 place-items-center rounded-full bg-cream shadow-[0_6px_20px_rgba(0,0,0,0.35)] ${className}`}
      style={{ width: size, height: size }}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      data-testid={secret ? 'logo-secret' : undefined}
    >
      <img src={LOGO_SRC} alt="Cutshop" draggable={false} className="pointer-events-none h-[78%] w-[78%] object-contain" />
      {holding && <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-gold/0 animate-pulse-soft" />}
    </div>
  );
}
