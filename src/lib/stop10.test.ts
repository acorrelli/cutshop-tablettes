import { describe, expect, it } from 'vitest';
import { evaluateStop, formatSeconds, isTimerVisible, roundToHundredth, startOfBrusselsDay } from './stop10';

describe('chrono Stop à 10 secondes', () => {
  it('arrondit au centième de seconde', () => {
    expect(roundToHundredth(10074)).toBe(10070);
    expect(roundToHundredth(10075)).toBe(10080);
    expect(roundToHundredth(9996)).toBe(10000);
  });

  it('calcule l’écart avec 10 secondes', () => {
    expect(evaluateStop(10070)).toEqual({ elapsedMs: 10070, deltaMs: 70, perfect: false });
    expect(evaluateStop(9930)).toEqual({ elapsedMs: 9930, deltaMs: 70, perfect: false });
    expect(evaluateStop(12345).deltaMs).toBe(2350);
  });

  it('détecte le 10,00 s pile', () => {
    expect(evaluateStop(10000).perfect).toBe(true);
    expect(evaluateStop(10004.9).perfect).toBe(true);
    expect(evaluateStop(9995).perfect).toBe(true);
    expect(evaluateStop(10005).perfect).toBe(false);
    expect(evaluateStop(9994).perfect).toBe(false);
  });

  it('cache le chrono après 3 secondes', () => {
    expect(isTimerVisible(0)).toBe(true);
    expect(isTimerVisible(2999)).toBe(true);
    expect(isTimerVisible(3000)).toBe(false);
    expect(isTimerVisible(9000)).toBe(false);
  });

  it('formate le temps selon la langue', () => {
    expect(formatSeconds(10070, 'fr')).toBe('10,07\u00a0s');
    expect(formatSeconds(10070, 'en')).toBe('10.07\u00a0s');
    expect(formatSeconds(70, 'fr')).toBe('0,07\u00a0s');
  });

  it('calcule minuit à Bruxelles, en hiver comme en été', () => {
    expect(startOfBrusselsDay(new Date('2026-01-15T10:30:00Z')).toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(startOfBrusselsDay(new Date('2026-07-15T10:30:00Z')).toISOString()).toBe('2026-07-14T22:00:00.000Z');
    expect(startOfBrusselsDay(new Date('2026-07-15T22:30:00Z')).toISOString()).toBe('2026-07-15T22:00:00.000Z');
  });
});
