// Classements de Cutshop Challenge : général (points Challenge), par jeu, duels, battles, challenge de la semaine.
import { Crown, Info, Medal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { bestScores, challengeBoard, multiBoard, periodStart, TIE_RULES_EN, TIE_RULES_FR, type BoardEntry } from '../ranking';
import { GAMES } from '../registry';
import { GAME_KEYS, type GameKey, type Period, type ScoreRow } from '../types';
import { formatScore, TableBadge, variantLabel } from './common';

export type BoardKind = 'general' | GameKey | 'duel' | 'battle';
const PERIODS: Period[] = ['today', 'week', 'month', 'all'];

/** Scores depuis une date, rechargés régulièrement et à chaque changement signalé par le serveur. */
export function useScores(since: number): ScoreRow[] | null {
  const { server } = useArcade();
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      server
        .scores(since)
        .then((r) => alive && setRows(r))
        .catch(() => alive && setRows((cur) => cur ?? []));
    void load();
    const id = setInterval(load, 15000);
    const off = server.onChange(() => void load());
    return () => {
      alive = false;
      clearInterval(id);
      off();
    };
  }, [server, since]);
  return rows;
}

export function BoardList({ entries, kind, highlight, limit = 10 }: { entries: BoardEntry[]; kind: BoardKind; highlight?: string | null; limit?: number }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  if (entries.length === 0) return <p className="py-10 text-center text-lg text-cream/60" data-testid="board-empty">{t('arcade.board.empty')}</p>;
  return (
    <ol className="space-y-1.5" data-testid="board-list">
      {entries.slice(0, limit).map((e) => {
        const me = highlight && e.pseudo === highlight;
        const medal = e.position <= 3;
        return (
          <li
            key={`${e.position}-${e.pseudo}`}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ring-1 ${me ? 'bg-[#7CE3A0]/15 ring-[#7CE3A0]/60' : e.position === 1 ? 'bg-gold/10 ring-gold/40' : 'bg-white/[0.04] ring-white/5'}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-black ${medal ? 'bg-gold text-bottle-950' : 'bg-white/10 text-cream'}`}>
              {e.position === 1 ? <Crown size={20} /> : e.position}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-lg font-black text-cream">{e.pseudo}</span>
              <span className="block truncate text-sm text-cream/60">
                {kind === 'general' && t('arcade.board.games', { n: e.detail.games ?? 0 })}
                {(kind === 'duel' || kind === 'battle') && t('arcade.board.wins', { wins: e.detail.wins ?? 0, played: e.detail.played ?? 0 })}
                {e.game && kind !== 'general' && GAMES[e.game].variants.length > 1 && variantLabel(e.game, e.variant ?? '', lang)}
              </span>
            </span>
            {e.table && <TableBadge table={e.table} size="sm" />}
            <span className="min-w-[5.5rem] text-right text-2xl font-black tabular-nums text-gold">
              {formatScore(e.value, lang)}
              <span className="ml-1 text-xs font-bold uppercase text-cream/60">{kind === 'general' || kind === 'duel' || kind === 'battle' ? t('arcade.board.pts') : ''}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TieRules({ kind }: { kind: BoardKind }) {
  const { t } = useTranslation();
  const { lang } = useApp();
  const rules = kind === 'duel' || kind === 'battle' ? (t('arcade.board.multiRules', { returnObjects: true }) as string[]) : lang === 'fr' ? TIE_RULES_FR : TIE_RULES_EN;
  return (
    <details className="mt-3 rounded-2xl bg-white/[0.04] px-4 py-2 text-sm text-cream/70">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-bold text-cream/80">
        <Info size={18} /> {t('arcade.board.howTitle')}
      </summary>
      <p className="mt-1">{t(kind === 'general' ? 'arcade.board.generalHow' : kind === 'duel' ? 'arcade.board.duelHow' : kind === 'battle' ? 'arcade.board.battleHow' : 'arcade.board.gameHow')}</p>
      <p className="mt-2 font-bold text-cream/80">{t('arcade.board.ties')}</p>
      <ol className="ml-5 list-decimal">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </details>
  );
}

export function Leaderboard({ initialKind = 'general' }: { initialKind?: BoardKind }) {
  const { t } = useTranslation();
  const { now, pseudo } = useArcade();
  const [period, setPeriod] = useState<Period>('today');
  const [kind, setKind] = useState<BoardKind>(initialKind);
  const since = useMemo(() => periodStart(period, now()), [period, now]);
  const rows = useScores(since);
  const entries = useMemo(() => {
    if (!rows) return [];
    if (kind === 'general') return challengeBoard(rows);
    if (kind === 'duel' || kind === 'battle') return multiBoard(rows, kind);
    return bestScores(rows, kind);
  }, [rows, kind]);
  const kinds: BoardKind[] = ['general', ...GAME_KEYS, 'duel', 'battle'];

  return (
    <section className="flex min-h-0 flex-col" data-testid="leaderboard">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`min-h-[48px] rounded-xl px-4 text-base font-black uppercase tracking-wide transition ${period === p ? 'bg-[#7CE3A0] text-bottle-950' : 'bg-white/[0.06] text-cream/80'}`}
            data-testid={`period-${p}`}
          >
            {t(`arcade.period.${p}`)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-black uppercase tracking-wide ring-1 transition ${kind === k ? 'bg-gold/20 text-gold-300 ring-gold' : 'bg-transparent text-cream/70 ring-white/10'}`}
            data-testid={`board-${k}`}
          >
            {k === 'general' && <Medal size={16} />}
            {k === 'general' ? t('arcade.board.general') : k === 'duel' ? t('arcade.board.duels') : k === 'battle' ? t('arcade.board.battles') : GAMES[k].title}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {rows === null ? <p className="py-10 text-center text-cream/60">...</p> : <BoardList entries={entries} kind={kind} highlight={pseudo} />}
        <TieRules kind={kind} />
      </div>
    </section>
  );
}
