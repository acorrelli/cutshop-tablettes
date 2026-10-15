import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Tile } from '../components/Tile';
import { Page } from '../components/ui';
import { useApp } from '../context/AppContext';
import { formatEventDate, formatTime, loc } from '../lib/loc';
import { CATEGORIES, MODULE_TILES } from '../lib/tiles';

export default function Home() {
  const { t } = useTranslation();
  const { content, lang, largeText } = useApp();
  // En paysage sur tablette, l'accueil tient sur un seul écran (sauf en mode grand texte, où l'on fait défiler).
  const fit = !largeText;
  const modules = content?.settings.modules;
  const on = (k: string) => (modules ? modules[k as keyof typeof modules] : k !== 'wheel');
  const categories = CATEGORIES.map((c) => ({ ...c, visible: c.items.filter(on) })).filter((c) => c.visible.length > 0);
  const direct = [MODULE_TILES.booking, MODULE_TILES.invoice].filter((d) => on(d.key));
  const next = modules?.events !== false ? content?.events.find((e) => e.seats_left > 0) ?? content?.events[0] : undefined;

  return (
    <Page className={`flex flex-col pt-4 ${fit ? 'lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4' : ''}`}>
      {next ? (
        <Link
          to={`/evenements/${next.id}`}
          className="card mb-4 flex shrink-0 items-center gap-5 overflow-hidden p-3 pl-4 pr-4 animate-fade-up"
          data-testid="next-event-banner"
        >
          <span className="hidden rounded-2xl bg-gold/15 px-4 py-3 text-center sm:block">
            <span className="block text-xs font-bold uppercase tracking-[0.2em] text-gold">{t('home.nextEvent')}</span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow sm:hidden">{t('home.nextEvent')}</p>
            <p className="text-xl font-black uppercase leading-tight tracking-wide sm:text-2xl">{loc(next, 'title', lang)}</p>
            <p className="text-lg text-cream/75">
              {t('events.at', { date: formatEventDate(next.starts_at, lang), time: formatTime(next.starts_at, lang) })}
            </p>
          </div>
          <span className="btn-gold shrink-0 text-lg">
            {t('home.register')} <ChevronRight size={24} />
          </span>
        </Link>
      ) : (
        <p className="mb-4 shrink-0 text-2xl font-bold text-cream/80 animate-fade-up">{t('home.greeting')}</p>
      )}

      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-3 ${fit ? 'min-h-0 flex-1 auto-rows-fr' : ''}`} data-testid="tiles">
        {categories.map((c, i) => (
          <Tile
            key={c.key}
            to={c.to}
            icon={c.icon}
            tone={c.tone}
            title={t(`categories.${c.key}.title`)}
            sub={t(`categories.${c.key}.sub`)}
            index={i}
            testId={`cat-${c.key}`}
            className={fit ? 'lg:landscape:min-h-0' : ''}
          >
            {c.key !== 'social' && (
              <span className="mt-2.5 flex flex-wrap gap-1.5">
                {c.visible.map((k) => (
                  <span key={k} className="rounded-full bg-black/20 px-2.5 py-0.5 text-[0.8rem] font-bold ring-1 ring-white/15">
                    {t(`tiles.${k}.title`)}
                  </span>
                ))}
              </span>
            )}
          </Tile>
        ))}
        {direct.map((d, i) => (
          <Tile
            key={d.key}
            to={d.to}
            icon={d.icon}
            tone={d.tone}
            title={t(`tiles.${d.key}.title`)}
            sub={t(`tiles.${d.key}.sub`)}
            index={categories.length + i}
            testId={`tile-${d.key}`}
            className={fit ? 'lg:landscape:min-h-0' : ''}
          />
        ))}
      </div>
    </Page>
  );
}
