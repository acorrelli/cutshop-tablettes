// Accueil de Cutshop Arcade : les 4 jeux, l'accès à Cutshop Challenge et le challenge de la semaine.
import { ArrowLeft, ChevronRight, Gift, Timer, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { unlockArcadeAudio } from '../audio';
import { useArcade } from '../ArcadeContext';
import { ARCADE_LOGO, GAME_ART } from '../assets';
import { GAMES } from '../registry';
import { GAME_KEYS, type WeeklyChallenge } from '../types';
import { ArcadeBackdrop, gameTagline, PseudoChip, SoundControl, useGameEnabled, usePseudoGate } from './common';

export function useWeeklyChallenge(): WeeklyChallenge | null {
  const { server, now } = useArcade();
  const [list, setList] = useState<WeeklyChallenge[]>([]);
  useEffect(() => {
    let alive = true;
    server
      .challenges()
      .then((l) => alive && setList(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [server]);
  const t = now();
  return list.find((c) => c.active && Date.parse(c.starts_at) <= t && t <= Date.parse(c.ends_at)) ?? null;
}

export default function ArcadeHome() {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const enabled = useGameEnabled();
  const weekly = useWeeklyChallenge();
  const gate = usePseudoGate();
  const games = GAME_KEYS.filter(enabled);

  const play = (game: string) => {
    unlockArcadeAudio();
    gate.require(() => navigate(`/arcade/jouer/${game}`));
  };

  return (
    <Page className="relative z-[1] flex flex-col pt-3 lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4">
      <ArcadeBackdrop />
      <div className="flex shrink-0 items-start gap-4 animate-fade-up">
        <Link to="/jeux" className="btn-ghost h-[56px] w-[56px] shrink-0 bg-black/40 px-0" aria-label={t('common.back')} data-testid="back-button">
          <ArrowLeft size={28} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <h1 className="sr-only">Cutshop Arcade</h1>
          <img src={ARCADE_LOGO} alt="Cutshop Arcade" className="h-[96px] w-auto drop-shadow-[0_0_18px_rgba(124,227,160,0.35)] lg:h-[110px]" draggable={false} />
          <p className="mt-1 text-xl font-black uppercase tracking-[0.25em] text-cream">{t('arcade.yourTurn')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <PseudoChip onChange={() => gate.require(() => undefined)} />
          <SoundControl />
        </div>
      </div>

      <div className={`mt-4 grid min-h-0 flex-1 gap-4 ${games.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`} data-testid="arcade-games">
        {games.map((g, i) => {
          const def = GAMES[g];
          return (
            <article
              key={g}
              className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-3xl bg-black/50 ring-1 ring-white/15 backdrop-blur-sm"
              style={{ animation: `fade-up 0.45s ease-out ${i * 0.05}s both` }}
              data-testid={`arcade-card-${g}`}
            >
              <button type="button" onClick={() => play(g)} className="relative min-h-0 flex-1 overflow-hidden" aria-label={def.title}>
                <img src={GAME_ART[g].card} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_88%] transition duration-300 group-active:scale-105" draggable={false} />
                <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
              </button>
              <div className="flex flex-col items-center gap-1 px-4 pb-4 pt-2.5 text-center">
                <h2 className="sr-only">{def.title}</h2>
                <p className="text-base font-bold leading-snug text-cream">{gameTagline(g, lang)}</p>
                <p className="flex items-center gap-1.5 text-sm font-bold text-cream/70">
                  <Timer size={16} /> {lang === 'fr' ? def.duration_fr : def.duration_en}
                </p>
                <button
                  type="button"
                  onClick={() => play(g)}
                  className="mt-1.5 w-full rounded-2xl border-2 border-[#7CE3A0]/80 bg-[#0F2A1E] py-3 text-lg font-black uppercase tracking-[0.15em] text-[#C9F5D8] shadow-[0_0_18px_rgba(124,227,160,0.25)] transition active:scale-[0.97]"
                  data-testid={`arcade-play-${g}`}
                >
                  {t('arcade.play')}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 grid shrink-0 gap-3 lg:grid-cols-[1fr_auto]">
        <Link
          to="/arcade/challenge"
          className="flex items-center gap-4 rounded-3xl border-2 border-gold/70 bg-black/60 px-5 py-3 shadow-[0_0_24px_rgba(212,168,75,0.2)] backdrop-blur transition active:scale-[0.99]"
          data-testid="arcade-challenge-link"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold text-bottle-950">
            <Trophy size={30} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-2xl font-black uppercase tracking-[0.12em] text-cream">{t('arcade.challenge.title')}</span>
            <span className="block truncate text-sm font-bold uppercase tracking-widest text-cream/70">{t('arcade.challenge.sub')}</span>
          </span>
          <ChevronRight size={32} className="text-gold" />
        </Link>
        {weekly && (
          <Link
            to="/arcade/challenge?tab=week"
            className="flex max-w-[32rem] items-center gap-3 rounded-3xl bg-[#7CE3A0]/12 px-5 py-3 ring-1 ring-[#7CE3A0]/50 backdrop-blur transition active:scale-[0.99]"
            data-testid="arcade-weekly"
          >
            <Gift size={28} className="shrink-0 text-[#9BE7B5]" />
            <span className="min-w-0">
              <span className="block text-xs font-black uppercase tracking-[0.2em] text-[#9BE7B5]">{t('arcade.week.title')}</span>
              <span className="block truncate text-lg font-black text-cream">{lang === 'fr' ? weekly.title_fr : weekly.title_en}</span>
              <span className="block truncate text-sm font-bold text-cream/75">
                {t('arcade.week.reward')} {lang === 'fr' ? weekly.reward_fr : weekly.reward_en}
              </span>
            </span>
          </Link>
        )}
      </div>
      {gate.dialog}
    </Page>
  );
}
