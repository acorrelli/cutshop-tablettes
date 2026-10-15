import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { openChannel } from '../lib/realtime/bus';
import { BATTLE_EVENTS, BattleEngine, type BattleState } from '../lib/realtime/battleEngine';
import { INSTANCE_ID } from '../lib/tablet';
import { useApp } from './AppContext';

const Ctx = createContext<BattleEngine | null>(null);

export function BattleProvider({ children }: { children: ReactNode }) {
  const { tablet, content, onReset } = useApp();
  const questionsRef = useRef(content?.questions ?? []);
  questionsRef.current = content?.questions ?? [];
  const [engine, setEngine] = useState<BattleEngine | null>(null);

  useEffect(() => {
    if (!tablet) return;
    const channel = openChannel('cutshop-battle', INSTANCE_ID, BATTLE_EVENTS);
    const e = new BattleEngine({ channel, key: INSTANCE_ID, tablet, getQuestions: () => questionsRef.current });
    setEngine(e);
    return () => {
      e.destroy();
      channel.close();
      setEngine(null);
    };
  }, [tablet]);

  // À la mise en veille, on quitte une Battle en attente ou terminée.
  useEffect(() => {
    if (!engine) return;
    return onReset(() => {
      const phase = engine.getState().phase;
      if (phase === 'lobby' || phase === 'alone' || phase === 'podium' || engine.getState().solo) engine.leave();
      engine.clearNotice();
    });
  }, [engine, onReset]);

  return <Ctx.Provider value={engine}>{children}</Ctx.Provider>;
}

const EMPTY: BattleState | null = null;

export function useBattleEngine(): BattleEngine | null {
  return useContext(Ctx);
}

export function useBattle(): BattleState | null {
  const engine = useContext(Ctx);
  return useSyncExternalStore(
    (cb) => (engine ? engine.subscribe(cb) : () => undefined),
    () => (engine ? engine.getState() : EMPTY),
  );
}
