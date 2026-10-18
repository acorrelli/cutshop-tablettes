import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import i18n from '../i18n';
import { api } from '../lib/api';
import { createIdleTimer, IDLE_MS, type IdleTimer } from '../lib/idle';
import { onQueueChange, startQueueWorker } from '../lib/queue';
import { getTabletName, setTabletName } from '../lib/tablet';
import type { Lang, PublicContent, SpinReason } from '../lib/types';

export interface WheelGrant {
  reason: SpinReason;
  /** Code PIN saisi par le staff, gardé en mémoire le temps du tour. */
  pin: string | null;
}

interface AppContextValue {
  tablet: string | null;
  setTablet: (name: string) => void;
  content: PublicContent | null;
  contentError: boolean;
  reloadContent: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  largeText: boolean;
  toggleLargeText: () => void;
  /** Change à chaque remise à zéro : sert de clé pour démonter tous les écrans. */
  sessionKey: number;
  asleep: boolean;
  wake: () => void;
  sleepNow: () => void;
  /** Suspend la mise en veille (partie en cours). Retourne la fonction de reprise. */
  holdAwake: () => () => void;
  wheelGrant: WheelGrant | null;
  grantSpin: (grant: WheelGrant) => void;
  clearGrant: () => void;
  online: boolean;
  pending: number;
  /** Fonctions appelées à chaque remise à zéro (ex : quitter la Battle). */
  onReset: (cb: () => void) => () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

const REFRESH_MS = 5 * 60000;

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [tablet, setTabletState] = useState<string | null>(() => getTabletName());
  const [content, setContent] = useState<PublicContent | null>(null);
  const [contentError, setContentError] = useState(false);
  const [lang, setLangState] = useState<Lang>('fr');
  const [largeText, setLargeText] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [asleep, setAsleep] = useState(false);
  const [wheelGrant, setWheelGrant] = useState<WheelGrant | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [pending, setPending] = useState(0);
  const resetCbs = useRef(new Set<() => void>());
  const idle = useRef<IdleTimer | null>(null);
  const idleMs = useRef(IDLE_MS);

  const loadAll = useCallback(async () => {
    try {
      const [settings, events, services, drinks, pairings, products, questions, segments] = await Promise.all([
        api.getSettings(),
        api.getEvents(),
        api.getServices(),
        api.getDrinks(),
        api.getPairings(),
        api.getProducts(),
        api.getQuestions(),
        api.getWheelSegments(),
      ]);
      idleMs.current = Math.min(600, Math.max(30, settings.idle_seconds || 60)) * 1000;
      setContent({ settings, events, services, drinks, pairings, products, questions, segments });
      setContentError(false);
    } catch {
      // Hors ligne : on garde les contenus déjà chargés (le service worker sert aussi le cache).
      setContentError(true);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const events = await api.getEvents();
      setContent((c) => (c ? { ...c, events } : c));
    } catch {
      /* on garde la liste précédente */
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const t = setInterval(() => void loadAll(), REFRESH_MS);
    return () => clearInterval(t);
  }, [loadAll]);

  useEffect(() => {
    const stop = startQueueWorker();
    const unsub = onQueueChange(setPending);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      stop();
      unsub();
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('large-text', largeText);
  }, [largeText]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void i18n.changeLanguage(l);
    document.documentElement.lang = l;
  }, []);

  /** Remise à zéro complète : toutes les saisies disparaissent avec le démontage des écrans. */
  const resetSession = useCallback(() => {
    resetCbs.current.forEach((cb) => cb());
    setWheelGrant(null);
    setLargeText(false);
    setLang('fr');
    setSessionKey((k) => k + 1);
    (document.activeElement as HTMLElement | null)?.blur?.();
    navigate('/', { replace: true });
  }, [navigate, setLang]);

  const sleepNow = useCallback(() => {
    resetSession();
    setAsleep(true);
  }, [resetSession]);

  useEffect(() => {
    const timer = createIdleTimer(() => sleepNow(), () => idleMs.current);
    idle.current = timer;
    const poke = () => timer.poke();
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    return () => {
      timer.stop();
      events.forEach((e) => window.removeEventListener(e, poke));
    };
  }, [sleepNow]);

  const wake = useCallback(() => {
    setAsleep(false);
    idle.current?.poke();
    void loadAll();
  }, [loadAll]);

  const holdAwake = useCallback(() => {
    idle.current?.pause();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      idle.current?.resume();
    };
  }, []);

  const setTablet = useCallback((name: string) => {
    setTabletName(name);
    setTabletState(name);
  }, []);

  const onReset = useCallback((cb: () => void) => {
    resetCbs.current.add(cb);
    return () => {
      resetCbs.current.delete(cb);
    };
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      tablet,
      setTablet,
      content,
      contentError,
      reloadContent: loadAll,
      refreshEvents,
      lang,
      setLang,
      largeText,
      toggleLargeText: () => setLargeText((v) => !v),
      sessionKey,
      asleep,
      wake,
      sleepNow,
      holdAwake,
      wheelGrant,
      grantSpin: setWheelGrant,
      clearGrant: () => setWheelGrant(null),
      online,
      pending,
      onReset,
    }),
    [tablet, setTablet, content, contentError, loadAll, refreshEvents, lang, setLang, largeText, sessionKey, asleep, wake, sleepNow, holdAwake, wheelGrant, online, pending, onReset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp doit être utilisé dans AppProvider');
  return v;
}

/** Garde la tablette éveillée tant que `active` est vrai. */
export function useHoldAwake(active: boolean) {
  const { holdAwake } = useApp();
  useEffect(() => {
    if (!active) return;
    return holdAwake();
  }, [active, holdAwake]);
}
