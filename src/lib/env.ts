// Sans URL ni clé Supabase, l'application fonctionne en mode démonstration :
// les données sont simulées dans le navigateur et la Battle passe par BroadcastChannel (plusieurs onglets).

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const IS_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
