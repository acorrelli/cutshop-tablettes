// État de Cutshop Arcade partagé par tous les écrans : identité de la table, horloge synchronisée avec le serveur,
// instantané (tables, invitations, partie), pseudo et son de la session, scores en direct des adversaires.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { openChannel } from '../lib/realtime/bus';
import { INSTANCE_ID } from '../lib/tablet';
import { arcadeServer, type ArcadeServer } from './server';
import { ArcadeError, type ArcadeErrorCode, type ArcadeSnapshot, type TableNo } from './types';

export const POLL_MS = 2000;

export interface LiveScore {
  table: TableNo;
  pseudo: string;
  score: number;
  at: number;
}

export interface SoundSettings {
  on: boolean;
  volume: number;
}

interface ArcadeValue {
  server: ArcadeServer;
  snapshot: ArcadeSnapshot | null;
  table: TableNo | null;
  /** Le serveur répond (nécessaire pour les parties multijoueurs). */
  online: boolean;
  /** Heure du serveur, en millisecondes. */
  now: () => number;
  refresh: () => Promise<void>;
  /** Exécute une action serveur, puis rafraîchit. Renvoie le code d'erreur éventuel. */
  act: <T>(fn: (s: ArcadeServer) => Promise<T>) => Promise<{ ok: true; value: T } | { ok: false; code: ArcadeErrorCode }>;
  pseudo: string | null;
  setPseudo: (p: string | null) => void;
  sound: SoundSettings;
  setSound: (s: SoundSettings) => void;
  /** Une partie est en cours sur cette tablette : les invitations attendent la fin. */
  playing: boolean;
  setPlaying: (v: boolean) => void;
  live: Record<string, LiveScore>;
  sendLive: (roomId: string, score: number) => void;
}

const Ctx = createContext<ArcadeValue | null>(null);

export function ArcadeProvider({ children }: { children: ReactNode }) {
  const { tablet, content, onReset } = useApp();
  const server = useMemo(() => arcadeServer(), []);
  const [snapshot, setSnapshot] = useState<ArcadeSnapshot | null>(null);
  const [online, setOnline] = useState(true);
  const offset = useRef(0);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [sound, setSound] = useState<SoundSettings>({ on: false, volume: 0.6 });
  const [playing, setPlaying] = useState(false);
  const [live, setLive] = useState<Record<string, LiveScore>>({});
  const roomRef = useRef<string | null>(null);
  roomRef.current = snapshot?.room?.id ?? null;

  useEffect(() => {
    if (content) server.setConfig(content.settings.arcade);
  }, [content, server]);

  const now = useCallback(() => Date.now() + offset.current, []);

  const refresh = useCallback(async () => {
    try {
      const t0 = Date.now();
      const snap = await server.snapshot();
      const t1 = Date.now();
      // Décalage d'horloge mesuré à mi chemin de l'aller retour.
      offset.current = snap.now - (t0 + t1) / 2;
      setSnapshot(snap);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [server]);

  useEffect(() => {
    if (!tablet) return;
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    let pending: ReturnType<typeof setTimeout> | null = null;
    const off = server.onChange(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        void refresh();
      }, 80);
    });
    return () => {
      clearInterval(id);
      off();
      if (pending) clearTimeout(pending);
    };
  }, [tablet, server, refresh]);

  // Scores en direct (affichage seulement : le résultat officiel est validé par le serveur).
  const bus = useRef<ReturnType<typeof openChannel> | null>(null);
  useEffect(() => {
    if (!tablet) return;
    const ch = openChannel('cutshop-arcade-live', INSTANCE_ID, ['live']);
    bus.current = ch;
    const off = ch.on('live', (p) => {
      if (p.room !== roomRef.current) return;
      const l = p as unknown as LiveScore & { room: string };
      setLive((cur) => ({ ...cur, [String(l.table)]: { table: l.table, pseudo: l.pseudo, score: l.score, at: l.at } }));
    });
    return () => {
      off();
      ch.close();
      bus.current = null;
    };
  }, [tablet]);

  useEffect(() => setLive({}), [snapshot?.room?.id]);

  const sendLive = useCallback(
    (roomId: string, score: number) => {
      const table = server.table();
      if (!table) return;
      const l = { table, pseudo: pseudo ?? '', score, at: Date.now() };
      setLive((cur) => ({ ...cur, [String(table)]: l }));
      bus.current?.send('live', { room: roomId, ...l });
    },
    [server, pseudo],
  );

  const act = useCallback(
    async <T,>(fn: (s: ArcadeServer) => Promise<T>) => {
      try {
        const value = await fn(server);
        void refresh();
        return { ok: true as const, value };
      } catch (e) {
        void refresh();
        return { ok: false as const, code: e instanceof ArcadeError ? e.code : ('network' as const) };
      }
    },
    [server, refresh],
  );

  // Remise à zéro de la session (veille) : pseudo et son effacés, lobby quitté.
  const snapRef = useRef(snapshot);
  snapRef.current = snapshot;
  useEffect(
    () =>
      onReset(() => {
        setPseudo(null);
        setSound({ on: false, volume: 0.6 });
        setPlaying(false);
        const room = snapRef.current?.room;
        if (room && room.status === 'lobby') void server.leave(room.id).catch(() => undefined);
      }),
    [onReset, server],
  );

  const value: ArcadeValue = {
    server,
    snapshot,
    table: snapshot?.table ?? server.table(),
    online,
    now,
    refresh,
    act,
    pseudo,
    setPseudo,
    sound,
    setSound,
    playing,
    setPlaying,
    live,
    sendLive,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useArcade(): ArcadeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useArcade doit être utilisé dans ArcadeProvider');
  return v;
}
