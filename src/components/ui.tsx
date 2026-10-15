import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { useEffect, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

/** En tête de page avec retour. */
export function PageHeader({ title, eyebrow, back = '/', children }: { title: string; eyebrow?: string; back?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 animate-fade-up">
      <Link to={back} className="btn-ghost h-[56px] w-[56px] shrink-0 px-0" aria-label={t('common.back')} data-testid="back-button">
        <ArrowLeft size={28} />
      </Link>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="h1 text-3xl sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** Contenu principal centré, avec marges adaptées à la tablette. */
export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-[1400px] px-4 pb-10 pt-6 sm:px-6 ${className}`}>{children}</main>;
}

export function TextField({
  label,
  error,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input {...props} className={`field ${error ? 'border-red-400' : ''} ${props.className ?? ''}`} aria-invalid={Boolean(error)} />
      {error ? <span className="mt-2 block text-base font-bold text-red-300">{error}</span> : hint ? <span className="mt-2 block text-sm text-cream/60">{hint}</span> : null}
    </label>
  );
}

/** Grande case à cocher (zone tactile de toute la ligne). */
export function CheckRow({
  checked,
  onChange,
  children,
  error,
  testId,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  error?: string | null;
  testId?: string;
}) {
  return (
    <div>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        data-testid={testId}
        className={`flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition ${checked ? 'border-gold bg-gold/10' : error ? 'border-red-400 bg-white/[0.03]' : 'border-cream/15 bg-white/[0.03]'}`}
      >
        <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 ${checked ? 'border-gold bg-gold text-bottle-950' : 'border-cream/40'}`}>
          {checked && <Check size={24} strokeWidth={3} />}
        </span>
        <span className="text-base leading-snug text-cream/90">{children}</span>
      </button>
      {error && <span className="mt-2 block text-base font-bold text-red-300">{error}</span>}
    </div>
  );
}

/** Sélecteur de quantité avec gros boutons. */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-ghost h-[60px] w-[60px] px-0 text-3xl" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="moins">
          <Minus size={28} />
        </button>
        <span className="min-w-[3ch] text-center text-3xl font-black" data-testid="stepper-value">
          {value}
        </span>
        <button type="button" className="btn-ghost h-[60px] w-[60px] px-0 text-3xl" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="plus">
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
}

/** Lien vers la politique de confidentialité, sous les formulaires. */
export function PrivacyLink() {
  const { t } = useTranslation();
  return (
    <Link to="/confidentialite" className="inline-flex min-h-[48px] items-center text-base font-bold text-gold underline underline-offset-4">
      {t('common.privacyLink')}
    </Link>
  );
}

/** Écran de confirmation plein écran qui se ferme tout seul. */
export function SuccessOverlay({
  title,
  children,
  onClose,
  autoCloseMs = 9000,
  icon,
}: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  autoCloseMs?: number;
  icon?: ReactNode;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    const id = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(id);
  }, [onClose, autoCloseMs]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bottle-950/90 p-6 backdrop-blur" role="dialog" aria-modal="true" data-testid="success-overlay">
      <div className="card w-full max-w-xl p-10 text-center animate-pop">
        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-gold text-bottle-950">{icon ?? <Check size={56} strokeWidth={3} />}</div>
        <h2 className="h2 mb-4 text-3xl">{title}</h2>
        <div className="space-y-3 text-xl text-cream/85">{children}</div>
        <button type="button" className="btn-gold mt-8 w-full text-xl" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}

/** Retour à l'accueil depuis n'importe quel écran (utilisé par les confirmations). */
export function useGoHome() {
  const navigate = useNavigate();
  return () => navigate('/');
}
