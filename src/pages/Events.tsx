import { Repeat, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PhotoSlot } from '../components/PhotoSlot';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { formatEventDate, formatTime, loc } from '../lib/loc';
import { eventIcon, eventTone } from './eventVisuals';

export default function Events() {
  const { t } = useTranslation();
  const { content, lang, refreshEvents } = useApp();
  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);
  const events = content?.events ?? [];

  return (
    <Page>
      <PageHeader title={t('events.title')} eyebrow={t('events.subtitle')} back="/cutshop" />
      {events.length === 0 && <p className="card p-10 text-center text-2xl text-cream/80">{t('events.none')}</p>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="event-list">
        {events.map((e, i) => {
          const full = e.seats_left <= 0;
          return (
            <Link
              key={e.id}
              to={`/evenements/${e.id}`}
              className="card group flex flex-col overflow-hidden transition active:scale-[0.98]"
              style={{ animation: `fade-up 0.45s ease-out ${Math.min(i, 8) * 0.04}s both` }}
              data-testid="event-card"
            >
              <div className="relative">
                <PhotoSlot src={e.image_url} alt={loc(e, 'title', lang)} icon={eventIcon(e.kind, 72)} tone={eventTone(e.kind)} className="h-40 w-full" />
                <span className="absolute left-4 top-4 rounded-2xl bg-bottle-950/85 px-4 py-2 text-center backdrop-blur">
                  <span className="block text-sm font-bold uppercase tracking-wider text-gold">{formatEventDate(e.starts_at, lang).split(' ')[0]}</span>
                  <span className="block text-lg font-black">{formatTime(e.starts_at, lang)}</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="text-2xl font-black uppercase tracking-wide">{loc(e, 'title', lang)}</h2>
                <p className="mt-1 text-lg font-bold text-gold-300">{formatEventDate(e.starts_at, lang)}</p>
                <p className="mt-3 text-lg text-cream/80">{loc(e, 'description', lang)}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base">
                  <span className={`flex items-center gap-2 font-bold ${full ? 'text-red-300' : 'text-cream'}`} data-testid="card-seats">
                    <Users size={18} /> {full ? t('events.full') : t('events.seatsLeft', { count: e.seats_left })}
                  </span>
                  {loc(e, 'recurrence', lang) && (
                    <span className="flex items-center gap-2 text-cream/60">
                      <Repeat size={18} /> {loc(e, 'recurrence', lang)}
                    </span>
                  )}
                </div>
                <span className={`mt-auto w-full pt-5`}>
                  <span className={`${full ? 'btn-ghost' : 'btn-gold'} w-full`}>{full ? t('events.full') : t('events.register')}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
