import type { Lang } from './types';
import { frenchTypo } from './typo';

/** Lit le champ localisé `${field}_${lang}` d'un objet, avec repli sur le français. */
export function loc<T extends object>(obj: T, field: string, lang: Lang): string {
  const rec = obj as Record<string, unknown>;
  const v = rec[`${field}_${lang}`];
  if (typeof v === 'string' && v.trim() !== '') return lang === 'fr' ? frenchTypo(v) : v;
  const fr = rec[`${field}_fr`];
  return typeof fr === 'string' ? frenchTypo(fr) : '';
}

const TZ = 'Europe/Brussels';

export function formatEventDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const s = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-BE' : 'en-GB', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('fr-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return lang === 'fr' ? `${Number(h)}h${m}` : `${h}:${m}`;
}

export function formatPrice(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-BE' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(value);
}
