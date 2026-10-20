// Implémentation de démonstration : aucune connexion Supabase.
// Les contenus sont gardés dans le navigateur (localStorage) pour que plusieurs onglets les partagent.
// Les données personnelles (inscriptions, newsletter, demandes) restent uniquement en mémoire.

import {
  DEFAULT_SETTINGS,
  SEED_DRINKS,
  SEED_SERVICES,
  SEED_PAIRINGS,
  SEED_PRIZES,
  SEED_PRODUCTS,
  SEED_QUESTIONS,
  buildSeedEvents,
} from '../../data/seed';
import { randomId } from '../random';
import { startOfBrusselsDay } from '../stop10';
import type {
  AppSettings,
  CutEvent,
  DeskRequest,
  GamePlay,
  InvoiceRequest,
  NewsletterSubscriber,
  ProductRequest,
  Registration,
  Stop10Score,
  WheelSpin,
} from '../types';
import { generateCode, pickWeighted } from '../wheel';
import { mergeSettings } from './supabaseApi';
import type { AdminTable, AdminTableRow, Api, RegisterResult } from './types';

const LS_KEY = 'cutshop.demo.v6';
export const DEMO_PASSWORD = 'demo';
/** Extraits audio envoyés pendant la visite (adresses blob, perdues au rechargement). */
const liveAudio = new Set<string>();

interface SharedState {
  settings: AppSettings;
  pin: string;
  events: CutEvent[];
  services: AdminTableRow['services'][];
  drinks: AdminTableRow['drinks'][];
  drink_pairings: AdminTableRow['drink_pairings'][];
  products: AdminTableRow['products'][];
  quiz_questions: AdminTableRow['quiz_questions'][];
  wheel_prizes: AdminTableRow['wheel_prizes'][];
  beat_tracks: AdminTableRow['beat_tracks'][];
  spins: WheelSpin[];
  stop10: Stop10Score[];
  plays: GamePlay[];
  pinFailures: number[];
}

interface PrivateState {
  registrations: Registration[];
  newsletter: NewsletterSubscriber[];
  product_requests: ProductRequest[];
  invoice_requests: InvoiceRequest[];
  desk_requests: DeskRequest[];
}

function freshShared(): SharedState {
  return {
    settings: structuredClone(DEFAULT_SETTINGS),
    pin: '2468',
    events: buildSeedEvents(),
    services: structuredClone(SEED_SERVICES),
    drinks: structuredClone(SEED_DRINKS),
    drink_pairings: structuredClone(SEED_PAIRINGS),
    products: structuredClone(SEED_PRODUCTS),
    quiz_questions: structuredClone(SEED_QUESTIONS),
    wheel_prizes: structuredClone(SEED_PRIZES),
    beat_tracks: [],
    spins: [],
    stop10: [],
    plays: [],
    pinFailures: [],
  };
}

function load(): SharedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SharedState;
      parsed.settings = mergeSettings(parsed.settings);
      parsed.beat_tracks ??= [];
      // Régénère les événements de démonstration passés pour garder un agenda vivant.
      const future = parsed.events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() > Date.now());
      if (future.length === 0) parsed.events = buildSeedEvents();
      return { ...freshShared(), ...parsed };
    }
  } catch {
    /* stockage indisponible ou corrompu : on repart des données d'exemple */
  }
  return freshShared();
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

