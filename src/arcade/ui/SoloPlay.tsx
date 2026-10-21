// Partie solo : présentation et règles, (choix de difficulté, son pour Beat Drop), partie, puis résultats.
// Hors ligne, la partie se joue quand même mais le score n'est pas enregistré.
import { ArrowLeft, Gauge, Headphones, Play, RotateCcw, Shuffle, Swords, Trophy, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Page } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { GAME_ART } from '../assets';
import { unlockArcadeAudio } from '../audio';
import { bestScores, periodStart } from '../ranking';
import { challengePoints, GAMES } from '../registry';
import { newSeed } from '../rng';
import { GAME_KEYS, type ArcadeErrorCode, type GameKey, type GameResult, type ScoreRow, type SoloSession } from '../types';
import { ArcadeBackdrop, formatScore, gameTagline, PseudoChip, SoundControl, useErrorText, useGameEnabled, usePseudoGate, variantLabel } from './common';
import { GameScreen } from './GameScreen';
import { asDifficulty } from '../games/beat/engine';
import type { BeatDifficulty } from '../games/beat/songs';
import { beatTrackById, beatTracks } from '../games/beat/tracks';
import { preloadTrackAudio } from '../games/beat/trackAudio';

/** Statistiques affichées en fin de partie, par jeu. */
export const RESULT_STATS: Record<GameKey, string[]> = {
  pour: ['glasses', 'perfect', 'great', 'overflow'],
  barber: ['served', 'perfect', 'left', 'wrongTool'],
  beat: ['perfect', 'good', 'miss', 'maxCombo'],
  findit: ['found', 'scenes', 'wrong'],
};

const COUNTDOWN_MS = 3500;
const BeatCalibration = lazy(() => import('../games/beat/Calibration'));

type Phase = { kind: 'intro' } | { kind: 'playing'; seed: number; startAt: number; session: SoloSession | null } | { kind: 'result'; result: GameResult; session: SoloSession | null };

export default function SoloPlay() {
  const { game: raw } = useParams();
  const enabled = useGameEnabled();
  if (!raw || !(GAME_KEYS as string[]).includes(raw) || !enabled(raw as GameKey)) return <Navigate to="/arcade" replace />;
  return <Solo key={raw} game={raw as GameKey} />;
}

