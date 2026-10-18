import { ChevronRight, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { Tile } from "../components/Tile";
import { Page, PageHeader } from "../components/ui";
import { useApp } from "../context/AppContext";
import { ARCADE_BG, ARCADE_CARDS, ARCADE_LOGO } from "../arcade/assets";
import { CATEGORIES, MODULE_TILES, type CategoryKey } from "../lib/tiles";

/** Page d'une catégorie de l'accueil : les modules qu'elle regroupe. */
export default function Category({ category }: { category: CategoryKey }) {
  const { t } = useTranslation();
  const { content } = useApp();
  const def = CATEGORIES.find((c) => c.key === category)!;
  const modules = content?.settings.modules;
  const items = def.items
    .filter((k) => (modules ? modules[k] : k !== "wheel"))
    .map((k) => MODULE_TILES[k])
    .filter(Boolean);
  if (items.length === 0) return <Navigate to="/" replace />;
  if (items.length === 1) return <Navigate to={items[0].to} replace />;
  const featured = items.find((m) => m.key === "arcade");
  const rest = featured ? items.filter((m) => m !== featured) : items;
  const cols = featured
    ? rest.length >= 4
      ? "sm:grid-cols-2"
      : "sm:grid-cols-1"
    : items.length === 4
      ? "sm:grid-cols-2 lg:grid-cols-2"
      : items.length === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2 lg:grid-cols-2";

  const grid = (
    <div
      className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-4 ${cols}`}
      data-testid="category-tiles"
    >
      {rest.map((m, i) => (
        <Tile
          key={m.key}
          to={m.to}
          icon={m.icon}
          tone={m.tone}
          title={t(`tiles.${m.key}.title`)}
          sub={t(`tiles.${m.key}.sub`)}
          index={i + (featured ? 1 : 0)}
          testId={`tile-${m.key}`}
          center={!featured}
          inline={Boolean(featured)}
          className={
            featured
              ? "min-h-[150px] lg:landscape:min-h-0"
              : "min-h-[180px] lg:landscape:min-h-0"
          }
        />
      ))}
    </div>
  );

  return (
    <Page className="flex flex-col lg:landscape:h-[calc(100dvh-76px)] lg:landscape:pb-4">
      <PageHeader title={t(`categories.${category}.title`)} />
      <p className="-mt-2 mb-5 max-w-4xl text-xl text-cream/80">
        {t(`categories.${category}.sub`)}
      </p>
      {featured ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Link
            to={featured.to}
            data-testid={`tile-${featured.key}`}
            className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl bg-[#0B110E] p-5 shadow-tile ring-1 ring-white/10 transition active:scale-[0.98]"
            style={{
              animation: "fade-up 0.45s ease-out both",
              backgroundImage: `linear-gradient(180deg, rgba(6,16,12,0.55), rgba(6,16,12,0.92)), url(${ARCADE_BG})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="flex flex-1 flex-col justify-center">
              <img
                src={ARCADE_LOGO}
                alt={t("tiles.arcade.title")}
                className="mx-auto h-28 w-auto drop-shadow-[0_0_18px_rgba(124,227,160,0.35)]"
                draggable={false}
              />
              <div className="mt-4 grid grid-cols-4 gap-2">
                {ARCADE_CARDS.map((c) => (
                  <img
                    key={c.key}
                    src={c.src}
                    alt=""
                    draggable={false}
                    className="aspect-[163/185] w-full rounded-2xl object-cover ring-1 ring-white/10"
                  />
                ))}
              </div>
            </div>
            <div className="flex items-end justify-between gap-4 pt-4">
              <div>
                <p className="text-base font-bold text-cream/80">
                  {t("tiles.arcade.sub")}
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#9BE7B5]">
                  <Trophy size={18} /> {t("arcade.challenge.title")}
                </p>
              </div>
              <span className="btn-gold shrink-0">
                {t("arcade.play")} <ChevronRight size={22} />
              </span>
            </div>
          </Link>
          {grid}
        </div>
      ) : (
        grid
      )}
    </Page>
  );
}
