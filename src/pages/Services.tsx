import { CalendarCheck, Clock, Droplets, GraduationCap, Receipt, Scissors, Sparkles, Baby, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { QrCode } from '../components/QrCode';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { formatPrice, loc } from '../lib/loc';
import type { Service, ServiceCategory } from '../lib/types';

const CATS: { key: ServiceCategory; icon: LucideIcon }[] = [
  { key: 'cut', icon: Scissors },
  { key: 'cut_beard', icon: Scissors },
  { key: 'care', icon: Sparkles },
  { key: 'kids', icon: Baby },
];

/** Nos prestations : tarifs classiques et étudiants, réservation via le QR code Salonkee. */
export default function Services() {
  const { t } = useTranslation();
  const { content, lang } = useApp();
  const services = content?.services ?? [];
  const cats = CATS.filter((c) => services.some((s) => s.category === c.key));
  const [cat, setCat] = useState<ServiceCategory>('cut');
  const [booking, setBooking] = useState<Service | null>(null);
  const current = cats.some((c) => c.key === cat) ? cat : cats[0]?.key;
  const list = services.filter((s) => s.category === current);
  const modules = content?.settings.modules;
  const hasStudent = services.some((s) => s.student_price !== null);

  return (
    <Page>
      <PageHeader title={t('services.title')} eyebrow={t('categories.services.title')} back="/nos-services" />
      <p className="-mt-2 mb-5 max-w-4xl text-xl text-cream/80">{t('services.intro')}</p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-3" role="tablist">
          {cats.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={current === key}
              className={`chip gap-3 ${current === key ? 'chip-on' : ''}`}
              onClick={() => setCat(key)}
              data-testid={`services-${key}`}
            >
              <Icon size={24} /> {t(`services.categories.${key}`)}
            </button>
          ))}
        </div>
        {hasStudent && (
          <span className="ml-auto flex items-center gap-2 rounded-full bg-gold/15 px-4 py-2 text-base font-bold text-gold-300 ring-1 ring-gold/40">
            <GraduationCap size={22} /> {t('services.studentLegend')}
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <p className="card p-10 text-center text-2xl">{t('services.none')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="services-list">
          {list.map((s, i) => (
            <article
              key={s.id}
              className="card flex flex-col p-5"
              style={{ animation: `fade-up 0.4s ease-out ${i * 0.03}s both` }}
              data-testid="service-card"
            >
              <div className="flex items-start gap-4">
                <h3 className="min-w-0 flex-1 text-xl font-black uppercase leading-tight tracking-wide">{loc(s, 'name', lang)}</h3>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="rounded-xl bg-cream px-3 py-1 text-lg font-black text-bottle-900">{formatPrice(s.price, lang)}</span>
                  {s.student_price !== null && (
                    <span className="flex items-center gap-1.5 rounded-xl px-3 py-1 text-base font-black text-gold-300 ring-1 ring-gold/50" data-testid="student-price">
                      <GraduationCap size={18} /> {t('services.student')} {formatPrice(s.student_price, lang)}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold uppercase tracking-wider text-gold">
                {s.duration_min !== null && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={16} /> {t('services.minutes', { n: s.duration_min })}
                  </span>
                )}
                {s.shampoo_included !== null && (
                  <span className="flex items-center gap-1.5 text-cream/60">
                    <Droplets size={16} /> {s.shampoo_included ? t('services.shampooYes') : t('services.shampooNo')}
                  </span>
                )}
              </p>
              <p className="mt-2 flex-1 text-base text-cream/85">{loc(s, 'description', lang)}</p>
              {modules?.booking !== false && content?.settings.salonkee_url && (
                <button type="button" className="btn-ghost mt-4 self-end" onClick={() => setBooking(s)} data-testid="service-book">
                  <CalendarCheck size={22} /> {t('services.book')}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-cream/60">{t('services.disclaimer')}</p>
      {modules?.invoice !== false && (
        <div className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="text-lg font-bold">{t('services.invoice')}</p>
          <Link to="/factures" className="btn-gold">
            <Receipt size={22} /> {t('services.invoiceCta')}
          </Link>
        </div>
      )}

      {booking && <BookSheet service={booking} url={content?.settings.salonkee_url ?? ''} onClose={() => setBooking(null)} />}
    </Page>
  );
}

function BookSheet({ service, url, onClose }: { service: Service; url: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const name = loc(service, 'name', lang);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('services.bookTitle')}>
      <div className="card relative grid w-full max-w-3xl items-center gap-8 p-8 md:grid-cols-[auto_1fr] animate-fade-up" onClick={(e) => e.stopPropagation()} data-testid="service-book-sheet">
        <button type="button" className="absolute right-4 top-4 rounded-full p-2 text-cream/70 ring-1 ring-white/15" onClick={onClose} aria-label={t('common.close')}>
          <X size={24} />
        </button>
        <QrCode value={url} size={260} className="mx-auto" />
        <div>
          <p className="eyebrow">{t('services.bookTitle')}</p>
          <h2 className="mt-2 text-3xl font-black uppercase leading-tight tracking-wide">{name}</h2>
          <p className="mt-2 text-xl font-black text-gold">
            {formatPrice(service.price, lang)}
            {service.student_price !== null && (
              <span className="ml-3 text-lg text-gold-300">
                {t('services.student')} {formatPrice(service.student_price, lang)}
              </span>
            )}
          </p>
          <p className="mt-4 text-lg text-cream/85">{t('services.bookText', { name })}</p>
          <p className="mt-4 text-base font-bold text-gold-300">{t('common.scanMe')}</p>
        </div>
      </div>
    </div>
  );
}
