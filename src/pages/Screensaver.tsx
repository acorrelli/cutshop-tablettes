import { Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';
import { useBattle } from '../context/BattleContext';
import { formatEventDate, formatTime, loc } from '../lib/loc';

/** Écran de veille animé : logo, accroche, prochain événement, invitation à la Battle. */
export default function Screensaver() {
  const { t } = useTranslation();
  const { wake, content, lang, setLang } = useApp();
  const battle = useBattle();
  const navigate = useNavigate();
  const next = content?.events.find((e) => e.seats_left > 0) ?? content?.events[0];
  const invite = battle?.invite;
  const battleOn = content?.settings.modules.battle !== false;

  const joinBattle = () => {
    wake();
    navigate('/battle');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-bottle-950 px-6 text-center"
      onClick={wake}
      data-testid="screensaver"
    >
      <div
        className="pointer-events-none absolute -left-1/4 -top-1/4 h-[150vmax] w-[150vmax] animate-spin-slow opacity-30"
        style={{ background: 'conic-gradient(from 0deg, #164734, #0A2219, #D4A84B33, #0A2219, #267255, #164734)' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,#0A2219_70%)]" />

      <div className="relative flex flex-col items-center">
        <div className="animate-float">
          <Logo size={200} />
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.5em] text-gold">Cutshop Mons</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-black uppercase leading-tight tracking-wide text-cream sm:text-5xl">{t('screensaver.hook')}</h1>

        {next && (
          <div className="mt-10 rounded-3xl border border-cream/15 bg-white/5 px-8 py-5 backdrop-blur">
            <p className="eyebrow">{t('screensaver.next')}</p>
            <p className="mt-1 text-3xl font-black uppercase">{loc(next, 'title', lang)}</p>
            <p className="mt-1 text-xl text-cream/80">
              {t('events.at', { date: formatEventDate(next.starts_at, lang), time: formatTime(next.starts_at, lang) })}
            </p>
          </div>
        )}

        {battleOn &&
          (invite ? (
            <button
              type="button"
              className="btn-gold mt-8 animate-pulse-soft text-2xl"
              onClick={(e) => {
                e.stopPropagation();
                joinBattle();
              }}
              data-testid="screensaver-battle-live"
            >
              <Swords size={30} /> {t('screensaver.battleLive')}
            </button>
          ) : (
            <p className="mt-8 flex items-center gap-3 text-xl font-bold text-gold-300">
              <Swords size={26} /> {t('screensaver.battleInvite')}
            </p>
          ))}

        <div className="mt-10 flex gap-3" onClick={(e) => e.stopPropagation()}>
          {(['fr', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`chip min-w-[72px] uppercase ${lang === l ? 'chip-on' : ''}`}
              onClick={() => {
                setLang(l);
                wake();
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
