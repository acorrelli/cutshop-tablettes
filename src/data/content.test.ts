// Règle de rédaction absolue : aucun tiret (ni court ni long) dans les textes affichés.
import { describe, expect, it } from 'vitest';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';
import {
  DEFAULT_SETTINGS,
  EVENT_PROGRAM,
  EVENT_TYPES,
  SEED_DRINKS,
  SEED_PAIRINGS,
  SEED_PRIZES,
  SEED_PRODUCTS,
  SEED_QUESTIONS,
  buildSeedEvents,
} from './seed';

const DASHES = /[-‐‑‒–—―−]/;

function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

// Champs techniques jamais affichés tels quels.
const TECHNICAL = /(^|\.)(id|url|image_url|salonkee_url|instagram_url|color|kind|key|category|theme|time|email|date|type|image|concept_photo_hero|concept_photo_1|concept_photo_2|concept_photo_3|facebook_url|tiktok_url|website)$|hair_types|scalp_types|effects/;

function displayed(value: unknown) {
  return strings(value).filter(([p]) => !TECHNICAL.test(p));
}

describe('règle des tirets', () => {
  it('aucun tiret dans les traductions FR et EN', () => {
    for (const [path, s] of [...displayed(fr), ...displayed(en)]) expect(`${path}: ${s}`).not.toMatch(DASHES);
  });

  it('aucun tiret dans les contenus d’exemple', () => {
    const all = displayed({
      settings: DEFAULT_SETTINGS,
      events: EVENT_TYPES,
      program: EVENT_PROGRAM,
      drinks: SEED_DRINKS,
      pairings: SEED_PAIRINGS,
      products: SEED_PRODUCTS,
      prizes: SEED_PRIZES,
      questions: SEED_QUESTIONS,
    });
    for (const [path, s] of all) expect(`${path}: ${s}`).not.toMatch(DASHES);
  });

  it('les clés FR et EN sont identiques', () => {
    const keys = (o: unknown) => strings(o).map(([p]) => p).sort();
    expect(keys(en)).toEqual(keys(fr));
  });
});

describe('données d’exemple', () => {
  it('contient au moins 80 questions complètes en FR et EN', () => {
    expect(SEED_QUESTIONS.length).toBeGreaterThanOrEqual(80);
    const ids = new Set(SEED_QUESTIONS.map((q) => q.id));
    expect(ids.size).toBe(SEED_QUESTIONS.length);
    for (const q of SEED_QUESTIONS) {
      expect(q.answers_fr).toHaveLength(4);
      expect(q.answers_en).toHaveLength(4);
      expect(new Set(q.answers_fr).size).toBe(4);
      expect(new Set(q.answers_en).size).toBe(4);
      expect(q.question_en.length).toBeGreaterThan(5);
    }
    for (const theme of ['mons', 'beer', 'barber', 'music', 'general', 'kids']) {
      expect(SEED_QUESTIONS.filter((q) => q.theme === theme).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('reprend le programme officiel avec les bons jours et horaires', () => {
    const events = buildSeedEvents();
    expect(events).toHaveLength(17);
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    expect(fmt(events[0].starts_at)).toBe('samedi 17 octobre à 18:00');
    expect(events[1].title_fr).toBe('Cutsession spécial Halloween');
    expect(fmt(events[16].starts_at)).toBe('samedi 26 décembre à 18:00');
    for (const e of events) {
      const day = new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', weekday: 'long' }).format(new Date(e.starts_at));
      expect(['vendredi', 'samedi']).toContain(day);
      if (e.kind === 'read' || e.kind === 'talk') expect(day).toBe('vendredi');
      else expect(day).toBe('samedi');
    }
    expect(events.find((e) => e.title_fr === 'Chut')!.capacity).toBe(20);
  });

  it('prévoit une case perdante et des gains positifs', () => {
    expect(SEED_PRIZES.filter((p) => p.is_losing)).toHaveLength(1);
    expect(SEED_PRIZES.every((p) => p.weight > 0)).toBe(true);
  });
});
