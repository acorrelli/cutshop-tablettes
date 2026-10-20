// Musiques de Beat Drop : import d'un MP3, choix de l'extrait de 72 secondes, analyse automatique
// (tempo et partitions des trois niveaux), écoute de contrôle avec repères, réglage fin et activation.
import {
  ArrowDown,
  ArrowUp,
  Headphones,
  Image as ImageIcon,
  Music,
  Pause,
  Play,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  analyzeTrack,
  shiftChart,
  suggestStart,
  toMono,
} from "../../arcade/games/beat/analysis";
import {
  BEAT_DIFFICULTIES,
  judgementCount,
  type BeatDifficulty,
} from "../../arcade/games/beat/songs";
import {
  chartFromCompact,
  hueFor,
  toCompact,
  type BeatTrackRow,
} from "../../arcade/games/beat/tracks";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { IS_DEMO } from "../../lib/env";
import {
  channelsOf,
  decodeFile,
  encodeMp3,
  EXTRACT_SEC,
  guessFromFileName,
  mmss,
  playFrom,
  playWithCues,
  renderExtract,
} from "../beatAudio";
import { AdminCard, useAsync } from "../Crud";

const btn =
  "flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 font-bold disabled:opacity-40";
const input =
  "w-full rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-3 py-2.5 outline-none focus:border-gold";
const LEVEL: Record<BeatDifficulty, string> = {
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
};
const MAX_FILE_MB = 40;

function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

