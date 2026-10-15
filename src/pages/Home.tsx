import {
  CalendarCheck,
  FerrisWheel,
  Gift,
  Puzzle,
  Receipt,
  Sparkles,
  SprayCan,
  Swords,
  Ticket,
  Timer,
  Beer,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { InstagramIcon } from '../components/Icons';
import { Page } from '../components/ui';
import { useApp } from '../context/AppContext';
import { formatEventDate, formatTime, loc } from '../lib/loc';
import type { ModuleKey } from '../lib/types';

interface TileDef {
  key: ModuleKey;
  to: string;
  icon: LucideIcon | ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone: string;
}

// Chaque tuile a sa propre ambiance de couleur, dans la palette vert bouteille, or et crème.
const TILES: TileDef[] = [
  { key: 'battle', to: '/battle', icon: Swords, tone: 'from-gold-500 to-gold-700 text-bottle-950' },
  { key: 'events', to: '/evenements', icon: Ticket, tone: 'from-bottle-500 to-bottle-700' },
  { key: 'booking', to: '/rdv', icon: CalendarCheck, tone: 'from-cream-200 to-cream-400 text-bottle-900' },
  { key: 'concept', to: '/concept', icon: Sparkles, tone: 'from-bottle-600 to-bottle-900' },
  { key: 'stop10', to: '/stop10', icon: Timer, tone: 'from-bottle-700 to-bottle-950' },
  { key: 'wheel', to: '/roue', icon: FerrisWheel, tone: 'from-gold-600 to-bottle-800' },
  { key: 'drinks', to: '/boissons', icon: Beer, tone: 'from-gold-700 to-bottle-900' },
  { key: 'products', to: '/produits', icon: SprayCan, tone: 'from-bottle-400 to-bottle-800' },
  { key: 'kids', to: '/kids', icon: Puzzle, tone: 'from-[#2F8F6B] via-[#D4A84B] to-[#C2553F]' },
  { key: 'gift', to: '/cheques', icon: Gift, tone: 'from-cream-300 to-gold-500 text-bottle-900' },
  { key: 'invoice', to: '/factures', icon: Receipt, tone: 'from-bottle-800 to-bottle-950' },
  { key: 'instagram', to: '/instagram', icon: InstagramIcon, tone: 'from-[#6B3A5E] via-[#B8573F] to-[#D4A84B]' },
];

export default function Home() {
  const { t } = useTranslation();
  const { content, lang, largeText } = useApp();
  // En paysage sur tablette, l'accueil tient sur un seul écran (sauf en mode grand texte, où l'on fait défiler).
  const fit = !largeText;
  const modules = content?.settings.modules;
  const tiles = TILES.filter((tile) => (modules ? modules[tile.key] : tile.key !== 'wheel'));
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

      <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 ${fit ? 'min-h-0 flex-1 auto-rows-fr' : ''}`} data-testid="tiles">
        {tiles.map((tile, i) => {
          const Icon = tile.icon;
          // Avec 11 tuiles, la Battle (module phare) prend deux cases pour remplir la grille.
          const wide = tile.key === 'battle' && tiles.length % 4 === 3;
          return (
            <Link
              key={tile.key}
              to={tile.to}
              data-testid={`tile-${tile.key}`}
              className={`group relative flex min-h-[150px] flex-col justify-end overflow-hidden rounded-3xl bg-gradient-to-br p-4 lg:px-5 shadow-tile ring-1 ring-white/10 transition active:scale-[0.97] ${fit ? 'lg:landscape:min-h-0' : ''} ${wide ? 'lg:col-span-2' : ''} ${tile.tone} ${tile.tone.includes('text-') ? '' : 'text-cream'}`}
              style={{ animation: `fade-up 0.45s ease-out ${i * 0.035}s both` }}
            >
              <Icon size={150} strokeWidth={1.1} className="pointer-events-none absolute -right-6 -top-6 opacity-[0.16] transition group-active:rotate-6" />
              <span className="mb-auto grid h-12 w-12 place-items-center rounded-2xl bg-black/20 ring-1 ring-white/15">
                <Icon size={28} strokeWidth={2} />
              </span>
              <span className="mt-3 block text-[1.3rem] font-black uppercase leading-[1.1] tracking-wide">{t(`tiles.${tile.key}.title`)}</span>
              <span className="mt-1 block text-[0.95rem] font-bold opacity-80">{t(`tiles.${tile.key}.sub`)}</span>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
