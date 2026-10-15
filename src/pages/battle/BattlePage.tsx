import { Crown, FerrisWheel, LogOut, Play, RotateCcw, Swords, Timer, User, Users, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, TextField } from '../../components/ui';
import { useApp, useHoldAwake } from '../../context/AppContext';
import { useBattle, useBattleEngine } from '../../context/BattleContext';
import { api } from '../../lib/api';
import { MAX_PLAYERS, MIN_PLAYERS, QUESTION_MS, cleanPseudo, questionText, type ScoreEntry } from '../../lib/battle';
import type { BattleState, BattleTheme } from '../../lib/realtime/battleEngine';
import { INSTANCE_ID } from '../../lib/tablet';
import { QUIZ_THEMES } from '../../lib/types';

const THEMES: BattleTheme[] = ['mix', ...QUIZ_THEMES];
const ANSWER_STYLES = [
  'bg-gold text-bottle-950',
  'bg-cream text-bottle-900',
  'bg-bottle-500 text-cream',
  'bg-[#8F6B22] text-cream',
];
const LETTERS = ['A', 'B', 'C', 'D'];

/** Rafraîchit l'affichage plusieurs fois par seconde (comptes à rebours). */
function useNow(active: boolean, every = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}

export default function BattlePage() {
  const { t } = useTranslation();
  const engine = useBattleEngine();
  const s = useBattle();
  const { tablet } = useApp();
  const phase = s?.phase ?? 'idle';
  const inGame = phase === 'countdown' || phase === 'question' || phase === 'result';
  useHoldAwake(inGame || phase === 'lobby');
  const now = useNow(phase !== 'idle' && phase !== 'podium');

  // Statistiques : une ligne par tablette et par partie terminée.
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (!s || s.phase !== 'podium' || !s.battleId || logged.current === s.battleId) return;
    logged.current = s.battleId;
    void api.logPlay(s.solo ? 'battle_solo' : 'battle', Math.max(1, Math.min(4, s.players.length)), s.battleId, tablet ?? '').catch(() => undefined);
  }, [s, tablet]);

  if (!engine || !s) {
    return (
      <Page>
        <PageHeader title={t('battle.title')} />
      </Page>
    );
  }

  return (
    <Page>
      {(phase === 'idle' || phase === 'lobby' || phase === 'alone') && <PageHeader title={t('battle.title')} eyebrow={t('tiles.battle.sub')} />}
      {phase === 'idle' && <Start s={s} />}
      {phase === 'lobby' && <Lobby s={s} now={now} />}
      {phase === 'alone' && <Alone s={s} />}
      {phase === 'countdown' && <Countdown s={s} now={now} />}
      {(phase === 'question' || phase === 'result') && <Play_ s={s} now={now} />}
      {phase === 'podium' && <Podium s={s} />}
    </Page>
  );
}

