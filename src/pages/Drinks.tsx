import { Beer, Coffee, CupSoda, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhotoSlot } from '../components/PhotoSlot';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { formatPrice, loc } from '../lib/loc';
import type { DrinkCategory } from '../lib/types';

const CATS: { key: DrinkCategory; icon: typeof Beer }[] = [
  { key: 'beer', icon: Beer },
  { key: 'soft', icon: CupSoda },
  { key: 'other', icon: Coffee },
];

export default function Drinks() {
  const { t } = useTranslation();
  const { content, lang } = useApp();
  const [cat, setCat] = useState<DrinkCategory>('beer');
  const [pairing, setPairing] = useState<string | null>(null);
  if (!content) return null;
  const drinks = content.drinks.filter((d) => d.category === cat);
  const chosen = content.pairings.find((p) => p.id === pairing);
  const abvLabel = (abv: number) => t('drinks.abv', { abv: lang === 'fr' ? String(abv).replace('.', ',') : String(abv) });

  return (
    <Page>
      <PageHeader title={t('drinks.title')} back="/boissons-produits" />

      {content.pairings.length > 0 && (
        <section className="card mb-6 overflow-hidden p-6 animate-fade-up" data-testid="pairing">
          <div className="flex flex-wrap items-center gap-4">
            <Sparkles className="text-gold" size={32} />
            <div className="mr-auto">
              <h2 className="h2">{t('drinks.pairingTitle')}</h2>
              <p className="text-lg text-cream/75">{t('drinks.pairingIntro')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {content.pairings.map((p) => (
              <button key={p.id} type="button" className={`chip ${pairing === p.id ? 'chip-on' : ''}`} onClick={() => setPairing(p.id)}>
                {loc(p, 'cut', lang)}
              </button>
            ))}
          </div>
          {chosen && (
            <div key={chosen.id} className="mt-5 rounded-2xl bg-gold/15 p-5 animate-pop">
              <p className="text-2xl font-black uppercase text-gold-300">{loc(chosen, 'drink', lang)}</p>
              <p className="mt-1 text-xl italic text-cream/90">« {loc(chosen, 'line', lang)} »</p>
            </div>
          )}
        </section>
      )}

      <div className="mb-5 flex flex-wrap gap-3" role="tablist">
        {CATS.filter(({ key }) => content.drinks.some((d) => d.category === key)).map(({ key, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={cat === key} className={`chip gap-3 ${cat === key ? 'chip-on' : ''}`} onClick={() => setCat(key)} data-testid={`drinks-${key}`}>
            <Icon size={24} /> {t(`drinks.categories.${key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {drinks.map((d, i) => {
          const style = loc(d, 'style', lang);
          return (
            <article key={d.id} className="card flex overflow-hidden" style={{ animation: `fade-up 0.4s ease-out ${i * 0.03}s both` }}>
              <PhotoSlot src={d.image_url} alt={d.name} icon={cat === 'beer' ? <Beer size={44} /> : cat === 'soft' ? <CupSoda size={44} /> : <Coffee size={44} />} tone={cat === 'beer' ? 'gold' : 'green'} className="w-36 shrink-0 self-stretch object-center" />
              <div className="flex min-w-0 flex-1 flex-col p-5">
                <h3 className="text-xl font-black uppercase leading-tight tracking-wide">{d.name}</h3>
                <p className="mt-1 text-sm font-bold uppercase tracking-wider text-gold">{d.brand}</p>
                <p className="mt-1 text-base text-cream/70">
                  {[style, d.abv !== null ? (d.abv === 0 ? t('drinks.noAlcohol') : abvLabel(d.abv)) : null].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-2 text-base text-cream/85">{loc(d, 'description', lang)}</p>
                {d.price > 0 && (
                  <span className="mt-auto self-end pt-3">
                    <span className="inline-block rounded-xl bg-cream px-3 py-1 text-lg font-black text-bottle-900">{formatPrice(d.price, lang)}</span>
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-lg font-bold text-cream/80">{t('drinks.order')}</p>
      {cat === 'beer' && <p className="mt-2 text-center text-sm text-cream/50">{t('drinks.moderation')}</p>}
    </Page>
  );
}
