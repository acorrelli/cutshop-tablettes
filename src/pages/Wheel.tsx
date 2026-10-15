import { Delete, FerrisWheel, Lock, PartyPopper, Ticket } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Page, PageHeader } from '../components/ui';
import { WheelSvg } from '../components/WheelSvg';
import { useApp, useHoldAwake } from '../context/AppContext';
import { api } from '../lib/api';
import { chime, tick, unlockAudio } from '../lib/sound';
import type { SpinResult } from '../lib/types';
import { buildWheelSlots, easeOutQuart, slotUnderPointer, targetRotation } from '../lib/wheel';

const SPIN_MS = 6500;
type Outcome = Extract<SpinResult, { ok: true }>;

export default function Wheel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { content, lang, tablet, wheelGrant, grantSpin, clearGrant, reloadContent } = useApp();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef(0);
  useHoldAwake(spinning);

  const slots = useMemo(() => buildWheelSlots(content?.segments ?? [], 10), [content?.segments]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!content) return null;
  const enabled = content.settings.modules.wheel;

  const errorText = (code: string) =>
    code === 'pin' ? t('wheel.pinWrong') : code === 'locked' ? t('wheel.pinLocked') : code === 'rate' ? t('wheel.rate') : code === 'empty' ? t('wheel.empty') : code === 'disabled' ? t('wheel.disabled') : t('common.error');

  const pressKey = (k: string) => {
    setPinError(null);
    setPin((p) => (k === 'del' ? p.slice(0, -1) : p.length < 8 ? p + k : p));
  };

  const unlock = async () => {
    if (pin.length < 4) return;
    setChecking(true);
    try {
      const res = await api.verifyPin(pin, tablet ?? '');
      if (res.ok) {
        grantSpin({ reason: 'staff', pin });
        setPin('');
      } else setPinError(errorText(res.error));
    } catch {
      setPinError(t('common.error'));
    } finally {
      setChecking(false);
    }
  };

  const spin = async () => {
    if (!wheelGrant || spinning || slots.length === 0) return;
    unlockAudio();
    setError(null);
    setSpinning(true);
    const grant = wheelGrant;
    let res: SpinResult;
    try {
      res = await api.spinWheel(grant.reason, grant.pin, tablet ?? '');
    } catch {
      res = { ok: false, error: 'network' };
    }
    if (!res.ok) {
      setSpinning(false);
      setError(errorText(res.error));
      if (res.error !== 'network') clearGrant();
      return;
    }
    // Un tour par client : l'autorisation est consommée dès le tirage.
    clearGrant();
    void api.logPlay('wheel', 1, grant.reason, tablet ?? '').catch(() => undefined);
    const won = res;
    const candidates = slots.map((s, i) => (s.id === won.prize_id ? i : -1)).filter((i) => i >= 0);
    const index = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
    const from = rotation;
    const to = targetRotation(index, slots.length, from, 6, Math.random());
    const t0 = performance.now();
    let lastSlot = slotUnderPointer(from, slots.length);
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / SPIN_MS);
      const r = from + (to - from) * easeOutQuart(p);
      setRotation(r);
      const slot = slotUnderPointer(r, slots.length);
      if (slot !== lastSlot) {
        lastSlot = slot;
        tick();
      }
      if (p < 1) raf.current = requestAnimationFrame(frame);
      else {
        setSpinning(false);
        setOutcome(won);
        chime(!won.is_losing);
        void reloadContent();
      }
    };
    raf.current = requestAnimationFrame(frame);
  };

  const label = (o: Outcome) => (lang === 'en' ? o.label_en || o.label_fr : o.label_fr);

  return (
    <Page>
      <PageHeader title={t('wheel.title')} back="/jeux" />
      {!enabled ? (
        <p className="card p-10 text-center text-2xl">{t('wheel.disabled')}</p>
      ) : (
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative">
            <WheelSvg slots={slots} rotation={rotation} lang={lang} />
          </div>

          <section className="card p-6 lg:p-7">
            {wheelGrant ? (
              <div className="text-center animate-fade-up">
                <FerrisWheel size={56} className="mx-auto text-gold" />
                <p className="mt-4 text-2xl font-black uppercase text-gold-300" data-testid="wheel-reason">
                  {t(`wheel.reason.${wheelGrant.reason}`)}
                </p>
                <p className="mt-2 text-lg text-cream/70">{t('wheel.oneTurn')}</p>
                <button type="button" className="btn-gold mt-8 min-h-[88px] w-full text-3xl" onClick={spin} disabled={spinning} data-testid="wheel-spin">
                  {spinning ? t('wheel.spinning') : t('wheel.spin')}
                </button>
              </div>
            ) : spinning ? (
              <p className="text-center text-3xl font-black uppercase text-gold animate-pulse-soft">{t('wheel.spinning')}</p>
            ) : (
              <div className="animate-fade-up" data-testid="wheel-locked">
                <div className="flex items-center gap-4">
                  <Lock size={40} className="shrink-0 text-gold" />
                  <h2 className="h2 text-2xl">{t('wheel.locked')}</h2>
                </div>
                <p className="mt-2 text-base text-cream/75">{t('wheel.lockedText')}</p>
                <p className="label mt-4">{t('wheel.staffPin')}</p>
                <div className="flex h-[64px] items-center justify-center gap-3 rounded-2xl border-2 border-cream/15 bg-bottle-950/60" data-testid="pin-display">
                  {pin.length === 0 ? <span className="text-cream/30">• • • •</span> : pin.split('').map((_, i) => <span key={i} className="h-4 w-4 rounded-full bg-gold" />)}
                </div>
                {pinError && <p className="mt-3 text-lg font-bold text-red-300" data-testid="pin-error">{pinError}</p>}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) =>
                    k === 'ok' ? (
                      <button key={k} type="button" className="btn-gold min-h-[58px] text-xl" onClick={unlock} disabled={pin.length < 4 || checking} data-testid="pin-ok">
                        OK
                      </button>
                    ) : k === 'del' ? (
                      <button key={k} type="button" className="btn-ghost min-h-[58px]" onClick={() => pressKey('del')} aria-label="Effacer">
                        <Delete size={26} />
                      </button>
                    ) : (
                      <button key={k} type="button" className="btn-ghost min-h-[58px] text-2xl" onClick={() => pressKey(k)} data-testid={`pin-${k}`}>
                        {k}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
            {error && <p className="mt-6 rounded-2xl bg-red-900/40 p-4 text-center text-lg font-bold text-red-100" data-testid="wheel-error">{error}</p>}
          </section>
        </div>
      )}

      {outcome && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-bottle-950/90 p-6 backdrop-blur" role="dialog" aria-modal="true" data-testid="wheel-outcome">
          <div className="card w-full max-w-xl p-10 text-center animate-pop">
            {outcome.is_losing ? (
              <>
                <FerrisWheel size={72} className="mx-auto text-cream/60" />
                <h2 className="h2 mt-6 text-3xl">{t('wheel.lost')}</h2>
                <p className="mt-3 text-xl text-cream/80">{t('wheel.lostText')}</p>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gold text-bottle-950">
                  <PartyPopper size={52} />
                </div>
                <h2 className="h2 mt-6 text-3xl text-gold">{t('wheel.won')}</h2>
                <p className="mt-2 text-3xl font-black uppercase">{label(outcome)}</p>
                <p className="mt-6 text-lg text-cream/75">{t('wheel.yourCode')}</p>
                <p className="mt-2 inline-flex items-center gap-3 rounded-2xl bg-cream px-8 py-4 font-mono text-5xl font-black tracking-[0.3em] text-bottle-900" data-testid="wheel-code">
                  <Ticket size={36} /> {outcome.code}
                </p>
                <p className="mt-4 text-base text-cream/70">{t('wheel.codeHint')}</p>
              </>
            )}
            <button
              type="button"
              className="btn-gold mt-8 w-full text-xl"
              onClick={() => {
                setOutcome(null);
                navigate('/');
              }}
            >
              {t('wheel.done')}
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
