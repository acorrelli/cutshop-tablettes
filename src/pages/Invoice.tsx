import { Building2, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckRow, Page, PageHeader, PrivacyLink, SuccessOverlay, TextField } from '../components/ui';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';
import { isValidEmail } from '../lib/email';
import { loc } from '../lib/loc';
import { sendOrQueue } from '../lib/queue';
import { validateVat } from '../lib/vat';

const EMPTY = { company: '', vat: '', address: '', email: '', first: '', last: '', consent: false };

export default function Invoice() {
  const { t } = useTranslation();
  const { content, lang, tablet } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'sent' | 'queued'>(null);
  const [failed, setFailed] = useState(false);
  if (!content) return null;
  const s = content.settings;

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const vat = validateVat(form.vat);
    const errs: Record<string, string | null> = {
      company: form.company.trim() ? null : t('invoice.companyErr'),
      vat: vat.valid ? null : vat.reason === 'checksum' ? t('invoice.vatChecksum') : t('invoice.vatErr'),
      address: form.address.trim() ? null : t('invoice.addressErr'),
      email: isValidEmail(form.email) ? null : t('events.errors.email'),
      first: form.first.trim() ? null : t('events.errors.firstName'),
      last: form.last.trim() ? null : t('events.errors.lastName'),
      consent: form.consent ? null : t('events.errors.consent'),
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean) || !vat.valid) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await sendOrQueue(() =>
        api.submitInvoiceRequest({
          company: form.company.trim(),
          vat: vat.normalized,
          address: form.address.trim(),
          email: form.email.trim().toLowerCase(),
          first_name: form.first.trim(),
          last_name: form.last.trim(),
          consent: true,
          tablet: tablet ?? '',
        }),
      );
      // Effacement immédiat des champs à l'écran.
      setForm(EMPTY);
      setDone(res.status);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={t('tiles.invoice.title')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <section className="card relative overflow-hidden p-8 animate-fade-up">
          <Building2 size={200} strokeWidth={0.8} className="pointer-events-none absolute -bottom-8 -right-8 text-gold opacity-10" />
          <h2 className="text-3xl font-black uppercase leading-tight tracking-wide text-gold">{loc(s, 'invoice_title', lang)}</h2>
          <p className="mt-6 text-xl leading-relaxed text-cream/90">{loc(s, 'invoice_body', lang)}</p>
          <p className="mt-6 text-lg text-cream/60">{t('invoice.optionalNote')}</p>
        </section>
        <form className="card space-y-5 p-7 animate-fade-up" onSubmit={submit} noValidate data-testid="invoice-form">
          <h2 className="h2">{t('invoice.formTitle')}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={t('invoice.company')} value={form.company} onChange={(e) => set('company', e.target.value)} error={errors.company} autoComplete="off" maxLength={160} name="company" />
            <TextField
              label={t('invoice.vat')}
              placeholder={t('invoice.vatPh')}
              value={form.vat}
              onChange={(e) => set('vat', e.target.value.toUpperCase())}
              error={errors.vat}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={20}
              name="vat"
            />
          </div>
          <TextField label={t('invoice.address')} value={form.address} onChange={(e) => set('address', e.target.value)} error={errors.address} autoComplete="off" maxLength={400} name="address" />
          <TextField
            label={t('invoice.email')}
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
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label={t('invoice.firstName')} value={form.first} onChange={(e) => set('first', e.target.value)} error={errors.first} autoComplete="off" maxLength={80} name="first" />
            <TextField label={t('invoice.lastName')} value={form.last} onChange={(e) => set('last', e.target.value)} error={errors.last} autoComplete="off" maxLength={80} name="last" />
          </div>
          <CheckRow checked={form.consent} onChange={(v) => set('consent', v)} error={errors.consent} testId="invoice-consent">
            {t('invoice.consent')} <strong className="text-gold">({t('common.required')})</strong>
          </CheckRow>
          {failed && <p className="rounded-2xl bg-red-900/40 p-4 text-lg font-bold text-red-100">{t('common.error')}</p>}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <PrivacyLink />
            <button type="submit" className="btn-gold min-w-[260px] text-xl" disabled={busy} data-testid="invoice-submit">
              <Send size={24} /> {t('invoice.submit')}
            </button>
          </div>
        </form>
      </div>
      {done && (
        <SuccessOverlay title={t('invoice.sentTitle')} onClose={() => setDone(null)}>
          <p>{done === 'sent' ? t('invoice.sentText') : t('common.offlineQueued')}</p>
        </SuccessOverlay>
      )}
    </Page>
  );
}
