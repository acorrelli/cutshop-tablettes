// Cutshop Challenge : défier une ou plusieurs tables, classements et challenge de la semaine.
import { ArrowLeft, Check, Clock, Gift, Send, Swords, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { GAME_ART } from '../assets';
import { bestScores } from '../ranking';
import { GAMES } from '../registry';
import { GAME_KEYS, type GameKey, type TableNo, type WeeklyChallenge } from '../types';
import { useWeeklyChallenge } from './ArcadeHome';
import { ArcadeBackdrop, PseudoChip, SoundControl, StatusPill, TableBadge, useErrorText, useGameEnabled, usePseudoGate, useTicker, variantLabel } from './common';
import { BoardList, Leaderboard, TieRules, useScores } from './Leaderboard';

export default function ChallengeHub() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'boards' | 'week'>(params.get('tab') === 'week' ? 'week' : 'boards');
  const weekly = useWeeklyChallenge();
  const gate = usePseudoGate();
  const initialGame = (GAME_KEYS as string[]).includes(params.get('game') ?? '') ? (params.get('game') as GameKey) : null;

  return (
    <Page className="relative z-[1] flex flex-col pt-4 lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4">
      <ArcadeBackdrop />
      <div className="mb-4 flex shrink-0 items-center gap-4 animate-fade-up">
        <Link to="/arcade" className="btn-ghost h-[56px] w-[56px] shrink-0 bg-black/40 px-0" aria-label={t('common.back')} data-testid="back-button">
          <ArrowLeft size={28} />
        </Link>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold text-bottle-950">
          <Trophy size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="h1 text-4xl">{t('arcade.challenge.title')}</h1>
          <p className="truncate text-base font-bold uppercase tracking-widest text-cream/70">{t('arcade.challenge.sub')}</p>
        </div>
        <PseudoChip onChange={() => gate.require(() => undefined)} />
        <SoundControl compact />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <DefyPanel initialGame={initialGame} requirePseudo={gate.require} />
        <div className="card flex min-h-[420px] flex-col border-white/10 bg-black/60 p-5 animate-fade-up">
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1.5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'boards'}
              onClick={() => setTab('boards')}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl text-base font-black uppercase tracking-wide ${tab === 'boards' ? 'bg-gold text-bottle-950' : 'text-cream/75'}`}
              data-testid="tab-boards"
            >
              <Trophy size={20} /> {t('arcade.board.title')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'week'}
              onClick={() => setTab('week')}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl text-base font-black uppercase tracking-wide ${tab === 'week' ? 'bg-gold text-bottle-950' : 'text-cream/75'}`}
              data-testid="tab-week"
            >
              <Gift size={20} /> {t('arcade.week.title')}
            </button>
          </div>
          {tab === 'boards' ? <Leaderboard initialKind={initialGame ?? 'general'} /> : <WeeklyPanel challenge={weekly} />}
        </div>
      </div>
      {gate.dialog}
    </Page>
  );
}

