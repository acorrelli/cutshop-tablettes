// Administration de Cutshop Arcade : jeux actifs, délais, tables, challenge de la semaine, modération des
// scores et pseudos, parties récentes et statistiques anonymisées.
import { Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useArcade } from '../../arcade/ArcadeContext';
import { periodStart } from '../../arcade/ranking';
import { GAMES } from '../../arcade/registry';
import type { AdminRoomRow } from '../../arcade/server/types';
import { DEFAULT_ARCADE_CONFIG, GAME_KEYS, type ArcadeConfig, type GameKey, type ScoreRow, type TableNo, type WeeklyChallenge } from '../../arcade/types';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import type { AppSettings } from '../../lib/types';
import { AdminCard } from '../Crud';

const btn = 'flex min-h-[48px] items-center gap-2 rounded-xl px-4 font-bold disabled:opacity-40';
const input = 'w-full rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-3 py-2.5 outline-none focus:border-gold';
const DASH = /[-–—]/;
const fmt = (ms: number) => new Date(ms).toLocaleString('fr-BE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export function ArcadeSection() {
  const { reloadContent } = useApp();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  useEffect(() => {
    void api.getSettings().then(setSettings);
  }, []);
  const save = async (next: AppSettings) => {
    await api.saveSettings(next);
    setSettings(next);
    await reloadContent();
  };
  if (!settings) return <p>Chargement...</p>;
  return (
    <div className="space-y-6" data-testid="admin-arcade">
      <GamesCard settings={settings} save={save} />
      <TablesCard />
      <ChallengesCard />
      <ScoresCard />
      <RoomsCard />
      <StatsCard />
    </div>
  );
}

