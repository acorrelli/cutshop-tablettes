// Règle de rédaction absolue : aucun tiret (ni court ni long) dans les textes affichés.
import { describe, expect, it } from 'vitest';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';
import {
  DEFAULT_SETTINGS,
  EVENT_TEMPLATES,
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
const TECHNICAL = /(^|\.)(id|url|image_url|salonkee_url|instagram_url|color|kind|key|category|theme|time|email|image|concept_photo_hero|concept_photo_1|concept_photo_2|concept_photo_3|facebook_url|tiktok_url|website)$|hair_types|scalp_types|effects/;

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
      events: EVENT_TEMPLATES,
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

  it('génère les événements récurrents dans le futur, le bon jour', () => {
    const now = new Date('2026-10-15T08:00:00Z');
    const events = buildSeedEvents(now);
    expect(events.length).toBe(EVENT_TEMPLATES.reduce((s, t) => s + t.count, 0));
    for (const e of events) expect(new Date(e.starts_at).getTime()).toBeGreaterThan(now.getTime());
    const cutSession = events.find((e) => e.title_fr === 'Cut Session')!;
    const local = new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(cutSession.starts_at));
    expect(local).toBe('samedi 21:00');
    const cutTalk = events.find((e) => e.title_fr === 'Cut and Talk')!;
    expect(new Date(cutTalk.starts_at).toISOString()).toBe('2026-10-16T18:30:00.000Z');
  });

  it('prévoit une case perdante et des gains positifs', () => {
    expect(SEED_PRIZES.filter((p) => p.is_losing)).toHaveLength(1);
    expect(SEED_PRIZES.every((p) => p.weight > 0)).toBe(true);
  });
});
