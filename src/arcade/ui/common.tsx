// Briques d'interface partagées par les écrans de Cutshop Arcade.
import { Shuffle, User, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { ARCADE_BG } from '../assets';
import { unlockArcadeAudio } from '../audio';
import { anonymousPseudo, checkPseudo, PSEUDO_MAX } from '../pseudo';
import { GAMES } from '../registry';
import type { ArcadeErrorCode, GameKey, TableNo, TableStatus } from '../types';

/** Fond sombre de l'Arcade, avec l'ambiance du bar floutée. */
export function ArcadeBackdrop({ image = ARCADE_BG }: { image?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <img src={image} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#06100C]/70 via-[#06100C]/55 to-[#06100C]/90" />
    </div>
  );
}

export function gameTitle(game: GameKey): string {
  return GAMES[game].title;
}

export function gameTagline(game: GameKey, lang: 'fr' | 'en'): string {
  return lang === 'fr' ? GAMES[game].tagline_fr : GAMES[game].tagline_en;
}

export function variantLabel(game: GameKey, variant: string, lang: 'fr' | 'en'): string {
  const v = GAMES[game].variants.find((x) => x.key === variant);
  return v ? (lang === 'fr' ? v.label_fr : v.label_en) : variant;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatScore(n: number, lang: 'fr' | 'en'): string {
  return n.toLocaleString(lang === 'fr' ? 'fr-BE' : 'en-GB');
}

/** Rafraîchit l'affichage à intervalle régulier (comptes à rebours). */
export function useTicker(ms = 500, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

export const TABLE_COLORS: Record<TableNo, string> = {
  1: '#7CE3A0',
  2: '#6FC3FF',
  3: '#FFB45C',
  4: '#E58CFF',
};

export function TableBadge({ table, size = 'md' }: { table: TableNo; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation();
  const cls = size === 'lg' ? 'h-14 min-w-14 text-2xl' : size === 'sm' ? 'h-7 min-w-7 text-sm' : 'h-10 min-w-10 text-lg';
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-xl px-1.5 font-black text-bottle-950 ${cls}`}
      style={{ background: TABLE_COLORS[table] }}
      aria-label={t('arcade.table', { n: table })}
    >
      {table}
    </span>
  );
}

const STATUS_STYLE: Record<TableStatus, string> = {
  available: 'bg-[#7CE3A0]/15 text-[#9BE7B5] ring-[#7CE3A0]/50',
  invited: 'bg-gold/15 text-gold-300 ring-gold/50',
  waiting: 'bg-gold/15 text-gold-300 ring-gold/50',
  ready: 'bg-[#6FC3FF]/15 text-[#A8DBFF] ring-[#6FC3FF]/50',
  playing: 'bg-[#E58CFF]/15 text-[#F0C2FF] ring-[#E58CFF]/50',
  offline: 'bg-white/5 text-cream/50 ring-white/15',
};

export function StatusPill({ status }: { status: TableStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black uppercase tracking-wide ring-1 ${STATUS_STYLE[status]}`}>
      <span className={`h-2 w-2 rounded-full ${status === 'offline' ? 'bg-cream/40' : 'bg-current'} ${status === 'playing' ? 'animate-pulse' : ''}`} />
      {t(`arcade.status.${status}`)}
    </span>
  );
}

/** Message lisible pour un code d'erreur du serveur. */
export function useErrorText() {
  const { t } = useTranslation();
  return (code: ArcadeErrorCode) => t(`arcade.errors.${code}`, { defaultValue: t('arcade.errors.network') });
}

/** Son coupé par défaut ; activable et réglable par le joueur pour sa session. */
export function SoundControl({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { sound, setSound } = useArcade();
  const toggle = () => {
    unlockArcadeAudio();
    setSound({ ...sound, on: !sound.on });
  };
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-black/40 ring-1 ring-white/10 ${compact ? 'p-1.5' : 'px-3 py-2'}`} data-testid="arcade-sound">
      <button
        type="button"
        onClick={toggle}
        className={`grid h-12 w-12 place-items-center rounded-xl transition ${sound.on ? 'bg-[#7CE3A0] text-bottle-950' : 'bg-white/10 text-cream'}`}
        aria-label={sound.on ? t('arcade.sound.off') : t('arcade.sound.on')}
        aria-pressed={sound.on}
        data-testid="arcade-sound-toggle"
      >
        {sound.on ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>
      {!compact && (
        <label className="flex items-center gap-2">
          <span className="sr-only">{t('arcade.sound.volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(sound.volume * 100)}
            disabled={!sound.on}
            onChange={(e) => setSound({ ...sound, volume: Number(e.target.value) / 100 })}
            className="h-2 w-28 accent-[#7CE3A0] disabled:opacity-40"
          />
        </label>
      )}
    </div>
  );
}

/** Choix du pseudo de la session (15 caractères, filtré) ou partie anonyme. */
export function PseudoDialog({ onDone, onCancel }: { onDone: (pseudo: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const { pseudo, setPseudo } = useArcade();
  const [value, setValue] = useState(pseudo && !pseudo.startsWith('Joueur ') && !pseudo.startsWith('Player ') ? pseudo : '');
  const [error, setError] = useState<string | null>(null);
  const confirm = () => {
    const c = checkPseudo(value);
    if (!c.ok) {
      setError(t(`arcade.pseudo.${c.error}`));
      return;
    }
    setPseudo(c.pseudo);
    onDone(c.pseudo);
  };
  const anonymous = () => {
    const p = anonymousPseudo();
    setPseudo(p);
    onDone(p);
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-6 backdrop-blur" role="dialog" aria-modal="true" data-testid="pseudo-dialog">
      <div className="card relative w-full max-w-lg border-[#7CE3A0]/30 bg-[#0B1511]/95 p-8 animate-pop">
        <button type="button" onClick={onCancel} className="btn-ghost absolute right-4 top-4 h-12 w-12 px-0" aria-label={t('common.close')}>
          <X size={24} />
        </button>
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#7CE3A0] text-bottle-950">
          <User size={34} />
        </span>
        <h2 className="h2 text-3xl">{t('arcade.pseudo.title')}</h2>
        <p className="mt-2 text-lg text-cream/75">{t('arcade.pseudo.text')}</p>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <input
            autoFocus
            value={value}
            maxLength={PSEUDO_MAX}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={t('arcade.pseudo.placeholder')}
            className={`field text-2xl font-bold ${error ? 'border-red-400' : ''}`}
            aria-label={t('arcade.pseudo.title')}
            data-testid="pseudo-input"
          />
          <div className="mt-2 flex justify-between text-sm">
            <span className="font-bold text-red-300">{error}</span>
            <span className="text-cream/50">
              {value.length}/{PSEUDO_MAX}
            </span>
          </div>
          <button type="submit" className="btn-gold mt-5 w-full text-xl" data-testid="pseudo-ok">
            {t('arcade.pseudo.ok')}
          </button>
        </form>
        <button type="button" onClick={anonymous} className="btn-ghost mt-3 w-full" data-testid="pseudo-anonymous">
          <Shuffle size={20} /> {t('arcade.pseudo.anonymous')}
        </button>
      </div>
    </div>
  );
}

/** Demande le pseudo si besoin avant de lancer une action. */
export function usePseudoGate() {
  const { pseudo } = useArcade();
  const [pending, setPending] = useState<((p: string) => void) | null>(null);
  const require = (fn: (p: string) => void) => {
    if (pseudo) fn(pseudo);
    else setPending(() => fn);
  };
  const dialog = pending ? (
    <PseudoDialog
      onDone={(p) => {
        const fn = pending;
        setPending(null);
        fn(p);
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;
  return { require, dialog };
}

export function PseudoChip({ onChange }: { onChange: () => void }) {
  const { t } = useTranslation();
  const { pseudo } = useArcade();
  return (
    <button type="button" onClick={onChange} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-black/40 px-4 ring-1 ring-white/10" data-testid="pseudo-chip">
      <User size={22} className="text-[#9BE7B5]" />
      <span className="text-left leading-tight">
        <span className="block text-xs font-bold uppercase tracking-widest text-cream/60">{t('arcade.pseudo.label')}</span>
        <span className="block max-w-[11rem] truncate text-lg font-black text-cream">{pseudo ?? t('arcade.pseudo.none')}</span>
      </span>
    </button>
  );
}

/** Fenêtre de confirmation simple. */
export function ConfirmDialog({
  title,
  text,
  confirm,
  cancel,
  onConfirm,
  onCancel,
  danger = false,
}: {
  title: string;
  text: ReactNode;
  confirm: string;
  cancel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-6 backdrop-blur" role="dialog" aria-modal="true" data-testid="confirm-dialog">
      <div className="card w-full max-w-lg bg-[#0B1511]/95 p-8 text-center animate-pop">
        <h2 className="h2 text-3xl">{title}</h2>
        <div className="mt-3 text-lg text-cream/80">{text}</div>
        <div className="mt-7 grid grid-cols-2 gap-3">
          <button type="button" className="btn-ghost text-lg" onClick={onCancel} data-testid="confirm-cancel">
            {cancel}
          </button>
          <button
            type="button"
            className={`btn text-lg ${danger ? 'bg-[#FF7A6B] text-bottle-950' : 'bg-gold text-bottle-950'}`}
            onClick={onConfirm}
            data-testid="confirm-ok"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Le module et le jeu sont ils activés dans l'admin ? */
export function useGameEnabled() {
  const { content } = useApp();
  return (g: GameKey) => content?.settings.arcade?.games?.[g] !== false;
}
