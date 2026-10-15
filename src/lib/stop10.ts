// Jeu Stop à 10 secondes.

export const TARGET_MS = 10000;
export const VISIBLE_MS = 3000;

/** Arrondi au centième de seconde, exprimé en millisecondes (10 074 ms donne 10 070 ms). */
export function roundToHundredth(ms: number): number {
  return Math.round(ms / 10) * 10;
}

export interface Stop10Result {
  elapsedMs: number;
  deltaMs: number;
  perfect: boolean;
}

export function evaluateStop(rawElapsedMs: number): Stop10Result {
  const elapsedMs = roundToHundredth(rawElapsedMs);
  const deltaMs = Math.abs(elapsedMs - TARGET_MS);
  return { elapsedMs, deltaMs, perfect: deltaMs === 0 };
}

/** Le chrono est visible pendant les trois premières secondes puis disparaît. */
export function isTimerVisible(elapsedMs: number): boolean {
  return elapsedMs < VISIBLE_MS;
}

/** Format affiché : « 10,07 s » en français, « 10.07 s » en anglais (espace insécable avant l'unité). */
export function formatSeconds(ms: number, lang: 'fr' | 'en' = 'fr'): string {
  const value = (Math.max(0, ms) / 1000).toFixed(2);
  return `${lang === 'fr' ? value.replace('.', ',') : value}\u00a0s`;
}

/** Début de la journée en cours à Bruxelles, en instant UTC (pour le classement du jour). */
export function startOfBrusselsDay(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const sinceMidnightMs = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getUTCMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs);
}
