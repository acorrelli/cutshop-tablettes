import { MessageCircleHeart, RotateCcw, SprayCan } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoSlot } from '../components/PhotoSlot';
import { Page, PageHeader, SuccessOverlay, TextField } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { formatPrice, loc } from '../lib/loc';
import { matchProducts } from '../lib/productMatch';
import { sendOrQueue } from '../lib/queue';
import type { EffectType, HairType, ProductProfile, ScalpType } from '../lib/types';

type Step = 'intro' | 'hair' | 'scalp' | 'beard' | 'effect' | 'result';
const HAIR: HairType[] = ['fine', 'thick', 'curly', 'coily'];
const SCALP: ScalpType[] = ['normal', 'dry', 'oily'];
const EFFECT: EffectType[] = ['volume', 'hold', 'shine', 'natural', 'care'];
const GRID: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

export default function Products() {
  const { t } = useTranslation();
  const { content, lang, tablet } = useApp();
  const [step, setStep] = useState<Step>('intro');
  const [profile, setProfile] = useState<Partial<ProductProfile>>({});
  const [talking, setTalking] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const complete = profile.hair && profile.scalp && profile.beard !== undefined && profile.effect;
  const selection = useMemo(
    () => (complete && content ? matchProducts(content.products, profile as ProductProfile) : []),
    [complete, content, profile],
  );
  if (!content) return null;

  const restart = () => {
    setProfile({});
    setStep('hair');
    setTalking(false);
    setFirstName('');
  };

  const send = async () => {
    if (!firstName.trim()) {
      setNameErr(t('events.errors.firstName'));
      return;
    }
    setBusy(true);
    try {
      await sendOrQueue(() => api.submitProductRequest(firstName.trim(), selection, profile as ProductProfile, tablet ?? ''));
      setFirstName('');
      setTalking(false);
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = { hair: 1, scalp: 2, beard: 3, effect: 4 } as Record<string, number>;

  const question = (title: string, options: { label: string; onPick: () => void; active: boolean }[]) => (
    <section className="card mx-auto max-w-4xl p-8 text-center animate-fade-up" key={step}>
      <p className="eyebrow">{t('products.step', { n: stepIndex[step] })}</p>
      <h2 className="mt-3 text-4xl font-black uppercase tracking-wide">{title}</h2>
      <div className="mx-auto mt-8 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(stepIndex[step] / 4) * 100}%` }} />
      </div>
      <div className={`mt-8 grid gap-4 ${GRID[options.length] ?? 'grid-cols-2'}`}>
        {options.map((o) => (
          <button key={o.label} type="button" className={`chip min-h-[96px] text-2xl ${o.active ? 'chip-on' : ''}`} onClick={o.onPick}>
            {o.label}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <Page>
      <PageHeader title={t('products.title')} back="/boissons-produits" />

      {step === 'intro' && (
        <section className="card mx-auto max-w-3xl p-10 text-center animate-fade-up">
          <SprayCan size={72} className="mx-auto text-gold" />
          <p className="mt-6 text-2xl text-cream/90">{t('products.intro')}</p>
          <button type="button" className="btn-gold mt-8 text-xl" onClick={() => setStep('hair')} data-testid="products-start">
            {t('products.start')}
          </button>
        </section>
      )}

      {step === 'hair' && (
        question(
          t('products.q.hair'),
          HAIR.map((h) => ({ label: t(`products.hair.${h}`), active: profile.hair === h, onPick: () => (setProfile((p) => ({ ...p, hair: h })), setStep('scalp')) })),
        )
      )}
      {step === 'scalp' && (
        question(
          t('products.q.scalp'),
          SCALP.map((s) => ({ label: t(`products.scalp.${s}`), active: profile.scalp === s, onPick: () => (setProfile((p) => ({ ...p, scalp: s })), setStep('beard')) })),
        )
      )}
      {step === 'beard' && (
        question(
          t('products.q.beard'),
          [true, false].map((b) => ({ label: b ? t('common.yes') : t('common.no'), active: profile.beard === b, onPick: () => (setProfile((p) => ({ ...p, beard: b })), setStep('effect')) })),
        )
      )}
      {step === 'effect' && (
        question(
          t('products.q.effect'),
          EFFECT.map((e) => ({ label: t(`products.effect.${e}`), active: profile.effect === e, onPick: () => (setProfile((p) => ({ ...p, effect: e })), setStep('result')) })),
        )
      )}

      {step === 'result' && (
        <section className="animate-fade-up" data-testid="products-result">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="h2 text-3xl text-gold">{t('products.resultTitle')}</h2>
              <p className="text-lg text-cream/75">{t('products.resultIntro')}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={restart}>
              <RotateCcw size={22} /> {t('products.restart')}
            </button>
          </div>
          {selection.length === 0 ? (
            <p className="card p-10 text-center text-2xl">{t('products.none')}</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {selection.map((p, i) => (
                <article key={p.id} className="card flex overflow-hidden" style={{ animation: `fade-up 0.4s ease-out ${i * 0.06}s both` }} data-testid="product-card">
                  <PhotoSlot src={p.image_url} alt={p.name} icon={<SprayCan size={52} />} tone={i % 2 ? 'dark' : 'gold'} className="w-32 shrink-0 sm:w-40" />
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-black uppercase leading-tight tracking-wide">{p.name}</h3>
                      {p.price > 0 && <span className="shrink-0 rounded-xl bg-cream px-3 py-1 text-lg font-black text-bottle-900">{formatPrice(p.price, lang)}</span>}
                    </div>
                    <p className="mt-1 text-sm font-bold uppercase tracking-wider text-gold">{p.brand}</p>
                    <p className="mt-3 text-base">
                      <strong className="text-gold-300">{t('products.benefit')} : </strong>
                      {loc(p, 'benefit', lang)}
                    </p>
                    <p className="mt-2 text-base text-cream/80">
                      <strong className="text-gold-300">{t('products.usage')} : </strong>
                      {loc(p, 'usage', lang)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}

          {selection.length > 0 && (
            <div className="card mt-6 p-6">
              {!talking ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xl font-bold">{t('products.final')}</p>
                  <button type="button" className="btn-gold text-xl" onClick={() => setTalking(true)} data-testid="products-talk">
                    <MessageCircleHeart size={26} /> {t('products.talk')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[260px] flex-1">
                    <TextField
                      label={t('products.firstName')}
                      hint={t('products.firstNameHint')}
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setNameErr(null);
                      }}
                      error={nameErr}
                      autoComplete="off"
                      maxLength={80}
                      autoFocus
                      name="firstName"
                    />
                  </div>
                  <button type="button" className="btn-gold mb-7 text-xl" onClick={send} disabled={busy} data-testid="products-send">
                    {t('products.sendToBarber')}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {sent && (
        <SuccessOverlay title={t('products.sent')} icon={<MessageCircleHeart size={52} />} onClose={() => setSent(false)}>
          <p>{t('products.final')}</p>
        </SuccessOverlay>
      )}
    </Page>
  );
}
