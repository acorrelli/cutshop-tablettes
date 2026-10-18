import { IS_DEMO } from '../../lib/env';
import { createDemoServer } from './demoServer';
import { createSupabaseServer } from './supabaseServer';
import type { ArcadeServer } from './types';

let instance: ArcadeServer | null = null;

/** Serveur de Cutshop Challenge : Supabase en production, navigateur en démonstration. */
export function arcadeServer(): ArcadeServer {
  if (!instance) instance = IS_DEMO ? createDemoServer() : createSupabaseServer();
  return instance;
}

export type { ArcadeServer } from './types';
