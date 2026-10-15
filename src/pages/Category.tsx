import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { Tile } from '../components/Tile';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { CATEGORIES, MODULE_TILES, type CategoryKey } from '../lib/tiles';

/** Page d'une catégorie de l'accueil : les modules qu'elle regroupe. */
export default function Category({ category }: { category: CategoryKey }) {
  const { t } = useTranslation();
  const { content } = useApp();
  const def = CATEGORIES.find((c) => c.key === category)!;
  const modules = content?.settings.modules;
  const items = def.items.filter((k) => (modules ? modules[k] : k !== 'wheel')).map((k) => MODULE_TILES[k]).filter(Boolean);
  if (items.length === 0) return <Navigate to="/" replace />;
  if (items.length === 1) return <Navigate to={items[0].to} replace />;
  const cols = items.length === 4 ? 'lg:grid-cols-2' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <Page className="flex flex-col lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4">
      <PageHeader title={t(`categories.${category}.title`)} eyebrow={t(`categories.${category}.sub`)} />
      <div className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`} data-testid="category-tiles">
        {items.map((m, i) => (
          <Tile
            key={m.key}
            to={m.to}
            icon={m.icon}
            tone={m.tone}
            title={t(`tiles.${m.key}.title`)}
            sub={t(`tiles.${m.key}.sub`)}
            index={i}
            testId={`tile-${m.key}`}
            className="min-h-[180px] lg:landscape:min-h-0"
          />
        ))}
      </div>
    </Page>
  );
}
