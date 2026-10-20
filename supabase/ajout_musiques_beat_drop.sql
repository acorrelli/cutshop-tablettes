-- Fichier de mise à jour : copie de supabase/migrations/20261021000001_beat_tracks.sql, à coller dans SQL Editor puis Run.
-- Beat Drop : musiques importées depuis l'admin (extrait MP3 de 72 secondes et partitions calculées à l'import).
-- Les fichiers audio sont rangés dans le bucket public « media » (dossier beat/), sous un nom aléatoire.
-- Ce fichier peut être exécuté plusieurs fois sans risque (base déjà installée : SQL Editor, puis Run).

create table if not exists public.beat_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  artist text not null default '' check (char_length(artist) <= 80),
  cover_url text,
  audio_url text not null,
  bpm numeric not null check (bpm between 50 and 220),
  beat_phase_ms int not null default 0 check (beat_phase_ms >= 0),
  -- Partitions compactes par niveau : {"easy": [[ms, piste, durée], ...], "medium": [...], "hard": [...]}.
  charts jsonb not null check (jsonb_typeof(charts) = 'object' and pg_column_size(charts) < 200000),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.beat_tracks enable row level security;
grant select on public.beat_tracks to anon;
grant select, insert, update, delete on public.beat_tracks to authenticated;

drop policy if exists beat_tracks_read on public.beat_tracks;
create policy beat_tracks_read on public.beat_tracks for select to anon, authenticated using (active or public.is_admin());
drop policy if exists beat_tracks_admin on public.beat_tracks;
create policy beat_tracks_admin on public.beat_tracks for all to authenticated using (public.is_admin()) with check (public.is_admin());