export function BeatTracksSection() {
  const { reloadContent } = useApp();
  const list = useAsync(() => api.adminList("beat_tracks"), []);
  const [adding, setAdding] = useState(false);
  const rows = [...(list.data ?? [])].sort(
    (a, b) =>
      a.sort - b.sort || (a.created_at ?? "").localeCompare(b.created_at ?? ""),
  );

  const refresh = async () => {
    await list.reload();
    await reloadContent();
  };

  return (
    <div className="space-y-6" data-testid="admin-beat-tracks">
      <AdminCard
        title="Musiques Beat Drop"
        actions={
          !adding && (
            <button
              type="button"
              className={`${btn} bg-gold text-bottle-950`}
              onClick={() => setAdding(true)}
              data-testid="beat-add"
            >
              <Plus size={20} /> Ajouter une musique
            </button>
          )
        }
      >
        <p className="text-sm text-cream/70">
          Choisis un fichier MP3 et le passage à jouer : l’application découpe
          un extrait de {EXTRACT_SEC} secondes, trouve le tempo et place les
          notes. Choisis le niveau de chaque musique : sur les tablettes, elle
          n’apparaît que dans ce niveau (Facile, Moyen ou Difficile). Sans
          musique active, le jeu garde ses morceaux d’origine.
        </p>
        {IS_DEMO && (
          <p className="mt-3 rounded-xl bg-gold/15 p-3 text-sm font-bold text-gold-300">
            Mode démonstration : la musique importée reste disponible jusqu’au
            rechargement de la page.
          </p>
        )}
        {list.error && (
          <p className="mt-3 rounded-xl bg-red-900/50 p-3 text-sm font-bold">
            Impossible de lire les musiques ({list.error}). Si c’est la première
            fois, lance le fichier supabase/ajout_musiques_beat_drop.sql dans
            Supabase.
          </p>
        )}
      </AdminCard>

      {adding && (
        <Importer
          nextSort={rows.length ? Math.max(...rows.map((r) => r.sort)) + 1 : 0}
          onCancel={() => setAdding(false)}
          onDone={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}

      {rows.length === 0 && !list.loading && !adding && (
        <AdminCard>
          <p className="text-cream/70">Aucune musique pour l’instant.</p>
        </AdminCard>
      )}

      {rows.map((row, i) => (
        <TrackCard
          key={row.id}
          row={row}
          first={i === 0}
          last={i === rows.length - 1}
          onMove={async (dir) => {
            const other = rows[i + dir];
            if (!other) return;
            await api.adminUpdate("beat_tracks", row.id, {
              sort: other.sort === row.sort ? row.sort + dir : other.sort,
            });
            await api.adminUpdate("beat_tracks", other.id, { sort: row.sort });
            await refresh();
          }}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}

type Step =
  | { kind: "idle" }
  | { kind: "work"; label: string; pct: number }
  | { kind: "error"; text: string };

function Importer({
  nextSort,
  onCancel,
  onDone,
}: {
  nextSort: number;
  onCancel: () => void;
  onDone: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<AudioBuffer | null>(null);
  const [suggested, setSuggested] = useState(0);
  const [start, setStart] = useState(0);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [trackLevel, setTrackLevel] = useState<BeatDifficulty>("medium");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopRef.current?.(), []);

  const pickFile = async (f: File | null) => {
    stopRef.current?.();
    setListening(false);
    setSource(null);
    setFile(f);
    if (!f) return;
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setStep({
        kind: "error",
        text: `Fichier trop lourd (plus de ${MAX_FILE_MB} Mo).`,
      });
      return;
    }
    const guess = guessFromFileName(f.name);
    setTitle(guess.title.slice(0, 80));
    setArtist(guess.artist.slice(0, 80));
    setStep({ kind: "work", label: "Lecture du fichier", pct: 0.3 });
    try {
      const buf = await decodeFile(f);
      if (buf.duration < EXTRACT_SEC + 1) {
        setStep({
          kind: "error",
          text: `Le morceau dure ${mmss(buf.duration)} : il faut au moins ${mmss(EXTRACT_SEC + 1)}.`,
        });
        return;
      }
      const s = suggestStart(toMono(channelsOf(buf)), buf.sampleRate);
      setSource(buf);
      setSuggested(s);
      setStart(s);
      setStep({ kind: "idle" });
    } catch {
      setStep({
        kind: "error",
        text: "Ce fichier audio ne peut pas être lu. Essaie un MP3 classique.",
      });
    }
  };

  const listen = () => {
    if (!source) return;
    if (listening) {
      stopRef.current?.();
      setListening(false);
      return;
    }
    stopRef.current = playFrom(source, start, 15);
    setListening(true);
    setTimeout(() => setListening(false), 15200);
  };

  const save = async () => {
    if (!source || !file) return;
    stopRef.current?.();
    setListening(false);
    try {
      setStep({ kind: "work", label: "Découpe de l’extrait", pct: 0.05 });
      const extract = await renderExtract(source, start);
      setStep({ kind: "work", label: "Compression MP3", pct: 0.1 });
      const mp3 = await encodeMp3(extract, (p) =>
        setStep({ kind: "work", label: "Compression MP3", pct: 0.1 + p * 0.5 }),
      );
      setStep({ kind: "work", label: "Analyse du rythme", pct: 0.65 });
      await new Promise((r) => setTimeout(r, 30));
      // Analyse du fichier compressé lui même : exactement ce que les tablettes joueront.
      const decoded = await decodeFile(mp3);
      const analysis = analyzeTrack(channelsOf(decoded), decoded.sampleRate);
      setStep({ kind: "work", label: "Envoi de la musique", pct: 0.8 });
      const audioUrl = await api.uploadAudio(mp3);
      let coverUrl: string | null = null;
      if (cover) coverUrl = await api.uploadImage(cover);
      setStep({ kind: "work", label: "Enregistrement", pct: 0.95 });
      await api.adminUpsert("beat_tracks", {
        title: title.trim().slice(0, 80) || "Sans titre",
        artist: artist.trim().slice(0, 80),
        cover_url: coverUrl,
        audio_url: audioUrl,
        bpm: analysis.bpm,
        beat_phase_ms: analysis.beatPhaseMs,
        charts: {
          easy: toCompact(analysis.charts.easy),
          medium: toCompact(analysis.charts.medium),
          hard: toCompact(analysis.charts.hard),
        },
        level: trackLevel,
        active: true,
        sort: nextSort,
      });
      await onDone();
    } catch (e) {
      setStep({ kind: "error", text: `L’import a échoué : ${errText(e)}` });
    }
  };

  const busy = step.kind === "work";
  const maxStart = source
    ? Math.max(0, source.duration - EXTRACT_SEC - 0.5)
    : 0;

  return (
    <AdminCard title="Nouvelle musique">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">
              Fichier audio (MP3)
            </span>
            <input
              type="file"
              accept="audio/*,.mp3"
              className="block w-full rounded-xl bg-white/10 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gold file:px-3 file:py-2 file:font-bold file:text-bottle-950"
              onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
              disabled={busy}
              data-testid="beat-file"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Titre</span>
              <input
                className={input}
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                data-testid="beat-title"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Artiste</span>
              <input
                className={input}
                value={artist}
                maxLength={80}
                onChange={(e) => setArtist(e.target.value)}
                disabled={busy}
                data-testid="beat-artist"
              />
            </label>
          </div>
          <LevelPicker
            value={trackLevel}
            onChange={setTrackLevel}
            disabled={busy}
            testId="beat-level"
          />
          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-bold">
              <ImageIcon size={16} /> Pochette (facultative)
            </span>
            <input
              type="file"
              accept="image/*"
              className="block w-full rounded-xl bg-white/10 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-white/20 file:px-3 file:py-2 file:font-bold file:text-cream"
              onChange={(e) => setCover(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </label>
        </div>

        <div className="space-y-4">
          {source ? (
            <>
              <div>
                <span className="mb-1 block text-sm font-bold">
                  Passage joué : de {mmss(start)} à {mmss(start + EXTRACT_SEC)}{" "}
                  <span className="font-normal text-cream/60">
                    (morceau de {mmss(source.duration)})
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={maxStart}
                  step={0.5}
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                  className="w-full accent-[#D4A84B]"
                  disabled={busy}
                  data-testid="beat-start"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${btn} bg-white/10`}
                    onClick={listen}
                    disabled={busy}
                  >
                    {listening ? <Pause size={18} /> : <Play size={18} />}{" "}
                    {listening ? "Arrêter" : "Écouter le début du passage"}
                  </button>
                  <button
                    type="button"
                    className={`${btn} bg-white/10`}
                    onClick={() => setStart(suggested)}
                    disabled={busy}
                  >
                    <Sparkles size={18} /> Passage conseillé ({mmss(suggested)})
                  </button>
                </div>
                <p className="mt-2 text-sm text-cream/60">
                  Le passage conseillé est le plus énergique du morceau. Tu peux
                  le déplacer, par exemple pour démarrer sur le refrain.
                </p>
              </div>
            </>
          ) : (
            <div className="grid min-h-[160px] place-items-center rounded-2xl border-2 border-dashed border-cream/15 p-6 text-center text-cream/60">
              <div>
                <Music className="mx-auto mb-2" size={36} />
                Choisis un fichier pour régler le passage joué.
              </div>
            </div>
          )}
        </div>
      </div>

      {step.kind === "work" && (
        <div className="mt-5" data-testid="beat-progress">
          <p className="mb-2 font-bold">{step.label}...</p>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round(step.pct * 100)}%` }}
            />
          </div>
        </div>
      )}
      {step.kind === "error" && (
        <p className="mt-4 rounded-xl bg-red-900/50 p-3 text-sm font-bold">
          {step.text}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className={`${btn} bg-gold text-bottle-950`}
          onClick={() => void save()}
          disabled={!source || busy || !title.trim()}
          data-testid="beat-save"
        >
          <Upload size={20} /> Analyser et enregistrer
        </button>
        <button
          type="button"
          className={`${btn} bg-white/10`}
          onClick={onCancel}
          disabled={busy}
        >
          Annuler
        </button>
      </div>
    </AdminCard>
  );
}

function TrackCard({
  row,
  first,
  last,
  onMove,
  onChanged,
}: {
  row: BeatTrackRow;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [artist, setArtist] = useState(row.artist);
  const savedLevel: BeatDifficulty = (
    BEAT_DIFFICULTIES as readonly string[]
  ).includes(row.level)
    ? row.level
    : "medium";
  const [level, setLevel] = useState<BeatDifficulty>(savedLevel);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const extractRef = useRef<AudioBuffer | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const charts = Object.fromEntries(
    BEAT_DIFFICULTIES.map((d) => [d, chartFromCompact(row.charts?.[d], d)]),
  ) as Record<BeatDifficulty, ReturnType<typeof chartFromCompact>>;
  const hue = hueFor(row.title || row.id);
  const dirty =
    title !== row.title || artist !== row.artist || level !== savedLevel;

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
    } catch (e) {
      setMsg(`Erreur : ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const togglePlay = async () => {
    if (playing) {
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
      return;
    }
    await run(async () => {
      if (!extractRef.current) {
        const res = await fetch(row.audio_url);
        if (!res.ok) throw new Error("fichier audio introuvable");
        extractRef.current = await decodeFile(await res.blob());
      }
      stopRef.current = playWithCues(extractRef.current, charts[level], () =>
        setPlaying(false),
      );
      setPlaying(true);
    });
  };

  /** Décale toutes les notes et la pulsation (notes en avance : valeur positive). */
  const shift = (ms: number) =>
    run(
      async () => {
        stopRef.current?.();
        setPlaying(false);
        const next = Object.fromEntries(
          BEAT_DIFFICULTIES.map((d) => [
            d,
            toCompact(shiftChart(charts[d], ms)),
          ]),
        );
        const beatMs = 60000 / row.bpm;
        await api.adminUpdate("beat_tracks", row.id, {
          charts: next,
          beat_phase_ms: Math.round(
            (((row.beat_phase_ms + ms) % beatMs) + beatMs) % beatMs,
          ),
        });
        await onChanged();
      },
      ms > 0 ? `Notes retardées de ${ms} ms.` : `Notes avancées de ${-ms} ms.`,
    );

  return (
    <div data-testid={`beat-row-${row.id}`}>
      <AdminCard>
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 70% 32%), hsl(${(hue + 60) % 360} 70% 12%))`,
            }}
          >
            {row.cover_url ? (
              <img
                src={row.cover_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <Music size={34} className="text-cream/70" />
            )}
          </div>
          <div className="min-w-[240px] flex-1 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={input}
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="Titre"
              />
              <input
                className={input}
                value={artist}
                maxLength={80}
                onChange={(e) => setArtist(e.target.value)}
                aria-label="Artiste"
                placeholder="Artiste"
              />
            </div>
            <LevelPicker
              value={level}
              onChange={setLevel}
              disabled={busy || playing}
              testId={`beat-level-${row.id}`}
            />
            <p className="text-sm text-cream/70">
              {Math.round(row.bpm)} BPM · {judgementCount(charts[level])} notes
              en {LEVEL[level].toLowerCase()}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`${btn} cursor-pointer bg-white/10 ${busy ? "pointer-events-none opacity-40" : ""}`}
              >
                <ImageIcon size={18} />{" "}
                {row.cover_url ? "Changer la pochette" : "Ajouter une pochette"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    void run(async () => {
                      const url = await api.uploadImage(f);
                      await api.adminUpdate("beat_tracks", row.id, {
                        cover_url: url,
                      });
                      if (row.cover_url)
                        await api
                          .removeMedia(row.cover_url)
                          .catch(() => undefined);
                      await onChanged();
                    }, "Pochette enregistrée.");
                  }}
                  data-testid={`beat-cover-${row.id}`}
                />
              </label>
              {row.cover_url && (
                <button
                  type="button"
                  className={`${btn} bg-white/10`}
                  onClick={() =>
                    void run(async () => {
                      await api.adminUpdate("beat_tracks", row.id, {
                        cover_url: null,
                      });
                      await api
                        .removeMedia(row.cover_url!)
                        .catch(() => undefined);
                      await onChanged();
                    }, "Pochette retirée.")
                  }
                  disabled={busy}
                >
                  Retirer la pochette
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${btn} bg-white/10 px-3`}
              onClick={() => void onMove(-1)}
              disabled={first || busy}
              aria-label="Monter"
            >
              <ArrowUp size={18} />
            </button>
            <button
              type="button"
              className={`${btn} bg-white/10 px-3`}
              onClick={() => void onMove(1)}
              disabled={last || busy}
              aria-label="Descendre"
            >
              <ArrowDown size={18} />
            </button>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  await api.adminUpdate("beat_tracks", row.id, {
                    active: !row.active,
                  });
                  await onChanged();
                })
              }
              className={`${btn} ${row.active ? "bg-gold/20 ring-2 ring-gold" : "bg-white/[0.06]"}`}
              disabled={busy}
              data-testid={`beat-active-${row.id}`}
            >
              {row.active ? "Active" : "Désactivée"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-cream/10 pt-4">
          <Headphones size={20} className="text-gold" />
          <span className="font-bold">
            Écoute de contrôle ({LEVEL[level].toLowerCase()})
          </span>
          <button
            type="button"
            className={`${btn} bg-white/10`}
            onClick={() => void togglePlay()}
            disabled={busy && !playing}
            data-testid={`beat-preview-${row.id}`}
          >
            {playing ? <Square size={18} /> : <Play size={18} />}{" "}
            {playing ? "Arrêter" : "Écouter avec les repères"}
          </button>
          <span className="mx-1 text-sm text-cream/60">
            Notes en retard ou en avance :
          </span>
          <button
            type="button"
            className={`${btn} bg-white/10`}
            onClick={() => void shift(-20)}
            disabled={busy}
          >
            Avancer de 20 ms
          </button>
          <button
            type="button"
            className={`${btn} bg-white/10`}
            onClick={() => void shift(20)}
            disabled={busy}
          >
            Retarder de 20 ms
          </button>
        </div>
        <p className="mt-2 text-sm text-cream/60">
          Un bip retentit sur chaque note : il doit tomber pile sur la musique.
          Si les bips arrivent après le son, avance les notes ; s’ils arrivent
          avant, retarde-les.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {dirty && (
            <button
              type="button"
              className={`${btn} bg-gold text-bottle-950`}
              onClick={() =>
                void run(async () => {
                  await api.adminUpdate("beat_tracks", row.id, {
                    title: title.trim().slice(0, 80) || row.title,
                    artist: artist.trim().slice(0, 80),
                    level,
                  });
                  await onChanged();
                }, "Enregistré.")
              }
              disabled={busy}
            >
              Enregistrer les modifications
            </button>
          )}
          {!confirmDelete ? (
            <button
              type="button"
              className={`${btn} ml-auto bg-red-900/50`}
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              <Trash2 size={18} /> Supprimer
            </button>
          ) : (
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <span className="font-bold">Supprimer cette musique ?</span>
              <button
                type="button"
                className={`${btn} bg-red-700`}
                onClick={() =>
                  void run(async () => {
                    stopRef.current?.();
                    await api.adminDelete("beat_tracks", row.id);
                    await api.removeMedia(row.audio_url).catch(() => undefined);
                    if (row.cover_url)
                      await api
                        .removeMedia(row.cover_url)
                        .catch(() => undefined);
                    await onChanged();
                  })
                }
                disabled={busy}
                data-testid={`beat-delete-${row.id}`}
              >
                Oui, supprimer
              </button>
              <button
                type="button"
                className={`${btn} bg-white/10`}
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
              >
                Non
              </button>
            </span>
          )}
        </div>
        {msg && <p className="mt-3 text-sm font-bold text-gold-300">{msg}</p>}
      </AdminCard>
    </div>
  );
}

function LevelPicker({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: BeatDifficulty;
  onChange: (l: BeatDifficulty) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-bold">
        Niveau sur les tablettes
      </span>
      <div className="flex flex-wrap gap-2" data-testid={testId}>
        {BEAT_DIFFICULTIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            disabled={disabled}
            aria-pressed={value === d}
            className={`${btn} ${value === d ? "bg-gold text-bottle-950" : "bg-white/10"}`}
            data-testid={`${testId}-${d}`}
          >
            {LEVEL[d]}
          </button>
        ))}
      </div>
    </div>
  );
}
