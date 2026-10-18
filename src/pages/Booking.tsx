import { CalendarCheck, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { QrCode } from '../components/QrCode';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';

/** Prise de rendez-vous via Salonkee : un QR code, aucune donnée saisie sur la tablette. */
export default function Booking() {
  const { t } = useTranslation();
  const { content } = useApp();
  const url = content?.settings.salonkee_url ?? '';
  return (
    <Page>
      <PageHeader title={t('booking.title')} eyebrow="Salonkee" back="/nos-services" />
      <div className="card grid items-center gap-10 p-8 md:grid-cols-[auto_1fr] md:p-12 animate-fade-up">
        <QrCode value={url} size={340} className="mx-auto" />
        <div>
          <CalendarCheck size={56} className="text-gold" />
          <h2 className="mt-4 text-4xl font-black uppercase leading-tight tracking-wide">{t('booking.text')}</h2>
          <p className="mt-4 text-xl text-cream/80">{t('booking.sub')}</p>
          <p className="mt-6 text-lg font-bold text-gold-300">{t('common.scanMe')}</p>
          <p className="mt-8 flex items-center gap-3 text-base text-cream/60">
            <ShieldCheck size={22} /> {t('booking.privacy')}
          </p>
        </div>
      </div>
    </Page>
  );
}
