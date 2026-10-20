import type { BeatTrackRow } from '../../arcade/games/beat/tracks';
// Implémentation Supabase de la couche de données.

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS } from '../../data/seed';
import type { AppSettings, CutEventWithSeats, Product, SpinResult, WheelSegment } from '../types';
import { NetworkError, type AdminSession, type Api, type PinCheck, type RedeemResult, type RegisterResult } from './types';

function isNetworkFailure(err: { message?: string } | null | undefined): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = err?.message ?? '';
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed/i.test(msg);
}

/** Convertit une erreur Supabase en exception, en distinguant les coupures réseau. */
function check(error: PostgrestError | { message: string } | null): void {
  if (!error) return;
  if (isNetworkFailure(error)) throw new NetworkError(error.message);
  throw new Error(error.message);
}

/** Fusionne les réglages enregistrés avec les valeurs par défaut (nouveaux champs ajoutés plus tard). */
export function mergeSettings(data: Partial<AppSettings> | null | undefined): AppSettings {
  const d = data ?? {};
  const arcade = { ...DEFAULT_SETTINGS.arcade, ...(d.arcade ?? {}), games: { ...DEFAULT_SETTINGS.arcade.games, ...(d.arcade?.games ?? {}) } };
  return { ...DEFAULT_SETTINGS, ...d, modules: { ...DEFAULT_SETTINGS.modules, ...(d.modules ?? {}) }, arcade };
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NetworkError) throw e;
    if (e instanceof TypeError && isNetworkFailure(e)) throw new NetworkError(e.message);
    throw e;
  }
}

