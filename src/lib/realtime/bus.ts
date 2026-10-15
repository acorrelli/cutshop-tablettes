// Canal temps réel commun aux tablettes : présence (qui est connecté) et messages diffusés.
// En production : Supabase Realtime (presence + broadcast).
// En mode démo : BroadcastChannel entre onglets d'un même navigateur, avec battements de coeur.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export interface PresenceMeta {
  key: string;
  [field: string]: unknown;
}

export interface BusChannel {
  track(meta: Record<string, unknown>): void;
  onPresence(cb: (metas: PresenceMeta[]) => void): () => void;
  on(event: string, cb: (payload: Record<string, unknown>) => void): () => void;
  send(event: string, payload: Record<string, unknown>): void;
  close(): void;
}

type Handler = (payload: Record<string, unknown>) => void;

function createRegistry() {
  const handlers = new Map<string, Set<Handler>>();
  const presenceCbs = new Set<(metas: PresenceMeta[]) => void>();
  let lastPresence: PresenceMeta[] = [];
  return {
    on(event: string, cb: Handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(cb);
      return () => handlers.get(event)?.delete(cb);
    },
    emit(event: string, payload: Record<string, unknown>) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
    onPresence(cb: (metas: PresenceMeta[]) => void) {
      presenceCbs.add(cb);
      cb(lastPresence);
      return () => presenceCbs.delete(cb);
    },
    emitPresence(metas: PresenceMeta[]) {
      lastPresence = metas;
      presenceCbs.forEach((cb) => cb(metas));
    },
  };
}

function supabaseChannel(name: string, key: string, events: string[]): BusChannel {
  const reg = createRegistry();
  const ch: RealtimeChannel = supabase!.channel(name, {
    config: { presence: { key }, broadcast: { self: false, ack: false } },
  });
  let subscribed = false;
  let pendingMeta: Record<string, unknown> | null = null;

  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState<Record<string, unknown>>();
    const metas: PresenceMeta[] = [];
    for (const [k, list] of Object.entries(state)) {
      const last = list[list.length - 1];
      if (last) metas.push({ ...last, key: k });
    }
    reg.emitPresence(metas);
  });
  for (const ev of events) {
    ch.on('broadcast', { event: ev }, (msg) => reg.emit(ev, (msg.payload ?? {}) as Record<string, unknown>));
  }
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      subscribed = true;
      if (pendingMeta) void ch.track(pendingMeta);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      subscribed = false;
    }
  });

  return {
    track(meta) {
      pendingMeta = meta;
      if (subscribed) void ch.track(meta);
    },
    onPresence: reg.onPresence,
    on: reg.on,
    send(event, payload) {
      // Le message est aussi traité localement par l'appelant si besoin (self: false).
      void ch.send({ type: 'broadcast', event, payload });
    },
    close() {
      void ch.untrack();
      void supabase!.removeChannel(ch);
    },
  };
}

const HEARTBEAT_MS = 1000;
const EXPIRE_MS = 3500;

function demoChannel(name: string, key: string): BusChannel {
  const reg = createRegistry();
  const bc = new BroadcastChannel(`cutshop:${name}`);
  const peers = new Map<string, { meta: PresenceMeta; ts: number }>();
  let myMeta: Record<string, unknown> | null = null;

  const publishPresence = () => {
    const now = Date.now();
    for (const [k, v] of peers) if (k !== key && now - v.ts > EXPIRE_MS) peers.delete(k);
    reg.emitPresence(Array.from(peers.values()).map((p) => p.meta));
  };
  const announce = () => {
    if (!myMeta) return;
    bc.postMessage({ t: 'p', key, meta: myMeta });
  };

  bc.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { t: string; key?: string; meta?: Record<string, unknown>; event?: string; payload?: Record<string, unknown> };
    if (msg.t === 'p' && msg.key) {
      const isNew = !peers.has(msg.key);
      peers.set(msg.key, { meta: { ...(msg.meta ?? {}), key: msg.key }, ts: Date.now() });
      if (isNew) announce();
      publishPresence();
    } else if (msg.t === 'x' && msg.key) {
      peers.delete(msg.key);
      publishPresence();
    } else if (msg.t === 'b' && msg.event) {
      reg.emit(msg.event, msg.payload ?? {});
    }
  };

  const timer = setInterval(() => {
    announce();
    publishPresence();
  }, HEARTBEAT_MS);
  const onUnload = () => bc.postMessage({ t: 'x', key });
  window.addEventListener('pagehide', onUnload);

  return {
    track(meta) {
      myMeta = meta;
      peers.set(key, { meta: { ...meta, key }, ts: Date.now() });
      announce();
      publishPresence();
    },
    onPresence: reg.onPresence,
    on: reg.on,
    send(event, payload) {
      bc.postMessage({ t: 'b', event, payload });
    },
    close() {
      clearInterval(timer);
      window.removeEventListener('pagehide', onUnload);
      bc.postMessage({ t: 'x', key });
      bc.close();
    },
  };
}

/** Canal local seul (navigateur sans BroadcastChannel) : la tablette se voit elle même, rien d'autre. */
function localChannel(key: string): BusChannel {
  const reg = createRegistry();
  return {
    track(meta) {
      reg.emitPresence([{ ...meta, key }]);
    },
    onPresence: reg.onPresence,
    on: reg.on,
    send() {},
    close() {},
  };
}

export function openChannel(name: string, key: string, events: string[]): BusChannel {
  if (supabase) return supabaseChannel(name, key, events);
  try {
    return demoChannel(name, key);
  } catch {
    return localChannel(key);
  }
}
