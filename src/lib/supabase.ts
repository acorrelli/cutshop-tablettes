import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IS_DEMO, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

// Session admin conservée en mémoire seulement (aucune donnée personnelle sur la tablette).
export const supabase: SupabaseClient | null = IS_DEMO
  ? null
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 20 } },
    });