function Solo({ game }: { game: GameKey }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const { act, now, pseudo, sound, setSound, server } = useArcade();
  const errorText = useErrorText();
  const gate = usePseudoGate();
  const def = GAMES[game];
  const [variant, setVariant] = useState(def.soloVariants.includes(def.defaultVariant) ? def.defaultVariant : def.soloVariants[0]);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  /** Beat Drop : musique choisie (null : au hasard). */
  const [track, setTrack] = useState<string | null>(null);

  const start = async () => {
    unlockArcadeAudio();
    setError(null);
    setStarting(true);
    const res = await act((s) => s.startSolo(game, variant));
    setStarting(false);
    if (res.ok) {
      setPhase({ kind: 'playing', seed: res.value.seed, startAt: now() + COUNTDOWN_MS, session: res.value });
    } else if (res.code === 'network' || res.code === 'not_paired') {
      // Partie libre sans enregistrement (hors ligne ou tablette non associée à une table).
      setPhase({ kind: 'playing', seed: newSeed(), startAt: now() + COUNTDOWN_MS, session: null });
    } else {
      setError(errorText(res.code));
    }
  };

  const play = () => gate.require(() => void start());

  if (phase.kind === 'playing') {
    return (
      <GameScreen
        game={game}
        variant={variant}
        seed={phase.seed}
        startAt={phase.startAt}
        durationMs={def.durationMs(variant)}
        exitText={t('arcade.hud.exitSolo')}
        track={game === 'beat' ? track : null}
        onExit={() => setPhase({ kind: 'intro' })}
        onEnd={(result) => {
          // Laisse le temps d'afficher « Temps écoulé ».
          setTimeout(() => setPhase({ kind: 'result', result, session: phase.session }), 1400);
        }}
      />
    );
  }

  if (phase.kind === 'result') {
    return <SoloResult game={game} variant={variant} result={phase.result} session={phase.session} onReplay={play} gateDialog={gate.dialog} />;
  }

  const needsAudio = def.needsAudio;
  return (
    <Page className="relative z-[1] flex flex-col pt-4 lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4">
      <ArcadeBackdrop image={GAME_ART[game].bg} />
      <div className="mb-4 flex shrink-0 items-center gap-4 animate-fade-up">
        <Link to="/arcade" className="btn-ghost h-[56px] w-[56px] shrink-0 bg-black/40 px-0" aria-label={t('common.back')} data-testid="back-button">
          <ArrowLeft size={28} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-[#9BE7B5]">Cutshop Arcade</p>
          <h1 className="h1 text-4xl">{def.title}</h1>
        </div>
        <PseudoChip onChange={() => gate.require(() => undefined)} />
        <SoundControl />
      </div>

      <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="relative min-h-[260px] overflow-hidden rounded-3xl ring-1 ring-white/15 animate-fade-up">
          <img src={GAME_ART[game].card} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6 pt-20">
            <p className="text-2xl font-black text-cream">{gameTagline(game, lang)}</p>
            <p className="text-lg font-bold text-cream/75">{lang === 'fr' ? def.duration_fr : def.duration_en}</p>
          </div>
        </div>

        <div className="card flex min-h-0 flex-col gap-4 overflow-y-auto border-white/10 bg-black/60 p-6 animate-fade-up" data-testid="solo-intro">
          <div>
            <h2 className="h2 text-2xl text-[#9BE7B5]">{t('arcade.howTo')}</h2>
            <ol className="mt-3 space-y-2">
              {(t(`arcade.rules.${game}`, { returnObjects: true }) as string[]).map((line, i) => (
                <li key={i} className="flex gap-3 text-[1.05rem] leading-snug text-cream/90">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#7CE3A0]/20 text-base font-black text-[#9BE7B5]">{i + 1}</span>
                  {line}
                </li>
              ))}
            </ol>
          </div>

          {def.soloVariants.length > 1 && (
            <div>
              <p className="label">{t('arcade.difficulty')}</p>
              <div className="flex flex-wrap gap-2">
                {def.soloVariants.map((v) => (
                  <button key={v} type="button" className={`chip ${variant === v ? 'chip-on' : ''}`} onClick={() => setVariant(v)} data-testid={`variant-${v}`}>
                    {variantLabel(game, v, lang)}
                  </button>
                ))}
                {needsAudio && (
                  <button type="button" className="chip ml-auto gap-2" onClick={() => setCalibrating(true)} data-testid="beat-calibrate">
                    <Gauge size={20} /> {t('arcade.audio.calibrate')}
                  </button>
                )}
              </div>
            </div>
          )}

          {game === 'beat' && <TrackPicker level={asDifficulty(variant)} value={track} onChange={setTrack} />}

          {needsAudio && (
            <div className="flex items-center gap-4 rounded-2xl bg-[#7CE3A0]/10 px-4 py-3 ring-1 ring-[#7CE3A0]/40" data-testid="audio-gate">
              <Headphones size={34} className="shrink-0 text-[#9BE7B5]" />
              <p className="flex-1 text-base font-bold text-cream/90">{sound.on ? t('arcade.audio.on') : t('arcade.audio.ask')}</p>
              {!sound.on && (
                <button
                  type="button"
                  className="btn bg-[#7CE3A0] text-bottle-950"
                  onClick={() => {
                    unlockArcadeAudio();
                    setSound({ ...sound, on: true });
                  }}
                  data-testid="audio-enable"
                >
                  {t('arcade.audio.enable')}
                </button>
              )}
            </div>
          )}

          {server.kind === 'demo' && server.table() === null && <p className="text-base font-bold text-gold-300">{t('arcade.notPairedSolo')}</p>}
          {error && <p className="text-lg font-bold text-red-300">{error}</p>}

          <div className="mt-auto flex flex-wrap gap-3">
            <button type="button" onClick={play} disabled={starting} className="btn-gold flex-1 py-4 text-2xl" data-testid="solo-start">
              <Play size={28} fill="currentColor" /> {t('arcade.play')}
            </button>
            <button type="button" onClick={() => navigate(`/arcade/challenge?game=${game}`)} className="btn-ghost bg-black/40 text-lg">
              <Swords size={22} /> {t('arcade.challengeTable')}
            </button>
          </div>
          {!pseudo && <p className="-mt-2 text-sm text-cream/60">{t('arcade.pseudo.hint')}</p>}
        </div>
      </div>
      {gate.dialog}
      {calibrating && (
        <div className="fixed inset-0 z-[60] bg-[#06040F]/95 backdrop-blur" role="dialog" aria-modal="true">
          <Suspense fallback={null}>
            <BeatCalibration lang={lang} sound={sound} onClose={() => setCalibrating(false)} />
          </Suspense>
        </div>
      )}
    </Page>
  );
}

function SoloResult({
  game,
  variant,
  result,
  session,
  onReplay,
  gateDialog,
}: {
  game: GameKey;
  variant: string;
  result: GameResult;
  session: SoloSession | null;
  onReplay: () => void;
  gateDialog: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const navigate = useNavigate();
  const { act, server, pseudo, now } = useArcade();
  const errorText = useErrorText();
  const [saved, setSaved] = useState<'saving' | 'saved' | 'offline' | ArcadeErrorCode>(session ? 'saving' : 'offline');
  const [today, setToday] = useState<ScoreRow[] | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (!session || sent.current) return;
    sent.current = true;
    let tries = 0;
    const send = async () => {
      const r = await act((s) => s.submitSolo(session.id, pseudo ?? '', result));
      if (r.ok || r.code === 'duplicate') setSaved('saved');
      else if (r.code === 'network' && tries++ < 5) setTimeout(() => void send(), 2000);
      else setSaved(r.code);
      server
        .scores(periodStart('today', now()))
        .then(setToday)
        .catch(() => setToday([]));
    };
    void send();
  }, [session, act, pseudo, result, server, now]);

  const board = useMemo(() => (today ? bestScores(today, game, { variant, modes: ['solo'] }) : []), [today, game, variant]);
  const mine = board.find((b) => b.pseudo === pseudo);
  const pts = challengePoints(game, variant, result.score);

  return (
    <Page className="relative z-[1] flex flex-col items-center justify-center pt-4 lg:landscape:h-[calc(100dvh-76px)]">
      <ArcadeBackdrop image={GAME_ART[game].bg} />
      <div className="card w-full max-w-3xl border-white/10 bg-black/65 p-8 text-center animate-pop" data-testid="solo-result">
        <p className="eyebrow text-[#9BE7B5]">
          {GAMES[game].title}
          {GAMES[game].soloVariants.length > 1 && ` · ${variantLabel(game, variant, lang)}`}
        </p>
        <p className="mt-2 text-2xl font-black uppercase text-cream">{t('arcade.result.score')}</p>
        <p className="text-8xl font-black tabular-nums leading-none text-gold drop-shadow-[0_0_24px_rgba(212,168,75,0.45)]" data-testid="result-score">
          {formatScore(result.score, lang)}
        </p>
        <p className="mt-2 text-lg font-bold text-[#9BE7B5]">{t('arcade.result.points', { n: pts })}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {RESULT_STATS[game]
            .filter((k) => result.stats[k] !== undefined)
            .map((k) => (
              <div key={k} className="min-w-[8.5rem] rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                <p className="text-3xl font-black tabular-nums text-cream">{result.stats[k]}</p>
                <p className="text-sm font-bold uppercase tracking-wide text-cream/65">{t(`arcade.stats.${k}`)}</p>
              </div>
            ))}
        </div>

        <div className="mt-6 min-h-[3.5rem] text-lg" data-testid="result-status">
          {saved === 'saving' && <p className="text-cream/70">{t('arcade.result.saving')}</p>}
          {saved === 'saved' && (
            <p className="flex items-center justify-center gap-2 font-bold text-cream">
              <Trophy size={22} className="text-gold" />
              {mine ? t('arcade.result.rankToday', { n: mine.position, best: formatScore(mine.value, lang) }) : t('arcade.result.saved')}
            </p>
          )}
          {saved === 'offline' && (
            <p className="flex items-center justify-center gap-2 font-bold text-gold-300">
              <WifiOff size={22} /> {t('arcade.result.offline')}
            </p>
          )}
          {saved !== 'saving' && saved !== 'saved' && saved !== 'offline' && <p className="font-bold text-red-300">{errorText(saved)}</p>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" className="btn-gold text-lg" onClick={onReplay} data-testid="result-replay">
            <RotateCcw size={22} /> {t('arcade.result.replay')}
          </button>
          <button type="button" className="btn-ghost text-lg" onClick={() => navigate(`/arcade/challenge?game=${game}`)} data-testid="result-challenge">
            <Swords size={22} /> {t('arcade.challengeTable')}
          </button>
          <button type="button" className="btn-ghost text-lg" onClick={() => navigate('/arcade')} data-testid="result-home">
            {t('arcade.result.home')}
          </button>
        </div>
      </div>
      {gateDialog}
    </Page>
  );
}

/** Beat Drop : choix de la musique parmi les morceaux importés du niveau choisi (rien ne s'affiche s'il n'y en a pas). */
function TrackPicker({ level, value, onChange }: { level: BeatDifficulty; value: string | null; onChange: (id: string | null) => void }) {
  const { t } = useTranslation();
  const { content, refreshBeatTracks } = useApp();
  const rows = content?.beatTracks;
  useEffect(() => {
    void refreshBeatTracks();
  }, [refreshBeatTracks]);
  const tracks = useMemo(() => {
    void rows;
    return beatTracks(level);
  }, [rows, level]);
  // Morceau retiré entre temps, ou d'un autre niveau : retour au hasard.
  useEffect(() => {
    if (value && !tracks.some((tr) => tr.id === value)) onChange(null);
  }, [tracks, value, onChange]);
  if (tracks.length === 0) return null;
  const pick = (id: string | null) => {
    onChange(id);
    const tr = beatTrackById(id);
    if (tr) void preloadTrackAudio(tr.audioUrl).catch(() => undefined);
  };
  const card = 'relative flex h-[92px] w-[150px] shrink-0 flex-col justify-end overflow-hidden rounded-2xl p-3 text-left ring-2 transition';
  return (
    <div data-testid="beat-tracks">
      <p className="label">{t('arcade.music')}</p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        <button
          type="button"
          onClick={() => pick(null)}
          className={`${card} bg-gradient-to-br from-[#2A1B5E] to-[#0B0720] ${value === null ? 'ring-[#7CE3A0]' : 'ring-white/10'}`}
          aria-pressed={value === null}
          data-testid="beat-track-random"
        >
          <Shuffle size={24} className="absolute left-3 top-3 text-[#9BE7B5]" />
          <span className="text-lg font-black leading-tight text-cream">{t('arcade.musicRandom')}</span>
          <span className="text-sm text-cream/60">{t('arcade.musicRandomSub')}</span>
        </button>
        {tracks.map((tr) => (
          <button
            key={tr.id}
            type="button"
            onClick={() => pick(tr.id)}
            className={`${card} ${value === tr.id ? 'ring-[#7CE3A0]' : 'ring-white/10'}`}
            style={{ background: `linear-gradient(135deg, hsl(${tr.hue} 70% 32%), hsl(${(tr.hue + 60) % 360} 70% 12%))` }}
            aria-pressed={value === tr.id}
            data-testid={`beat-track-${tr.id}`}
          >
            {tr.coverUrl && <img src={tr.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" draggable={false} />}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
            <span className="relative line-clamp-2 text-base font-black leading-tight text-cream">{tr.title}</span>
            {tr.artist && <span className="relative truncate text-sm text-cream/70">{tr.artist}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
