// Salle multijoueur : lobby (invitations, prêts, lancement par l'hôte), partie synchronisée, attente des
// résultats, podium officiel calculé par le serveur, revanche.
import { Check, Crown, Hourglass, LogOut, Play, RotateCcw, Swords, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { GAME_ART } from '../assets';
import { multiPoints, rankPlayers } from '../ranking';
import { GAMES } from '../registry';
import type { GameResult, Room, RoomPlayer } from '../types';
import { ArcadeBackdrop, formatScore, TABLE_COLORS, TableBadge, useErrorText, useTicker, variantLabel } from './common';
import { GameScreen } from './GameScreen';
import { asDifficulty } from '../games/beat/engine';
import { beatTrackForSeed } from '../games/beat/tracks';
import { preloadTrackAudio } from '../games/beat/trackAudio';

const PENDING_KEY = 'cutshop.arcade.pending';

/** Résultat pas encore accepté par le serveur (coupure réseau, rechargement) : renvoyé jusqu'au délai de grâce. */
function savePending(roomId: string, result: GameResult) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ roomId, result }));
  } catch {
    /* stockage indisponible */
  }
}
function readPending(roomId: string): GameResult | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { roomId: string; result: GameResult } | null;
    return p && p.roomId === roomId ? p.result : null;
  } catch {
    return null;
  }
}
function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* rien */
  }
}

export default function RoomPage() {
  const { t } = useTranslation();
  const { snapshot, table } = useArcade();
  const room = snapshot?.room ?? null;
  // Beat Drop : la musique de la partie (tirée de la graine) se télécharge dès le salon d'attente.
  const beatSeed = room?.game === 'beat' ? room.seed : null;
  const beatLevel = room?.game === 'beat' ? asDifficulty(room.variant) : null;
  useEffect(() => {
    if (beatSeed === null || beatSeed === undefined || !beatLevel) return;
    const tr = beatTrackForSeed(beatSeed, beatLevel);
    if (tr) void preloadTrackAudio(tr.audioUrl).catch(() => undefined);
  }, [beatSeed, beatLevel]);

  if (!snapshot) return <Page className="relative z-[1] grid min-h-[60vh] place-items-center text-xl">...</Page>;
  if (!room || !table) {
    return (
      <Page className="relative z-[1] flex min-h-[70vh] flex-col items-center justify-center gap-5 text-center">
        <ArcadeBackdrop />
        <Swords size={56} className="text-gold" />
        <p className="h2 text-3xl">{t('arcade.room.none')}</p>
        <Link to="/arcade/challenge" className="btn-gold text-xl">
          {t('arcade.room.newChallenge')}
        </Link>
      </Page>
    );
  }
  const me = room.players.find((p) => p.table === table);
  if (!me) return null;
  if (room.status === 'lobby') return <Lobby room={room} me={me} />;
  if (room.status === 'playing') return <Playing room={room} me={me} />;
  return <Finished room={room} me={me} />;
}

function playerStateLabel(p: RoomPlayer, room: Room, now: number, t: (k: string, o?: Record<string, unknown>) => string) {
  if (p.state === 'invited') return t('arcade.room.invited', { s: Math.max(0, Math.ceil(((p.expires_at ?? now) - now) / 1000)) });
  if (p.state === 'joined') return p.table === room.host ? t('arcade.room.host') : t('arcade.room.joined');
  return t(`arcade.room.state.${p.state}`);
}

function RoomHeader({ room }: { room: Room }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const def = GAMES[room.game];
  return (
    <div className="flex items-center gap-4">
      <img src={GAME_ART[room.game].card} alt="" className="h-24 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-white/15" />
      <div className="min-w-0">
        <p className="eyebrow text-[#9BE7B5]">{room.mode === 'duel' ? t('arcade.room.duel') : t('arcade.room.battle', { n: room.players.filter((p) => p.state !== 'declined' && p.state !== 'expired' && p.state !== 'left').length })}</p>
        <h1 className="h1 text-4xl">{def.title}</h1>
        {def.variants.length > 1 && <p className="text-lg font-bold text-cream/75">{variantLabel(room.game, room.variant, lang)}</p>}
      </div>
    </div>
  );
}

