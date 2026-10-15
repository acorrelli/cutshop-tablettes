import { Beer, Clock, Mail, MapPin, Mic, Phone, Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PhotoSlot } from '../components/PhotoSlot';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { loc } from '../lib/loc';

export default function Concept() {
  const { t } = useTranslation();
  const { content, lang } = useApp();
  if (!content) return null;
  const s = content.settings;
  const paragraphs = loc(s, 'concept_body', lang).split(/\n\s*\n/);

  const blocks = [
    { key: 'barber', title: t('concept.barber'), text: loc(s, 'block_barber', lang), icon: <Scissors size={64} />, photo: s.concept_photo_1 },
    { key: 'bar', title: t('concept.bar'), text: loc(s, 'block_bar', lang), icon: <Beer size={64} />, photo: s.concept_photo_2 },
    { key: 'events', title: t('concept.events'), text: loc(s, 'block_events', lang), icon: <Mic size={64} />, photo: s.concept_photo_3 },
  ];

  return (
    <Page>
      <PageHeader title={t('tiles.concept.title')} eyebrow="Cutshop Mons" />
      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <article className="card p-8 animate-fade-up">
          <h2 className="mb-6 text-3xl font-black uppercase leading-tight tracking-wide text-gold">{loc(s, 'concept_title', lang)}</h2>
          <div className="space-y-5 text-[1.2rem] leading-relaxed text-cream/90">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-8 text-2xl font-black uppercase tracking-wide text-cream">{loc(s, 'concept_tagline', lang)}</p>
        </article>
        <PhotoSlot src={s.concept_photo_1} alt="Cutshop" icon={<Scissors size={110} strokeWidth={1.2} />} className="min-h-[320px] w-full rounded-3xl shadow-tile" />
      </section>

      <section className="mt-6 grid gap-5 md:grid-cols-3">
        {blocks.map((b, i) => (
          <div key={b.key} className="card overflow-hidden" style={{ animation: `fade-up 0.45s ease-out ${0.1 + i * 0.08}s both` }}>
            <PhotoSlot src={b.photo} alt={b.title} icon={b.icon} tone={i === 1 ? 'gold' : i === 2 ? 'dark' : 'green'} className="h-44 w-full" />
            <div className="p-6">
              <h3 className="h2 text-xl">{b.title}</h3>
              <p className="mt-2 text-lg text-cream/80">{b.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card mt-6 grid gap-6 p-8 md:grid-cols-3" data-testid="practical">
        <h2 className="h2 md:col-span-3">{t('concept.practical')}</h2>
        <div className="flex gap-4">
          <MapPin className="shrink-0 text-gold" size={30} />
          <div>
            <p className="font-bold uppercase tracking-wider text-cream/60">{t('concept.address')}</p>
            <p className="text-xl">{s.address}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Clock className="shrink-0 text-gold" size={30} />
          <div>
            <p className="font-bold uppercase tracking-wider text-cream/60">{t('concept.hours')}</p>
            <p className="whitespace-pre-line text-xl">{loc(s, 'hours', lang)}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <Phone className="shrink-0 text-gold" size={30} />
          <div>
            <p className="font-bold uppercase tracking-wider text-cream/60">{t('concept.contact')}</p>
            <p className="text-xl">{s.phone}</p>
            <p className="mt-1 flex items-center gap-2 text-xl">
              <Mail size={20} className="text-gold" /> {s.email}
            </p>
          </div>
        </div>
      </section>
    </Page>
  );
}
