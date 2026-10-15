import { EyeOff, FerrisWheel, Medal, Play, RotateCcw, Square, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader, TextField } from '../components/ui';
import { useApp, useHoldAwake } from '../context/AppContext';
import { api } from '../lib/api';
import { cleanPseudo } from '../lib/battle';
import { evaluateStop, formatSeconds, isTimerVisible, type Stop10Result } from '../lib/stop10';
import type { Stop10Score } from '../lib/types';

type Phase = 'ready' | 'running' | 'done';

export default function Stop10() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lang, tablet, content, grantSpin } = useApp();
  const [phase, setPhase] = useState<Phase>('ready');
  const [display, setDisplay] = useState(0);
  const [result, setResult] = useState<Stop10Result | null>(null);
  const [board, setBoard] = useState<Stop10Score[]>([]);
  const [pseudo, setPseudo] = useState('');
  const [saved, setSaved] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const wheelOn = Boolean(content?.settings.modules.wheel);
  useHoldAwake(phase === 'running');

  const loadBoard = useCallback(async () => {
    try {
      setBoard(await api.getStop10Today());
    } catch {
      /* classement indisponible hors ligne */
    }
  }, []);
  useEffect(() => {
    void loadBoard();
    return () => cancelAnimationFrame(rafRef.current);
  }, [loadBoard]);

  const loop = () => {
    const elapsed = performance.now() - startRef.current;
    setDisplay(elapsed);
    if (isTimerVisible(elapsed)) rafRef.current = requestAnimationFrame(loop);
  };

  const start = () => {
    setResult(null);
    setSaved(false);
    startRef.current = performance.now();
    setDisplay(0);
    setPhase('running');
    rafRef.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    const elapsed = performance.now() - startRef.current;
    cancelAnimationFrame(rafRef.current);
    const r = evaluateStop(elapsed);
    setResult(r);
    setPhase('done');
    void api.logPlay('stop10', 1, null, tablet ?? '').catch(() => undefined);
  };

  const save = async () => {
    if (!result) return;
    const name = cleanPseudo(pseudo);
    if (!name) return;
    try {
      await api.addStop10Score(name, result.deltaMs, result.elapsedMs, tablet ?? '');
      setSaved(true);
      setPseudo('');
      void loadBoard();
    } catch {
      setSaved(true);
    }
  };

  const verdict = !result
    ? ''
    : result.perfect
      ? t('stop10.perfect')
      : result.deltaMs <= 100
        ? t('stop10.great')
        : result.deltaMs <= 500
          ? t('stop10.good')
          : t('stop10.meh');

  return (
    <Page>
      <PageHeader title={t('stop10.title')} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card relative flex min-h-[460px] flex-col items-center justify-center overflow-hidden p-8 text-center">
          {phase === 'ready' && (
            <div className="animate-fade-up">
              <p className="mx-auto max-w-xl text-2xl text-cream/85">{t('stop10.intro')}</p>
              <button type="button" className="btn-gold mx-auto mt-10 h-44 w-44 rounded-full text-3xl font-black uppercase" onClick={start} data-testid="stop10-start">
                <Play size={40} /> {t('stop10.start')}
              </button>
            </div>
          )}

          {phase === 'running' && (
            <div className="flex flex-col items-center">
              <div className="h-32" data-testid="stop10-timer">
                {isTimerVisible(display) ? (
                  <p className="font-mono text-8xl font-black tabular-nums text-cream">{formatSeconds(display, lang)}</p>
                ) : (
                  <p className="flex items-center gap-4 text-4xl font-black uppercase text-gold animate-pulse-soft">
                    <EyeOff size={44} /> {t('stop10.counting')}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="mt-8 grid h-56 w-56 place-items-center rounded-full bg-red-700 text-4xl font-black uppercase text-cream shadow-[0_12px_40px_rgba(185,28,28,0.45)] transition active:scale-95"
                onPointerDown={stop}
                data-testid="stop10-stop"
              >
                <span className="flex flex-col items-center gap-2">
                  <Square size={44} fill="currentColor" /> {t('stop10.stop')}
                </span>
              </button>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="w-full animate-pop" data-testid="stop10-result">
              <p className="eyebrow">{t('stop10.result')}</p>
              <p className={`mt-2 font-mono text-8xl font-black tabular-nums ${result.perfect ? 'text-gold' : 'text-cream'}`}>{formatSeconds(result.elapsedMs, lang)}</p>
              <p className="mt-2 text-2xl font-bold text-cream/80">{t('stop10.delta', { delta: formatSeconds(result.deltaMs, lang) })}</p>
              <p className={`mt-4 text-3xl font-black uppercase ${result.perfect ? 'text-gold' : 'text-cream'}`}>{verdict}</p>

              {result.perfect && (
                <>
                  <div className="pointer-events-none absolute inset-0">
                    {Array.from({ length: 24 }, (_, i) => (
                      <span
                        key={i}
                        className="absolute h-3 w-3 rounded-sm"
                        style={{
                          left: `${(i * 37) % 100}%`,
                          top: '-10px',
                          background: ['#D4A84B', '#F4EBD9', '#267255'][i % 3],
                          animation: `confetti ${1.6 + (i % 5) * 0.3}s ease-in ${(i % 7) * 0.12}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  {wheelOn && (
                    <button
                      type="button"
                      className="btn-gold mx-auto mt-6 text-xl"
                      onClick={() => {
                        grantSpin({ reason: 'stop10', pin: null });
                        navigate('/roue');
                      }}
                      data-testid="stop10-wheel"
                    >
                      <FerrisWheel size={26} /> {t('battle.spinGo')}
                    </button>
                  )}
                </>
              )}

              {!saved ? (
                <div className="mx-auto mt-8 flex max-w-lg items-end gap-3 text-left">
                  <div className="flex-1">
                    <TextField label={t('stop10.saveScore')} placeholder={t('battle.pseudoPh')} value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={14} autoComplete="off" name="pseudo" />
                  </div>
                  <button type="button" className="btn-cream" onClick={save} disabled={!cleanPseudo(pseudo)} data-testid="stop10-save">
                    {t('stop10.save')}
                  </button>
                </div>
              ) : (
                <p className="mt-8 text-xl font-bold text-gold-300">{t('stop10.saved')}</p>
              )}
              <button type="button" className="btn-ghost mx-auto mt-6" onClick={() => setPhase('ready')}>
                <RotateCcw size={22} /> {t('stop10.again')}
              </button>
            </div>
          )}
        </section>

        <aside className="card p-6" data-testid="stop10-board">
          <div className="flex items-center gap-3">
            <Trophy className="text-gold" size={30} />
            <div>
              <h2 className="h2 text-xl">{t('stop10.leaderboard')}</h2>
              <p className="text-sm text-cream/60">{t('stop10.resets')}</p>
            </div>
          </div>
          {board.length === 0 ? (
            <p className="mt-6 text-lg text-cream/70">{t('stop10.empty')}</p>
          ) : (
            <ol className="mt-5 space-y-2">
              {board.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-4 rounded-2xl px-4 py-3 ${i === 0 ? 'bg-gold/20' : 'bg-white/[0.04]'}`}>
                  <span className="w-8 text-center text-xl font-black text-gold">{i < 3 ? <Medal size={24} className="mx-auto" /> : i + 1}</span>
                  <span className="flex-1 truncate text-lg font-bold">{s.pseudo}</span>
                  <span className="font-mono text-lg tabular-nums text-cream/85">{formatSeconds(s.delta_ms, lang)}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </Page>
  );
}
