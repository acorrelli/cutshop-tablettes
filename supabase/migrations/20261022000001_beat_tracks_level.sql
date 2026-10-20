-- Beat Drop : niveau de chaque musique importée. Sur les tablettes, une musique n'apparaît que dans son niveau.
-- Relançable sans risque.
alter table public.beat_tracks add column if not exists level text not null default 'medium';
alter table public.beat_tracks drop constraint if exists beat_tracks_level_check;
alter table public.beat_tracks add constraint beat_tracks_level_check check (level in ('easy', 'medium', 'hard'));
