import { CalendarHeart, PartyPopper } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { PhotoSlot } from '../components/PhotoSlot';
import { CheckRow, Page, PageHeader, PrivacyLink, Stepper, SuccessOverlay, TextField } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { isValidEmail } from '../lib/email';
import { formatEventDate, formatTime, loc } from '../lib/loc';
import { sendOrQueue } from '../lib/queue';
import { eventIcon, eventTone } from './eventVisuals';

const EMPTY = { first: '', last: '', email: '', seats: 1, consent: false, newsletter: false };

export default function EventRegister() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { content, lang, tablet, refreshEvents } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { kind: 'ok' | 'queued'; seats: number }>(null);
  const [fullMsg, setFullMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const event = content?.events.find((e) => e.id === id);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  if (!content) return null;
  if (!event) {
    return (
      <Page>
        <PageHeader title={t('events.title')} back="/evenements" />
        <p className="card p-10 text-center text-2xl">{t('events.none')}</p>
      </Page>
    );
  }

  const title = loc(event, 'title', lang);
  const when = t('events.at', { date: formatEventDate(event.starts_at, lang), time: formatTime(event.starts_at, lang) });
  const dateLabel = formatEventDate(event.starts_at, lang);
  const confirmWhen =
    lang === 'fr'
      ? `le ${dateLabel.charAt(0).toLowerCase()}${dateLabel.slice(1)} à ${formatTime(event.starts_at, lang)}`
      : `on ${dateLabel} at ${formatTime(event.starts_at, lang)}`;
  const isFull = event.seats_left <= 0;
  const maxSeats = Math.max(1, Math.min(6, event.seats_left));
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const errs: Record<string, string | null> = {
      first: form.first.trim() ? null : t('events.errors.firstName'),
      last: form.last.trim() ? null : t('events.errors.lastName'),
      email: isValidEmail(form.email) ? null : t('events.errors.email'),
      consent: form.consent ? null : t('events.errors.consent'),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setFailed(false);
    try {
      const seats = form.seats;
      const res = await sendOrQueue(() =>
        api.registerEvent({
          event_id: event.id,
          first_name: form.first.trim(),
          last_name: form.last.trim(),
          email: form.email.trim(),
          seats,
          newsletter: form.newsletter,
          consent: form.consent,
          tablet: tablet ?? '',
        }),
      );
      if (res.status === 'queued') {
        setForm(EMPTY);
        setResult({ kind: 'queued', seats });
      } else if (res.result.ok) {
        setForm(EMPTY);
        setResult({ kind: 'ok', seats });
      } else if (res.result.error === 'full' || res.result.error === 'closed') {
        setFullMsg(t('events.fullText'));
      } else if (res.result.error === 'not_enough') {
        setFullMsg(t('events.notEnough', { count: res.result.seats_left ?? 0 }));
      } else {
        setFailed(true);
      }
      void refreshEvents();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={title} eyebrow={when} back="/evenements" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <aside className="card overflow-hidden animate-fade-up">
          <PhotoSlot src={event.image_url} alt={title} icon={eventIcon(event.kind, 96)} tone={eventTone(event.kind)} contain className="aspect-square w-full" />
          <div className="p-7">
            <p className="text-xl leading-relaxed text-cream/90">{loc(event, 'description', lang)}</p>
            <p className={`mt-6 inline-flex rounded-full px-5 py-2 text-lg font-bold ${isFull ? 'bg-red-900/80 text-red-100' : 'bg-cream text-bottle-900'}`} data-testid="seats-left">
              {isFull ? t('events.full') : t('events.seatsLeft', { count: event.seats_left })}
            </p>
          </div>
        </aside>

        {isFull ? (
          <section className="card grid place-items-center p-10 text-center animate-fade-up" data-testid="event-full">
            <div>
              <CalendarHeart size={72} className="mx-auto text-gold" />
              <h2 className="h2 mt-6 text-3xl">{t('events.fullTitle')}</h2>
              <p className="mt-4 text-xl text-cream/80">{t('events.fullText')}</p>
              <button type="button" className="btn-gold mt-8 text-xl" onClick={() => navigate('/evenements')}>
                {t('events.title')}
              </button>
            </div>
          </section>
        ) : (
          <form className="card space-y-5 p-7 animate-fade-up" onSubmit={submit} noValidate data-testid="register-form">
            <h2 className="h2">{t('events.form.title')}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label={t('events.form.firstName')} value={form.first} onChange={(e) => set('first', e.target.value)} error={errors.first} autoComplete="off" maxLength={80} name="first" />
              <TextField label={t('events.form.lastName')} value={form.last} onChange={(e) => set('last', e.target.value)} error={errors.last} autoComplete="off" maxLength={80} name="last" />
            </div>
            <TextField
              label={t('events.form.email')}
              type="email"
              inputMode="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              autoComplete="off"
              autoCapitalize="none"
              maxLength={254}
              name="email"
            />
            <Stepper label={t('events.form.seats')} value={Math.min(form.seats, maxSeats)} min={1} max={maxSeats} onChange={(v) => set('seats', v)} />
            <CheckRow checked={form.consent} onChange={(v) => set('consent', v)} error={errors.consent} testId="consent">
              {t('events.form.consent')} <strong className="text-gold">({t('common.required')})</strong>
            </CheckRow>
            <CheckRow checked={form.newsletter} onChange={(v) => set('newsletter', v)} testId="newsletter">
              {t('events.form.newsletter')} <span className="text-cream/60">({t('common.optional')})</span>
            </CheckRow>
            {fullMsg && (
              <p className="rounded-2xl bg-red-900/40 p-4 text-lg font-bold text-red-100" data-testid="full-msg">
                {t('events.fullTitle')} {fullMsg}
              </p>
            )}
            {failed && <p className="rounded-2xl bg-red-900/40 p-4 text-lg font-bold text-red-100">{t('common.error')}</p>}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <PrivacyLink />
              <button type="submit" className="btn-gold min-w-[280px] text-xl" disabled={busy} data-testid="register-submit">
                {t('events.form.submit')}
              </button>
            </div>
          </form>
        )}
      </div>

      {result && (
        <SuccessOverlay
          title={t('events.confirmTitle')}
          icon={<PartyPopper size={52} />}
          onClose={() => {
            setResult(null);
            navigate('/evenements');
          }}
        >
          {result.kind === 'ok' ? (
            <>
              <p>{t('events.confirmText', { event: title, count: result.seats })}</p>
              <p className="text-gold-300">{t('events.confirmWhen', { when: confirmWhen })}</p>
            </>
          ) : (
            <p>{t('events.confirmQueued', { event: title })}</p>
          )}
          <p className="text-base text-cream/60">{t('events.cleared')}</p>
        </SuccessOverlay>
      )}
    </Page>
  );
}
