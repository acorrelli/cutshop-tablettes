import { BellRing, CalendarClock, Gift as GiftIcon, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Page, PageHeader, SuccessOverlay } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { loc } from '../lib/loc';
import { sendOrQueue } from '../lib/queue';

export default function Gift() {
  const { t } = useTranslation();
  const { content, lang, tablet } = useApp();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!content) return null;
  const s = content.settings;
  const amounts = s.gift_amounts
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  const ask = async () => {
    setBusy(true);
    try {
      await sendOrQueue(() => api.submitDeskRequest('gift', tablet ?? ''));
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={t('tiles.gift.title')} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="card relative overflow-hidden p-8 animate-fade-up">
          <GiftIcon size={220} strokeWidth={0.8} className="pointer-events-none absolute -right-10 -top-10 text-gold opacity-10" />
          <h2 className="text-4xl font-black uppercase leading-tight tracking-wide text-gold">{loc(s, 'gift_title', lang)}</h2>
          <p className="mt-6 text-xl leading-relaxed text-cream/90">{loc(s, 'gift_body', lang)}</p>
          <button type="button" className="btn-gold mt-8 text-xl" onClick={ask} disabled={busy} data-testid="gift-ask">
            <BellRing size={26} /> {t('gift.ask')}
          </button>
        </section>
        <section className="space-y-5">
          <div className="card p-6 animate-fade-up">
            <p className="eyebrow">{t('gift.amounts')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {amounts.map((a) => (
                <span key={a} className="rounded-2xl bg-cream px-5 py-3 text-2xl font-black text-bottle-900">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="card flex gap-4 p-6 animate-fade-up">
            <CalendarClock size={30} className="shrink-0 text-gold" />
            <div>
              <p className="eyebrow">{t('gift.validity')}</p>
              <p className="mt-1 text-lg">{loc(s, 'gift_validity', lang)}</p>
            </div>
          </div>
          <div className="card flex gap-4 p-6 animate-fade-up">
            <ScrollText size={30} className="shrink-0 text-gold" />
            <div>
              <p className="eyebrow">{t('gift.conditions')}</p>
              <p className="mt-1 text-lg">{loc(s, 'gift_conditions', lang)}</p>
            </div>
          </div>
        </section>
      </div>
      {sent && <SuccessOverlay title={t('gift.asked')} onClose={() => setSent(false)} icon={<BellRing size={52} />} />}
    </Page>
  );
}