function GamesCard({ settings, save }: { settings: AppSettings; save: (s: AppSettings) => Promise<void> }) {
  const cfg: ArcadeConfig = { ...DEFAULT_ARCADE_CONFIG, ...settings.arcade, games: { ...DEFAULT_ARCADE_CONFIG.games, ...settings.arcade?.games } };
  const [timeout, setTimeoutS] = useState(cfg.invite_timeout_s);
  const [maxInv, setMaxInv] = useState(cfg.invite_max_per_2min);
  const [idle, setIdle] = useState(settings.idle_seconds ?? 60);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (g: GameKey) => void save({ ...settings, arcade: { ...cfg, games: { ...cfg.games, [g]: !cfg.games[g] } } });

  return (
    <AdminCard title="Jeux et délais">
      <p className="mb-3 text-sm text-cream/60">Un jeu désactivé disparaît de l’Arcade et ne peut plus être lancé, ni en solo ni en défi.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {GAME_KEYS.map((g) => {
          const on = cfg.games[g];
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              className={`flex min-h-[64px] items-center justify-between rounded-2xl px-5 text-left font-bold ${on ? 'bg-gold/20 ring-2 ring-gold' : 'bg-white/[0.06]'}`}
              data-testid={`arcade-game-${g}`}
            >
              {GAMES[g].title}
              <span className={`relative h-8 w-14 rounded-full ${on ? 'bg-gold' : 'bg-white/20'}`}>
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-cream transition-all ${on ? 'left-7' : 'left-1'}`} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Expiration d’une invitation (secondes)</span>
          <input className={input} type="number" min={15} max={180} value={timeout} onChange={(e) => setTimeoutS(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Invitations maximum par table sur 2 minutes</span>
          <input className={input} type="number" min={1} max={20} value={maxInv} onChange={(e) => setMaxInv(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Mise en veille après inactivité (secondes)</span>
          <input className={input} type="number" min={30} max={600} value={idle} onChange={(e) => setIdle(Number(e.target.value))} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className={`${btn} bg-gold text-bottle-950`}
          onClick={async () => {
            const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v) || a));
            await save({
              ...settings,
              idle_seconds: clamp(idle, 30, 600),
              arcade: { ...cfg, invite_timeout_s: clamp(timeout, 15, 180), invite_max_per_2min: clamp(maxInv, 1, 20) },
            });
            setMsg('Réglages enregistrés.');
          }}
          data-testid="arcade-save-delays"
        >
          <Save size={18} /> Enregistrer
        </button>
        {msg && <span className="text-sm font-bold text-gold-300">{msg}</span>}
      </div>
      <p className="mt-3 text-sm text-cream/60">La veille est suspendue automatiquement pendant une partie.</p>
    </AdminCard>
  );
}

function TablesCard() {
  const { snapshot, server, table, refresh } = useArcade();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <AdminCard title="Tables">
      <div className="grid gap-3 sm:grid-cols-4">
        {(snapshot?.tables ?? []).map((t) => (
          <div key={t.table} className="rounded-2xl bg-white/[0.06] p-4">
            <p className="text-lg font-black">Table {t.table}</p>
            <p className="text-sm text-cream/70">{t.status === 'offline' ? 'Hors ligne' : t.status === 'available' ? 'Disponible' : t.status === 'playing' ? 'En partie' : 'Dans un lobby'}</p>
            <p className="text-xs text-cream/50">{t.last_seen ? `Vue à ${fmt(t.last_seen)}` : 'Jamais vue'}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-cream/70">
        Cette tablette : {table ? <strong>Table {table}</strong> : <strong>non associée</strong>}.
        {server.kind === 'demo'
          ? ' En démonstration, la table est déduite du nom de la tablette (Tablette 1 à 4, rubrique Réglages).'
          : ' Chaque tablette est identifiée par un jeton secret : l’associer ici à sa table empêche toute usurpation depuis l’interface client.'}
      </p>
      {server.kind === 'supabase' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {([1, 2, 3, 4] as TableNo[]).map((n) => (
            <button
              key={n}
              type="button"
              className={`${btn} ${table === n ? 'bg-gold text-bottle-950' : 'bg-white/10'}`}
              onClick={async () => {
                try {
                  await server.adminPairDevice(n);
                  await refresh();
                  setMsg(`Tablette associée à la table ${n}.`);
                } catch (e) {
                  setMsg(errText(e));
                }
              }}
            >
              Associer à la table {n}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-bold text-gold-300">{msg}</p>}
    </AdminCard>
  );
}

const EMPTY_CHALLENGE = (): WeeklyChallenge => {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59);
  return {
    id: `c${Date.now().toString(36)}`,
    game: 'pour',
    title_fr: '',
    title_en: '',
    description_fr: '',
    description_en: '',
    reward_fr: '',
    reward_en: '',
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    active: true,
  };
};

const toLocal = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ChallengesCard() {
  const { server } = useArcade();
  const [list, setList] = useState<WeeklyChallenge[]>([]);
  const [edit, setEdit] = useState<WeeklyChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => void server.challenges().then(setList).catch((e) => setError(errText(e))), [server]);
  useEffect(load, [load]);

  const textFields: [keyof WeeklyChallenge, string][] = [
    ['title_fr', 'Titre (FR)'],
    ['title_en', 'Titre (EN)'],
    ['description_fr', 'Description (FR)'],
    ['description_en', 'Description (EN)'],
    ['reward_fr', 'Récompense (FR)'],
    ['reward_en', 'Récompense (EN)'],
  ];
  const dashes = edit ? textFields.filter(([k]) => DASH.test(String(edit[k]))).map(([, l]) => l) : [];

  return (
    <AdminCard
      title="Challenge de la semaine"
      actions={
        <button type="button" className={`${btn} bg-gold text-bottle-950`} onClick={() => setEdit(EMPTY_CHALLENGE())} data-testid="challenge-new">
          <Plus size={18} /> Nouveau challenge
        </button>
      }
    >
      <p className="mb-3 text-sm text-cream/60">Le challenge actif dont les dates couvrent aujourd’hui est mis en avant dans l’Arcade, avec son classement (meilleurs scores solo sur la période).</p>
      {list.length === 0 && <p className="text-cream/60">Aucun challenge.</p>}
      <ul className="space-y-2">
        {list
          .slice()
          .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
          .map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-black">
                  {c.title_fr} <span className="text-sm font-bold text-cream/60">· {GAMES[c.game].title}</span>
                </span>
                <span className="text-sm text-cream/60">
                  Du {fmt(Date.parse(c.starts_at))} au {fmt(Date.parse(c.ends_at))} · {c.reward_fr} · {c.active ? 'actif' : 'inactif'}
                </span>
              </span>
              <button type="button" className={`${btn} bg-white/10`} onClick={() => setEdit({ ...c })} aria-label="Modifier">
                <Pencil size={18} />
              </button>
              <button
                type="button"
                className={`${btn} bg-red-900/60`}
                aria-label="Supprimer"
                onClick={async () => {
                  if (!confirm(`Supprimer le challenge « ${c.title_fr} » ?`)) return;
                  await server.adminDeleteChallenge(c.id).catch((e) => setError(errText(e)));
                  load();
                }}
              >
                <Trash2 size={18} />
              </button>
            </li>
          ))}
      </ul>
      {error && <p className="mt-2 text-sm font-bold text-red-300">{error}</p>}

      {edit && (
        <div className="mt-4 space-y-3 rounded-2xl bg-bottle-950/60 p-4 ring-1 ring-gold/40" data-testid="challenge-form">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Jeu</span>
              <select className={input} value={edit.game} onChange={(e) => setEdit({ ...edit, game: e.target.value as GameKey })}>
                {GAME_KEYS.map((g) => (
                  <option key={g} value={g}>
                    {GAMES[g].title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Début</span>
              <input className={input} type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => e.target.value && setEdit({ ...edit, starts_at: new Date(e.target.value).toISOString() })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Fin</span>
              <input className={input} type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => e.target.value && setEdit({ ...edit, ends_at: new Date(e.target.value).toISOString() })} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {textFields.map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-sm font-bold">{label}</span>
                <input className={input} value={String(edit[k])} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} data-testid={`challenge-${k}`} />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-3 font-bold">
            <input type="checkbox" className="h-6 w-6 accent-[#D4A84B]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Challenge actif
          </label>
          {dashes.length > 0 && <p className="text-sm font-bold text-gold-300">Tiret détecté : {dashes.join(', ')}. La charte évite les tirets.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btn} bg-gold text-bottle-950`}
              disabled={!edit.title_fr.trim() || Date.parse(edit.ends_at) <= Date.parse(edit.starts_at)}
              onClick={async () => {
                try {
                  await server.adminSaveChallenge({ ...edit, title_en: edit.title_en || edit.title_fr, description_en: edit.description_en || edit.description_fr, reward_en: edit.reward_en || edit.reward_fr });
                  setEdit(null);
                  load();
                } catch (e) {
                  setError(errText(e));
                }
              }}
              data-testid="challenge-save"
            >
              <Save size={18} /> Enregistrer
            </button>
            <button type="button" className={`${btn} bg-white/10`} onClick={() => setEdit(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </AdminCard>
  );
}

function ScoresCard() {
  const { server } = useArcade();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [game, setGame] = useState<GameKey | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => void server.adminScores(300).then(setRows).catch((e) => setMsg(errText(e))), [server]);
  useEffect(load, [load]);
  const shown = rows.filter((r) => game === 'all' || r.game === game).slice(0, 100);

  return (
    <AdminCard title="Scores et pseudos">
      <div className="flex flex-wrap gap-2">
        {(['all', ...GAME_KEYS] as const).map((g) => (
          <button key={g} type="button" className={`${btn} ${game === g ? 'bg-gold text-bottle-950' : 'bg-white/10'}`} onClick={() => setGame(g)}>
            {g === 'all' ? 'Tous' : GAMES[g].title}
          </button>
        ))}
      </div>
      <div className="mt-3 max-h-[420px] overflow-y-auto rounded-2xl bg-bottle-950/40">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-bottle-900 text-cream/70">
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Pseudo</th>
              <th className="p-2">Jeu</th>
              <th className="p-2">Mode</th>
              <th className="p-2">Table</th>
              <th className="p-2 text-right">Score</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-2">{fmt(r.created_at)}</td>
                <td className="p-2 font-bold">{r.pseudo}</td>
                <td className="p-2">
                  {GAMES[r.game].title}
                  {GAMES[r.game].variants.length > 1 && ` (${r.variant})`}
                </td>
                <td className="p-2">{r.mode === 'solo' ? 'Solo' : `${r.mode === 'duel' ? 'Duel' : 'Battle'}, ${r.rank}e`}</td>
                <td className="p-2">{r.table}</td>
                <td className="p-2 text-right font-black">{r.score}</td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    className="rounded-lg bg-red-900/60 p-2"
                    aria-label="Supprimer le score"
                    onClick={async () => {
                      if (!confirm(`Supprimer le score ${r.score} de ${r.pseudo} ?`)) return;
                      await server.adminDeleteScore(r.id).catch((e) => setMsg(errText(e)));
                      load();
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-cream/60">
                  Aucun score.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input className={input} placeholder="Pseudo à modérer" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input className={input} placeholder="Remplacer par" maxLength={15} value={to} onChange={(e) => setTo(e.target.value)} />
        <button
          type="button"
          className={`${btn} bg-gold text-bottle-950`}
          disabled={!from.trim() || !to.trim()}
          onClick={async () => {
            try {
              const n = await server.adminRenamePseudo(from.trim(), to.trim());
              setMsg(`${n} score(s) renommé(s).`);
              setFrom('');
              setTo('');
              load();
            } catch (e) {
              setMsg(errText(e));
            }
          }}
        >
          Renommer
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${btn} bg-red-900/60`}
          onClick={async () => {
            const label = game === 'all' ? 'TOUS les scores de tous les jeux' : `tous les scores de ${GAMES[game].title}`;
            if (!confirm(`Remettre à zéro ${label} ? Cette action est définitive.`)) return;
            try {
              const n = await server.adminResetScores(game === 'all' ? null : game);
              setMsg(`${n} score(s) supprimé(s).`);
              load();
            } catch (e) {
              setMsg(errText(e));
            }
          }}
          data-testid="arcade-reset"
        >
          <RotateCcw size={18} /> Remettre à zéro {game === 'all' ? 'tous les classements' : GAMES[game].title}
        </button>
        {msg && <span className="text-sm font-bold text-gold-300">{msg}</span>}
      </div>
    </AdminCard>
  );
}

function RoomsCard() {
  const { server } = useArcade();
  const [rooms, setRooms] = useState<AdminRoomRow[]>([]);
  useEffect(() => {
    void server.adminRooms(30).then(setRooms).catch(() => setRooms([]));
  }, [server]);
  const status: Record<AdminRoomRow['status'], string> = { lobby: 'Lobby', playing: 'En cours', finished: 'Terminée', cancelled: 'Annulée' };
  return (
    <AdminCard title="Parties multijoueurs récentes">
      {rooms.length === 0 ? (
        <p className="text-cream/60">Aucune partie.</p>
      ) : (
        <ul className="space-y-2">
          {rooms.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white/[0.06] p-3 text-sm">
              <span className="font-black">
                {GAMES[r.game].title} · {r.mode === 'duel' ? 'Duel' : 'Battle'} · {status[r.status]}
              </span>
              <span className="ml-2 text-cream/60">{fmt(r.created_at)}</span>
              <span className="mt-1 block text-cream/80">
                {r.players
                  .map((p) => `Table ${p.table} ${p.pseudo || ''} (${p.abandoned ? 'abandon' : p.score !== null ? `${p.score} pts, ${p.rank}e` : p.state})`)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

function StatsCard() {
  const { server, now } = useArcade();
  const [rows, setRows] = useState<ScoreRow[]>([]);
  useEffect(() => {
    void server
      .scores(periodStart('month', now()))
      .then(setRows)
      .catch(() => setRows([]));
  }, [server, now]);
  const stats = useMemo(() => {
    const today = periodStart('today', now());
    return GAME_KEYS.map((g) => {
      const list = rows.filter((r) => r.game === g);
      const solo = list.filter((r) => r.mode === 'solo');
      return {
        g,
        today: list.filter((r) => r.created_at >= today).length,
        month: list.length,
        duels: new Set(list.filter((r) => r.mode === 'duel').map((r) => r.room_id)).size,
        battles: new Set(list.filter((r) => r.mode === 'battle').map((r) => r.room_id)).size,
        avg: solo.length ? Math.round(solo.reduce((n, r) => n + r.score, 0) / solo.length) : 0,
        best: list.reduce((m, r) => Math.max(m, r.score), 0),
      };
    });
  }, [rows, now]);
  return (
    <AdminCard title="Statistiques anonymisées (mois en cours)">
      <p className="mb-3 text-sm text-cream/60">Aucune donnée personnelle : seuls des volumes et des moyennes sont affichés.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-cream/70">
            <tr>
              <th className="p-2">Jeu</th>
              <th className="p-2 text-right">Scores aujourd’hui</th>
              <th className="p-2 text-right">Scores ce mois</th>
              <th className="p-2 text-right">Duels</th>
              <th className="p-2 text-right">Battles</th>
              <th className="p-2 text-right">Score solo moyen</th>
              <th className="p-2 text-right">Record</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.g} className="border-t border-white/5">
                <td className="p-2 font-bold">{GAMES[s.g].title}</td>
                <td className="p-2 text-right">{s.today}</td>
                <td className="p-2 text-right">{s.month}</td>
                <td className="p-2 text-right">{s.duels}</td>
                <td className="p-2 text-right">{s.battles}</td>
                <td className="p-2 text-right">{s.avg}</td>
                <td className="p-2 text-right font-black">{s.best}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