function Lobby({ room, me }: { room: Room; me: RoomPlayer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { act, now: serverNow } = useArcade();
  const errorText = useErrorText();
  useTicker(500);
  const now = serverNow();
  const [error, setError] = useState<string | null>(null);
  const isHost = room.host === me.table;
  const ready = room.players.filter((p) => p.state === 'ready').length + (isHost && me.state !== 'ready' ? 1 : 0);
  const waitingJoin = room.players.some((p) => p.state === 'joined' && p.table !== room.host);
  const pendingInvites = room.players.some((p) => p.state === 'invited');
  const canStart = isHost && ready >= 2 && !waitingJoin;

  const run = async (fn: Parameters<typeof act>[0]) => {
    setError(null);
    const r = await act(fn);
    if (!r.ok) setError(errorText(r.code));
    return r.ok;
  };

  return (
    <Page className="relative z-[1] flex flex-col pt-6 lg:landscape:h-[calc(100dvh-76px)]">
      <ArcadeBackdrop image={GAME_ART[room.game].bg} />
      <div className="card mx-auto flex w-full max-w-4xl flex-col gap-6 border-white/10 bg-black/65 p-7 animate-fade-up" data-testid="room-lobby">
        <RoomHeader room={room} />
        <ul className="grid gap-2.5 sm:grid-cols-2" data-testid="room-players">
          {room.players.map((p) => {
            const out = p.state === 'declined' || p.state === 'expired' || p.state === 'left';
            return (
              <li
                key={p.table}
                className={`flex items-center gap-3 rounded-2xl p-3 ring-2 ${out ? 'bg-white/[0.03] opacity-55 ring-white/10' : p.state === 'ready' ? 'bg-[#7CE3A0]/12 ring-[#7CE3A0]/70' : 'bg-white/[0.05] ring-white/10'}`}
                data-testid={`room-player-${p.table}`}
                data-state={p.state}
              >
                <TableBadge table={p.table} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate text-xl font-black">
                    {p.pseudo || t('arcade.table', { n: p.table })}
                    {p.table === room.host && <Crown size={18} className="text-gold" />}
                    {p.table === me.table && <span className="rounded-full bg-white/10 px-2 text-xs font-bold uppercase">{t('arcade.hud.you')}</span>}
                  </span>
                  <span className="block text-base font-bold text-cream/70">{playerStateLabel(p, room, now, t)}</span>
                </span>
                {p.state === 'ready' && <Check size={28} className="text-[#9BE7B5]" />}
                {p.state === 'invited' && <Hourglass size={24} className="animate-pulse text-gold" />}
                {out && <X size={24} className="text-cream/50" />}
              </li>
            );
          })}
        </ul>

        <p className="text-center text-lg text-cream/80" data-testid="lobby-hint">
          {isHost
            ? canStart
              ? t('arcade.room.hostReady')
              : pendingInvites || waitingJoin
                ? t('arcade.room.hostWaiting')
                : t('arcade.room.hostAlone')
            : me.state === 'ready'
              ? t('arcade.room.waitHost')
              : t('arcade.room.pressReady')}
        </p>
        {error && <p className="text-center text-lg font-bold text-red-300">{error}</p>}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          {isHost ? (
            <button type="button" className="btn-gold py-4 text-2xl" disabled={!canStart} onClick={() => void run((s) => s.start(room.id))} data-testid="room-start">
              <Play size={28} fill="currentColor" /> {t('arcade.room.start')}
            </button>
          ) : (
            <button
              type="button"
              className={`btn py-4 text-2xl ${me.state === 'ready' ? 'bg-[#7CE3A0] text-bottle-950' : 'bg-gold text-bottle-950'}`}
              onClick={() => void run((s) => s.setReady(room.id, me.state !== 'ready'))}
              data-testid="room-ready"
            >
              <Check size={28} /> {me.state === 'ready' ? t('arcade.room.isReady') : t('arcade.room.ready')}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost text-lg"
            onClick={() => void run((s) => s.leave(room.id)).then(() => navigate('/arcade/challenge'))}
            data-testid="room-leave"
          >
            <LogOut size={22} /> {isHost ? t('arcade.room.cancel') : t('arcade.room.leave')}
          </button>
        </div>
      </div>
    </Page>
  );
}

function Playing({ room, me }: { room: Room; me: RoomPlayer }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { act, live, server } = useArcade();
  const [submitted, setSubmitted] = useState(me.result_at !== null);
  const [rejected, setRejected] = useState<string | null>(null);
  const errorText = useErrorText();
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = useCallback(
    async (result: GameResult) => {
      savePending(room.id, result);
      const r = await act((s) => s.submitResult(room.id, result));
      if (r.ok || r.code === 'duplicate') {
        clearPending();
        setSubmitted(true);
      } else if (r.code === 'network' || r.code === 'too_early') {
        // Reconnexion : nouvel essai tant que le délai de grâce n'est pas écoulé.
        retry.current = setTimeout(() => void submit(result), 1500);
      } else {
        clearPending();
        setSubmitted(true);
        setRejected(errorText(r.code));
      }
    },
    [act, room.id, errorText],
  );

  useEffect(() => {
    const pending = readPending(room.id);
    if (pending && me.result_at === null) void submit(pending);
    return () => {
      if (retry.current) clearTimeout(retry.current);
    };
  }, [room.id, me.result_at, submit]);

  const participants = room.players.filter((p) => p.state === 'ready');
  const opponents = participants
    .filter((p) => p.table !== me.table)
    .map((p) => ({ table: p.table, pseudo: p.pseudo, score: p.score ?? live[String(p.table)]?.score ?? 0, out: p.abandoned }));

  if (me.abandoned) {
    return (
      <Page className="relative z-[1] flex min-h-[70vh] flex-col items-center justify-center gap-5 text-center">
        <ArcadeBackdrop image={GAME_ART[room.game].bg} />
        <p className="h2 text-3xl">{t('arcade.room.abandoned')}</p>
        <Link to="/arcade" className="btn-gold text-xl">
          {t('arcade.result.home')}
        </Link>
      </Page>
    );
  }

  if (submitted || me.result_at !== null) {
    return (
      <Page className="relative z-[1] flex min-h-[70vh] flex-col items-center justify-center pt-6">
        <ArcadeBackdrop image={GAME_ART[room.game].bg} />
        <div className="card w-full max-w-2xl border-white/10 bg-black/65 p-8 text-center animate-pop" data-testid="room-waiting">
          <Hourglass size={44} className="mx-auto animate-pulse text-gold" />
          <p className="h2 mt-3 text-3xl">{t('arcade.room.waitingOthers')}</p>
          {rejected && <p className="mt-2 text-lg font-bold text-red-300">{rejected}</p>}
          <ul className="mt-6 space-y-2">
            {participants.map((p) => (
              <li key={p.table} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-2.5">
                <TableBadge table={p.table} />
                <span className="flex-1 truncate text-left text-lg font-black">{p.pseudo}</span>
                <span className="text-base font-bold text-cream/70">
                  {p.abandoned ? t('arcade.hud.out') : p.result_at !== null ? t('arcade.room.done') : t('arcade.room.stillPlaying')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Page>
    );
  }

  return (
    <GameScreen
      game={room.game}
      variant={room.variant}
      seed={room.seed}
      startAt={room.starts_at ?? 0}
      durationMs={room.duration_ms}
      roomId={room.id}
      opponents={opponents}
      exitText={t('arcade.hud.exitMulti')}
      onExit={() => void act((s) => s.leave(room.id)).then(() => navigate('/arcade'))}
      onEnd={(r) => void submit(r)}
      claim={
        room.game === 'findit' && room.variant === 'hunt'
          ? async (objectId) => {
              try {
                return await server.claim(room.id, objectId);
              } catch {
                return null;
              }
            }
          : undefined
      }
      claims={room.claims}
    />
  );
}

function Finished({ room, me }: { room: Room; me: RoomPlayer }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const { act, pseudo } = useArcade();
  const errorText = useErrorText();
  const [error, setError] = useState<string | null>(null);
  const ranked = useMemo(() => rankPlayers(room.players.filter((p) => p.state === 'ready')), [room.players]);

  if (room.status === 'cancelled') {
    const declined = room.players.filter((p) => p.table !== room.host).every((p) => p.state === 'declined' || p.state === 'expired');
    return (
      <Page className="relative z-[1] flex min-h-[70vh] flex-col items-center justify-center pt-6">
        <ArcadeBackdrop image={GAME_ART[room.game].bg} />
        <div className="card w-full max-w-2xl border-white/10 bg-black/65 p-8 text-center animate-pop" data-testid="room-cancelled">
          <X size={48} className="mx-auto text-cream/70" />
          <p className="h2 mt-3 text-3xl">{declined ? t('arcade.room.declinedAll') : t('arcade.room.cancelled')}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link to="/arcade/challenge" className="btn-gold text-lg">
              {t('arcade.room.newChallenge')}
            </Link>
            <Link to="/arcade" className="btn-ghost text-lg">
              {t('arcade.result.home')}
            </Link>
          </div>
        </div>
      </Page>
    );
  }

  const winner = ranked[0];
  const iWon = winner?.table === me.table && !winner.abandoned;
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  return (
    <Page className="relative z-[1] flex flex-col items-center pt-4 lg:landscape:h-[calc(100dvh-76px)]">
      <ArcadeBackdrop image={GAME_ART[room.game].bg} />
      <div className="card w-full max-w-4xl border-white/10 bg-black/65 p-7 animate-pop" data-testid="room-finished">
        <div className="text-center">
          <p className="eyebrow text-[#9BE7B5]">{GAMES[room.game].title}</p>
          <p className="h1 mt-1 text-4xl" data-testid="room-winner">
            {iWon ? t('arcade.room.youWin') : t('arcade.room.winner', { pseudo: winner?.pseudo ?? '' })}
          </p>
        </div>

        {/* Podium */}
        <div className="mt-4 flex items-end justify-center gap-4" data-testid="podium">
          {podium.map((p) => {
            const h = p.rank === 1 ? 'h-32' : p.rank === 2 ? 'h-24' : 'h-16';
            return (
              <div key={p.table} className="flex w-44 flex-col items-center">
                {p.rank === 1 && <Crown size={36} className="mb-1 text-gold" />}
                <p className="max-w-full truncate text-xl font-black">{p.pseudo}</p>
                <p className="text-2xl font-black tabular-nums text-gold">{p.abandoned ? t('arcade.hud.out') : formatScore(p.score ?? 0, lang)}</p>
                <div
                  className={`mt-2 flex w-full ${h} items-start justify-center rounded-t-2xl pt-3 text-4xl font-black text-bottle-950`}
                  style={{ background: `linear-gradient(180deg, ${TABLE_COLORS[p.table]}, ${TABLE_COLORS[p.table]}88)` }}
                >
                  {p.rank}
                </div>
              </div>
            );
          })}
        </div>

        <ol className="mt-5 space-y-1.5" data-testid="room-ranking">
          {ranked.map((p) => (
            <li key={p.table} className={`flex items-center gap-3 rounded-2xl px-4 py-2 ${p.table === me.table ? 'bg-[#7CE3A0]/15 ring-1 ring-[#7CE3A0]/60' : 'bg-white/[0.04]'}`}>
              <span className="w-8 text-xl font-black">{p.rank}</span>
              <TableBadge table={p.table} size="sm" />
              <span className="flex-1 truncate text-lg font-black">{p.pseudo}</span>
              <span className="text-base font-bold text-[#9BE7B5]">+{multiPoints(room.mode, p.rank ?? 99)} {t('arcade.board.pts')}</span>
              <span className="w-28 text-right text-xl font-black tabular-nums text-gold">{p.abandoned ? t('arcade.hud.out') : formatScore(p.score ?? 0, lang)}</span>
            </li>
          ))}
        </ol>
        {error && <p className="mt-3 text-center text-lg font-bold text-red-300">{error}</p>}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="btn-gold text-lg"
            onClick={async () => {
              setError(null);
              const r = await act((s) => s.rematch(room.id, pseudo ?? me.pseudo));
              if (!r.ok) setError(errorText(r.code));
            }}
            data-testid="room-rematch"
          >
            <RotateCcw size={22} /> {t('arcade.room.rematch')}
          </button>
          <button type="button" className="btn-ghost text-lg" onClick={() => navigate('/arcade/challenge')} data-testid="room-new">
            <Trophy size={22} /> {t('arcade.room.newChallenge')}
          </button>
          <button type="button" className="btn-ghost text-lg" onClick={() => navigate('/arcade')} data-testid="room-home">
            {t('arcade.result.home')}
          </button>
        </div>
      </div>
    </Page>
  );
}