function DefyPanel({ initialGame, requirePseudo }: { initialGame: GameKey | null; requirePseudo: (fn: (p: string) => void) => void }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const { snapshot, table, act, online } = useArcade();
  const enabled = useGameEnabled();
  const errorText = useErrorText();
  const games = GAME_KEYS.filter(enabled);
  const [game, setGame] = useState<GameKey>(initialGame && enabled(initialGame) ? initialGame : games[0] ?? 'pour');
  const [variant, setVariant] = useState(GAMES[game].defaultVariant);
  const [picked, setPicked] = useState<TableNo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const activeRoom = snapshot?.room && (snapshot.room.status === 'lobby' || snapshot.room.status === 'playing') ? snapshot.room : null;

  const others = (snapshot?.tables ?? []).filter((x) => x.table !== table);
  const selectable = (s: string) => s === 'available' || s === 'invited';
  const toggle = (n: TableNo) => setPicked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].slice(-3)));
  const valid = picked.filter((n) => selectable(others.find((o) => o.table === n)?.status ?? 'offline'));

  const pickGame = (g: GameKey) => {
    setGame(g);
    setVariant(GAMES[g].defaultVariant);
  };

  const send = () =>
    requirePseudo(async (pseudo) => {
      setSending(true);
      setError(null);
      const r = await act((s) => s.createRoom({ pseudo, game, variant, invite: valid }));
      setSending(false);
      if (r.ok) navigate('/arcade/salle');
      else setError(errorText(r.code));
    });

  if (!table) {
    return (
      <div className="card flex flex-col items-center justify-center gap-4 border-white/10 bg-black/60 p-8 text-center" data-testid="not-paired">
        <Users size={48} className="text-gold" />
        <p className="h2 text-2xl">{t('arcade.notPaired.title')}</p>
        <p className="max-w-md text-lg text-cream/75">{t('arcade.notPaired.text')}</p>
      </div>
    );
  }

  return (
    <div className="card flex min-h-0 flex-col gap-4 overflow-y-auto border-white/10 bg-black/60 p-5 animate-fade-up" data-testid="defy-panel">
      <div className="flex items-center gap-3">
        <Swords size={26} className="text-[#9BE7B5]" />
        <h2 className="h2 flex-1 text-2xl">{t('arcade.defy.title')}</h2>
        <span className="flex items-center gap-2 text-base font-bold text-cream/70">
          {t('arcade.defy.you')} <TableBadge table={table} size="sm" />
        </span>
      </div>

      {activeRoom ? (
        <div className="rounded-2xl bg-gold/10 p-5 ring-1 ring-gold/50">
          <p className="text-lg font-bold text-cream">{t('arcade.defy.inRoom')}</p>
          <button type="button" className="btn-gold mt-3 w-full text-lg" onClick={() => navigate('/arcade/salle')} data-testid="back-to-room">
            {t('arcade.defy.backToRoom')}
          </button>
        </div>
      ) : (
        <>
          <div>
            <p className="label">{t('arcade.defy.tables')}</p>
            <div className="grid grid-cols-3 gap-2" data-testid="table-list">
              {others.map((o) => {
                const can = selectable(o.status);
                const on = picked.includes(o.table) && can;
                return (
                  <button
                    key={o.table}
                    type="button"
                    disabled={!can}
                    onClick={() => toggle(o.table)}
                    className={`relative flex flex-col items-start gap-2 rounded-2xl p-3 text-left ring-2 transition active:scale-[0.98] disabled:opacity-55 ${on ? 'bg-[#7CE3A0]/15 ring-[#7CE3A0]' : 'bg-white/[0.04] ring-white/10'}`}
                    aria-pressed={on}
                    data-testid={`pick-table-${o.table}`}
                    data-status={o.status}
                  >
                    <span className="flex w-full items-center gap-2">
                      <TableBadge table={o.table} />
                      <span className="text-lg font-black">{t('arcade.table', { n: o.table })}</span>
                      {on && <Check size={22} className="ml-auto text-[#9BE7B5]" />}
                    </span>
                    <StatusPill status={o.status} />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-cream/65">{t('arcade.defy.modeHint')}</p>
          </div>

          <div>
            <p className="label">{t('arcade.defy.game')}</p>
            <div className="grid grid-cols-4 gap-2">
              {games.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => pickGame(g)}
                  className={`relative h-24 overflow-hidden rounded-2xl ring-2 transition active:scale-[0.97] ${game === g ? 'ring-gold' : 'ring-white/10 opacity-70'}`}
                  aria-pressed={game === g}
                  data-testid={`pick-game-${g}`}
                >
                  <img src={GAME_ART[g].card} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-xs font-black uppercase tracking-wide text-cream">{GAMES[g].title}</span>
                </button>
              ))}
            </div>
            {GAMES[game].variants.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {GAMES[game].variants.map((v) => (
                  <button key={v.key} type="button" className={`chip min-h-[48px] text-base ${variant === v.key ? 'chip-on' : ''}`} onClick={() => setVariant(v.key)} data-testid={`pick-variant-${v.key}`}>
                    {variantLabel(game, v.key, lang)}
                  </button>
                ))}
              </div>
            )}
            {game === 'findit' && <p className="mt-2 text-sm text-cream/65">{t(variant === 'hunt' ? 'arcade.defy.huntHint' : 'arcade.defy.raceHint')}</p>}
          </div>

          {error && <p className="text-lg font-bold text-red-300" data-testid="defy-error">{error}</p>}
          {!online && <p className="text-base font-bold text-gold-300">{t('arcade.errors.network')}</p>}

          <button type="button" className="btn-gold mt-auto py-4 text-xl" disabled={valid.length === 0 || sending} onClick={send} data-testid="send-challenge">
            <Send size={24} />
            {valid.length <= 1 ? t('arcade.defy.sendDuel') : t('arcade.defy.sendBattle', { n: valid.length + 1 })}
          </button>
        </>
      )}
    </div>
  );
}

function WeeklyPanel({ challenge }: { challenge: WeeklyChallenge | null }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const { pseudo } = useArcade();
  const now = useTicker(1000);
  const since = challenge ? Date.parse(challenge.starts_at) : 0;
  const rows = useScores(since);
  const entries = useMemo(
    () => (challenge && rows ? bestScores(rows, challenge.game, { since, until: Date.parse(challenge.ends_at), modes: ['solo'] }) : []),
    [rows, challenge, since],
  );
  if (!challenge) return <p className="py-16 text-center text-lg text-cream/65" data-testid="week-none">{t('arcade.week.none')}</p>;
  const left = Math.max(0, Date.parse(challenge.ends_at) - now);
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="week-panel">
      <div className="flex gap-4 rounded-2xl bg-white/[0.04] p-4">
        <img src={GAME_ART[challenge.game].card} alt="" className="h-28 w-24 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-black uppercase text-cream">{lang === 'fr' ? challenge.title_fr : challenge.title_en}</p>
          <p className="mt-1 text-base text-cream/80">{lang === 'fr' ? challenge.description_fr : challenge.description_en}</p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-bold">
            <span className="flex items-center gap-1.5 text-[#9BE7B5]">
              <Gift size={18} /> {lang === 'fr' ? challenge.reward_fr : challenge.reward_en}
            </span>
            <span className="flex items-center gap-1.5 text-cream/75" data-testid="week-countdown">
              <Clock size={18} /> {t('arcade.week.left', { d, h, m })}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-lg font-black uppercase tracking-wide text-cream">{t('arcade.week.ranking')}</p>
        <button type="button" className="btn-gold min-h-[48px] text-base" onClick={() => navigate(`/arcade/jouer/${challenge.game}`)} data-testid="week-play">
          {t('arcade.play')} {GAMES[challenge.game].title}
        </button>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
        <BoardList entries={entries} kind={challenge.game} highlight={pseudo} limit={50} />
        <TieRules kind={challenge.game} />
      </div>
    </div>
  );
}
