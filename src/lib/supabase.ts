import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';
import { isStaffDevice } from './tablet';

// Session admin : en mémoire seulement sur les tablettes clientes (aucune donnée personnelle sur la tablette),
// conservée dans le navigateur du poste de l'équipe (Chromebook) pour survivre à sa mise en veille.
const memory = new Map<string, string>();
const authStorage = {
  getItem(key: string): string | null {
    if (!isStaffDevice()) return memory.get(key) ?? null;
    try {
      return localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    if (!isStaffDevice()) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible : la session reste en mémoire */
    }
  },
  removeItem(key: string): void {
    memory.delete(key);
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignoré */
    }
  },
};

export const supabase: SupabaseClient | null = IS_DEMO
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, storage: authStorage, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
