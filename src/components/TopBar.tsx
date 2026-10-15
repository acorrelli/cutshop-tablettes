import { ALargeSmall, House, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { IS_DEMO } from '../lib/env';
import { Logo } from './Logo';

/** Barre du haut toujours visible : logo, accueil, langue, grand texte. */
export function TopBar() {
  const { t } = useTranslation();
  const { lang, setLang, largeText, toggleLargeText, online, pending, tablet } = useApp();
  const { pathname } = useLocation();
  const atHome = pathname === '/';

  return (
    <header className="sticky top-0 z-30 border-b border-cream/10 bg-bottle-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Logo size={54} secret />
        <div className="mr-auto hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="text-xl font-black uppercase tracking-[0.18em] text-cream">Cutshop</span>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Mons</span>
        </div>
        <div className="mr-auto sm:hidden" />

        {(!online || pending > 0) && (
          <span className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 text-sm font-bold text-gold-300" data-testid="offline-badge">
            <WifiOff size={18} /> {t('common.offline')}
            {pending > 0 && <span className="rounded-full bg-gold px-2 text-bottle-950">{pending}</span>}
          </span>
        )}
        {IS_DEMO && (
          <span className="hidden rounded-full border border-gold/40 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold lg:inline">
            {t('common.demoMode')} {tablet ? `· ${tablet}` : ''}
          </span>
        )}

        <Link
          to="/"
          aria-label={t('common.home')}
          className={`btn min-h-[56px] px-4 ${atHome ? 'bg-white/5 text-cream/50' : 'bg-gold text-bottle-950'}`}
          data-testid="home-button"
        >
          <House size={26} />
          <span className="hidden md:inline">{t('common.home')}</span>
        </Link>

        <div className="flex h-[56px] overflow-hidden rounded-2xl border border-cream/15" role="group" aria-label="Langue / Language">
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`min-w-[60px] px-3 text-lg font-black uppercase transition ${lang === l ? 'bg-cream text-bottle-900' : 'bg-transparent text-cream/70'}`}
              aria-pressed={lang === l}
              data-testid={`lang-${l}`}
            >
              {l}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={toggleLargeText}
          aria-pressed={largeText}
          aria-label={t('common.largeText')}
          className={`btn min-h-[56px] px-4 ${largeText ? 'bg-cream text-bottle-900' : 'btn-ghost'}`}
          data-testid="large-text"
        >
          <ALargeSmall size={28} />
          <span className="hidden lg:inline">{t('common.largeText')}</span>
        </button>
      </div>
    </header>
  );
}
