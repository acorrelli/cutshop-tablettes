// Minuterie d'inactivité : après 60 secondes sans interaction, la tablette repasse en veille
// et toutes les données saisies sont effacées.

export const IDLE_MS = 60000;

export interface IdleTimer {
  /** À appeler à chaque interaction. */
  poke(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  readonly paused: boolean;
}

/** timeoutMs peut être une fonction : le délai est relu à chaque interaction (réglage de l'admin). */
export function createIdleTimer(onIdle: () => void, timeoutMs: number | (() => number) = IDLE_MS): IdleTimer {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let pauses = 0;
  let stopped = false;

  const clear = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
  };
  const arm = () => {
    clear();
    if (stopped || pauses > 0) return;
    handle = setTimeout(() => {
      handle = null;
      onIdle();
    }, typeof timeoutMs === 'function' ? timeoutMs() : timeoutMs);
  };

  arm();
  return {
    poke: arm,
    pause() {
      pauses++;
      clear();
    },
    resume() {
      pauses = Math.max(0, pauses - 1);
      arm();
    },
    stop() {
      stopped = true;
      clear();
    },
    get paused() {
      return pauses > 0;
    },
  };
}
