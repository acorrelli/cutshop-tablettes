// Écran de jeu plein écran : bandeau (score, temps, pseudo, adversaires, position, sortie), compte à rebours
// commun puis le mini jeu. Utilisé en solo comme en duel ou battle.
import { Crown, Timer, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp, useHoldAwake } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { GAME_ART } from '../assets';
import { sfx } from '../audio';
import { GAME_COMPONENTS } from '../games';
import type { GameProps } from '../games/types';
import type { GameKey, GameResult, TableNo } from '../types';
import { ConfirmDialog, formatClock, formatScore, gameTitle, TABLE_COLORS, TableBadge } from './common';

export interface Opponent {
  table: TableNo;
  pseudo: string;
  score: number;
  /** A quitté la partie ou s'est déconnecté. */
  out?: boolean;
}

export function GameScreen({
  game,
  variant,
  seed,
  startAt,
  durationMs,
  onEnd,
  onExit,
  exitText,
  opponents,
  roomId,
  claim,
  claims,
}: {
  game: GameKey;
  variant: string;
  seed: number;
  startAt: number;
  durationMs: number;
  onEnd: (r: GameResult) => void;
  onExit: () => void;
  exitText: string;
  opponents?: Opponent[];
  roomId?: string;
  claim?: GameProps['claim'];
  claims?: GameProps['claims'];
}) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const { now, sound, setPlaying, pseudo, table, sendLive } = useArcade();
  const [score, setScore] = useState(0);
  const [clock, setClock] = useState(now());
  const [confirm, setConfirm] = useState(false);
  const [over, setOver] = useState(false);
  const lastBeep = useRef(0);
  const liveAt = useRef(0);
  const pendingLive = useRef<number | null>(null);
  useHoldAwake(true);

  useEffect(() => {
    setPlaying(true);
    return () => setPlaying(false);
  }, [setPlaying]);

  useEffect(() => {
    const id = setInterval(() => setClock(now()), 100);
    return () => clearInterval(id);
  }, [now]);

  // Bips du compte à rebours.
  const toStart = startAt - clock;
  useEffect(() => {
    const s = Math.ceil(toStart / 1000);
    if (toStart > 0 && s <= 3 && s !== lastBeep.current) {
      lastBeep.current = s;
      sfx('tick', sound);
    } else if (toStart <= 0 && lastBeep.current !== 0) {
      lastBeep.current = 0;
      sfx('go', sound);
    }
  }, [toStart, sound]);

  // Score en direct envoyé aux autres tables au plus 4 fois par seconde.
  const flushLive = useCallback(() => {
    if (!roomId || pendingLive.current === null) return;
    sendLive(roomId, pendingLive.current);
    pendingLive.current = null;
    liveAt.current = Date.now();
  }, [roomId, sendLive]);
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(flushLive, 250);
    return () => clearInterval(id);
  }, [roomId, flushLive]);

  const onLive = useCallback((s: number) => {
    setScore(s);
    pendingLive.current = s;
  }, []);

  const ended = useRef(false);
  const handleEnd = useCallback(
    (r: GameResult) => {
      if (ended.current) return;
      ended.current = true;
      setScore(r.score);
      pendingLive.current = r.score;
      flushLive();
      setOver(true);
      sfx('end', sound);
      onEnd(r);
    },
    [onEnd, flushLive, sound],
  );

  const Game = GAME_COMPONENTS[game];
  const remaining = Math.min(durationMs, Math.max(0, startAt + durationMs - clock));

  const ranking = useMemo(() => {
    if (!opponents) return null;
    const me: Opponent = { table: table ?? 1, pseudo: pseudo ?? '', score };
    const all = [me, ...opponents.filter((o) => o.table !== me.table)];
    return all
      .slice()
      .sort((a, b) => Number(Boolean(a.out)) - Number(Boolean(b.out)) || b.score - a.score || a.table - b.table)
      .map((p, i) => ({ ...p, position: i + 1, me: p.table === me.table }));
  }, [opponents, score, pseudo, table]);
  const myPos = ranking?.find((r) => r.me)?.position ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#06100C] text-cream" data-testid="game-screen" data-game={game}>
      <img src={GAME_ART[game].bg} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/60" />

      {/* Bandeau */}
      <header className="relative z-10 flex shrink-0 items-center gap-3 px-4 pt-3">
        <div className="min-w-0 rounded-2xl bg-black/55 px-4 py-2 ring-1 ring-white/10 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9BE7B5]">{gameTitle(game)}</p>
          <p className="flex items-center gap-2 truncate text-lg font-black">
            {table && <TableBadge table={table} size="sm" />}
            <span className="truncate" data-testid="hud-pseudo">
              {pseudo}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-black/55 px-4 py-2 ring-1 ring-white/10 backdrop-blur">
          <Timer size={26} className={remaining < 10000 && remaining > 0 ? 'text-[#FF7A6B]' : 'text-[#9BE7B5]'} />
          <span className={`font-mono text-3xl font-black tabular-nums ${remaining < 10000 && remaining > 0 ? 'text-[#FF9C90]' : ''}`} data-testid="hud-timer">
            {formatClock(remaining)}
          </span>
        </div>

        <div className="rounded-2xl bg-black/55 px-5 py-1.5 text-center ring-1 ring-white/10 backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cream/70">{t('arcade.hud.score')}</p>
          <p className="text-3xl font-black tabular-nums leading-none text-gold" data-testid="hud-score">
            {formatScore(score, lang)}
          </p>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {ranking && (
            <ol className="flex min-w-0 gap-1.5" data-testid="hud-opponents">
              {ranking.map((r) => (
                <li
                  key={r.table}
                  className={`flex items-center gap-2 rounded-2xl px-2.5 py-1.5 ring-1 backdrop-blur ${r.me ? 'bg-[#7CE3A0]/20 ring-[#7CE3A0]' : 'bg-black/55 ring-white/10'} ${r.out ? 'opacity-45' : ''}`}
                >
                  <span className="text-lg font-black text-cream/80">{r.position}</span>
                  {r.position === 1 && !r.out && <Crown size={16} className="text-gold" />}
                  <span className="h-6 w-1.5 rounded-full" style={{ background: TABLE_COLORS[r.table] }} />
                  <span className="leading-tight">
                    <span className="block max-w-[7.5rem] truncate text-sm font-black">{r.me ? t('arcade.hud.you') : r.pseudo}</span>
                    <span className="block text-sm font-bold tabular-nums text-gold">{r.out ? t('arcade.hud.out') : formatScore(r.score, lang)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {myPos !== null && (
            <span className="sr-only" data-testid="hud-position">
              {myPos}
            </span>
          )}
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-black/55 ring-1 ring-white/15 backdrop-blur active:scale-95"
            aria-label={t('arcade.hud.exit')}
            data-testid="hud-exit"
          >
            <X size={28} />
          </button>
        </div>
      </header>

      {/* Jeu */}
      <div className="relative z-0 min-h-0 flex-1">
        {Game ? (
          <Suspense fallback={<div className="grid h-full place-items-center text-xl">...</div>}>
            <Game
              seed={seed}
              variant={variant}
              clock={now}
              startAt={startAt}
              durationMs={durationMs}
              sound={sound}
              lang={lang}
              onLive={onLive}
              onEnd={handleEnd}
              claim={claim}
              claims={claims}
              myTable={table}
            />
          </Suspense>
        ) : (
          <div className="grid h-full place-items-center text-2xl font-bold text-cream/80">{t('arcade.unavailable')}</div>
        )}
      </div>

      {/* Compte à rebours commun */}
      {toStart > 0 && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-[2px]" data-testid="countdown">
          <div className="text-center">
            <p className="text-2xl font-black uppercase tracking-[0.3em] text-[#9BE7B5]">{t('arcade.getReady')}</p>
            <p key={Math.ceil(toStart / 1000)} className="mt-2 text-[9rem] font-black leading-none text-cream drop-shadow-[0_0_30px_rgba(124,227,160,0.6)] animate-pop">
              {Math.ceil(toStart / 1000) > 3 ? '...' : Math.ceil(toStart / 1000)}
            </p>
          </div>
        </div>
      )}

      {over && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 backdrop-blur-sm" data-testid="time-up">
          <p className="text-6xl font-black uppercase italic tracking-wide text-gold drop-shadow-[0_0_30px_rgba(212,168,75,0.6)] animate-pop">{t('arcade.timeUp')}</p>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={t('arcade.hud.exitTitle')}
          text={exitText}
          confirm={t('arcade.hud.exitOk')}
          cancel={t('arcade.hud.exitCancel')}
          danger
          onConfirm={() => {
            setConfirm(false);
            onExit();
          }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
