-- Fichier de mise à jour : niveau des musiques Beat Drop. À coller dans SQL Editor de Supabase, puis Run.
-- (Copie de supabase/migrations/20261022000001_beat_tracks_level.sql.)
alter table public.beat_tracks add column if not exists level text not null default 'medium';
alter table public.beat_tracks drop constraint if exists beat_tracks_level_check;
alter table public.beat_tracks add constraint beat_tracks_level_check check (level in ('easy', 'medium', 'hard'));