export function createDemoApi(): Api {
  let shared = load();
  const priv: PrivateState = {
    registrations: [],
    newsletter: [],
    product_requests: [],
    invoice_requests: [],
    desk_requests: [],
  };
  let session: { email: string } | null = null;

  const refresh = () => {
    shared = load();
  };
  const save = () => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(shared));
    } catch {
      /* ignoré en mode démo */
    }
  };
  const requireAdmin = () => {
    if (!session) throw new Error('Connexion admin requise');
  };
  const seatsTaken = (eventId: string) =>
    priv.registrations.filter((r) => r.event_id === eventId).reduce((s, r) => s + r.seats, 0);

  const checkPin = (pin: string | null): 'ok' | 'pin' | 'locked' => {
    const now = Date.now();
    shared.pinFailures = shared.pinFailures.filter((t) => now - t < 10 * 60000);
    if (shared.pinFailures.length >= 8) return 'locked';
    if ((pin ?? '') !== shared.pin) {
      shared.pinFailures.push(now);
      save();
      return 'pin';
    }
    return 'ok';
  };

  const api: Api = {
    mode: 'demo',

    async getSettings() {
      refresh();
      await delay(60);
      return structuredClone(shared.settings);
    },
    async getEvents() {
      refresh();
      await delay();
      const now = Date.now();
      return shared.events
        .filter((e) => e.published && new Date(e.ends_at ?? new Date(e.starts_at).getTime() + 7200000).getTime() > now)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((e) => ({ ...e, seats_left: Math.max(0, e.capacity - seatsTaken(e.id)) }));
    },
    async getServices() {
      refresh();
      return shared.services.filter((s) => s.active).sort((a, b) => a.sort - b.sort);
    },
    async getDrinks() {
      refresh();
      return shared.drinks.filter((d) => d.active).sort((a, b) => a.sort - b.sort);
    },
    async getPairings() {
      refresh();
      return shared.drink_pairings.filter((d) => d.active).sort((a, b) => a.sort - b.sort);
    },
    async getProducts() {
      refresh();
      return shared.products.filter((p) => p.active).sort((a, b) => a.sort - b.sort);
    },
    async getQuestions() {
      refresh();
      return shared.quiz_questions.filter((q) => q.active);
    },
    async getBeatTracks() {
      refresh();
      // En démo, la musique reste en mémoire le temps de la visite : un morceau dont le fichier a disparu est ignoré.
      return structuredClone((shared.beat_tracks ?? []).filter((t) => t.active && liveAudio.has(t.audio_url)));
    },
    async getWheelSegments() {
      refresh();
      return shared.wheel_prizes
        .filter((p) => p.active && p.weight > 0 && (p.stock === null || p.stock > 0))
        .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
        .map(({ id, label_fr, label_en, color, is_losing }) => ({ id, label_fr, label_en, color, is_losing }));
    },
    async getStop10Today() {
      refresh();
      const since = startOfBrusselsDay().getTime();
      return shared.stop10
        .filter((s) => new Date(s.created_at).getTime() >= since)
        .sort((a, b) => a.delta_ms - b.delta_ms || a.created_at.localeCompare(b.created_at))
        .slice(0, 10);
    },

    async registerEvent(input): Promise<RegisterResult> {
      refresh();
      await delay(250);
      if (!input.consent) return { ok: false, error: 'consent' };
      const ev = shared.events.find((e) => e.id === input.event_id);
      if (!ev || !ev.published) return { ok: false, error: 'closed' };
      const left = ev.capacity - seatsTaken(ev.id);
      if (left <= 0) return { ok: false, error: 'full', seats_left: 0 };
      if (input.seats > left) return { ok: false, error: 'not_enough', seats_left: left };
      const email = input.email.trim().toLowerCase();
      priv.registrations.push({
        id: randomId('r'),
        event_id: ev.id,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email,
        seats: input.seats,
        newsletter: input.newsletter,
        tablet: input.tablet,
        created_at: new Date().toISOString(),
      });
      if (input.newsletter && !priv.newsletter.some((n) => n.email === email)) {
        priv.newsletter.push({
          email,
          first_name: input.first_name.trim(),
          last_name: input.last_name.trim(),
          source: `event:${ev.title_fr}`,
          created_at: new Date().toISOString(),
        });
      }
      return { ok: true, seats_left: left - input.seats };
    },

    async submitProductRequest(firstName, products, profile, tablet) {
      await delay();
      priv.product_requests.unshift({
        id: randomId('pr'),
        first_name: firstName,
        product_ids: products.map((p) => p.id),
        product_names: products.map((p) => p.name),
        profile,
        tablet,
        status: 'new',
        created_at: new Date().toISOString(),
      });
    },
    async submitInvoiceRequest(input) {
      await delay();
      const { consent: _consent, ...rest } = input;
      void _consent;
      priv.invoice_requests.unshift({ id: randomId('iv'), ...rest, status: 'new', created_at: new Date().toISOString() });
    },
    async submitDeskRequest(kind, tablet) {
      await delay();
      priv.desk_requests.unshift({ id: randomId('dk'), kind, tablet, status: 'new', created_at: new Date().toISOString() });
    },
    async addStop10Score(pseudo, deltaMs, elapsedMs, tablet) {
      refresh();
      shared.stop10.push({ id: randomId('s'), pseudo, delta_ms: deltaMs, elapsed_ms: elapsedMs, tablet, created_at: new Date().toISOString() });
      shared.stop10 = shared.stop10.slice(-500);
      save();
    },
    async logPlay(game, players, ref, tablet) {
      refresh();
      shared.plays.push({ id: randomId('g'), game, players, ref, tablet, created_at: new Date().toISOString() });
      shared.plays = shared.plays.slice(-3000);
      save();
    },

    async verifyPin(pin) {
      refresh();
      await delay();
      if (!shared.settings.modules.wheel) return { ok: false, error: 'disabled' };
      const res = checkPin(pin);
      return res === 'ok' ? { ok: true } : { ok: false, error: res };
    },

    async spinWheel(reason, pin, tablet) {
      refresh();
      await delay(300);
      if (!shared.settings.modules.wheel) return { ok: false, error: 'disabled' };
      if (reason === 'staff') {
        const res = checkPin(pin);
        if (res !== 'ok') return { ok: false, error: res };
      } else {
        const recent = shared.spins.some(
          (s) => s.tablet === tablet && s.reason !== 'staff' && Date.now() - new Date(s.created_at).getTime() < 120000,
        );
        if (recent) return { ok: false, error: 'rate' };
      }
      const prize = pickWeighted(shared.wheel_prizes, Math.random());
      if (!prize) return { ok: false, error: 'empty' };
      if (prize.stock !== null) prize.stock -= 1;
      let code: string | null = null;
      if (!prize.is_losing) {
        do code = generateCode();
        while (shared.spins.some((s) => s.code === code));
      }
      shared.spins.unshift({
        id: randomId('sp'),
        prize_id: prize.id,
        label_fr: prize.label_fr,
        label_en: prize.label_en,
        code,
        reason,
        tablet,
        created_at: new Date().toISOString(),
        redeemed_at: null,
      });
      save();
      return { ok: true, prize_id: prize.id, label_fr: prize.label_fr, label_en: prize.label_en, code, is_losing: prize.is_losing };
    },

    async signIn(email, password) {
      await delay(200);
      if (password !== DEMO_PASSWORD) throw new Error('Identifiants incorrects (mode démo : mot de passe « demo »)');
      session = { email };
      return { email, isAdmin: true };
    },
    async signOut() {
      session = null;
    },
    async getSession() {
      return session ? { email: session.email, isAdmin: true } : null;
    },

    async adminList<T extends AdminTable>(table: T) {
      requireAdmin();
      refresh();
      const rows = structuredClone(shared[table]) as AdminTableRow[T][];
      return rows;
    },
    async adminUpsert<T extends AdminTable>(table: T, row: Partial<AdminTableRow[T]>) {
      requireAdmin();
      refresh();
      const list = shared[table] as unknown as AdminTableRow[T][];
      const id = (row as { id?: string }).id;
      const idx = id ? list.findIndex((r) => (r as { id: string }).id === id) : -1;
      let saved: AdminTableRow[T];
      if (idx >= 0) {
        saved = { ...list[idx], ...row } as AdminTableRow[T];
        list[idx] = saved;
      } else {
        saved = { ...row, id: id || randomId('n') } as AdminTableRow[T];
        list.push(saved);
      }
      save();
      return structuredClone(saved);
    },
    async adminUpdate<T extends AdminTable>(table: T, id: string, patch: Partial<AdminTableRow[T]>) {
      requireAdmin();
      refresh();
      const list = shared[table] as unknown as AdminTableRow[T][];
      const idx = list.findIndex((r) => (r as { id: string }).id === id);
      if (idx < 0) throw new Error('Élément introuvable');
      list[idx] = { ...list[idx], ...patch, id } as AdminTableRow[T];
      save();
      return structuredClone(list[idx]);
    },
    async adminDelete(table, id) {
      requireAdmin();
      refresh();
      const list = shared[table] as unknown as { id: string }[];
      const idx = list.findIndex((r) => r.id === id);
      if (idx >= 0) list.splice(idx, 1);
      if (table === 'events') priv.registrations = priv.registrations.filter((r) => r.event_id !== id);
      save();
    },
    async saveSettings(settings) {
      requireAdmin();
      refresh();
      shared.settings = mergeSettings(settings);
      save();
    },
    async getStaffPin() {
      requireAdmin();
      refresh();
      return shared.pin;
    },
    async setStaffPin(pin) {
      requireAdmin();
      refresh();
      shared.pin = pin;
      save();
    },
    async listRegistrations(eventId) {
      requireAdmin();
      return priv.registrations
        .filter((r) => !eventId || r.event_id === eventId)
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listNewsletter() {
      requireAdmin();
      return priv.newsletter.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async deleteNewsletter(email) {
      requireAdmin();
      priv.newsletter = priv.newsletter.filter((n) => n.email !== email);
    },
    async listSpins(limit = 300) {
      requireAdmin();
      refresh();
      return shared.spins.slice(0, limit);
    },
    async redeemCode(code) {
      requireAdmin();
      refresh();
      const spin = shared.spins.find((s) => s.code === code.trim().toUpperCase());
      if (!spin) return { ok: false, error: 'unknown' };
      if (spin.redeemed_at) return { ok: false, error: 'used', label_fr: spin.label_fr, redeemed_at: spin.redeemed_at };
      spin.redeemed_at = new Date().toISOString();
      save();
      return { ok: true, label_fr: spin.label_fr, created_at: spin.created_at };
    },
    listRequests: (async (table: 'product_requests' | 'invoice_requests' | 'desk_requests') => {
      requireAdmin();
      return priv[table].slice();
    }) as Api['listRequests'],
    async setRequestStatus(table, id, status) {
      requireAdmin();
      const row = (priv[table] as { id: string; status: string }[]).find((r) => r.id === id);
      if (row) row.status = status;
    },
    async deleteRequest(table, id) {
      requireAdmin();
      (priv as unknown as Record<string, { id: string }[]>)[table] = (priv[table] as { id: string }[]).filter((r) => r.id !== id);
    },
    async statsSince(sinceIso) {
      requireAdmin();
      refresh();
      const since = (iso: string) => iso >= sinceIso;
      return {
        plays: shared.plays.filter((p) => since(p.created_at)),
        registrations: priv.registrations.filter((r) => since(r.created_at)),
        spins: shared.spins.filter((s) => since(s.created_at)),
        productRequests: priv.product_requests.filter((r) => since(r.created_at)),
      };
    },
    async uploadImage(file) {
      requireAdmin();
      // En démo, l'image est convertie en data URL (pratique pour prévisualiser).
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    async uploadAudio(file) {
      requireAdmin();
      const url = URL.createObjectURL(file);
      liveAudio.add(url);
      return url;
    },
    async removeMedia(url) {
      requireAdmin();
      if (liveAudio.delete(url)) URL.revokeObjectURL(url);
    },
    async purgePersonalData() {
      requireAdmin();
      const limit = Date.now() - 90 * 86400000;
      const old = new Set(shared.events.filter((e) => new Date(e.ends_at ?? e.starts_at).getTime() < limit).map((e) => e.id));
      const before = priv.registrations.length;
      priv.registrations = priv.registrations.filter((r) => !old.has(r.event_id));
      return { registrations: before - priv.registrations.length, invoices: 0, product_requests: 0, desk_requests: 0 };
    },
  };
  return api;
}
