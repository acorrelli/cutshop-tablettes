import { useEffect, useMemo, useState } from 'react';
import { api, type StatsRows } from '../../lib/api';
import { TABLET_NAMES } from '../../lib/tablet';
import type { CutEvent } from '../../lib/types';
import { AdminCard, fmtDateTime } from '../Crud';

const DAY = 86400000;

function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('/').length === 3 ? key.split('/') : key.split(/\D/);
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))));
}

type Metric = 'battles' | 'solo' | 'stop10' | 'kids' | 'registrations' | 'spins' | 'productRequests';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'battles', label: 'Quiz Cutshop' },
  { key: 'solo', label: 'Quiz solo' },
  { key: 'stop10', label: 'Stop à 10 s' },
  { key: 'kids', label: 'Jeux kids' },
  { key: 'registrations', label: 'Inscriptions' },
  { key: 'spins', label: 'Tours de roue' },
  { key: 'productRequests', label: 'Demandes produits' },
];

function bucket(rows: StatsRows) {
  // Compte par jour et par tablette. Les Battles sont comptées une fois par partie (ref commune).
  const out = new Map<string, Map<string, Record<Metric, number>>>();
  const seenBattle = new Set<string>();
  const add = (iso: string, tablet: string, metric: Metric, n = 1) => {
    const d = dayKey(iso);
    if (!out.has(d)) out.set(d, new Map());
    const byTab = out.get(d)!;
    if (!byTab.has(tablet)) byTab.set(tablet, { battles: 0, solo: 0, stop10: 0, kids: 0, registrations: 0, spins: 0, productRequests: 0 });
    byTab.get(tablet)![metric] += n;
  };
  for (const p of rows.plays) {
    if (p.game === 'battle') {
      const k = p.ref ?? p.id;
      if (seenBattle.has(k)) continue;
      seenBattle.add(k);
      add(p.created_at, p.tablet, 'battles');
    } else if (p.game === 'battle_solo') add(p.created_at, p.tablet, 'solo');
    else if (p.game === 'stop10') add(p.created_at, p.tablet, 'stop10');
    else if (p.game === 'memory' || p.game === 'barber') add(p.created_at, p.tablet, 'kids');
  }
  for (const r of rows.registrations) add(r.created_at, r.tablet, 'registrations');
  for (const s of rows.spins) add(s.created_at, s.tablet, 'spins');
  for (const r of rows.productRequests) add(r.created_at, r.tablet, 'productRequests');
  return out;
}

export function StatsSection() {
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState<StatsRows | null>(null);
  const [events, setEvents] = useState<CutEvent[]>([]);
  useEffect(() => {
    setRows(null);
    void api.statsSince(new Date(Date.now() - days * DAY).toISOString()).then(setRows);
    void api.adminList('events').then(setEvents);
  }, [days]);

  const data = useMemo(() => (rows ? bucket(rows) : null), [rows]);
  const tablets = useMemo(() => {
    const set = new Set<string>(TABLET_NAMES);
    data?.forEach((byTab) => byTab.forEach((_, t) => set.add(t)));
    return Array.from(set).filter(Boolean);
  }, [data]);

  const totals = useMemo(() => {
    const tot: Record<Metric, number> = { battles: 0, solo: 0, stop10: 0, kids: 0, registrations: 0, spins: 0, productRequests: 0 };
    data?.forEach((byTab) => byTab.forEach((m) => METRICS.forEach(({ key }) => (tot[key] += m[key]))));
    return tot;
  }, [data]);

  const perEvent = useMemo(() => {
    const map = new Map<string, number>();
    rows?.registrations.forEach((r) => map.set(r.event_id, (map.get(r.event_id) ?? 0) + r.seats));
    return events
      .filter((e) => map.has(e.id))
      .map((e) => ({ e, seats: map.get(e.id)! }))
      .sort((a, b) => a.e.starts_at.localeCompare(b.e.starts_at));
  }, [rows, events]);

  const dayKeys = data ? Array.from(data.keys()).sort().reverse() : [];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 14, 30, 90].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)} className={`min-h-[48px] rounded-xl px-4 font-bold ${days === d ? 'bg-gold text-bottle-950' : 'bg-white/10'}`}>
            {d} jours
          </button>
        ))}
      </div>
      {!data ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {METRICS.map((m) => (
              <div key={m.key} className="rounded-2xl bg-bottle-800/60 p-4 ring-1 ring-cream/10">
                <p className="text-xs font-bold uppercase tracking-wider text-cream/60">{m.label}</p>
                <p className="mt-1 text-3xl font-black text-gold" data-testid={`stat-${m.key}`}>
                  {totals[m.key]}
                </p>
              </div>
            ))}
          </div>

          <AdminCard title="Par jour et par tablette">
            {dayKeys.length === 0 ? (
              <p className="text-cream/60">Aucune activité sur la période.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase text-cream/50">
                      <th className="px-2 py-2">Jour</th>
                      <th className="px-2 py-2">Tablette</th>
                      {METRICS.map((m) => (
                        <th key={m.key} className="px-2 py-2 text-right">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayKeys.flatMap((d) =>
                      tablets
                        .filter((t) => data.get(d)!.has(t))
                        .map((t, i) => {
                          const m = data.get(d)!.get(t)!;
                          return (
                            <tr key={`${d}${t}`} className={i === 0 ? 'border-t border-cream/10' : ''}>
                              <td className="px-2 py-2 font-bold">{i === 0 ? dayLabel(d) : ''}</td>
                              <td className="px-2 py-2">{t}</td>
                              {METRICS.map((x) => (
                                <td key={x.key} className={`px-2 py-2 text-right tabular-nums ${m[x.key] ? '' : 'text-cream/30'}`}>
                                  {m[x.key]}
                                </td>
                              ))}
                            </tr>
                          );
                        }),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>

          <AdminCard title="Inscriptions par événement">
            {perEvent.length === 0 ? (
              <p className="text-cream/60">Aucune inscription sur la période.</p>
            ) : (
              <ul className="space-y-2">
                {perEvent.map(({ e, seats }) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <span className="w-64 truncate font-bold">
                      {e.title_fr} <span className="text-xs text-cream/50">{fmtDateTime(e.starts_at)}</span>
                    </span>
                    <span className="h-4 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${Math.min(100, (seats / Math.max(1, e.capacity)) * 100)}%` }} />
                    </span>
                    <span className="w-24 text-right tabular-nums">
                      {seats} / {e.capacity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </>
      )}
    </div>
  );
}