export function createSupabaseApi(sb: SupabaseClient): Api {
  const sessionInfo = async (): Promise<AdminSession | null> => {
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const { data: isAdmin } = await sb.rpc('is_admin');
    return { email: user.email ?? '', isAdmin: Boolean(isAdmin) };
  };

  const api: Api = {
    mode: 'supabase',

    getSettings: () =>
      wrap(async () => {
        const { data, error } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
        check(error);
        return mergeSettings(data?.data as Partial<AppSettings>);
      }),

    getEvents: () =>
      wrap(async () => {
        const { data, error } = await sb.rpc('get_public_events', undefined, { get: true });
        check(error);
        return (data ?? []) as CutEventWithSeats[];
      }),

    getServices: () =>
      wrap(async () => {
        const { data, error } = await sb.from('services').select('*').eq('active', true).order('sort');
        check(error);
        return (data ?? []).map((s) => ({
          ...s,
          price: Number(s.price),
          student_price: s.student_price === null ? null : Number(s.student_price),
        }));
      }),

    getDrinks: () =>
      wrap(async () => {
        const { data, error } = await sb.from('drinks').select('*').eq('active', true).order('sort');
        check(error);
        return (data ?? []).map((d) => ({ ...d, abv: d.abv === null ? null : Number(d.abv), price: Number(d.price) }));
      }),

    getPairings: () =>
      wrap(async () => {
        const { data, error } = await sb.from('drink_pairings').select('*').eq('active', true).order('sort');
        check(error);
        return data ?? [];
      }),

    getProducts: () =>
      wrap(async () => {
        const { data, error } = await sb.from('products').select('*').eq('active', true).order('sort');
        check(error);
        return (data ?? []).map((p) => ({ ...p, price: Number(p.price) })) as Product[];
      }),

    getQuestions: () =>
      wrap(async () => {
        const { data, error } = await sb.from('quiz_questions').select('*').eq('active', true);
        check(error);
        return data ?? [];
      }),

    getWheelSegments: () =>
      wrap(async () => {
        const { data, error } = await sb.rpc('get_wheel_segments', undefined, { get: true });
        check(error);
        return (data ?? []) as WheelSegment[];
      }),

    getBeatTracks: async () => {
      // Table absente (SQL pas encore lancé) ou réseau coupé : Beat Drop garde ses morceaux de synthèse.
      try {
        const { data, error } = await sb.from('beat_tracks').select('*').eq('active', true).order('sort');
        if (error) return [];
        return (data ?? []).map((r) => ({ ...r, bpm: Number(r.bpm) })) as BeatTrackRow[];
      } catch {
        return [];
      }
    },

    getStop10Today: () =>
      wrap(async () => {
        const { data, error } = await sb
          .from('stop10_scores')
          .select('id, pseudo, delta_ms, elapsed_ms, tablet, created_at')
          .order('delta_ms')
          .order('created_at')
          .limit(10);
        check(error);
        return data ?? [];
      }),

    registerEvent: (input) =>
      wrap(async () => {
        const { data, error } = await sb.rpc('register_event', {
          p_event_id: input.event_id,
          p_first_name: input.first_name,
          p_last_name: input.last_name,
          p_email: input.email,
          p_seats: input.seats,
          p_newsletter: input.newsletter,
          p_consent: input.consent,
          p_tablet: input.tablet,
        });
        check(error);
        return data as RegisterResult;
      }),

    submitProductRequest: (firstName, products, profile, tablet) =>
      wrap(async () => {
        const { error } = await sb.from('product_requests').insert({
          first_name: firstName,
          product_ids: products.map((p) => p.id),
          product_names: products.map((p) => p.name),
          profile,
          tablet,
        });
        check(error);
      }),

    submitInvoiceRequest: (input) =>
      wrap(async () => {
        const { error } = await sb.from('invoice_requests').insert(input);
        check(error);
      }),

    submitDeskRequest: (kind, tablet) =>
      wrap(async () => {
        const { error } = await sb.from('desk_requests').insert({ kind, tablet });
        check(error);
      }),

    addStop10Score: (pseudo, deltaMs, elapsedMs, tablet) =>
      wrap(async () => {
        const { error } = await sb.from('stop10_scores').insert({ pseudo, delta_ms: deltaMs, elapsed_ms: elapsedMs, tablet });
        check(error);
      }),

    logPlay: (game, players, ref, tablet) =>
      wrap(async () => {
        const { error } = await sb.from('game_plays').insert({ game, players, ref, tablet });
        check(error);
      }),

    verifyPin: async (pin, tablet) => {
      try {
        const { data, error } = await sb.rpc('verify_wheel_pin', { p_pin: pin, p_tablet: tablet });
        check(error);
        return data as PinCheck;
      } catch (e) {
        if (e instanceof NetworkError) return { ok: false, error: 'network' };
        throw e;
      }
    },

    spinWheel: async (reason, pin, tablet) => {
      try {
        const { data, error } = await sb.rpc('spin_wheel', { p_reason: reason, p_pin: pin, p_tablet: tablet });
        check(error);
        return data as SpinResult;
      } catch (e) {
        if (e instanceof NetworkError) return { ok: false, error: 'network' };
        throw e;
      }
    },

    signIn: async (email, password) => {
      // Les claviers tactiles ajoutent souvent une majuscule ou une espace en fin d'adresse.
      const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error && /invalid login credentials/i.test(error.message)) throw new Error('Adresse mail ou mot de passe incorrect.');
      check(error);
      const s = await sessionInfo();
      if (!s) throw new Error('Session introuvable');
      return s;
    },

    signOut: async () => {
      await sb.auth.signOut();
    },

    getSession: sessionInfo,

    adminList: async (table) => {
      let query = sb.from(table).select('*');
      if (table === 'events') query = query.order('starts_at', { ascending: true });
      else if (table === 'quiz_questions') query = query.order('theme').order('created_at');
      else query = query.order('sort');
      const { data, error } = await query;
      check(error);
      return (data ?? []) as never[];
    },

    adminUpsert: async (table, row) => {
      const { data, error } = await sb.from(table).upsert(row as never).select().single();
      check(error);
      return data as never;
    },

    adminDelete: async (table, id) => {
      const { error } = await sb.from(table).delete().eq('id', id);
      check(error);
    },

    saveSettings: async (settings) => {
      const { error } = await sb.from('settings').upsert({ id: 1, data: settings, updated_at: new Date().toISOString() });
      check(error);
    },

    getStaffPin: async () => {
      const { data, error } = await sb.from('staff_settings').select('wheel_pin').eq('id', 1).maybeSingle();
      check(error);
      return data?.wheel_pin ?? '';
    },

    setStaffPin: async (pin) => {
      const { error } = await sb.from('staff_settings').upsert({ id: 1, wheel_pin: pin, updated_at: new Date().toISOString() });
      check(error);
    },

    listRegistrations: async (eventId) => {
      let query = sb.from('event_registrations').select('*').order('created_at', { ascending: false });
      if (eventId) query = query.eq('event_id', eventId);
      const { data, error } = await query.limit(2000);
      check(error);
      return data ?? [];
    },

    listNewsletter: async () => {
      const { data, error } = await sb.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
      check(error);
      return data ?? [];
    },

    deleteNewsletter: async (email) => {
      const { error } = await sb.from('newsletter_subscribers').delete().eq('email', email);
      check(error);
    },

    listSpins: async (limit = 300) => {
      const { data, error } = await sb.from('wheel_spins').select('*').order('created_at', { ascending: false }).limit(limit);
      check(error);
      return data ?? [];
    },

    redeemCode: async (code) => {
      const { data, error } = await sb.rpc('redeem_code', { p_code: code });
      check(error);
      return data as RedeemResult;
    },

    listRequests: (async (table: 'product_requests' | 'invoice_requests' | 'desk_requests') => {
      const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false }).limit(500);
      check(error);
      return data ?? [];
    }) as Api['listRequests'],

    setRequestStatus: async (table, id, status) => {
      const { error } = await sb.from(table).update({ status }).eq('id', id);
      check(error);
    },

    deleteRequest: async (table, id) => {
      const { error } = await sb.from(table).delete().eq('id', id);
      check(error);
    },

    statsSince: async (sinceIso) => {
      const [plays, regs, spins, reqs] = await Promise.all([
        sb.from('game_plays').select('*').gte('created_at', sinceIso).limit(10000),
        sb.from('event_registrations').select('event_id, seats, tablet, created_at').gte('created_at', sinceIso).limit(10000),
        sb.from('wheel_spins').select('reason, tablet, created_at, code, redeemed_at').gte('created_at', sinceIso).limit(10000),
        sb.from('product_requests').select('tablet, created_at').gte('created_at', sinceIso).limit(10000),
      ]);
      check(plays.error);
      check(regs.error);
      check(spins.error);
      check(reqs.error);
      return {
        plays: plays.data ?? [],
        registrations: regs.data ?? [],
        spins: spins.data ?? [],
        productRequests: reqs.data ?? [],
      };
    },

    uploadImage: async (file) => {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false });
      check(error);
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    uploadAudio: async (file) => {
      const path = `beat/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.mp3`;
      const { error } = await sb.storage.from('media').upload(path, file, { cacheControl: '31536000', upsert: false, contentType: 'audio/mpeg' });
      check(error);
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    removeMedia: async (url) => {
      const marker = '/storage/v1/object/public/media/';
      const i = url.indexOf(marker);
      if (i < 0) return;
      const { error } = await sb.storage.from('media').remove([decodeURIComponent(url.slice(i + marker.length))]);
      check(error);
    },

    purgePersonalData: async () => {
      const { data, error } = await sb.rpc('purge_personal_data');
      check(error);
      return data as Record<string, number>;
    },
  };
  return api;
}
