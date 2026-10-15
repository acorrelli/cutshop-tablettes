import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_MS, createIdleTimer } from './idle';

describe('remise à zéro après inactivité', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('déclenche la veille après 60 secondes sans interaction', () => {
    const onIdle = vi.fn();
    createIdleTimer(onIdle);
    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    expect(IDLE_MS).toBe(60000);
  });

  it('repart de zéro à chaque interaction', () => {
    const onIdle = vi.fn();
    const timer = createIdleTimer(onIdle);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(50000);
      timer.poke();
    }
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(IDLE_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('se met en pause pendant une partie et reprend ensuite', () => {
    const onIdle = vi.fn();
    const timer = createIdleTimer(onIdle);
    timer.pause();
    timer.pause();
    vi.advanceTimersByTime(IDLE_MS * 5);
    expect(onIdle).not.toHaveBeenCalled();
    timer.resume();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(onIdle).not.toHaveBeenCalled();
    timer.resume();
    expect(timer.paused).toBe(false);
    vi.advanceTimersByTime(IDLE_MS);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('ne se déclenche plus une fois arrêtée', () => {
    const onIdle = vi.fn();
    const timer = createIdleTimer(onIdle);
    timer.stop();
    timer.poke();
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