// ---------------------------------------------------------------- accueil de la Battle
function Start({ s }: { s: BattleState }) {
  const { t } = useTranslation();
  const engine = useBattleEngine()!;
  const [pseudo, setPseudo] = useState(s.pseudo);
  const [theme, setTheme] = useState<BattleTheme>('mix');
  const [err, setErr] = useState<string | null>(null);
  const name = cleanPseudo(pseudo);
  const invite = s.invite;

  const need = () => {
    if (!name) {
      setErr(t('battle.pseudoErr'));
      return false;
    }
    return true;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <section className="card relative overflow-hidden p-8 animate-fade-up">
        <Swords size={220} strokeWidth={0.8} className="pointer-events-none absolute -bottom-10 -right-10 text-gold opacity-10" />
        <p className="text-2xl leading-relaxed text-cream/90">{t('battle.intro')}</p>
        <div className="mt-6 flex flex-wrap gap-4 text-lg font-bold text-gold-300">
          <span className="flex items-center gap-2">
            <Users size={22} /> {t('battle.range')}
          </span>
          <span className="flex items-center gap-2">
            <Timer size={22} /> {t('battle.format')}
          </span>
          <span className="flex items-center gap-2">
            <Zap size={22} /> {t('battle.maxPoints')}
          </span>
        </div>
        {s.notice === 'full' && <p className="mt-6 rounded-2xl bg-red-900/40 p-4 text-lg font-bold">{t('battle.full')}</p>}
        {s.busy && !invite && <p className="mt-6 rounded-2xl bg-white/10 p-4 text-lg font-bold">{t('battle.busy')}</p>}
      </section>

      <section className="card space-y-6 p-8 animate-fade-up">
        {invite && (
          <div className="rounded-3xl border-2 border-gold bg-gold/10 p-5" data-testid="battle-invite">
            <p className="text-2xl font-black uppercase text-gold">{t('battle.invite')}</p>
            <p className="mt-1 text-lg">{t('battle.inviteBy', { pseudo: invite.hostPseudo, tablet: invite.hostTablet })}</p>
            <p className="mt-1 text-base text-cream/70">
              {t('battle.players', { n: invite.players })} · {t(`battle.themes.${invite.theme}`)}
            </p>
          </div>
        )}
        <TextField
          label={t('battle.pseudo')}
          placeholder={t('battle.pseudoPh')}
          value={pseudo}
          onChange={(e) => {
            setPseudo(e.target.value);
            setErr(null);
          }}
          error={err}
          maxLength={14}
          autoComplete="off"
          name="pseudo"
          data-testid="battle-pseudo"
        />
        {invite ? (
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-gold flex-1 text-2xl" onClick={() => need() && engine.join(name)} data-testid="battle-join" disabled={invite.players >= MAX_PLAYERS}>
              <Users size={28} /> {t('battle.join')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => engine.dismissInvite()}>
              {t('battle.later')}
            </button>
          </div>
        ) : (
          <>
            <div>
              <span className="label">{t('battle.theme')}</span>
              <div className="flex flex-wrap gap-3">
                {THEMES.map((th) => (
                  <button key={th} type="button" className={`chip ${theme === th ? 'chip-on' : ''}`} onClick={() => setTheme(th)} data-testid={`theme-${th}`}>
                    {t(`battle.themes.${th}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-gold flex-1 text-2xl" onClick={() => need() && engine.host(name, theme)} disabled={s.busy} data-testid="battle-launch">
                <Swords size={28} /> {t('battle.launch')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => need() && engine.solo(name, theme)} data-testid="battle-solo">
                <User size={24} /> {t('battle.solo')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- salle d'attente
function Lobby({ s, now }: { s: BattleState; now: number }) {
  const { t } = useTranslation();
  const engine = useBattleEngine()!;
  const left = Math.max(0, Math.ceil((s.lobbyEndsAt - now) / 1000));
  const slots = Array.from({ length: MAX_PLAYERS }, (_, i) => s.lobbyPlayers[i]);
  return (
    <section className="card p-8 text-center animate-fade-up" data-testid="battle-lobby">
      <p className="eyebrow">{t('battle.lobby')}</p>
      <p className="mt-3 text-6xl font-black tabular-nums text-gold" data-testid="lobby-countdown">
        {t('battle.startsIn', { s: left })}
      </p>
      <p className="mt-3 text-xl text-cream/75">{t('battle.waiting')}</p>
      <p className="mt-1 text-lg font-bold">{t(`battle.themes.${s.theme}`)}</p>
      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
        {slots.map((p, i) => (
          <div
            key={i}
            className={`flex min-h-[120px] flex-col items-center justify-center rounded-3xl border-2 p-4 ${p ? 'border-gold bg-gold/10 animate-pop' : 'border-dashed border-cream/20'}`}
            data-testid={p ? 'lobby-player' : undefined}
          >
            {p ? (
              <>
                <User size={34} className="text-gold" />
                <p className="mt-2 text-xl font-black">{p.pseudo}</p>
                <p className="text-sm text-cream/60">{p.key === INSTANCE_ID ? t('battle.you') : p.tablet}</p>
              </>
            ) : (
              <span className="text-cream/30 animate-pulse-soft">
                <User size={34} />
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-6 text-lg font-bold">{t('battle.players', { n: s.lobbyPlayers.length })}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {s.isHost && (
          <button type="button" className="btn-gold text-2xl" disabled={s.lobbyPlayers.length < MIN_PLAYERS} onClick={() => engine.startNow()} data-testid="battle-startnow">
            <Play size={28} /> {t('battle.startNow')}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => engine.leave()}>
          <LogOut size={22} /> {t('battle.quit')}
        </button>
      </div>
    </section>
  );
}

function Alone({ s }: { s: BattleState }) {
  const { t } = useTranslation();
  const engine = useBattleEngine()!;
  return (
    <section className="card mx-auto max-w-3xl p-10 text-center animate-fade-up" data-testid="battle-alone">
      <Users size={64} className="mx-auto text-cream/50" />
      <h2 className="h2 mt-6 text-3xl">{t('battle.alone')}</h2>
      <div className="mt-8 flex flex-col gap-3">
        <button type="button" className="btn-gold text-2xl" onClick={() => engine.solo(s.pseudo, s.theme)} data-testid="battle-solo-offer">
          <Timer size={28} /> {t('battle.soloOffer')}
        </button>
        <button type="button" className="btn-ghost text-xl" onClick={() => engine.host(s.pseudo, s.theme)}>
          <RotateCcw size={22} /> {t('battle.relaunch')}
        </button>
        <button type="button" className="btn-ghost text-xl" onClick={() => engine.leave()}>
          <LogOut size={22} /> {t('battle.quit')}
        </button>
      </div>
    </section>
  );
}

function Countdown({ s, now }: { s: BattleState; now: number }) {
  const { t } = useTranslation();
  const left = Math.max(1, Math.ceil((s.startAt - now) / 1000));
  return (
    <section className="grid min-h-[60vh] place-items-center text-center" data-testid="battle-countdown">
      <div>
        <p className="text-3xl font-black uppercase text-gold">{s.solo ? t('battle.soloTitle') : t('battle.getReady')}</p>
        <p key={left} className="mt-6 text-[10rem] font-black leading-none text-cream animate-pop">
          {left}
        </p>
        {!s.solo && <p className="mt-6 text-xl text-cream/70">{s.players.map((p) => p.pseudo).join(' · ')}</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- question et résultat
function Play_({ s, now }: { s: BattleState; now: number }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const engine = useBattleEngine()!;
  const q = s.questions[s.q];
  if (!q) return null;
  const { question, answers } = questionText(q, lang);
  const isResult = s.phase === 'result';
  const mine = s.myAnswer && s.myAnswer.q === s.q ? s.myAnswer : null;
  const remaining = Math.max(0, s.phaseEndsAt - now);
  const ratio = isResult ? 0 : Math.min(1, remaining / QUESTION_MS);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <section className="card p-6 sm:p-8" data-testid="battle-question">
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">{t('battle.question', { n: s.q + 1, total: s.questions.length })}</p>
          {!isResult && (
            <p className={`flex items-center gap-2 text-3xl font-black tabular-nums ${remaining < 5000 ? 'text-red-300' : 'text-gold'}`}>
              <Timer size={28} /> {Math.ceil(remaining / 1000)}
            </p>
          )}
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gold transition-[width] duration-200 ease-linear" style={{ width: `${ratio * 100}%` }} />
        </div>
        <h2 className="mt-6 min-h-[5.5rem] text-[2rem] font-black leading-tight sm:text-4xl" data-testid="question-text">
          {question}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {answers.map((a, i) => {
            const correct = i === q.correct;
            const chosen = mine?.choice === i;
            let state = '';
            if (isResult) state = correct ? 'ring-4 ring-gold scale-[1.02]' : 'opacity-35';
            else if (mine) state = chosen ? 'ring-4 ring-cream' : 'opacity-50';
            return (
              <button
                key={i}
                type="button"
                disabled={Boolean(mine) || isResult}
                onClick={() => engine.answer(i)}
                className={`flex min-h-[96px] items-center gap-4 rounded-3xl px-6 py-4 text-left text-2xl font-black shadow-tile transition active:scale-[0.97] disabled:cursor-default ${ANSWER_STYLES[i]} ${state}`}
                data-testid={`answer-${i}`}
                data-correct={isResult && correct ? 'true' : undefined}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/15 text-xl">{LETTERS[i]}</span>
                <span className="leading-tight">{a}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 min-h-[3.5rem] text-center" data-testid="answer-feedback">
          {!isResult && mine && <p className="text-xl font-bold text-cream/80 animate-fade-up">{t('battle.answered')}</p>}
          {isResult && (
            <p className={`text-3xl font-black uppercase animate-pop ${mine?.correct ? 'text-gold' : 'text-red-300'}`}>
              {mine ? (mine.correct ? `${t('battle.correct')} ${t('battle.plus', { n: mine.points })}` : t('battle.wrong')) : t('battle.tooLate')}
              {!mine?.correct && <span className="mt-2 block text-xl font-bold normal-case text-cream/85">{t('battle.theAnswer', { answer: answers[q.correct] })}</span>}
            </p>
          )}
        </div>
      </section>
      <Ranking ranking={engine.ranking()} highlight={INSTANCE_ID} solo={s.solo} />
    </div>
  );
}

const ROW = 72;

/** Classement animé : chaque ligne glisse à sa nouvelle place. */
function Ranking({ ranking, highlight, solo }: { ranking: ScoreEntry[]; highlight: string; solo: boolean }) {
  const { t } = useTranslation();
  const order = [...ranking].sort((a, b) => a.id.localeCompare(b.id));
  return (
    <aside className="card p-5" data-testid="battle-ranking">
      <h3 className="h2 mb-4 flex items-center gap-2 text-xl">
        <Crown size={24} className="text-gold" /> {solo ? t('battle.soloTitle') : t('battle.ranking')}
      </h3>
      <div className="relative" style={{ height: ranking.length * ROW }}>
        {order.map((r) => {
          const pos = ranking.findIndex((x) => x.id === r.id);
          return (
            <div
              key={r.id}
              className={`absolute inset-x-0 flex h-[64px] items-center gap-3 rounded-2xl px-4 transition-transform duration-700 ease-out ${r.id === highlight ? 'bg-gold/20 ring-1 ring-gold' : 'bg-white/[0.05]'} ${r.gone ? 'opacity-45' : ''}`}
              style={{ transform: `translateY(${pos * ROW}px)` }}
            >
              <span className="w-7 text-center text-xl font-black text-gold">{pos + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-black">{r.pseudo}</span>
                {r.gone && <span className="block text-xs text-cream/60">{t('battle.gone')}</span>}
              </span>
              <span className="text-lg font-black tabular-nums">{t('battle.points', { n: r.total })}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- podium
function Podium({ s }: { s: BattleState }) {
  const { t } = useTranslation();
  const engine = useBattleEngine()!;
  const navigate = useNavigate();
  const { content, grantSpin } = useApp();
  const ranking = engine.ranking();
  const winner = ranking[0];
  const iWon = !s.solo && winner?.id === INSTANCE_ID && winner.total > 0 && s.players.length >= MIN_PLAYERS;
  const wheelOn = Boolean(content?.settings.modules.wheel);
  const me = ranking.find((r) => r.id === INSTANCE_ID);
  const heights = ['h-44', 'h-32', 'h-24'];
  const podiumOrder = [ranking[1], ranking[0], ranking[2]];

  return (
    <section className="animate-fade-up" data-testid="battle-podium">
      <div className="text-center">
        <p className="eyebrow">{t('battle.podium')}</p>
        <h2 className="mt-2 text-4xl font-black uppercase text-gold" data-testid="podium-title">
          {s.solo ? t('battle.soloScore', { n: me?.total ?? 0 }) : iWon ? t('battle.youWin') : t('battle.winner', { pseudo: winner?.pseudo ?? '' })}
        </h2>
        {s.solo && <p className="mt-2 text-xl text-cream/80">{t('battle.soloCorrect', { n: me?.correct ?? 0, total: s.questions.length })}</p>}
      </div>

      {!s.solo && (
        <div className="mx-auto mt-10 flex max-w-3xl items-end justify-center gap-4">
          {podiumOrder.map((r, i) => {
            if (!r) return <div key={i} className="w-1/3" />;
            const rank = ranking.indexOf(r);
            return (
              <div key={r.id} className="flex w-1/3 flex-col items-center" style={{ animation: `pop 0.6s cubic-bezier(.2,.9,.3,1.2) ${0.2 + (2 - rank) * 0.25}s both` }}>
                {rank === 0 && <Crown size={48} className="mb-2 text-gold animate-float" />}
                <p className="truncate text-2xl font-black">{r.pseudo}</p>
                <p className="mb-3 text-lg text-cream/75">{t('battle.points', { n: r.total })}</p>
                <div className={`w-full rounded-t-3xl ${heights[rank]} ${rank === 0 ? 'bg-gold text-bottle-950' : rank === 1 ? 'bg-cream text-bottle-900' : 'bg-gold-700 text-cream'} grid place-items-center text-5xl font-black`}>
                  {rank + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!s.solo && ranking.length > 3 && (
        <p className="mt-4 text-center text-lg text-cream/70">
          4. {ranking[3].pseudo} · {t('battle.points', { n: ranking[3].total })}
        </p>
      )}

      <div className="mt-10 flex flex-wrap justify-center gap-4">
        {iWon && wheelOn && (
          <button
            type="button"
            className="btn-gold min-h-[72px] text-2xl animate-pulse-soft"
            onClick={() => {
              grantSpin({ reason: 'battle', pin: null });
              engine.leave();
              navigate('/roue');
            }}
            data-testid="battle-wheel"
          >
            <FerrisWheel size={30} /> {t('battle.spinWon')}
          </button>
        )}
        <button type="button" className="btn-cream text-xl" onClick={() => engine.leave()} data-testid="battle-again">
          <RotateCcw size={24} /> {t('battle.playAgain')}
        </button>
      </div>
    </section>
  );
}
