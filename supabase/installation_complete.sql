-- Cutshop Mons : installation complète de la base (fichier généré par scripts/build-setup-sql.mjs).
-- À coller en une fois dans SQL Editor d'un projet Supabase neuf, puis Run. Ne pas exécuter deux fois.
-- Contenu : supabase/migrations/20261015000001_init.sql, supabase/migrations/20261018000001_services.sql, supabase/migrations/20261018000002_arcade.sql, supabase/migrations/20261021000001_beat_tracks.sql, supabase/migrations/20261022000001_beat_tracks_level.sql, supabase/seed.sql

-- ===== supabase/migrations/20261015000001_init.sql =====
-- =============================================================================
-- Cutshop tablettes : schéma complet
-- Tables, index, politiques RLS strictes et fonctions serveur.
--
-- Principe de sécurité :
--   * Les tablettes utilisent la clé anon : lecture des contenus publics,
--     insertion des inscriptions et demandes, jamais de lecture de données personnelles.
--   * Les inscriptions aux événements et la roue passent par des fonctions
--     SECURITY DEFINER qui contrôlent tout côté serveur (capacité, code PIN, tirage).
--   * Seuls les comptes listés dans public.admins lisent et modifient les données.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Administrateurs
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Début de la journée en cours à Bruxelles (classement du jour remis à zéro chaque nuit).
create or replace function public.brussels_day_start()
returns timestamptz
language sql
stable
as $$
  select (date_trunc('day', now() at time zone 'Europe/Brussels')) at time zone 'Europe/Brussels';
$$;

-- -----------------------------------------------------------------------------
-- Réglages
-- -----------------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Réglages réservés à l'équipe (jamais lisibles par les tablettes).
create table if not exists public.staff_settings (
  id int primary key default 1 check (id = 1),
  wheel_pin text not null default '2468' check (wheel_pin ~ '^[0-9]{4,8}$'),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Événements et inscriptions
-- -----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'other' check (kind in ('dj', 'talk', 'read', 'mic', 'run', 'other')),
  title_fr text not null check (char_length(title_fr) between 1 and 120),
  title_en text not null default '',
  description_fr text not null default '',
  description_en text not null default '',
  recurrence_fr text not null default '',
  recurrence_en text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  image_url text,
  capacity int not null default 30 check (capacity between 0 and 10000),
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists events_starts_at_idx on public.events (starts_at);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  seats int not null check (seats between 1 and 10),
  newsletter boolean not null default false,
  consent boolean not null check (consent),
  tablet text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);
create index if not exists event_registrations_created_idx on public.event_registrations (created_at);

create table if not exists public.newsletter_subscribers (
  email text primary key check (char_length(email) <= 254),
  first_name text not null default '',
  last_name text not null default '',
  source text not null default '',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Carte du bar
-- -----------------------------------------------------------------------------
create table if not exists public.drinks (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('beer', 'soft', 'other')),
  name text not null,
  brand text not null default '',
  style_fr text not null default '',
  style_en text not null default '',
  abv numeric(4, 1),
  description_fr text not null default '',
  description_en text not null default '',
  price numeric(6, 2) not null default 0 check (price >= 0),
  image_url text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.drink_pairings (
  id uuid primary key default gen_random_uuid(),
  cut_fr text not null,
  cut_en text not null default '',
  drink_fr text not null default '',
  drink_en text not null default '',
  line_fr text not null default '',
  line_en text not null default '',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Produits
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  benefit_fr text not null default '',
  benefit_en text not null default '',
  usage_fr text not null default '',
  usage_en text not null default '',
  price numeric(6, 2) not null default 0 check (price >= 0),
  image_url text,
  hair_types text[] not null default '{}' check (hair_types <@ array['fine', 'thick', 'curly', 'coily']),
  scalp_types text[] not null default '{}' check (scalp_types <@ array['normal', 'dry', 'oily']),
  for_beard boolean not null default false,
  effects text[] not null default '{}' check (effects <@ array['volume', 'hold', 'shine', 'natural', 'care']),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Quiz
-- -----------------------------------------------------------------------------
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  theme text not null check (theme in ('mons', 'beer', 'barber', 'music', 'general', 'kids')),
  question_fr text not null,
  question_en text not null default '',
  answers_fr text[] not null check (array_length(answers_fr, 1) between 2 and 4),
  answers_en text[] not null default '{}',
  correct_index int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (correct_index >= 0 and correct_index < array_length(answers_fr, 1))
);
create index if not exists quiz_questions_theme_idx on public.quiz_questions (theme);

-- -----------------------------------------------------------------------------
-- Roue de la fortune
-- -----------------------------------------------------------------------------
create table if not exists public.wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  label_fr text not null,
  label_en text not null default '',
  weight numeric(6, 2) not null default 10 check (weight >= 0),
  stock int check (stock is null or stock >= 0),
  is_losing boolean not null default false,
  color text not null default '#D4A84B',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  prize_id uuid references public.wheel_prizes (id) on delete set null,
  label_fr text not null,
  label_en text not null default '',
  code text unique check (code is null or code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  reason text not null check (reason in ('staff', 'battle', 'stop10')),
  tablet text not null default '',
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid
);
create index if not exists wheel_spins_created_idx on public.wheel_spins (created_at);

-- Tentatives de code PIN (protection contre les essais en série).
create table if not exists public.pin_attempts (
  id bigint generated always as identity primary key,
  tablet text not null default '',
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists pin_attempts_created_idx on public.pin_attempts (created_at);

-- -----------------------------------------------------------------------------
-- Jeux et statistiques
-- -----------------------------------------------------------------------------
create table if not exists public.stop10_scores (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null check (char_length(pseudo) between 1 and 14),
  delta_ms int not null check (delta_ms between 0 and 600000),
  elapsed_ms int not null check (elapsed_ms between 0 and 600000),
  tablet text not null default '' check (char_length(tablet) <= 30),
  created_at timestamptz not null default now()
);
create index if not exists stop10_scores_created_idx on public.stop10_scores (created_at);

create table if not exists public.game_plays (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('battle', 'battle_solo', 'stop10', 'memory', 'barber', 'wheel')),
  players int not null default 1 check (players between 1 and 4),
  ref text check (ref is null or char_length(ref) <= 64),
  tablet text not null default '' check (char_length(tablet) <= 30),
  created_at timestamptz not null default now()
);
create index if not exists game_plays_created_idx on public.game_plays (created_at);

-- -----------------------------------------------------------------------------
-- Demandes envoyées par les tablettes
-- -----------------------------------------------------------------------------
create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  product_ids text[] not null default '{}',
  product_names text[] not null default '{}',
  profile jsonb not null default '{}'::jsonb,
  tablet text not null default '' check (char_length(tablet) <= 30),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 160),
  vat text not null check (char_length(vat) between 4 and 20),
  address text not null check (char_length(address) between 1 and 400),
  email text not null check (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  consent boolean not null check (consent),
  tablet text not null default '' check (char_length(tablet) <= 30),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);

create table if not exists public.desk_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'gift' check (kind in ('gift')),
  tablet text not null default '' check (char_length(tablet) <= 30),
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Droits et politiques RLS
-- =============================================================================
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.staff_settings enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.drinks enable row level security;
alter table public.drink_pairings enable row level security;
alter table public.products enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.wheel_prizes enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.stop10_scores enable row level security;
alter table public.game_plays enable row level security;
alter table public.product_requests enable row level security;
alter table public.invoice_requests enable row level security;
alter table public.desk_requests enable row level security;

-- On repart d'une base saine : aucun droit implicite pour anon, droits explicites ensuite.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon, public;
grant usage on schema public to anon, authenticated;

-- Contenus publics : lecture seule pour les tablettes.
grant select on public.settings, public.events, public.drinks, public.drink_pairings, public.products, public.quiz_questions to anon;
-- Insertions autorisées (aucune lecture en retour).
grant insert on public.stop10_scores, public.game_plays, public.product_requests, public.invoice_requests, public.desk_requests to anon;
-- Classement du jour : uniquement pseudo et écart, pas de donnée personnelle.
grant select on public.stop10_scores to anon;

-- L'admin connecté passe par le rôle authenticated et les politiques is_admin().
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Politiques : contenus publics
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy events_read on public.events for select to anon, authenticated using (published or public.is_admin());
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy drinks_read on public.drinks for select to anon, authenticated using (active or public.is_admin());
create policy drinks_admin on public.drinks for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pairings_read on public.drink_pairings for select to anon, authenticated using (active or public.is_admin());
create policy pairings_admin on public.drink_pairings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select to anon, authenticated using (active or public.is_admin());
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy questions_read on public.quiz_questions for select to anon, authenticated using (active or public.is_admin());
create policy questions_admin on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Politiques : données réservées à l'équipe
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy staff_settings_admin on public.staff_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy registrations_admin on public.event_registrations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy newsletter_admin on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy prizes_admin on public.wheel_prizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy spins_admin on public.wheel_spins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pin_attempts_admin on public.pin_attempts for select to authenticated using (public.is_admin());

-- Politiques : insertions depuis les tablettes
create policy stop10_insert on public.stop10_scores for insert to anon, authenticated with check (true);
create policy stop10_read_today on public.stop10_scores for select to anon, authenticated
  using (created_at >= public.brussels_day_start() or public.is_admin());
create policy stop10_admin on public.stop10_scores for delete to authenticated using (public.is_admin());

create policy plays_insert on public.game_plays for insert to anon, authenticated with check (true);
create policy plays_admin on public.game_plays for select to authenticated using (public.is_admin());

create policy product_requests_insert on public.product_requests for insert to anon, authenticated with check (status = 'new');
create policy product_requests_admin on public.product_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy invoice_requests_insert on public.invoice_requests for insert to anon, authenticated with check (status = 'new');
create policy invoice_requests_admin on public.invoice_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy desk_requests_insert on public.desk_requests for insert to anon, authenticated with check (status = 'new');
create policy desk_requests_admin on public.desk_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Fonctions serveur
-- =============================================================================

-- Événements à venir avec places restantes (sans jamais exposer les inscrits).
create or replace function public.get_public_events()
returns table (
  id uuid,
  kind text,
  title_fr text,
  title_en text,
  description_fr text,
  description_en text,
  recurrence_fr text,
  recurrence_en text,
  starts_at timestamptz,
  ends_at timestamptz,
  image_url text,
  capacity int,
  published boolean,
  seats_left int
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.kind, e.title_fr, e.title_en, e.description_fr, e.description_en,
         e.recurrence_fr, e.recurrence_en, e.starts_at, e.ends_at, e.image_url, e.capacity, e.published,
         greatest(e.capacity - coalesce((select sum(r.seats) from public.event_registrations r where r.event_id = e.id), 0), 0)::int
  from public.events e
  where e.published
    and coalesce(e.ends_at, e.starts_at + interval '2 hours') > now()
  order by e.starts_at
  limit 100;
$$;

-- Inscription à un événement avec contrôle de capacité atomique.
create or replace function public.register_event(
  p_event_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_seats int,
  p_newsletter boolean,
  p_consent boolean,
  p_tablet text default ''
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_taken int;
  v_left int;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not coalesce(p_consent, false) then
    return jsonb_build_object('ok', false, 'error', 'consent');
  end if;
  if coalesce(trim(p_first_name), '') = '' or coalesce(trim(p_last_name), '') = ''
     or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_seats is null or p_seats < 1 or p_seats > 10 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Verrou sur l'événement : deux tablettes ne peuvent pas prendre la dernière place en même temps.
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not v_event.published or coalesce(v_event.ends_at, v_event.starts_at + interval '2 hours') <= now() then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;

  select coalesce(sum(seats), 0) into v_taken from public.event_registrations where event_id = p_event_id;
  v_left := v_event.capacity - v_taken;
  if v_left <= 0 then
    return jsonb_build_object('ok', false, 'error', 'full', 'seats_left', 0);
  end if;
  if p_seats > v_left then
    return jsonb_build_object('ok', false, 'error', 'not_enough', 'seats_left', v_left);
  end if;

  insert into public.event_registrations (event_id, first_name, last_name, email, seats, newsletter, consent, tablet)
  values (p_event_id, left(trim(p_first_name), 80), left(trim(p_last_name), 80), v_email, p_seats,
          coalesce(p_newsletter, false), true, left(coalesce(p_tablet, ''), 30));

  if coalesce(p_newsletter, false) then
    insert into public.newsletter_subscribers (email, first_name, last_name, source)
    values (v_email, left(trim(p_first_name), 80), left(trim(p_last_name), 80), 'event:' || v_event.title_fr)
    on conflict (email) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'seats_left', v_left - p_seats);
end;
$$;

-- Segments publics de la roue (sans probabilités ni stocks).
create or replace function public.get_wheel_segments()
returns table (id uuid, label_fr text, label_en text, color text, is_losing boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.label_fr, p.label_en, p.color, p.is_losing
  from public.wheel_prizes p
  where p.active and p.weight > 0 and (p.stock is null or p.stock > 0)
  order by p.sort, p.id;
$$;

-- Contrôle du code PIN staff avec limitation des essais (8 échecs en 10 minutes bloquent la roue).
create or replace function public.check_pin_internal(p_pin text, p_tablet text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pin text;
  v_failures int;
begin
  select count(*) into v_failures from public.pin_attempts
  where not success and created_at > now() - interval '10 minutes';
  if v_failures >= 8 then
    return 'locked';
  end if;
  select wheel_pin into v_pin from public.staff_settings where id = 1;
  if v_pin is null or coalesce(p_pin, '') <> v_pin then
    insert into public.pin_attempts (tablet, success) values (left(coalesce(p_tablet, ''), 30), false);
    return 'pin';
  end if;
  insert into public.pin_attempts (tablet, success) values (left(coalesce(p_tablet, ''), 30), true);
  return 'ok';
end;
$$;

create or replace function public.verify_wheel_pin(p_pin text, p_tablet text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_res text;
begin
  if coalesce((select (data -> 'modules' ->> 'wheel')::boolean from public.settings where id = 1), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'disabled');
  end if;
  v_res := public.check_pin_internal(p_pin, p_tablet);
  if v_res = 'ok' then
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', false, 'error', v_res);
end;
$$;

-- Génère un code gagnant de 6 caractères sans caractères ambigus.
create or replace function public.generate_prize_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := extensions.gen_random_bytes(6);
begin
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Tirage de la roue : entièrement côté serveur.
--   p_reason = 'staff'  : le code PIN est obligatoire.
--   p_reason = 'battle' ou 'stop10' : tour offert, limité à un tour automatique
--   toutes les 2 minutes par tablette pour éviter les abus.
create or replace function public.spin_wheel(p_reason text, p_pin text default null, p_tablet text default '')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tablet text := left(coalesce(p_tablet, ''), 30);
  v_check text;
  v_total numeric;
  v_target numeric;
  v_prize public.wheel_prizes%rowtype;
  v_code text;
  v_try int := 0;
begin
  if coalesce((select (data -> 'modules' ->> 'wheel')::boolean from public.settings where id = 1), false) is not true then
    return jsonb_build_object('ok', false, 'error', 'disabled');
  end if;

  if p_reason = 'staff' then
    v_check := public.check_pin_internal(p_pin, v_tablet);
    if v_check <> 'ok' then
      return jsonb_build_object('ok', false, 'error', v_check);
    end if;
  elsif p_reason in ('battle', 'stop10') then
    if exists (
      select 1 from public.wheel_spins
      where tablet = v_tablet and reason in ('battle', 'stop10') and created_at > now() - interval '2 minutes'
    ) then
      return jsonb_build_object('ok', false, 'error', 'rate');
    end if;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;

  -- Verrouille les gains éligibles le temps du tirage (stocks cohérents entre tablettes).
  perform 1 from public.wheel_prizes
  where active and weight > 0 and (stock is null or stock > 0)
  for update;

  select coalesce(sum(weight), 0) into v_total from public.wheel_prizes
  where active and weight > 0 and (stock is null or stock > 0);
  if v_total <= 0 then
    return jsonb_build_object('ok', false, 'error', 'empty');
  end if;

  -- Tirage pondéré : même règle que src/lib/wheel.ts (ordre sort puis id, poids cumulés).
  v_target := random() * v_total;
  for v_prize in
    select * from public.wheel_prizes
    where active and weight > 0 and (stock is null or stock > 0)
    order by sort, id
  loop
    exit when v_target < v_prize.weight;
    v_target := v_target - v_prize.weight;
  end loop;

  if v_prize.stock is not null then
    update public.wheel_prizes set stock = stock - 1 where id = v_prize.id;
  end if;

  if v_prize.is_losing then
    insert into public.wheel_spins (prize_id, label_fr, label_en, code, reason, tablet)
    values (v_prize.id, v_prize.label_fr, v_prize.label_en, null, p_reason, v_tablet);
  else
    loop
      v_try := v_try + 1;
      v_code := public.generate_prize_code();
      begin
        insert into public.wheel_spins (prize_id, label_fr, label_en, code, reason, tablet)
        values (v_prize.id, v_prize.label_fr, v_prize.label_en, v_code, p_reason, v_tablet);
        exit;
      exception when unique_violation then
        if v_try > 20 then
          raise;
        end if;
      end;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'prize_id', v_prize.id,
    'label_fr', v_prize.label_fr,
    'label_en', v_prize.label_en,
    'code', v_code,
    'is_losing', v_prize.is_losing
  );
end;
$$;

-- Validation d'un code gagnant au comptoir (admin uniquement). Un code validé devient inutilisable.
create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_spin public.wheel_spins%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select * into v_spin from public.wheel_spins where code = upper(trim(p_code)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unknown');
  end if;
  if v_spin.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'error', 'used', 'label_fr', v_spin.label_fr, 'redeemed_at', v_spin.redeemed_at);
  end if;
  update public.wheel_spins set redeemed_at = now(), redeemed_by = auth.uid() where id = v_spin.id;
  return jsonb_build_object('ok', true, 'label_fr', v_spin.label_fr, 'created_at', v_spin.created_at);
end;
$$;

-- Purge RGPD : supprime les données personnelles devenues inutiles.
-- À lancer depuis l'admin (bouton dans Réglages) ou automatiquement avec pg_cron (voir README).
create or replace function public.purge_personal_data()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_regs int;
  v_invoices int;
  v_products int;
  v_desk int;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Inscriptions : supprimées +/ 3 mois après l'événement.
  delete from public.event_registrations r
  using public.events e
  where r.event_id = e.id and coalesce(e.ends_at, e.starts_at) < now() - interval '90 days';
  get diagnostics v_regs = row_count;
  -- Demandes de facture traitées depuis plus de 3 mois.
  delete from public.invoice_requests where status = 'done' and created_at < now() - interval '90 days';
  get diagnostics v_invoices = row_count;
  -- Demandes produits : utiles le temps de la visite.
  delete from public.product_requests where created_at < now() - interval '30 days';
  get diagnostics v_products = row_count;
  delete from public.desk_requests where created_at < now() - interval '7 days';
  get diagnostics v_desk = row_count;
  delete from public.pin_attempts where created_at < now() - interval '1 day';
  delete from public.stop10_scores where created_at < now() - interval '30 days';
  return jsonb_build_object('registrations', v_regs, 'invoices', v_invoices, 'product_requests', v_products, 'desk_requests', v_desk);
end;
$$;

-- Droits d'exécution des fonctions : tout est retiré puis accordé explicitement.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.brussels_day_start() to anon, authenticated;
grant execute on function public.get_public_events() to anon, authenticated;
grant execute on function public.register_event(uuid, text, text, text, int, boolean, boolean, text) to anon, authenticated;
grant execute on function public.get_wheel_segments() to anon, authenticated;
grant execute on function public.verify_wheel_pin(text, text) to anon, authenticated;
grant execute on function public.spin_wheel(text, text, text) to anon, authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.purge_personal_data() to authenticated;

-- =============================================================================
-- Stockage des photos (bucket public en lecture, écriture réservée à l'admin)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy media_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- Valeurs initiales indispensables (le contenu d'exemple est dans supabase/seed.sql).
insert into public.settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;
insert into public.staff_settings (id) values (1) on conflict (id) do nothing;


-- ===== supabase/migrations/20261018000001_services.sql =====
-- Prestations du salon affichées dans « Nos services » (tarif classique et tarif étudiant).
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cut', 'cut_beard', 'care', 'kids')),
  name_fr text not null,
  name_en text not null default '',
  description_fr text not null default '',
  description_en text not null default '',
  duration_min int check (duration_min is null or duration_min > 0),
  price numeric(6, 2) not null default 0 check (price >= 0),
  student_price numeric(6, 2) check (student_price is null or student_price >= 0),
  shampoo_included boolean,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.services enable row level security;

-- Lecture publique des prestations visibles, gestion réservée aux administrateurs.
revoke all on public.services from anon;
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;

create policy services_read on public.services for select to anon, authenticated using (active or public.is_admin());
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- ===== supabase/migrations/20261018000002_arcade.sql =====
-- =============================================================================
-- Cutshop Arcade / Cutshop Challenge : serveur autoritaire des mini jeux multijoueurs.
--
-- Mêmes règles que src/arcade/server/logic.ts (serveur de démonstration) : toute modification
-- doit être faite des deux côtés. Contrôles de cohérence : src/arcade/validation.ts.
--
-- Principe de sécurité :
--   * Chaque tablette s'identifie par un jeton d'appareil aléatoire (p_token), associé à une
--     table (1 à 4) par un admin connecté. Sans table, les actions de jeu sont refusées.
--   * Aucun accès direct aux tables (RLS sans politique, privilèges retirés) : tout passe par
--     les fonctions SECURITY DEFINER ci-dessous, sous un verrou transactionnel commun.
--   * Erreurs métier : exception 'arcade:<code>' (codes de ArcadeErrorCode).
--   * Horodatages en millisecondes Unix (comme Date.now()), sauf les dates des challenges.
--
-- Constantes (logic.ts) :
--   COUNTDOWN_MS 4000, ONLINE_MS 15000, RESULT_GRACE_MS 20000, EARLY_MS 2500,
--   LOBBY_TTL_MS 600000, SOLO_TTL_MS 1800000, CLAIM_GAP_MS 300, FINISHED_VISIBLE_MS 180000.
-- =============================================================================

-- Horloge du serveur en millisecondes.
create or replace function public.now_ms()
returns bigint
language sql
volatile
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Tablettes : jeton aléatoire, table attribuée par l'admin (une seule tablette par table).
create table if not exists public.arcade_devices (
  token text primary key check (char_length(token) between 8 and 200),
  table_no smallint check (table_no between 1 and 4),
  last_seen bigint
);
create unique index if not exists arcade_devices_table_idx on public.arcade_devices (table_no) where table_no is not null;

-- Salles multijoueurs (seq : ordre de création, sert aux départages).
create table if not exists public.arcade_rooms (
  id text primary key,
  seq bigserial,
  game text not null check (game in ('barber', 'pour', 'beat', 'findit')),
  variant text not null,
  seed bigint not null,
  mode text not null check (mode in ('duel', 'battle')),
  host smallint not null check (host between 1 and 4),
  status text not null check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  created_at bigint not null,
  starts_at bigint,
  ends_at bigint,
  duration_ms int not null,
  rematch_of text,
  -- Find It, chasse compétitive : objet -> table qui l'a trouvé en premier.
  claims jsonb not null default '{}'::jsonb
);
create index if not exists arcade_rooms_status_idx on public.arcade_rooms (status);

-- Joueurs d'une salle (ord : organisateur puis invités, dans l'ordre de l'invitation).
create table if not exists public.arcade_room_players (
  room_id text not null references public.arcade_rooms (id) on delete cascade,
  table_no smallint not null check (table_no between 1 and 4),
  ord smallint not null,
  pseudo text not null default '',
  state text not null check (state in ('invited', 'joined', 'ready', 'declined', 'expired', 'left')),
  invited_at bigint not null,
  expires_at bigint,
  score int,
  result_at bigint,
  abandoned boolean not null default false,
  rank smallint,
  primary key (room_id, table_no)
);
create index if not exists arcade_room_players_table_idx on public.arcade_room_players (table_no, state);

-- Sessions solo (un seul résultat par session).
create table if not exists public.arcade_solo (
  id text primary key,
  table_no smallint not null check (table_no between 1 and 4),
  game text not null,
  variant text not null,
  seed bigint not null,
  started_at bigint not null,
  submitted boolean not null default false
);
create index if not exists arcade_solo_table_idx on public.arcade_solo (table_no, started_at);

-- Scores validés (solo et multijoueur), base des classements.
create table if not exists public.arcade_scores (
  id text primary key,
  game text not null check (game in ('barber', 'pour', 'beat', 'findit')),
  variant text not null,
  pseudo text not null,
  table_no smallint not null check (table_no between 1 and 4),
  score int not null check (score >= 0),
  mode text not null check (mode in ('solo', 'duel', 'battle')),
  room_id text,
  rank smallint,
  players smallint,
  created_at bigint not null
);
create index if not exists arcade_scores_created_idx on public.arcade_scores (created_at);

-- Journaux anti abus (10 minutes de rétention).
create table if not exists public.arcade_invite_log (
  id bigserial primary key,
  from_table smallint not null,
  at bigint not null
);
create table if not exists public.arcade_claim_log (
  id bigserial primary key,
  table_no smallint not null,
  at bigint not null
);

-- Challenges de la semaine (gérés dans l'admin).
create table if not exists public.arcade_challenges (
  id text primary key,
  game text not null check (game in ('barber', 'pour', 'beat', 'findit')),
  title_fr text not null default '',
  title_en text not null default '',
  description_fr text not null default '',
  description_en text not null default '',
  reward_fr text not null default '',
  reward_en text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true
);

-- RLS sans politique et aucun privilège direct : accès uniquement par les fonctions.
alter table public.arcade_devices enable row level security;
alter table public.arcade_rooms enable row level security;
alter table public.arcade_room_players enable row level security;
alter table public.arcade_solo enable row level security;
alter table public.arcade_scores enable row level security;
alter table public.arcade_invite_log enable row level security;
alter table public.arcade_claim_log enable row level security;
alter table public.arcade_challenges enable row level security;
revoke all on public.arcade_devices, public.arcade_rooms, public.arcade_room_players, public.arcade_solo,
  public.arcade_scores, public.arcade_invite_log, public.arcade_claim_log, public.arcade_challenges
  from public, anon, authenticated;
revoke all on sequence public.arcade_rooms_seq_seq, public.arcade_invite_log_id_seq, public.arcade_claim_log_id_seq
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Registre des jeux (src/arcade/registry.ts) et contrôles de cohérence (validation.ts)
-- -----------------------------------------------------------------------------

create or replace function public.arcade_valid_variant(p_game text, p_variant text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(case p_game
    when 'barber' then p_variant = 'std'
    when 'pour' then p_variant = 'std'
    when 'beat' then p_variant in ('easy', 'medium', 'hard')
    when 'findit' then p_variant in ('race', 'hunt')
  end, false);
$$;

-- Variantes proposées en solo (la chasse compétitive est réservée au multijoueur).
create or replace function public.arcade_solo_variant(p_game text, p_variant text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select public.arcade_valid_variant(p_game, p_variant) and not (p_game = 'findit' and p_variant <> 'race');
$$;

create or replace function public.arcade_duration_ms(p_game text, p_variant text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_game when 'barber' then 90000 when 'pour' then 60000 when 'beat' then 72000 when 'findit' then 90000 end;
$$;

-- Plafond théorique du score. Beat Drop : valeurs de beatMaxScore() (src/arcade/games/beat/songs.ts),
-- à régénérer si les morceaux changent :
--   npx tsx -e "import {beatMaxScore} from './src/arcade/games/beat/songs.ts'; console.log(['easy','medium','hard'].map(beatMaxScore))"
create or replace function public.arcade_max_score(p_game text, p_variant text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_game
    when 'barber' then 9000
    when 'pour' then 8000
    when 'findit' then 7000
    when 'beat' then case p_variant when 'medium' then 124000 when 'hard' then 157200 else 47200 end
  end;
$$;

-- Statistique entière positive (0 si absente ou non numérique), comme n() dans validation.ts.
create or replace function public.arcade_stat(p_stats jsonb, p_key text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when jsonb_typeof(p_stats -> p_key) = 'number' then greatest(0, floor((p_stats ->> p_key)::numeric)) else 0 end;
$$;

-- Le score reste sous le plafond du jeu et compatible avec les statistiques transmises.
create or replace function public.arcade_is_plausible(p_game text, p_variant text, p_score numeric, p_stats jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  v_a numeric;
  v_b numeric;
begin
  if p_score is null or p_score <> trunc(p_score) or p_score < 0 then return false; end if;
  if p_score > public.arcade_max_score(p_game, p_variant) then return false; end if;
  case p_game
    when 'pour' then
      -- 300 points au plus par verre, 30 verres au plus.
      v_a := public.arcade_stat(p_stats, 'glasses');
      return v_a <= 30 and p_score <= v_a * 300;
    when 'barber' then
      -- 400 points au plus par client, 23 clients au plus.
      v_a := public.arcade_stat(p_stats, 'served');
      return v_a <= 23 and p_score <= v_a * 400;
    when 'findit' then
      v_a := public.arcade_stat(p_stats, 'found');
      v_b := public.arcade_stat(p_stats, 'scenes');
      return v_a <= 45 and v_b <= 9 and p_score <= v_a * 150 + v_b * 200;
    when 'beat' then
      v_a := public.arcade_stat(p_stats, 'perfect') + public.arcade_stat(p_stats, 'good');
      return v_a <= public.arcade_stat(p_stats, 'judgements') and p_score <= v_a * 400;
    else
      return false;
  end case;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pseudos (src/arcade/pseudo.ts) : le filtrage principal est côté tablette, repris ici simplement.
-- -----------------------------------------------------------------------------

-- Sans accents (décomposition Unicode puis retrait des diacritiques), en minuscules.
create or replace function public.arcade_unaccent_lower(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(case when getdatabaseencoding() = 'UTF8'
    then regexp_replace(normalize(coalesce(p, ''), NFD), '[̀-ͯ]', '', 'g')
    else coalesce(p, '') end);
$$;

-- Clé de regroupement des classements (pseudoKey).
create or replace function public.arcade_pseudo_key(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(regexp_replace(public.arcade_unaccent_lower(p), '\s+', ' ', 'g'));
$$;

-- Nettoyage de la saisie (cleanPseudo) : caractères de contrôle, espaces, 15 caractères au plus.
create or replace function public.arcade_clean_pseudo(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[\x01-\x1f\x7f<>]', '', 'g'), '\s+', ' ', 'g')), 15);
$$;

-- Termes offensants (isOffensive) : mots entiers ou fragments, chiffres « leet » convertis.
create or replace function public.arcade_is_offensive(p text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with c as (select translate(public.arcade_unaccent_lower(p), '013457@$', 'oieastas') as s)
  select exists (
      select 1 from c, unnest(regexp_split_to_array(c.s, '[^a-z]+')) w
      where w = any (array[
        'con', 'conne', 'pute', 'merde', 'nique', 'niquer', 'ntm', 'fdp', 'pd', 'pede', 'tapette', 'negre', 'nazi', 'bite',
        'couille', 'chatte', 'teub', 'zizi', 'abruti', 'debile', 'gogol', 'mongol', 'cul', 'kut', 'lul', 'hoer', 'kanker',
        'tering', 'mongool', 'flikker', 'cunt', 'shit', 'bitch', 'dick', 'cock', 'slut', 'fag', 'retard', 'rape', 'porn', 'sex', 'xxx'])
    ) or exists (
      select 1 from c, unnest(array[
        'connard', 'connasse', 'salope', 'salaud', 'putain', 'encule', 'batard', 'bougnoule', 'youpin', 'hitler', 'branleur',
        'trisomique', 'klootzak', 'fuck', 'pussy', 'whore', 'nigger', 'nigga', 'faggot']) b
      where position(b in regexp_replace(c.s, '[^a-z]', '', 'g')) > 0
    )
  from c;
$$;

-- Pseudo validé (checkPseudo), sinon 'arcade:invalid'.
create or replace function public.arcade_check_pseudo(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := public.arcade_clean_pseudo(p);
begin
  if char_length(v) < 2 or public.arcade_is_offensive(v) then
    raise exception 'arcade:invalid';
  end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Réglages (settings.data -> 'arcade'), valeurs par défaut de DEFAULT_ARCADE_CONFIG
-- -----------------------------------------------------------------------------

create or replace function public.arcade_game_enabled(p_game text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_game in ('barber', 'pour', 'beat', 'findit') and coalesce((
    select case when jsonb_typeof(data -> 'arcade' -> 'games' -> p_game) = 'boolean'
      then (data -> 'arcade' -> 'games' ->> p_game)::boolean end
    from public.settings where id = 1), true);
$$;

create or replace function public.arcade_setting_num(p_key text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case when jsonb_typeof(data -> 'arcade' -> p_key) = 'number' then (data -> 'arcade' ->> p_key)::numeric end
    from public.settings where id = 1), p_default);
$$;

-- -----------------------------------------------------------------------------
-- Fonctions internes (jamais exposées)
-- -----------------------------------------------------------------------------

create or replace function public.arcade_random_id(p_prefix text)
returns text
language sql
volatile
set search_path = public
as $$
  select p_prefix || encode(extensions.gen_random_bytes(8), 'hex');
$$;

-- Graine imprévisible sur 32 bits (newSeed).
create or replace function public.arcade_seed()
returns bigint
language sql
volatile
set search_path = public
as $$
  select (get_byte(b, 0)::bigint << 24) + (get_byte(b, 1)::bigint << 16) + (get_byte(b, 2)::bigint << 8) + get_byte(b, 3)::bigint
  from (select extensions.gen_random_bytes(4) as b) x;
$$;

-- Table associée au jeton, sinon 'arcade:not_paired'.
create or replace function public.arcade_table_of(p_token text)
returns smallint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v smallint;
begin
  select table_no into v from public.arcade_devices where token = p_token;
  if v is null then raise exception 'arcade:not_paired'; end if;
  return v;
end;
$$;

-- Dernier signe de vie de la table.
create or replace function public.arcade_seen(p_table smallint)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select max(last_seen) from public.arcade_devices where table_no = p_table;
$$;

create or replace function public.arcade_online(p_table smallint, p_now bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p_now - public.arcade_seen(p_table) <= 15000, false);
$$;

-- Partie à laquelle la table participe (lobby ou en cours), activeRoomOf.
create or replace function public.arcade_active_room(p_table smallint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.id from public.arcade_rooms r
  where (r.status = 'lobby' and exists (
          select 1 from public.arcade_room_players p
          where p.room_id = r.id and p.table_no = p_table and p.state in ('joined', 'ready')))
     or (r.status = 'playing' and exists (
          select 1 from public.arcade_room_players p
          where p.room_id = r.id and p.table_no = p_table and p.state = 'ready' and not p.abandoned and p.result_at is null))
  order by r.seq
  limit 1;
$$;

-- Invitation en attente pour la table (pendingInvites).
create or replace function public.arcade_has_invite(p_table smallint, p_now bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.arcade_rooms r join public.arcade_room_players p on p.room_id = r.id
    where r.status = 'lobby' and p.table_no = p_table and p.state = 'invited' and coalesce(p.expires_at, 0) > p_now);
$$;

-- État d'une table vu depuis l'accueil (tableStatus).
create or replace function public.arcade_table_status(p_table smallint, p_now bigint)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room text;
  v_status text;
  v_state text;
begin
  if not public.arcade_online(p_table, p_now) then return 'offline'; end if;
  v_room := public.arcade_active_room(p_table);
  if v_room is not null then
    select status into v_status from public.arcade_rooms where id = v_room;
    if v_status = 'playing' then return 'playing'; end if;
    select state into v_state from public.arcade_room_players where room_id = v_room and table_no = p_table;
    return case when v_state = 'ready' then 'ready' else 'waiting' end;
  end if;
  if public.arcade_has_invite(p_table, p_now) then return 'invited'; end if;
  return 'available';
end;
$$;

-- Salle au format Room (joueurs dans l'ordre de l'invitation).
create or replace function public.arcade_room_json(p_room text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id, 'game', r.game, 'variant', r.variant, 'seed', r.seed, 'mode', r.mode, 'host', r.host,
    'status', r.status, 'created_at', r.created_at, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'duration_ms', r.duration_ms, 'rematch_of', r.rematch_of,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table', p.table_no, 'pseudo', p.pseudo, 'state', p.state, 'invited_at', p.invited_at,
        'expires_at', p.expires_at, 'score', p.score, 'result_at', p.result_at,
        'abandoned', p.abandoned, 'rank', p.rank) order by p.ord)
      from public.arcade_room_players p where p.room_id = r.id), '[]'::jsonb),
    'claims', r.claims)
  from public.arcade_rooms r where r.id = p_room;
$$;

-- Ligne de score au format ScoreRow.
create or replace function public.arcade_score_json(s public.arcade_scores)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id, 'game', s.game, 'variant', s.variant, 'pseudo', s.pseudo, 'table', s.table_no,
    'score', s.score, 'mode', s.mode, 'room_id', s.room_id, 'rank', s.rank, 'players', s.players,
    'created_at', s.created_at);
$$;

-- Fin de partie : abandons, classement officiel, enregistrement des scores (finalize).
-- Classement : abandons en dernier, score décroissant, résultat validé le plus tôt, plus petite table.
create or replace function public.arcade_finalize(p_room text, p_now bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_room public.arcade_rooms%rowtype;
  v_parts int;
begin
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found or v_room.status <> 'playing' then return; end if;
  update public.arcade_room_players set abandoned = true
  where room_id = p_room and state = 'ready' and result_at is null;
  select count(*) into v_parts from public.arcade_room_players where room_id = p_room and state = 'ready';
  with ranked as (
    select table_no, row_number() over (
      order by abandoned, coalesce(score, -1) desc, coalesce(result_at, 9007199254740991), table_no) as rk
    from public.arcade_room_players where room_id = p_room and state = 'ready'
  )
  update public.arcade_room_players p set rank = ranked.rk
  from ranked where p.room_id = p_room and p.table_no = ranked.table_no;
  insert into public.arcade_scores (id, game, variant, pseudo, table_no, score, mode, room_id, rank, players, created_at)
  select p_room || ':' || p.table_no, v_room.game, v_room.variant, p.pseudo, p.table_no, p.score, v_room.mode,
         p_room, p.rank, v_parts, coalesce(p.result_at, p_now)
  from public.arcade_room_players p
  where p.room_id = p_room and p.state = 'ready' and not p.abandoned and p.score is not null
  on conflict (id) do nothing;
  update public.arcade_rooms set status = 'finished', ends_at = coalesce(ends_at, p_now) where id = p_room;
end;
$$;

-- Entretien : expirations, déconnexions, fin des parties dont le délai est écoulé, rétention (housekeeping).
create or replace function public.arcade_housekeeping(p_now bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  update public.arcade_room_players p set state = 'expired'
  from public.arcade_rooms r
  where r.id = p.room_id and r.status = 'lobby' and p.state = 'invited' and coalesce(p.expires_at, 0) <= p_now;
  -- Une tablette déconnectée avant le départ quitte le lobby.
  update public.arcade_room_players p set state = 'left'
  from public.arcade_rooms r
  where r.id = p.room_id and r.status = 'lobby' and p.state in ('joined', 'ready') and not public.arcade_online(p.table_no, p_now);
  -- Organisateur parti ou lobby abandonné depuis 10 minutes : partie annulée.
  update public.arcade_rooms r set status = 'cancelled'
  where r.status = 'lobby' and (
    p_now - r.created_at > 600000
    or exists (select 1 from public.arcade_room_players p where p.room_id = r.id and p.table_no = r.host and p.state = 'left'));
  for v_id in
    select id from public.arcade_rooms where status = 'playing' and ends_at is not null and p_now > ends_at + 20000 order by seq
  loop
    perform public.arcade_finalize(v_id, p_now);
  end loop;
  -- Rétention : parties 7 jours, sessions solo 1 jour, journaux 10 minutes, tablettes inconnues 1 jour.
  delete from public.arcade_rooms where p_now - created_at >= 604800000;
  delete from public.arcade_solo where p_now - started_at >= 86400000;
  delete from public.arcade_invite_log where p_now - at >= 600000;
  delete from public.arcade_claim_log where p_now - at >= 600000;
  delete from public.arcade_devices where table_no is null and coalesce(last_seen, 0) <= p_now - 86400000;
end;
$$;

-- Création d'une salle et envoi des invitations (createRoom). Renvoie l'identifiant.
create or replace function public.arcade_create_room_internal(
  p_table smallint, p_pseudo text, p_game text, p_variant text, p_invite jsonb, p_rematch_of text, p_now bigint
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pseudo text;
  v_invite smallint[] := '{}';
  v_el jsonb;
  v_t numeric;
  v_inv smallint;
  v_recent int;
  v_id text;
  v_n int;
begin
  perform public.arcade_housekeeping(p_now);
  v_pseudo := public.arcade_check_pseudo(p_pseudo);
  if not public.arcade_game_enabled(p_game) or not public.arcade_valid_variant(p_game, p_variant) then
    raise exception 'arcade:invalid';
  end if;
  if p_invite is null or jsonb_typeof(p_invite) <> 'array' then raise exception 'arcade:invalid'; end if;
  -- Tables invitées sans doublon, sans la sienne, dans l'ordre donné.
  for v_el in select e from jsonb_array_elements(p_invite) with ordinality as x (e, i) order by i loop
    if jsonb_typeof(v_el) <> 'number' then raise exception 'arcade:invalid'; end if;
    v_t := (v_el #>> '{}')::numeric;
    continue when v_t = p_table;
    if v_t not in (1, 2, 3, 4) then raise exception 'arcade:invalid'; end if;
    if not (v_t::smallint = any (v_invite)) then v_invite := v_invite || v_t::smallint; end if;
  end loop;
  v_n := cardinality(v_invite);
  if v_n < 1 or v_n > 3 then raise exception 'arcade:invalid'; end if;
  if public.arcade_active_room(p_table) is not null then raise exception 'arcade:busy'; end if;
  foreach v_inv in array v_invite loop
    if public.arcade_table_status(v_inv, p_now) not in ('available', 'invited') then raise exception 'arcade:unavailable'; end if;
  end loop;
  select count(*) into v_recent from public.arcade_invite_log where from_table = p_table and p_now - at < 120000;
  if v_recent + v_n > public.arcade_setting_num('invite_max_per_2min', 6) then raise exception 'arcade:rate_limited'; end if;

  v_id := public.arcade_random_id('r');
  insert into public.arcade_rooms (id, game, variant, seed, mode, host, status, created_at, duration_ms, rematch_of)
  values (v_id, p_game, p_variant, public.arcade_seed(), case when v_n = 1 then 'duel' else 'battle' end, p_table,
          'lobby', p_now, public.arcade_duration_ms(p_game, p_variant), p_rematch_of);
  insert into public.arcade_room_players (room_id, table_no, ord, pseudo, state, invited_at, expires_at)
  values (v_id, p_table, 0, v_pseudo, 'joined', p_now, null);
  insert into public.arcade_room_players (room_id, table_no, ord, pseudo, state, invited_at, expires_at)
  select v_id, u.t, u.o, '', 'invited', p_now,
         p_now + round(public.arcade_setting_num('invite_timeout_s', 45) * 1000)::bigint
  from unnest(v_invite) with ordinality as u (t, o);
  insert into public.arcade_invite_log (from_table, at) select p_table, p_now from generate_series(1, v_n);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fonctions des tablettes
-- -----------------------------------------------------------------------------

-- Signe de vie + instantané : tables, invitations reçues, partie en cours ou terminée récemment.
create or replace function public.arcade_snapshot(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now bigint;
  v_table smallint;
  v_tables jsonb;
  v_invites jsonb;
  v_room text;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  if p_token is null or char_length(p_token) not between 8 and 200 then raise exception 'arcade:invalid'; end if;
  v_now := public.now_ms();
  insert into public.arcade_devices (token, last_seen) values (p_token, v_now)
  on conflict (token) do update set last_seen = excluded.last_seen
  returning table_no into v_table;
  perform public.arcade_housekeeping(v_now);
  select jsonb_agg(jsonb_build_object(
           'table', t, 'status', public.arcade_table_status(t::smallint, v_now), 'last_seen', public.arcade_seen(t::smallint))
         order by t)
  into v_tables from generate_series(1, 4) t;
  if v_table is null then
    return jsonb_build_object('now', v_now, 'table', null, 'tables', v_tables, 'invites', '[]'::jsonb, 'room', null);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'room_id', r.id, 'game', r.game, 'variant', r.variant, 'mode', r.mode, 'host', r.host,
           'host_pseudo', h.pseudo, 'expires_at', p.expires_at) order by r.seq), '[]'::jsonb)
  into v_invites
  from public.arcade_rooms r
  join public.arcade_room_players p on p.room_id = r.id and p.table_no = v_table
  join public.arcade_room_players h on h.room_id = r.id and h.table_no = r.host
  where r.status = 'lobby' and p.state = 'invited' and coalesce(p.expires_at, 0) > v_now;
  v_room := public.arcade_active_room(v_table);
  if v_room is null then
    -- Dernière partie terminée ou annulée récemment : résultats, refus, revanche.
    select r.id into v_room from public.arcade_rooms r
    where (r.status in ('finished', 'cancelled') or (r.status = 'playing' and exists (
             select 1 from public.arcade_room_players p where p.room_id = r.id and p.table_no = v_table and p.state = 'ready')))
      and exists (select 1 from public.arcade_room_players p
                  where p.room_id = r.id and p.table_no = v_table and (p.state = 'ready' or p.table_no = r.host))
      and v_now - coalesce(r.ends_at, r.created_at) < 180000
    order by r.created_at desc, r.seq
    limit 1;
  end if;
  return jsonb_build_object('now', v_now, 'table', v_table, 'tables', v_tables, 'invites', v_invites,
                            'room', case when v_room is null then null else public.arcade_room_json(v_room) end);
end;
$$;

-- Nouvelle partie : 1 invité = duel, 2 ou 3 invités = battle.
create or replace function public.arcade_create_room(
  p_token text, p_pseudo text, p_game text, p_variant text, p_invite jsonb, p_rematch_of text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_id text;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_id := public.arcade_create_room_internal(v_table, p_pseudo, p_game, p_variant, p_invite, p_rematch_of, public.now_ms());
  return public.arcade_room_json(v_id);
end;
$$;

-- Réponse à une invitation. Accepter refuse implicitement les autres invitations en attente.
create or replace function public.arcade_respond(p_token text, p_room text, p_accept boolean, p_pseudo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
  v_pseudo text;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  perform public.arcade_housekeeping(v_now);
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found then raise exception 'arcade:not_allowed'; end if;
  if v_room.status <> 'lobby' or v_p.state <> 'invited' then raise exception 'arcade:expired'; end if;
  if not coalesce(p_accept, false) then
    update public.arcade_room_players set state = 'declined' where room_id = p_room and table_no = v_table;
    return public.arcade_room_json(p_room);
  end if;
  v_pseudo := public.arcade_check_pseudo(p_pseudo);
  if public.arcade_active_room(v_table) is not null then raise exception 'arcade:busy'; end if;
  update public.arcade_room_players set state = 'joined', pseudo = v_pseudo where room_id = p_room and table_no = v_table;
  update public.arcade_room_players p set state = 'declined'
  from public.arcade_rooms r
  where r.id = p.room_id and r.id <> p_room and r.status = 'lobby' and p.table_no = v_table
    and p.state = 'invited' and coalesce(p.expires_at, 0) > v_now;
  return public.arcade_room_json(p_room);
end;
$$;

create or replace function public.arcade_set_ready(p_token text, p_room text, p_ready boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  perform public.arcade_housekeeping(public.now_ms());
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found then raise exception 'arcade:not_allowed'; end if;
  if v_room.status <> 'lobby' or v_p.state not in ('joined', 'ready') then raise exception 'arcade:not_allowed'; end if;
  update public.arcade_room_players set state = case when coalesce(p_ready, false) then 'ready' else 'joined' end
  where room_id = p_room and table_no = v_table;
  return public.arcade_room_json(p_room);
end;
$$;

-- L'organisateur confirme le lancement : départ commun fixé par l'horloge du serveur (compte à rebours 4 s).
create or replace function public.arcade_start(p_token text, p_room text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_room public.arcade_rooms%rowtype;
  v_ready int;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  perform public.arcade_housekeeping(v_now);
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  if v_room.host <> v_table or v_room.status <> 'lobby' then raise exception 'arcade:not_allowed'; end if;
  if not exists (select 1 from public.arcade_room_players where room_id = p_room and table_no = v_table) then
    raise exception 'arcade:not_allowed';
  end if;
  update public.arcade_room_players set state = 'ready' where room_id = p_room and table_no = v_table and state = 'joined';
  if exists (select 1 from public.arcade_room_players where room_id = p_room and state = 'joined') then
    raise exception 'arcade:not_ready';
  end if;
  select count(*) into v_ready from public.arcade_room_players where room_id = p_room and state = 'ready';
  if v_ready < 2 then raise exception 'arcade:not_ready'; end if;
  update public.arcade_room_players set state = 'expired' where room_id = p_room and state = 'invited';
  update public.arcade_rooms
  set mode = case when v_ready = 2 then 'duel' else 'battle' end,
      status = 'playing',
      starts_at = v_now + 4000,
      ends_at = v_now + 4000 + duration_ms
  where id = p_room;
  return public.arcade_room_json(p_room);
end;
$$;

-- Quitter : avant le départ (l'organisateur annule la partie) ou abandon pendant la partie.
create or replace function public.arcade_leave(p_token text, p_room text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found then raise exception 'arcade:not_allowed'; end if;
  if v_room.status = 'lobby' then
    if v_room.host = v_table then
      update public.arcade_rooms set status = 'cancelled' where id = p_room;
    else
      update public.arcade_room_players set state = case when state = 'invited' then 'declined' else 'left' end
      where room_id = p_room and table_no = v_table;
    end if;
  elsif v_room.status = 'playing' and v_p.state = 'ready' and v_p.result_at is null then
    update public.arcade_room_players set abandoned = true where room_id = p_room and table_no = v_table;
    if not exists (select 1 from public.arcade_room_players
                   where room_id = p_room and state = 'ready' and not abandoned and result_at is null) then
      perform public.arcade_finalize(p_room, v_now);
    end if;
  end if;
  return public.arcade_room_json(p_room);
end;
$$;

-- Résultat d'une partie multijoueur, encadré par l'horloge du serveur.
create or replace function public.arcade_submit_result(p_token text, p_room text, p_score numeric, p_stats jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
  v_score numeric := p_score;
  v_claimed int;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  perform public.arcade_housekeeping(v_now);
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found then raise exception 'arcade:not_allowed'; end if;
  if v_p.state <> 'ready' then raise exception 'arcade:not_allowed'; end if;
  if v_p.result_at is not null then raise exception 'arcade:duplicate'; end if;
  if v_room.status = 'finished' or v_p.abandoned then raise exception 'arcade:too_late'; end if;
  if v_room.status <> 'playing' or v_room.ends_at is null then raise exception 'arcade:not_allowed'; end if;
  if v_now < v_room.ends_at - 2500 then raise exception 'arcade:too_early'; end if;
  if v_now > v_room.ends_at + 20000 then raise exception 'arcade:too_late'; end if;

  if v_room.game = 'findit' and v_room.variant = 'hunt' then
    -- Chasse compétitive : le score officiel vient des objets attribués par le serveur.
    select count(*) into v_claimed from jsonb_each(v_room.claims) c where (c.value #>> '{}') = v_table::text;
    v_score := greatest(0, v_claimed * 100 - 10 * least(50, public.arcade_stat(p_stats, 'wrong')));
  elsif not public.arcade_is_plausible(v_room.game, v_room.variant, p_score, p_stats) then
    raise exception 'arcade:implausible';
  end if;
  update public.arcade_room_players set score = v_score::int, result_at = v_now where room_id = p_room and table_no = v_table;
  if not exists (select 1 from public.arcade_room_players
                 where room_id = p_room and state = 'ready' and not abandoned and result_at is null) then
    perform public.arcade_finalize(p_room, v_now);
  end if;
  return public.arcade_room_json(p_room);
end;
$$;

-- Find It, chasse compétitive : le premier qui trouve l'objet le remporte pour tout le monde.
create or replace function public.arcade_claim(p_token text, p_room text, p_object text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
  v_owner smallint;
  v_last bigint;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found then raise exception 'arcade:not_allowed'; end if;
  if v_room.game <> 'findit' or v_room.variant <> 'hunt' or v_room.status <> 'playing' or v_p.state <> 'ready' or v_p.abandoned then
    raise exception 'arcade:not_allowed';
  end if;
  if v_room.starts_at is null or v_room.ends_at is null or v_now < v_room.starts_at or v_now > v_room.ends_at + 500 then
    raise exception 'arcade:not_allowed';
  end if;
  if p_object is null or p_object !~ '^[0-9]{1,2}:[a-z]{2,12}$' then raise exception 'arcade:invalid'; end if;
  v_owner := (v_room.claims ->> p_object)::smallint;
  if v_owner is not null then
    return jsonb_build_object('won', v_owner = v_table, 'owner', v_owner);
  end if;
  select coalesce(max(at), 0) into v_last from public.arcade_claim_log where table_no = v_table;
  if v_now - v_last < 300 then raise exception 'arcade:rate_limited'; end if;
  update public.arcade_rooms set claims = claims || jsonb_build_object(p_object, v_table) where id = p_room;
  insert into public.arcade_claim_log (table_no, at) values (v_table, v_now);
  return jsonb_build_object('won', true, 'owner', v_table);
end;
$$;

-- Revanche : nouvelle salle, mêmes jeu et adversaires, qui doivent tous accepter à nouveau.
create or replace function public.arcade_rematch(p_token text, p_room text, p_pseudo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_room public.arcade_rooms%rowtype;
  v_p public.arcade_room_players%rowtype;
  v_others jsonb;
  v_id text;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  select * into v_room from public.arcade_rooms where id = p_room;
  if not found then raise exception 'arcade:not_found'; end if;
  if v_room.status <> 'finished' then raise exception 'arcade:not_allowed'; end if;
  select * into v_p from public.arcade_room_players where room_id = p_room and table_no = v_table;
  if not found or v_p.state <> 'ready' then raise exception 'arcade:not_allowed'; end if;
  select coalesce(jsonb_agg(table_no order by ord), '[]'::jsonb) into v_others
  from public.arcade_room_players where room_id = p_room and state = 'ready' and table_no <> v_table;
  v_id := public.arcade_create_room_internal(v_table, p_pseudo, v_room.game, v_room.variant, v_others, v_room.id, public.now_ms());
  return public.arcade_room_json(v_id);
end;
$$;

-- Départ d'une partie solo (une session toutes les 3 secondes au plus par table).
create or replace function public.arcade_start_solo(p_token text, p_game text, p_variant text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_id text;
  v_seed bigint;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  if not public.arcade_game_enabled(p_game) or not public.arcade_solo_variant(p_game, p_variant) then
    raise exception 'arcade:invalid';
  end if;
  if exists (select 1 from public.arcade_solo where table_no = v_table and v_now - started_at < 3000) then
    raise exception 'arcade:rate_limited';
  end if;
  v_id := public.arcade_random_id('s');
  v_seed := public.arcade_seed();
  insert into public.arcade_solo (id, table_no, game, variant, seed, started_at) values (v_id, v_table, p_game, p_variant, v_seed, v_now);
  return jsonb_build_object('id', v_id, 'seed', v_seed, 'started_at', v_now, 'now', v_now);
end;
$$;

-- Résultat d'une partie solo : durée minimale, 30 minutes au plus, un seul enregistrement.
create or replace function public.arcade_submit_solo(p_token text, p_session text, p_pseudo text, p_score numeric, p_stats jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_table smallint;
  v_now bigint;
  v_s public.arcade_solo%rowtype;
  v_pseudo text;
  v_row public.arcade_scores%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('arcade'));
  v_table := public.arcade_table_of(p_token);
  v_now := public.now_ms();
  select * into v_s from public.arcade_solo where id = p_session and table_no = v_table;
  if not found then raise exception 'arcade:not_found'; end if;
  if v_s.submitted then raise exception 'arcade:duplicate'; end if;
  if v_now - v_s.started_at < public.arcade_duration_ms(v_s.game, v_s.variant) - 2500 then raise exception 'arcade:too_early'; end if;
  if v_now - v_s.started_at > 1800000 then raise exception 'arcade:too_late'; end if;
  if not public.arcade_is_plausible(v_s.game, v_s.variant, p_score, p_stats) then raise exception 'arcade:implausible'; end if;
  v_pseudo := public.arcade_check_pseudo(p_pseudo);
  update public.arcade_solo set submitted = true where id = v_s.id;
  insert into public.arcade_scores (id, game, variant, pseudo, table_no, score, mode, room_id, rank, players, created_at)
  values (v_s.id, v_s.game, v_s.variant, v_pseudo, v_table, p_score::int, 'solo', null, null, null, v_now)
  returning * into v_row;
  return public.arcade_score_json(v_row);
end;
$$;

-- Scores servant aux classements depuis une date (millisecondes).
create or replace function public.arcade_scores(p_since bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.arcade_score_json(s) order by s.created_at, s.id), '[]'::jsonb)
  from public.arcade_scores s where s.created_at >= coalesce(p_since, 0);
$$;

-- Challenge au format WeeklyChallenge (dates ISO en UTC).
create or replace function public.arcade_challenge_json(c public.arcade_challenges)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id, 'game', c.game, 'title_fr', c.title_fr, 'title_en', c.title_en,
    'description_fr', c.description_fr, 'description_en', c.description_en,
    'reward_fr', c.reward_fr, 'reward_en', c.reward_en,
    'starts_at', to_char(c.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'ends_at', to_char(c.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'active', c.active);
$$;

-- Tous les challenges (actifs ou non) : la tablette choisit celui de la semaine.
create or replace function public.arcade_challenges()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.arcade_challenge_json(c) order by c.starts_at, c.id), '[]'::jsonb)
  from public.arcade_challenges c;
$$;

-- -----------------------------------------------------------------------------
-- Administration (admin connecté uniquement)
-- -----------------------------------------------------------------------------

create or replace function public.arcade_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'arcade:not_allowed'; end if;
end;
$$;

create or replace function public.arcade_admin_scores(p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.arcade_require_admin();
  return (select coalesce(jsonb_agg(public.arcade_score_json(s) order by s.created_at desc, s.id), '[]'::jsonb)
          from (select * from public.arcade_scores order by created_at desc, id limit greatest(coalesce(p_limit, 100), 0)) s);
end;
$$;

create or replace function public.arcade_admin_delete_score(p_id text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  delete from public.arcade_scores where id = p_id;
end;
$$;

-- Renomme un pseudo dans tous les scores (même pseudo quelle que soit la casse ou l'accentuation).
create or replace function public.arcade_admin_rename(p_from text, p_to text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  if p_to is null then raise exception 'arcade:invalid'; end if;
  update public.arcade_scores set pseudo = p_to where public.arcade_pseudo_key(pseudo) = public.arcade_pseudo_key(p_from);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Remise à zéro des scores d'un jeu (ou de tous si p_game est vide).
create or replace function public.arcade_admin_reset(p_game text default null)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  delete from public.arcade_scores where nullif(p_game, '') is null or game = p_game;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Dernières parties (format AdminRoomRow).
create or replace function public.arcade_admin_rooms(p_limit int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.arcade_require_admin();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'game', r.game, 'variant', r.variant, 'mode', r.mode, 'status', r.status, 'created_at', r.created_at,
      'players', coalesce((
        select jsonb_agg(jsonb_build_object('table', p.table_no, 'pseudo', p.pseudo, 'state', p.state, 'score', p.score,
                                            'rank', p.rank, 'abandoned', p.abandoned) order by p.ord)
        from public.arcade_room_players p where p.room_id = r.id), '[]'::jsonb)
    ) order by r.created_at desc, r.seq), '[]'::jsonb)
    from (select * from public.arcade_rooms order by created_at desc, seq limit greatest(coalesce(p_limit, 50), 0)) r);
end;
$$;

-- Création ou modification d'un challenge (format WeeklyChallenge).
create or replace function public.arcade_admin_save_challenge(p_challenge jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_starts timestamptz;
  v_ends timestamptz;
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  if coalesce(p_challenge ->> 'id', '') = '' or coalesce(p_challenge ->> 'game', '') not in ('barber', 'pour', 'beat', 'findit') then
    raise exception 'arcade:invalid';
  end if;
  begin
    v_starts := (p_challenge ->> 'starts_at')::timestamptz;
    v_ends := (p_challenge ->> 'ends_at')::timestamptz;
  exception when others then
    raise exception 'arcade:invalid';
  end;
  if v_starts is null or v_ends is null then raise exception 'arcade:invalid'; end if;
  insert into public.arcade_challenges (id, game, title_fr, title_en, description_fr, description_en, reward_fr, reward_en, starts_at, ends_at, active)
  values (
    p_challenge ->> 'id', p_challenge ->> 'game',
    coalesce(p_challenge ->> 'title_fr', ''), coalesce(p_challenge ->> 'title_en', ''),
    coalesce(p_challenge ->> 'description_fr', ''), coalesce(p_challenge ->> 'description_en', ''),
    coalesce(p_challenge ->> 'reward_fr', ''), coalesce(p_challenge ->> 'reward_en', ''),
    v_starts, v_ends, coalesce((p_challenge ->> 'active')::boolean, true))
  on conflict (id) do update set
    game = excluded.game, title_fr = excluded.title_fr, title_en = excluded.title_en,
    description_fr = excluded.description_fr, description_en = excluded.description_en,
    reward_fr = excluded.reward_fr, reward_en = excluded.reward_en,
    starts_at = excluded.starts_at, ends_at = excluded.ends_at, active = excluded.active;
end;
$$;

create or replace function public.arcade_admin_delete_challenge(p_id text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  delete from public.arcade_challenges where id = p_id;
end;
$$;

-- Associe la tablette (jeton) à une table ; la tablette qui occupait cette table est dissociée.
create or replace function public.arcade_admin_pair_device(p_token text, p_table int)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.arcade_require_admin();
  perform pg_advisory_xact_lock(hashtext('arcade'));
  if p_token is null or char_length(p_token) not between 8 and 200 or (p_table is not null and p_table not between 1 and 4) then
    raise exception 'arcade:invalid';
  end if;
  update public.arcade_devices set table_no = null where table_no = p_table and token <> p_token;
  insert into public.arcade_devices (token, table_no, last_seen) values (p_token, p_table, public.now_ms())
  on conflict (token) do update set table_no = excluded.table_no;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution : fonctions internes jamais exposées, fonctions de jeu pour les tablettes,
-- fonctions d'administration pour les comptes connectés (contrôle is_admin() à l'intérieur).
-- -----------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'arcade\_%' or p.proname = 'now_ms')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

grant execute on function public.now_ms() to anon, authenticated;
grant execute on function public.arcade_snapshot(text) to anon, authenticated;
grant execute on function public.arcade_create_room(text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.arcade_respond(text, text, boolean, text) to anon, authenticated;
grant execute on function public.arcade_set_ready(text, text, boolean) to anon, authenticated;
grant execute on function public.arcade_start(text, text) to anon, authenticated;
grant execute on function public.arcade_leave(text, text) to anon, authenticated;
grant execute on function public.arcade_submit_result(text, text, numeric, jsonb) to anon, authenticated;
grant execute on function public.arcade_claim(text, text, text) to anon, authenticated;
grant execute on function public.arcade_rematch(text, text, text) to anon, authenticated;
grant execute on function public.arcade_start_solo(text, text, text) to anon, authenticated;
grant execute on function public.arcade_submit_solo(text, text, text, numeric, jsonb) to anon, authenticated;
grant execute on function public.arcade_scores(bigint) to anon, authenticated;
grant execute on function public.arcade_challenges() to anon, authenticated;

grant execute on function public.arcade_admin_scores(int) to authenticated;
grant execute on function public.arcade_admin_delete_score(text) to authenticated;
grant execute on function public.arcade_admin_rename(text, text) to authenticated;
grant execute on function public.arcade_admin_reset(text) to authenticated;
grant execute on function public.arcade_admin_rooms(int) to authenticated;
grant execute on function public.arcade_admin_save_challenge(jsonb) to authenticated;
grant execute on function public.arcade_admin_delete_challenge(text) to authenticated;
grant execute on function public.arcade_admin_pair_device(text, int) to authenticated;


-- ===== supabase/migrations/20261021000001_beat_tracks.sql =====
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


-- ===== supabase/migrations/20261022000001_beat_tracks_level.sql =====
-- Beat Drop : niveau de chaque musique importée. Sur les tablettes, une musique n'apparaît que dans son niveau.
-- Relançable sans risque.
alter table public.beat_tracks add column if not exists level text not null default 'medium';
alter table public.beat_tracks drop constraint if exists beat_tracks_level_check;
alter table public.beat_tracks add constraint beat_tracks_level_check check (level in ('easy', 'medium', 'hard'));


-- ===== supabase/seed.sql =====
-- Données d'exemple Cutshop. Fichier généré par scripts/generate-seed.ts : ne pas modifier à la main.
-- À exécuter une seule fois après la migration (SQL Editor de Supabase ou supabase db reset).
begin;

-- Réglages
update public.settings set data = '{"salonkee_url":"https://salonkee.be/salon/cutshop-mons","instagram_url":"https://www.instagram.com/cutshop_mons/","facebook_url":"https://www.facebook.com/cutshopmons/","tiktok_url":"https://www.tiktok.com/@cutshop_belgium","website":"www.cutshop.be","address":"Rue de la Chaussée 40, 7000 Mons","phone":"065/67.60.66","email":"contact@cutshop.be","hours_fr":"Mardi et mercredi : 10h à 18h\nJeudi : 10h à 18h\nVendredi : 8h à 18h","hours_en":"Tuesday and Wednesday: 10am to 6pm\nThursday: 10am to 6pm\nFriday: 8am to 6pm","concept_title_fr":"Cutshop, bien plus qu’une coupe","concept_title_en":"Cutshop, much more than a haircut","concept_body_fr":"Tout commence en 2018, au coeur de Mons, avec une idée simple : et si passer chez le barbier devenait un vrai moment ? Le Cutshop naît de cette envie de mélanger trois univers qui vont parfaitement ensemble : un barbershop exigeant, un bar convivial et un lieu de vie ouvert à la culture.\n\nIci, on vient pour une coupe ou une barbe taillée dans les règles de l’art, et on reste pour l’ambiance. Une bière du terroir belge à la main, on discute, on rencontre, on prend son temps.\n\nDepuis deux ans, une nouvelle équipe a repris le flambeau avec la même passion. Le concept a été relancé et renforcé, avec toujours plus de services, de soins et d’événements.\n\nCar le Cutshop se transforme aussi régulièrement en scène : DJ sets, artistes locaux, impro, stand-up, soirées discussion, soirées lecture... Un lieu où chacun trouve sa place, que tu viennes pour ta coupe du mois ou pour passer une bonne soirée.","concept_body_en":"It all started in 2018, in the heart of Mons, with a simple idea: what if going to the barber became a real moment? Cutshop was born from the urge to blend three worlds that go perfectly together: a demanding barbershop, a friendly bar and a place open to culture.\n\nHere, you come for a cut or a beard trimmed by the book, and you stay for the vibe. A local Belgian beer in hand, you chat, you meet people, you take your time.\n\nFor the past two years, a new team has carried the torch with the same passion. The concept has been relaunched and strengthened, with ever more services, treatments and events.\n\nBecause Cutshop also regularly turns into a stage: DJ sets, local artists, improv, stand-up, discussion nights, reading nights... A place where everyone finds their spot, whether you come for your monthly cut or for a great night out.","concept_tagline_fr":"Le Cutshop, c’est ton moment.","concept_tagline_en":"Cutshop is your moment.","concept_photo_hero":"photo:vitrine-cutshop","concept_photo_1":"photo:le-barbershop","concept_photo_2":"photo:le-bar","concept_photo_3":"photo:les-events","block_barber_fr":"Coupes, dégradés, barbes taillées et rasages à l’ancienne. Un savoir-faire exigeant, dans une ambiance détendue.","block_barber_en":"Cuts, fades, beard trims and old-school shaves. Demanding craftsmanship in a relaxed atmosphere.","block_bar_fr":"Des bières belges du terroir, des softs et un comptoir où l’on prend le temps de discuter.","block_bar_en":"Local Belgian beers, soft drinks and a counter where people take the time to talk.","block_events_fr":"DJ sets, scène ouverte, impro, stand-up, soirées discussion et lecture. Le salon devient une scène.","block_events_en":"DJ sets, open mic, improv, stand-up, talk nights and reading nights. The shop becomes a stage.","gift_title_fr":"Offre un moment Cutshop","gift_title_en":"Give a Cutshop moment","gift_body_fr":"Une coupe, une barbe, un soin ou une soirée au bar : le chèque cadeau Cutshop, c’est le cadeau qui fait plaisir à coup sûr. Choisis le montant ou la prestation, on s’occupe du reste. Disponible directement au comptoir.","gift_body_en":"A cut, a beard, a treatment or a night at the bar: the Cutshop gift voucher is the present that always hits the spot. Choose the amount or the service, we take care of the rest. Available right at the counter.","gift_amounts":"25 €, 50 €, 75 €, 100 € (exemple)","gift_validity_fr":"Valable 12 mois à partir de la date d’achat (exemple)","gift_validity_en":"Valid for 12 months from the purchase date (example)","gift_conditions_fr":"Utilisable en une ou plusieurs fois, non remboursable, valable sur toutes les prestations et au bar (exemple, à compléter)","gift_conditions_en":"Can be used in one or several visits, non-refundable, valid on all services and at the bar (example, to be completed)","invoice_title_fr":"Indépendant ou société ? On te fait ta facture","invoice_title_en":"Freelancer or company? We’ll make you an invoice","invoice_body_fr":"Tes prestations et achats au Cutshop peuvent être facturés au nom de ton entreprise. Il te suffit de nous transmettre tes coordonnées de facturation.","invoice_body_en":"Your services and purchases at Cutshop can be invoiced in your company’s name. All you need to do is send us your billing details.","privacy_fr":"Responsable du traitement : Cutshop Mons (coordonnées à compléter dans l’espace admin).\n\nDonnées collectées : prénom, nom, adresse mail et nombre de places pour les inscriptions aux événements ; adresse mail pour la newsletter si tu l’acceptes ; coordonnées de facturation pour les factures pros ; prénom et sélection de produits pour les conseils produits.\n\nPourquoi : gérer ton inscription, t’envoyer la newsletter si tu l’as demandée, établir ta facture ou préparer ton conseil produit. Rien d’autre, et aucune revente.\n\nConservation : les inscriptions sont supprimées +/ 3 mois après l’événement ; la newsletter jusqu’à ta désinscription ; les données de facturation selon les obligations comptables légales.\n\nTablettes : aucune donnée personnelle n’est conservée sur les tablettes. Les formulaires sont effacés après chaque envoi et après 60 secondes d’inactivité.\n\nHébergement : base de données Supabase, hébergée dans l’Union européenne.\n\nTes droits : accès, rectification, effacement, opposition et retrait du consentement à tout moment, sur simple demande au comptoir ou par mail. Tu peux aussi contacter l’Autorité de protection des données (autoriteprotectiondonnees.be).","privacy_en":"Data controller: Cutshop Mons (contact details to be completed in the admin area).\n\nData collected: first name, last name, email address and number of seats for event registrations; email address for the newsletter if you opt in; billing details for business invoices; first name and product selection for product advice.\n\nWhy: to manage your registration, send you the newsletter if you asked for it, issue your invoice or prepare your product advice. Nothing else, and never sold.\n\nRetention: registrations are deleted +/ 3 months after the event; newsletter data until you unsubscribe; billing data as required by accounting law.\n\nTablets: no personal data is stored on the tablets. Forms are cleared after each submission and after 60 seconds of inactivity.\n\nHosting: Supabase database, hosted in the European Union.\n\nYour rights: access, correction, deletion, objection and withdrawal of consent at any time, just ask at the counter or by email. You can also contact the Belgian Data Protection Authority (dataprotectionauthority.be).","modules":{"concept":true,"booking":true,"services":true,"events":true,"arcade":true,"battle":true,"stop10":true,"wheel":false,"kids":true,"drinks":true,"products":true,"gift":true,"invoice":true,"instagram":true},"idle_seconds":60,"arcade":{"games":{"barber":true,"pour":true,"beat":true,"findit":true},"invite_timeout_s":45,"invite_max_per_2min":6}}'::jsonb, updated_at = now() where id = 1;

-- Programme des événements (dates fixes, heure de Bruxelles).
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession', 'Cutsession', 'Trois DJ filmés en direct, et toi dans le décor. Dès 18h.', 'Three DJs filmed live, and you are part of the scene. From 6pm.', 'Un samedi sur deux', 'Every other Saturday', 'photo:cutsession-carre-5', '2026-10-17T16:00:00.000Z', '2026-10-17T20:00:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession spécial Halloween', 'Cutsession Halloween special', 'L’édition spéciale Halloween : trois DJ filmés en direct, et toi dans le décor. Déguisement bienvenu. Dès 18h.', 'The Halloween special: three DJs filmed live, and you are part of the scene. Costumes welcome. From 6pm.', '', '', 'photo:cutsession-carre-5', '2026-10-31T17:00:00.000Z', '2026-10-31T21:00:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('read', 'Chut', 'Chut', 'Lecture en silence, DJ set relax, un verre à la main, puis on échange ensemble. Entrée libre, 20 places maximum.', 'Silent reading, a chill DJ set, a drink in hand, then we share together. Free entry, 20 spots maximum.', 'Un vendredi sur deux', 'Every other Friday', 'photo:chut-carre-5', '2026-11-06T17:30:00.000Z', '2026-11-06T19:00:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('mic', 'Open Mic', 'Open Mic', 'Stand-up, impro, beatbox, slam : le micro est à toi.', 'Stand-up, improv, beatbox, slam: the mic is yours.', 'Un samedi sur deux', 'Every other Saturday', 'photo:open-mic-carre-1', '2026-11-07T17:00:00.000Z', '2026-11-07T19:30:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('talk', 'Cut and Talk', 'Cut and Talk', 'Une soirée pour débattre d’un sujet autour d’un verre. Thème : l’intelligence artificielle.', 'A night to debate a topic over a drink. Theme: artificial intelligence.', 'Un vendredi sur deux', 'Every other Friday', 'photo:cut-and-talk-carre-5', '2026-11-13T19:30:00.000Z', '2026-11-13T21:30:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession', 'Cutsession', 'Trois DJ filmés en direct, et toi dans le décor. Dès 18h.', 'Three DJs filmed live, and you are part of the scene. From 6pm.', 'Un samedi sur deux', 'Every other Saturday', 'photo:cutsession-carre-5', '2026-11-14T17:00:00.000Z', '2026-11-14T21:00:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('read', 'Chut', 'Chut', 'Lecture en silence, DJ set relax, un verre à la main, puis on échange ensemble. Entrée libre, 20 places maximum.', 'Silent reading, a chill DJ set, a drink in hand, then we share together. Free entry, 20 spots maximum.', 'Un vendredi sur deux', 'Every other Friday', 'photo:chut-carre-5', '2026-11-20T17:30:00.000Z', '2026-11-20T19:00:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('mic', 'Open Mic', 'Open Mic', 'Stand-up, impro, beatbox, slam : le micro est à toi.', 'Stand-up, improv, beatbox, slam: the mic is yours.', 'Un samedi sur deux', 'Every other Saturday', 'photo:open-mic-carre-1', '2026-11-21T17:00:00.000Z', '2026-11-21T19:30:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('talk', 'Cut and Talk', 'Cut and Talk', 'Une soirée pour débattre d’un sujet autour d’un verre.', 'A night to debate a topic over a drink.', 'Un vendredi sur deux', 'Every other Friday', 'photo:cut-and-talk-carre-5', '2026-11-27T19:30:00.000Z', '2026-11-27T21:30:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession', 'Cutsession', 'Trois DJ filmés en direct, et toi dans le décor. Dès 18h.', 'Three DJs filmed live, and you are part of the scene. From 6pm.', 'Un samedi sur deux', 'Every other Saturday', 'photo:cutsession-carre-5', '2026-11-28T17:00:00.000Z', '2026-11-28T21:00:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('read', 'Chut', 'Chut', 'Lecture en silence, DJ set relax, un verre à la main, puis on échange ensemble. Entrée libre, 20 places maximum.', 'Silent reading, a chill DJ set, a drink in hand, then we share together. Free entry, 20 spots maximum.', 'Un vendredi sur deux', 'Every other Friday', 'photo:chut-carre-5', '2026-12-04T17:30:00.000Z', '2026-12-04T19:00:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('mic', 'Open Mic', 'Open Mic', 'Stand-up, impro, beatbox, slam : le micro est à toi.', 'Stand-up, improv, beatbox, slam: the mic is yours.', 'Un samedi sur deux', 'Every other Saturday', 'photo:open-mic-carre-1', '2026-12-05T17:00:00.000Z', '2026-12-05T19:30:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('talk', 'Cut and Talk', 'Cut and Talk', 'Une soirée pour débattre d’un sujet autour d’un verre.', 'A night to debate a topic over a drink.', 'Un vendredi sur deux', 'Every other Friday', 'photo:cut-and-talk-carre-5', '2026-12-11T19:30:00.000Z', '2026-12-11T21:30:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession', 'Cutsession', 'Trois DJ filmés en direct, et toi dans le décor. Dès 18h.', 'Three DJs filmed live, and you are part of the scene. From 6pm.', 'Un samedi sur deux', 'Every other Saturday', 'photo:cutsession-carre-5', '2026-12-12T17:00:00.000Z', '2026-12-12T21:00:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('read', 'Chut', 'Chut', 'Lecture en silence, DJ set relax, un verre à la main, puis on échange ensemble. Entrée libre, 20 places maximum.', 'Silent reading, a chill DJ set, a drink in hand, then we share together. Free entry, 20 spots maximum.', 'Un vendredi sur deux', 'Every other Friday', 'photo:chut-carre-5', '2026-12-18T17:30:00.000Z', '2026-12-18T19:00:00.000Z', 20, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('mic', 'Open Mic', 'Open Mic', 'Stand-up, impro, beatbox, slam : le micro est à toi.', 'Stand-up, improv, beatbox, slam: the mic is yours.', 'Un samedi sur deux', 'Every other Saturday', 'photo:open-mic-carre-1', '2026-12-19T17:00:00.000Z', '2026-12-19T19:30:00.000Z', 40, true);
insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values ('dj', 'Cutsession spécial fêtes', 'Cutsession holiday special', 'L’édition spéciale fêtes : trois DJ filmés en direct pour finir l’année en beauté. Dès 18h.', 'The holiday special: three DJs filmed live to end the year in style. From 6pm.', '', '', 'photo:cutsession-carre-5', '2026-12-26T17:00:00.000Z', '2026-12-26T21:00:00.000Z', 40, true);

-- Prestations
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe dégradé zéro', 'Skin fade', 'Les cheveux sont rasés à blanc (0 mm) près des tempes, des oreilles et de la nuque, puis deviennent progressivement plus longs vers le dessus du crâne. Un fondu net et très court, pour un style moderne et propre.', 'Hair is shaved to the skin (0 mm) around the temples, ears and neckline, then gets gradually longer towards the top. A clean, very short blend for a modern, sharp style.', 30, 25, 22, false, 1, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe taper', 'Taper cut', 'Les cheveux sont plus courts près de la peau, sur les côtés et la nuque, parfois à blanc, puis deviennent plus longs et plus fournis sur le sommet du crâne.', 'Hair is kept short close to the skin on the sides and neckline, sometimes down to the skin, then gets longer and fuller on top.', 30, 25, 22, false, 2, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe mulet', 'Mullet', 'Des cheveux courts sur le devant, le dessus et les côtés, mais longs à l’arrière. La coupe culte, revisitée à ta façon.', 'Short on the front, top and sides, long at the back. The cult cut, reinvented your way.', 30, 25, 22, false, 3, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe cheveux bouclés', 'Curly hair cut', 'Une coupe pensée pour les boucles : on suit le sens naturel de chaque boucle pour garder du ressort, de la définition et une forme équilibrée, sans effet triangle.', 'A cut designed for curls: we follow the natural pattern of each curl to keep bounce, definition and a balanced shape, with no triangle effect.', 30, 25, 22, false, 4, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe dégradé espagnol', 'Spanish fade', 'Une coupe tendance au fondu très progressif et net sur les côtés et la nuque, de très court près des oreilles et des tempes jusqu’à plus de longueur sur le dessus. Le contraste met en valeur le volume et la texture du sommet. Un entretien régulier garde des lignes précises.', 'A trendy cut with a very gradual, clean fade on the sides and neckline, from very short around the ears and temples to more length on top. The contrast highlights volume and texture. Regular upkeep keeps the lines sharp.', 30, 25, 22, false, 5, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe simple', 'Simple cut', 'Pour une coupe d’entretien ou un dégradé léger.', 'For a maintenance cut or a light fade.', 20, 25, 22, false, 6, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut', 'Coupe transformation (+5 cm)', 'Transformation cut (+5 cm)', 'Pour changer de look et couper de 5 à 10 cm, ou plus, sur la longueur des cheveux.', 'To change your look and take off 5 to 10 cm, or more, from your hair length.', 40, 35, 33, false, 7, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe dégradé zéro + barbe', 'Skin fade + beard', 'La coupe dégradé zéro, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Skin fade, completed with a beard trim and shaping for a sharp, balanced look.', 50, 42.5, 38, false, 11, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe taper + barbe', 'Taper cut + beard', 'La coupe taper, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Taper cut, completed with a beard trim and shaping for a sharp, balanced look.', 50, 42.5, 38, false, 12, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe mulet + barbe', 'Mullet + beard', 'La coupe mulet, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Mullet, completed with a beard trim and shaping for a sharp, balanced look.', 50, 42.5, 38, false, 13, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe cheveux bouclés + barbe', 'Curly hair cut + beard', 'La coupe cheveux bouclés, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Curly hair cut, completed with a beard trim and shaping for a sharp, balanced look.', 50, 42.5, 38, false, 14, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe dégradé espagnol + barbe', 'Spanish fade + beard', 'La coupe dégradé espagnol, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Spanish fade, completed with a beard trim and shaping for a sharp, balanced look.', 50, 42.5, 38, false, 15, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe simple + barbe', 'Simple cut + beard', 'La coupe simple, complétée par la taille et la mise en forme de la barbe pour un ensemble net et harmonieux.', 'Simple cut, completed with a beard trim and shaping for a sharp, balanced look.', 40, 42.5, 38, false, 16, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('cut_beard', 'Coupe transformation + barbe', 'Transformation cut + beard', 'Pour changer de look : on coupe de 5 à 10 cm, ou plus, sur la longueur des cheveux, et on taille la barbe de plusieurs centimètres.', 'For a new look: we take 5 to 10 cm, or more, off your hair length and trim several centimetres off the beard.', 60, 65, null, false, 17, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('care', 'Coupe + shampoing + soin capillaire', 'Cut + shampoo + hair treatment', 'La coupe, accompagnée d’un shampoing et de soins capillaires choisis selon ton type de cheveux.', 'Your cut, with a shampoo and hair treatments chosen for your hair type.', 40, 45, null, true, 21, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('care', 'Coupe + soin visage', 'Cut + facial', 'La coupe de cheveux, suivie d’un soin du visage en six étapes : diagnostic du type de peau pour orienter le soin, nettoyage complet, microneedling, masque, soin hydratant et épilation.', 'Your haircut, followed by a six step facial: skin type diagnosis to tailor the treatment, deep cleansing, microneedling, mask, moisturising care and hair removal.', 50, 59, null, null, 22, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('care', 'Coupe + barbe + soin visage', 'Cut + beard + facial', 'La coupe et la taille de la barbe, suivies d’un soin du visage en six étapes : diagnostic du type de peau, nettoyage complet, microneedling, masque, soin hydratant et épilation.', 'Your cut and beard trim, followed by a six step facial: skin type diagnosis, deep cleansing, microneedling, mask, moisturising care and hair removal.', 70, 75, null, null, 23, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('care', 'Coupe et barbe + soin capillaire', 'Cut and beard + hair treatment', 'Une coupe de cheveux et une taille de barbe, complétées par des soins capillaires et des soins de la barbe.', 'A haircut and beard trim, completed with hair and beard treatments.', 70, 75, null, null, 24, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('care', 'Épilation', 'Hair removal', 'Épilation du milieu du nez, des oreilles et de l’entre sourcils.', 'Hair removal for the middle of the nose, the ears and between the eyebrows.', 15, 15, null, null, 25, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('kids', 'Coupe enfant (de 5 à 12 ans)', 'Kids cut (5 to 12 years)', 'Une vraie coupe de barbier pour les petits, dans la bonne humeur.', 'A real barber cut for the little ones, with a smile.', null, 19, null, null, 31, true);
insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values ('kids', 'Coupe enfant (moins de 5 ans)', 'Kids cut (under 5)', 'Une première coupe tout en douceur, à leur rythme.', 'A gentle first cut, at their own pace.', null, 19, null, null, 32, true);

-- Boissons
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Admirable', 'Brasserie Racine Carrée', '', '', null, 'Une création artisanale de la Brasserie Racine Carrée. Demande au comptoir, on te la présente.', 'A craft creation from Brasserie Racine Carrée. Ask at the counter and we’ll tell you all about it.', 4, 'photo:boisson-admirable', 1, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Aubel pomme cerise', 'Aubel', 'Fruitée', 'Fruity', null, 'Pomme et cerise, fraîche et gourmande. Parfaite quand tu veux du fruit dans le verre.', 'Apple and cherry, fresh and indulgent. Perfect when you want fruit in your glass.', 4, 'photo:boisson-aubel-pomme-cerise', 2, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Barbar Bok', 'Lefebvre', 'Brune au miel', 'Dark honey beer', 8, 'La version brune de la célèbre Barbar : miel, malt torréfié et une belle rondeur.', 'The dark version of the famous Barbar: honey, roasted malt and a lovely roundness.', 4.4, 'photo:boisson-barbar', 4, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Bavik 0.0', 'Brasserie De Brabandere', 'Pils', 'Pils', 0, 'Une pils belge sans alcool, nette et désaltérante, pour accompagner ta coupe.', 'An alcohol free Belgian pils, clean and refreshing, to go with your cut.', 4, 'photo:boisson-bavik', 5, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Béatific Ecstasy', 'Brasserie Surréaliste', 'Sour au blé, framboise et citron vert', 'Wheat sour with raspberry and lime', null, 'Acidulée et fruitée, avec de la framboise et du citron vert. Une claque de fraîcheur signée Brasserie Surréaliste.', 'Tart and fruity, with raspberry and lime. A burst of freshness from Brasserie Surréaliste.', 4, 'photo:boisson-beatific-ecstasy', 6, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Boriner Vice', 'Brasserie du Borinage', 'Blanche acidulée houblonnée', 'Hoppy sour white', null, 'Une blanche acidulée généreusement houblonnée à cru. Vive, fruitée, surprenante.', 'A sour white beer, generously dry hopped. Lively, fruity and surprising.', 4, 'photo:boisson-boriner-vice', 7, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Cosmic Rainbow', 'Brasserie Surréaliste', 'Double India Porter', 'Double India Porter', null, 'Un porter houblonné aux Vic Secret et Simcoe : torréfié et aromatique à la fois.', 'A hoppy porter with Vic Secret and Simcoe: roasty and aromatic at once.', 4.2, 'photo:boisson-cosmic-rainbow', 8, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Dance Rave Dance', 'Brasserie Surréaliste', 'Session IPA', 'Session IPA', null, 'Session IPA houblonnée à cru aux Citra, Motueka et Nelson. Légère, fruitée, primée au Brussels Beer Challenge.', 'A session IPA dry hopped with Citra, Motueka and Nelson. Light, fruity and an award winner at the Brussels Beer Challenge.', 4, 'photo:boisson-dance-rave-dance', 9, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Django', 'Brasserie Racine Carrée', '', '', null, 'Une bière de caractère de la Brasserie Racine Carrée. Laisse-toi surprendre.', 'A beer with character from Brasserie Racine Carrée. Let yourself be surprised.', 4.2, 'photo:boisson-django', 12, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Dominicains Double', 'Brasserie 3F', 'Double', 'Dubbel', 6.9, 'Brassée à Mons par la Brasserie 3F. Une double brune aux notes de caramel et de fruits secs.', 'Brewed in Mons by Brasserie 3F. A brown dubbel with notes of caramel and dried fruit.', 4, 'photo:boisson-dominicains-2', 13, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Dominicains Quadruple', 'Brasserie 3F', 'Quadruple', 'Quadrupel', 9.2, 'La plus intense de la gamme Dominicains : sombre, riche et puissante. Brassée à Mons.', 'The boldest of the Dominicains range: dark, rich and powerful. Brewed in Mons.', 4.5, 'photo:boisson-dominicains-4', 14, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Dominicains Triple', 'Brasserie 3F', 'Triple', 'Tripel', 8.2, 'Triple blonde montoise, épicée et aromatique, primée aux World Beer Awards.', 'A golden tripel from Mons, spicy and aromatic, awarded at the World Beer Awards.', 4.3, 'photo:boisson-dominicains-3', 15, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Fraise au fût 40 cl', 'Florise', 'Bière fruitée à la fraise', 'Strawberry beer', null, 'Bière fruitée à la fraise, servie au fût en 40 cl. Douce et gourmande.', 'Strawberry fruit beer on draught, served in 40 cl. Sweet and indulgent.', 4, null, 16, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Friskette', 'BALF', 'Blanche d’hiver', 'Winter white beer', null, 'Une bière artisanale de la brasserie BALF. Demande au comptoir pour la découvrir.', 'A craft beer from the BALF brewery. Ask at the counter to discover it.', 4.2, 'photo:boisson-friskette', 17, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Harmony', 'Brasserie des Légendes', '', '', null, 'Une bière de la Brasserie des Légendes, brasserie de la région d’Ath.', 'A beer from Brasserie des Légendes, a brewery from the Ath area.', 4, 'photo:boisson-harmony', 18, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Hopera', 'Lupulus', 'Belgian Pale Ale', 'Belgian Pale Ale', 6, 'Une pale ale belge bien houblonnée, fraîche et équilibrée.', 'A well hopped Belgian pale ale, fresh and balanced.', 4.2, 'photo:boisson-hopera', 19, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Hypernova', 'Brasserie des Étoiles', '', '', null, 'Une création de la Brasserie des Étoiles. Demande au comptoir, on te la présente.', 'A creation from Brasserie des Étoiles. Ask at the counter and we’ll tell you all about it.', 4.5, 'photo:boisson-hypernova', 20, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Hypnotic', 'Brasserie Surréaliste', '', '', null, 'Une bière de la Brasserie Surréaliste, la brasserie bruxelloise qui ose tout.', 'A beer from Brasserie Surréaliste, the Brussels brewery that dares everything.', 4, 'photo:boisson-hypnotic', 21, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Impératrice 33 cl', 'Brasserie de la Couronne', 'Triple blonde', 'Golden tripel', null, 'Une bière de la Brasserie de la Couronne, en bouteille de 33 cl.', 'A beer from Brasserie de la Couronne, in a 33 cl bottle.', 4.5, 'photo:boisson-imperatrice', 22, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'La Baraque 6', 'Brasserie du Borinage', '', '', null, 'Une bière de la Brasserie du Borinage, brassée dans la région de Mons.', 'A beer from Brasserie du Borinage, brewed in the Mons area.', 4.2, 'photo:boisson-la-baraque-6', 23, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'La Tartine', 'BALF', '', '', null, 'Une bière artisanale de la brasserie BALF.', 'A craft beer from the BALF brewery.', 4, null, 24, false);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Marguerite', 'BALF', '', '', null, 'Une bière artisanale de la brasserie BALF. Demande au comptoir pour la découvrir.', 'A craft beer from the BALF brewery. Ask at the counter to discover it.', 4.5, 'photo:boisson-marguerite', 25, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Mulet Pils', 'Brasserie du Borinage', 'Pils', 'Pils', 5.2, 'La pils du Borinage : nette, fraîche et franche. Parfaite pour une coupe mulet, évidemment.', 'The Borinage pils: crisp, fresh and straightforward. Perfect for a mullet, obviously.', 4.3, 'photo:boisson-mulet-pils', 26, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Organicus', 'Lupulus', 'Blonde bio', 'Organic blonde', null, 'La version bio de la Lupulus Blonde, houblonnée et désaltérante.', 'The organic version of Lupulus Blonde, hoppy and refreshing.', 4.2, 'photo:boisson-organicus', 27, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Paix Dieu', 'Brasserie Caulier', 'Triple', 'Tripel', 10, 'La triple brassée les nuits de pleine lune, élue meilleure triple d’Europe en 2022. Riche et généreuse.', 'The tripel brewed on full moon nights, voted best tripel in Europe in 2022. Rich and generous.', 4.5, 'photo:boisson-paix-dieu', 28, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Paix Dieu Nova', 'Brasserie Caulier', 'Blonde', 'Blonde', 6, 'La petite soeur plus légère de la Paix Dieu : une blonde de 6 % toute en finesse.', 'The lighter little sister of Paix Dieu: a 6% blonde full of finesse.', 4, 'photo:boisson-paix-dieu-nova', 29, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Peau de Pêche', 'Brasserie du Borinage', 'Pale ale à la pêche', 'Peach pale ale', 6, 'Une pale ale à la pêche de la Brasserie du Borinage, fruitée et ensoleillée.', 'A peach pale ale from Brasserie du Borinage, fruity and sunny.', 4.3, null, 30, false);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Pils’ Thagore', 'Brasserie Racine Carrée', 'Pils', 'Pils', null, 'La pils de la Brasserie Racine Carrée, fraîche et désaltérante.', 'The pils from Brasserie Racine Carrée, fresh and thirst quenching.', 4, 'photo:boisson-pils-thagore', 31, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Placebo', 'Lupulus', 'Blonde', 'Blonde', 0, 'Blonde sans alcool aux arômes de malt et de houblon, relevée d’une touche épicée.', 'Alcohol free blonde with malt and hop aromas and a spicy touch.', 4.5, 'photo:boisson-placebo', 32, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Racine', 'BALF', '', '', null, 'Une bière artisanale de la brasserie BALF. Demande au comptoir pour la découvrir.', 'A craft beer from the BALF brewery. Ask at the counter to discover it.', 4.2, 'photo:boisson-racine', 33, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Stuut Juicy Dolly', 'Brasserie Caulier', 'Bière fruitée', 'Fruity beer', null, 'Stuut, la gamme fruitée et décalée de la Brasserie Caulier, en canette.', 'Stuut, the fruity and offbeat range from Brasserie Caulier, in a can.', 4.2, 'photo:boisson-juicy-dolly', 34, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Stuut Pin My Ride', 'Brasserie Caulier', 'Bière fruitée', 'Fruity beer', null, 'Stuut, la gamme fruitée et décalée de la Brasserie Caulier, en canette.', 'Stuut, the fruity and offbeat range from Brasserie Caulier, in a can.', 4.2, 'photo:boisson-pin-my-ride', 35, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Sunlight', 'Brasserie du Borinage', 'Session IPA', 'Session IPA', null, 'Rafraîchissante et fruitée, une vraie bouffée de soleil signée Brasserie du Borinage.', 'Refreshing and fruity, a real ray of sunshine from Brasserie du Borinage.', 4.3, 'photo:boisson-sunlight', 36, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Supernova', 'Brasserie des Étoiles', '', '', null, 'Une création de la Brasserie des Étoiles. Demande au comptoir, on te la présente.', 'A creation from Brasserie des Étoiles. Ask at the counter and we’ll tell you all about it.', 4.2, 'photo:boisson-supernova', 37, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Triple du Prince', 'Brasserie Racine Carrée', 'Triple', 'Tripel', null, 'Une triple blonde de la Brasserie Racine Carrée, ronde et généreuse.', 'A golden tripel from Brasserie Racine Carrée, round and generous.', 4.5, 'photo:boisson-triple-du-prince', 38, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Triple Fourche', 'BALF', 'Triple', 'Tripel', null, 'Une triple de la brasserie BALF, généreuse et chaleureuse.', 'A tripel from the BALF brewery, generous and warming.', 4.5, 'photo:boisson-triple-fourche', 39, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Urine', 'Brasserie du Borinage', '', '', null, 'La plus culottée de la Brasserie du Borinage. Le nom fait sourire, la bière met tout le monde d’accord.', 'The cheekiest one from Brasserie du Borinage. The name makes you smile, the beer wins everyone over.', 4.3, 'photo:boisson-urine', 40, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('beer', 'Urine Zéro', 'Brasserie du Borinage', 'Sans alcool', 'Alcohol free', null, 'La version sans alcool de l’Urine : tout le goût, sans le degré.', 'The alcohol free version of Urine: all the taste, none of the alcohol.', 4, 'photo:boisson-urine-zero', 41, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Bori Cola', 'Brasserie du Borinage', 'Cola artisanal', 'Craft cola', null, 'Le cola local de la Brasserie du Borinage.', 'The local cola from Brasserie du Borinage.', 3, 'photo:boisson-boricola', 100, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Canada Dry', 'Coca Cola', 'Ginger ale', 'Ginger ale', null, 'Ginger ale pétillant, doux et rafraîchissant.', 'Sparkling ginger ale, smooth and refreshing.', 2.5, 'photo:boisson-canada-dry', 101, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Club Mate', '', 'Maté pétillant', 'Sparkling mate', null, 'La boisson au maté pétillante, pour un petit coup de boost.', 'The sparkling mate drink, for a little boost.', 3, 'photo:boisson-club-mate', 102, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Coca Cola', 'Coca Cola', 'Soda', 'Soda', null, 'Le classique, bien frais.', 'The classic, nice and cold.', 2, 'photo:boisson-coca-normal', 103, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Coca Cola Zéro', 'Coca Cola', 'Soda sans sucres', 'Sugar free soda', null, 'Tout le goût du Coca, sans sucres.', 'All the Coke taste, no sugar.', 2, 'photo:boisson-coca-zero', 104, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Eau pétillante', 'Chaudfontaine', 'Eau', 'Water', null, 'Pour rester frais pendant ta coupe.', 'To stay fresh during your cut.', 2, 'photo:boisson-eau-petillante', 105, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Eau plate', 'Chaudfontaine', 'Eau', 'Water', null, 'Pour rester frais pendant ta coupe.', 'To stay fresh during your cut.', 2, 'photo:boisson-eau-plate', 106, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Fanta', 'Coca Cola', 'Soda à l’orange', 'Orange soda', null, 'Pétillant et fruité.', 'Fizzy and fruity.', 2, 'photo:boisson-fanta-orange', 107, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Fuze Tea citron', 'Coca Cola', 'Thé glacé', 'Iced tea', null, 'Thé glacé au citron, frais et léger.', 'Lemon iced tea, fresh and light.', 2.5, 'photo:boisson-fuze-tea-lemon', 108, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Fuze Tea hibiscus', 'Coca Cola', 'Thé glacé', 'Iced tea', null, 'Thé glacé à l’hibiscus, fruité et désaltérant.', 'Hibiscus iced tea, fruity and refreshing.', 2.5, 'photo:boisson-fuze-tea-hibiscus', 109, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Kombucha Ginger', 'Yaya Kombucha', 'Kombucha', 'Kombucha', null, 'Kombucha au gingembre : pétillant, vif et naturellement fermenté.', 'Ginger kombucha: sparkling, zingy and naturally fermented.', 3.5, 'photo:boisson-kombucha-ginger', 110, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Kombucha Passion', 'Yaya Kombucha', 'Kombucha', 'Kombucha', null, 'Kombucha au fruit de la passion, exotique et pétillant.', 'Passion fruit kombucha, exotic and sparkling.', 3.5, null, 111, false);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Kombucha Pink Elderflower', 'Yaya Kombucha', 'Kombucha', 'Kombucha', null, 'Kombucha bio à la fleur de sureau, floral, léger et pétillant.', 'Organic elderflower kombucha, floral, light and sparkling.', 3.5, 'photo:boisson-kombucha-pink', 112, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Kombucha Yuzu', 'Yaya Kombucha', 'Kombucha', 'Kombucha', null, 'Kombucha au yuzu, frais et acidulé.', 'Yuzu kombucha, fresh and tangy.', 3.5, null, 113, false);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Loumonade citron bergamote', 'Lupulus', 'Limonade artisanale', 'Craft lemonade', null, 'Limonade artisanale citron et bergamote, fraîche et parfumée.', 'Craft lemonade with lemon and bergamot, fresh and fragrant.', 3, 'photo:boisson-loumonade-citron-bergamote', 114, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Loumonade myrtille menthe', 'Lupulus', 'Limonade artisanale', 'Craft lemonade', null, 'Limonade artisanale myrtille et menthe, fruitée et rafraîchissante.', 'Craft lemonade with blueberry and mint, fruity and refreshing.', 3, 'photo:boisson-loumonade-myrtille-menthe', 115, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Loumonade rose vanille cerise', 'Lupulus', 'Limonade artisanale', 'Craft lemonade', null, 'Limonade artisanale rose, vanille et cerise, douce et originale.', 'Craft lemonade with rose, vanilla and cherry, sweet and original.', 3, 'photo:boisson-loumonade-rose-vanille-cerise', 116, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Minute Maid orange', 'Coca Cola', 'Jus de fruits', 'Fruit juice', null, 'Jus d’orange, le plein de vitamines.', 'Orange juice, packed with vitamins.', 2.5, 'photo:boisson-minute-maid-orange', 117, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Minute Maid pomme cerise', 'Coca Cola', 'Jus de fruits', 'Fruit juice', null, 'Jus pomme et cerise, doux et fruité.', 'Apple and cherry juice, sweet and fruity.', 2.5, 'photo:boisson-minute-maid-pomme-cerise', 118, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Ritchie Grapefruit', 'Ritchie', 'Limonade belge', 'Belgian lemonade', null, 'Limonade belge au pamplemousse, pétillante et légèrement amère.', 'Belgian grapefruit lemonade, sparkling and slightly bitter.', 3, 'photo:boisson-ritchie-grapefruit', 119, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Ritchie Lemon', 'Ritchie', 'Limonade belge', 'Belgian lemonade', null, 'Limonade belge au citron, pétillante et vive.', 'Belgian lemon lemonade, sparkling and zesty.', 3, 'photo:boisson-ritchie-lemon', 120, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Spa citron', 'Spa', 'Limonade', 'Lemonade', null, 'Le classique belge au citron, pétillant.', 'The Belgian classic, sparkling lemon.', 2.5, 'photo:boisson-spa-citron', 121, true);
insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values ('soft', 'Spa orange', 'Spa', 'Limonade', 'Lemonade', null, 'Le classique belge à l’orange, pétillant.', 'The Belgian classic, sparkling orange.', 2.5, 'photo:boisson-spa-orange', 122, true);

-- Ta coupe, ta bière
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Dégradé net', 'Sharp fade', 'La Mulet Pils', 'Mulet Pils', 'Net, frais, sans bavure. Comme ton dégradé.', 'Sharp, fresh, no rough edges. Just like your fade.', 1, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Barbe taillée', 'Trimmed beard', 'La Dominicains Quadruple', 'Dominicains Quadruple', 'Une barbe de caractère mérite une bière qui en a aussi.', 'A beard with character deserves a beer with character.', 2, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Coupe classique', 'Classic cut', 'La Paix Dieu', 'Paix Dieu', 'Les classiques ne se démodent jamais. Ni la coupe, ni la triple.', 'Classics never go out of style. Neither the cut nor the tripel.', 3, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Boule à zéro', 'Buzz cut', 'La Placebo', 'Placebo', 'Tête légère, bière légère, esprit libre.', 'Light head, light beer, free mind.', 4, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Boucles assumées', 'Proud curls', 'La Béatific Ecstasy', 'Béatific Ecstasy', 'Du volume, du peps et un brin de folie fruitée.', 'Volume, pep and a touch of fruity madness.', 5, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Coupe mulet', 'Mullet', 'La Mulet Pils', 'Mulet Pils', 'Business devant, pils derrière. Évidemment.', 'Business in the front, pils in the back. Obviously.', 6, true);
insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values ('Rasage à l’ancienne', 'Old-school shave', 'La Dominicains Triple', 'Dominicains Triple', 'Un rituel de tradition appelle une triple brassée à Mons.', 'A traditional ritual calls for a tripel brewed in Mons.', 7, true);

-- Produits
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Aftershave 4', 'Nishman', 'Lotion après-rasage qui rafraîchit et apaise la peau.', 'After shave lotion that refreshes and soothes the skin.', 'Quelques gouttes sur la peau après le rasage, en tapotant.', 'A few drops on the skin after shaving, patting gently.', 12, '{}'::text[], '{}'::text[], false, array['care']::text[], 'photo:produit-cream-cologne-4', 1, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Barber Talc', 'Nishman', 'Talc de barbier qui absorbe l’humidité et laisse la nuque nette et sèche.', 'Barber talc that absorbs moisture and leaves the neck clean and dry.', 'Appliquer au pinceau sur la nuque et les contours.', 'Apply with a brush on the neck and outlines.', 10, '{}'::text[], '{}'::text[], false, array['care', 'natural']::text[], 'photo:produit-barber-talc', 2, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Beard Brush', 'Nishman', 'Brosse à barbe qui démêle, discipline et répartit les soins.', 'Beard brush that detangles, tames and spreads your care products.', 'Brosser la barbe dans le sens de la pousse, chaque matin.', 'Brush your beard in the direction of growth every morning.', 14, '{}'::text[], '{}'::text[], true, array['care', 'natural']::text[], 'photo:produit-beard-brush', 3, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire Sport 02', 'Nishman', 'Cire coiffante 02 Sport : tenue forte et brillance pour un style net.', '02 Sport styling wax: strong hold and shine for a sharp look.', 'Une noisette sur cheveux secs, coiffer au peigne.', 'A small amount on dry hair, style with a comb.', 8, array['fine', 'thick']::text[], '{}'::text[], false, array['hold', 'shine']::text[], 'photo:produit-cire-02', 4, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire barbe et moustache', 'Nishman', 'Discipline la barbe et sculpte la moustache pour un contour net toute la journée.', 'Tames the beard and shapes the moustache for a sharp outline all day.', 'Chauffer une petite quantité entre les doigts, appliquer puis peigner.', 'Warm a small amount between your fingers, apply, then comb.', 8, '{}'::text[], '{}'::text[], true, array['hold', 'care']::text[], 'photo:produit-cire-barbe-moustache', 5, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire Black Edition', 'Nishman', 'Cire coiffante pour une tenue fiable et un fini soigné.', 'Styling wax for reliable hold and a polished finish.', 'Une noisette sur cheveux secs, coiffer au peigne ou aux doigts.', 'A small amount on dry hair, style with a comb or your fingers.', 8, array['fine', 'thick']::text[], '{}'::text[], false, array['hold', 'shine']::text[], 'photo:produit-cire-10', 6, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire Gold Million', 'Nishman', 'Cire coiffante pour une tenue fiable et un fini brillant.', 'Styling wax for reliable hold and a shiny finish.', 'Une noisette sur cheveux secs, coiffer au peigne.', 'A small amount on dry hair, style with a comb.', 8, array['fine', 'thick']::text[], '{}'::text[], false, array['hold', 'shine']::text[], 'photo:produit-cire-07', 7, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire Keratin 05', 'Nishman', 'Cire coiffante enrichie en kératine : tenue, brillance et cheveux protégés.', 'Keratin enriched styling wax: hold, shine and protected hair.', 'Une noisette sur cheveux secs, coiffer au peigne.', 'A small amount on dry hair, style with a comb.', 8, array['fine', 'thick']::text[], '{}'::text[], false, array['hold', 'shine']::text[], 'photo:produit-cire-05', 8, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Cire Milky', 'Nishman', 'Cire coiffante crémeuse pour une tenue souple et un joli brillant.', 'Creamy styling wax for flexible hold and a nice shine.', 'Une noisette sur cheveux secs ou légèrement humides, coiffer au peigne.', 'A small amount on dry or slightly damp hair, style with a comb.', 8, array['fine', 'thick']::text[], '{}'::text[], false, array['hold', 'shine']::text[], 'photo:produit-cire-milky', 9, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Conditioner 1', 'Nishman', 'Après-shampoing qui adoucit et facilite le coiffage.', 'Conditioner that softens and makes styling easier.', 'Après le shampoing, laisser poser une minute puis rincer.', 'After shampooing, leave on for one minute, then rinse.', 10, '{}'::text[], array['normal', 'dry']::text[], false, array['care', 'shine']::text[], 'photo:produit-conditioner-1', 10, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Conditioner 2', 'Nishman', 'Après-shampoing qui nourrit et apporte de la souplesse.', 'Conditioner that nourishes and adds suppleness.', 'Après le shampoing, laisser poser une minute puis rincer.', 'After shampooing, leave on for one minute, then rinse.', 10, '{}'::text[], array['normal', 'dry']::text[], false, array['care', 'shine']::text[], 'photo:produit-conditioner-2', 11, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Conditioner 3', 'Nishman', 'Après-shampoing qui démêle et prend soin des cheveux épais ou bouclés.', 'Conditioner that detangles and cares for thick or curly hair.', 'Après le shampoing, laisser poser une minute puis rincer.', 'After shampooing, leave on for one minute, then rinse.', 10, array['thick', 'curly', 'coily']::text[], array['dry']::text[], false, array['care']::text[], 'photo:produit-conditioner-3', 12, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Crème modelante M3', 'Nishman', 'Crème modelante pour sculpter la coiffure avec un rendu naturel.', 'Shaping cream to sculpt your style with a natural look.', 'Émulsionner entre les mains, appliquer sur cheveux secs.', 'Rub between your hands, apply to dry hair.', 12, array['thick', 'curly']::text[], '{}'::text[], false, array['hold', 'natural']::text[], 'photo:produit-creme-modelante-m3', 13, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Crème modelante M5', 'Nishman', 'Texture mate et fixation forte, pensée pour les coiffures créatives.', 'Matte texture and strong hold, made for creative styles.', 'Émulsionner entre les mains, appliquer sur cheveux secs et sculpter.', 'Rub between your hands, apply to dry hair and sculpt.', 12, array['thick', 'curly']::text[], '{}'::text[], false, array['hold', 'natural']::text[], 'photo:produit-creme-modelante-m5', 14, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Crème modelante M8', 'Nishman', 'Crème modelante pour une tenue maîtrisée et un rendu naturel.', 'Shaping cream for controlled hold and a natural look.', 'Émulsionner entre les mains, appliquer sur cheveux secs.', 'Rub between your hands, apply to dry hair.', 12, array['thick', 'curly']::text[], '{}'::text[], false, array['hold', 'natural']::text[], 'photo:produit-creme-modelante-m8', 15, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Huile à barbe', 'Nishman', 'Nourrit la barbe et la peau, apporte douceur et brillance.', 'Nourishes beard and skin, adds softness and shine.', 'Quelques gouttes chaque matin, masser jusqu’à la peau.', 'A few drops every morning, massage down to the skin.', 15, '{}'::text[], '{}'::text[], true, array['care', 'shine']::text[], 'photo:produit-huile-de-barbe', 18, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Lotion n°1', 'Nishman', 'Lotion après-rasage parfumée, fraîcheur immédiate.', 'Scented after shave lotion, instant freshness.', 'Appliquer sur la peau après le rasage.', 'Apply to the skin after shaving.', 12, '{}'::text[], '{}'::text[], false, array['care']::text[], 'photo:produit-lotion-1', 19, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Lotion n°7', 'Nishman', 'Lotion après-rasage parfumée, fraîcheur immédiate.', 'Scented after shave lotion, instant freshness.', 'Appliquer sur la peau après le rasage.', 'Apply to the skin after shaving.', 12, '{}'::text[], '{}'::text[], false, array['care']::text[], 'photo:produit-lotion-7', 20, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Lotion n°8', 'Nishman', 'Lotion après-rasage parfumée, fraîcheur immédiate.', 'Scented after shave lotion, instant freshness.', 'Appliquer sur la peau après le rasage.', 'Apply to the skin after shaving.', 12, '{}'::text[], '{}'::text[], false, array['care']::text[], 'photo:produit-lotion-8', 21, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Magic Brush', 'Nishman', 'Brosse pratique pour coiffer et discipliner au quotidien.', 'Handy brush to style and tame every day.', 'Brosser sur cheveux secs ou humides.', 'Brush on dry or damp hair.', 6, '{}'::text[], '{}'::text[], false, array['natural']::text[], 'photo:produit-magic-brush', 22, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Mousse coiffante Sea Salt', 'Nishman', 'Effet sel de mer : texture décoiffée et volume naturel.', 'Sea salt effect: tousled texture and natural volume.', 'Répartir sur cheveux humides, sécher en froissant.', 'Spread through damp hair, scrunch while drying.', 12, array['fine', 'thick', 'curly']::text[], '{}'::text[], false, array['volume', 'natural']::text[], 'photo:produit-mousse-sea-salt', 24, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Peigne 034', 'Nishman', 'Peigne de barbier pour une raie nette et un coiffage précis.', 'Barber comb for a sharp parting and precise styling.', 'Coiffer après application de ton produit.', 'Comb after applying your product.', 6, '{}'::text[], '{}'::text[], false, array['natural']::text[], 'photo:produit-peigne-034', 25, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Poudre fixation moyenne', 'Nishman', 'Poudre coiffante qui donne du volume avec une tenue moyenne.', 'Styling powder for volume with medium hold.', 'Saupoudrer sur les racines sèches et travailler du bout des doigts.', 'Sprinkle on dry roots and work in with your fingertips.', 10, array['fine']::text[], '{}'::text[], false, array['volume', 'hold']::text[], 'photo:produit-poudre-fix-moyenne', 26, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Powder Matte Finish', 'Nishman', 'Poudre coiffante au fini mat : volume instantané, effet naturel.', 'Matte finish styling powder: instant volume, natural look.', 'Saupoudrer sur les racines sèches et travailler du bout des doigts.', 'Sprinkle on dry roots and work in with your fingertips.', 10, array['fine']::text[], '{}'::text[], false, array['volume', 'natural']::text[], 'photo:produit-powder-matte-finish', 27, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Powder X1', 'Nishman', 'Poudre coiffante pour du volume et de la tenue sur cheveux fins.', 'Styling powder for volume and hold on fine hair.', 'Saupoudrer sur les racines sèches et travailler du bout des doigts.', 'Sprinkle on dry roots and work in with your fingertips.', 12, array['fine', 'thick']::text[], '{}'::text[], false, array['volume', 'hold']::text[], 'photo:produit-powder-x1', 28, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Shampoing antichute', 'Nishman', 'Shampoing qui prend soin du cuir chevelu et des cheveux fragilisés.', 'Shampoo that cares for the scalp and weakened hair.', 'Masser sur cheveux mouillés, laisser poser une minute, rincer.', 'Massage into wet hair, leave on for one minute, rinse.', 15, '{}'::text[], array['normal', 'oily']::text[], false, array['care', 'volume']::text[], 'photo:produit-shampoing-anti-chute', 29, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Shampoing barbe', 'Nishman', 'Nettoie la barbe en douceur et la laisse souple.', 'Gently cleanses the beard and leaves it soft.', 'Masser dans la barbe mouillée, rincer abondamment.', 'Massage into the wet beard, rinse thoroughly.', 8, '{}'::text[], '{}'::text[], true, array['care']::text[], 'photo:produit-shampoing-barbe', 30, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Spray parfum barbe', 'Nishman', 'Parfume la barbe toute la journée.', 'Keeps your beard smelling great all day.', 'Vaporiser légèrement sur la barbe.', 'Spray lightly onto the beard.', 15, '{}'::text[], '{}'::text[], true, array['care']::text[], 'photo:produit-spray-parfum-barbe', 32, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Spray Sea Salt', 'Nishman', 'Effet décoiffé maîtrisé, volume et texture légère.', 'Controlled tousled look, volume and light texture.', 'Vaporiser sur cheveux humides, sécher en froissant.', 'Spray onto damp hair, scrunch while drying.', 12, array['fine', 'thick', 'curly']::text[], '{}'::text[], false, array['volume', 'natural']::text[], 'photo:produit-sea-salt-spray', 33, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Tonique capillaire', 'Nishman', 'Lotion tonique qui rafraîchit et rééquilibre le cuir chevelu.', 'Tonic lotion that refreshes and rebalances the scalp.', 'Appliquer sur le cuir chevelu propre, masser, ne pas rincer.', 'Apply to a clean scalp, massage, do not rinse.', 12, '{}'::text[], array['dry', 'oily']::text[], false, array['care']::text[], 'photo:produit-hair-tonic', 34, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Shampoing à l’ail', 'Nishman', 'Shampoing à l’extrait d’ail qui fortifie les cheveux et tonifie le cuir chevelu.', 'Garlic extract shampoo that strengthens hair and invigorates the scalp.', 'Masser sur cheveux mouillés, laisser poser une minute, rincer.', 'Massage into wet hair, leave on for one minute, rinse.', 15, '{}'::text[], array['normal', 'oily']::text[], false, array['care', 'volume']::text[], 'photo:produit-shampoing-ail', 35, true);
insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values ('Aftershave 5', 'Nishman', 'Crème et eau de Cologne après-rasage : apaise la peau et la parfume durablement.', 'After shave cream and cologne: soothes the skin and leaves a lasting scent.', 'Quelques gouttes sur la peau après le rasage, en tapotant.', 'A few drops on the skin after shaving, patting gently.', 12, '{}'::text[], '{}'::text[], false, array['care']::text[], 'photo:produit-cream-cologne-5', 36, true);

-- Gains de la roue
insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values ('10 % sur ta coupe', '10% off your cut', 10, null, false, '#D4A84B', 1, true);
insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values ('Un soft offert', 'A free soft drink', 25, null, false, '#267255', 2, true);
insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values ('Une bière offerte', 'A free beer', 15, null, false, '#F4EBD9', 3, true);
insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values ('5 € sur un produit', '€5 off a product', 10, null, false, '#8F6B22', 4, true);
insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values ('Pas de chance cette fois', 'No luck this time', 40, null, true, '#0E2F23', 5, true);

-- Questions de quiz (690)
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appelle la grande fête de Mons, le week-end de la Trinité ?', 'What is the name of the big Mons festival held on Trinity weekend?', array['Le Doudou', 'Le Carnaval', 'La Ducasse d’Ath', 'Les Fêtes de Wallonie']::text[], array['The Doudou', 'The Carnival', 'The Ath Ducasse', 'The Wallonia Festival']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Qui affronte le Dragon pendant le Combat dit Lumeçon ?', 'Who fights the Dragon during the Lumeçon battle?', array['Saint Georges', 'Saint Michel', 'Saint Nicolas', 'Saint Martin']::text[], array['Saint George', 'Saint Michael', 'Saint Nicholas', 'Saint Martin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Sur la Grand-Place, on caresse la tête de quel animal pour avoir de la chance ?', 'On the Grand-Place, which animal’s head do people stroke for good luck?', array['Un petit singe', 'Un lion', 'Un chien', 'Un dragon']::text[], array['A little monkey', 'A lion', 'A dog', 'A dragon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Mons a été Capitale européenne de la culture en quelle année ?', 'In which year was Mons a European Capital of Culture?', array['2015', '2010', '2018', '2005']::text[], array['2015', '2010', '2018', '2005']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le beffroi de Mons est le seul beffroi de Belgique de quel style ?', 'The Mons belfry is the only belfry in Belgium built in which style?', array['Baroque', 'Gothique', 'Roman', 'Art déco']::text[], array['Baroque', 'Gothic', 'Romanesque', 'Art Deco']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle sainte est la patronne de Mons ?', 'Which saint is the patron saint of Mons?', array['Sainte Waudru', 'Sainte Gudule', 'Sainte Catherine', 'Sainte Rita']::text[], array['Saint Waudru', 'Saint Gudula', 'Saint Catherine', 'Saint Rita']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appelle le char doré qui porte la châsse de Sainte Waudru pendant la procession ?', 'What is the golden chariot carrying Saint Waudru’s shrine during the procession called?', array['Le Car d’Or', 'Le Char du Roi', 'Le Carrosse des Saints', 'La Barque dorée']::text[], array['The Car d’Or', 'The King’s Chariot', 'The Saints’ Coach', 'The Golden Barge']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle rivière traverse Mons ?', 'Which river flows through Mons?', array['La Trouille', 'La Meuse', 'L’Escaut', 'La Sambre']::text[], array['The Trouille', 'The Meuse', 'The Scheldt', 'The Sambre']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Mons est la capitale de quelle province ?', 'Mons is the capital of which province?', array['Le Hainaut', 'Namur', 'Liège', 'Le Brabant wallon']::text[], array['Hainaut', 'Namur', 'Liège', 'Walloon Brabant']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appellent les habitants de Mons ?', 'What are the people of Mons called?', array['Les Montois', 'Les Monsiens', 'Les Montagnards', 'Les Monsois']::text[], array['Montois', 'Monsians', 'Mountaineers', 'Monsois']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel peintre célèbre a vécu dans le Borinage, près de Mons, avant de devenir artiste ?', 'Which famous painter lived in the Borinage, near Mons, before becoming an artist?', array['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Paul Cézanne']::text[], array['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Paul Cézanne']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le Mundaneum, installé à Mons, est souvent surnommé...', 'The Mundaneum, based in Mons, is often nicknamed...', array['Le Google de papier', 'Le Louvre belge', 'La Bibliothèque du roi', 'Le Musée du temps']::text[], array['The paper Google', 'The Belgian Louvre', 'The King’s Library', 'The Museum of Time']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Pendant le Lumeçon, la foule essaie d’attraper quoi sur le Dragon pour avoir de la chance ?', 'During the Lumeçon, what does the crowd try to grab from the Dragon for good luck?', array['Les crins de sa queue', 'Ses écailles', 'Ses dents', 'Ses ailes']::text[], array['Hair from its tail', 'Its scales', 'Its teeth', 'Its wings']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appellent les personnages qui protègent Saint Georges pendant le Lumeçon ?', 'What are the characters protecting Saint George during the Lumeçon called?', array['Les Chinchins', 'Les Gilles', 'Les Blancs Moussis', 'Les Géants']::text[], array['The Chinchins', 'The Gilles', 'The Blancs Moussis', 'The Giants']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel est le nom de Mons en néerlandais ?', 'What is the Dutch name of Mons?', array['Bergen', 'Monten', 'Berghe', 'Heuvel']::text[], array['Bergen', 'Monten', 'Berghe', 'Heuvel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Laquelle de ces bières est une trappiste ?', 'Which of these beers is a Trappist beer?', array['Chimay', 'Leffe', 'Duvel', 'Jupiler']::text[], array['Chimay', 'Leffe', 'Duvel', 'Jupiler']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Chimay est brassée dans quelle province ?', 'Chimay is brewed in which province?', array['Le Hainaut', 'Liège', 'Namur', 'Le Luxembourg']::text[], array['Hainaut', 'Liège', 'Namur', 'Luxembourg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel animal figure sur le logo de l’Orval ?', 'Which animal appears on the Orval logo?', array['Une truite', 'Un cygne', 'Un lion', 'Un cerf']::text[], array['A trout', 'A swan', 'A lion', 'A deer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La culture de la bière en Belgique est inscrite au patrimoine de l’UNESCO depuis quelle année ?', 'Since which year has Belgian beer culture been on the UNESCO heritage list?', array['2016', '2006', '2012', '2020']::text[], array['2016', '2006', '2012', '2020']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel type de fermentation donne naissance au lambic ?', 'What kind of fermentation produces lambic?', array['Spontanée', 'Basse', 'Haute', 'Accélérée']::text[], array['Spontaneous', 'Bottom', 'Top', 'Accelerated']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La gueuze est un assemblage de...', 'Gueuze is a blend of...', array['Lambics jeunes et vieux', 'Bières blondes et brunes', 'Bière et cidre', 'Bière et vin']::text[], array['Young and old lambics', 'Blonde and brown beers', 'Beer and cider', 'Beer and wine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel fruit donne son goût à la kriek ?', 'Which fruit gives kriek its flavour?', array['La cerise', 'La framboise', 'La pêche', 'La pomme']::text[], array['Cherry', 'Raspberry', 'Peach', 'Apple']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La bière de saison est née dans les fermes de quelle région ?', 'Saison beer was born on the farms of which region?', array['Le Hainaut', 'La Flandre occidentale', 'Le Limbourg', 'Anvers']::text[], array['Hainaut', 'West Flanders', 'Limburg', 'Antwerp']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Que veut dire le mot Duvel ?', 'What does the word Duvel mean?', array['Diable', 'Ange', 'Double', 'Doré']::text[], array['Devil', 'Angel', 'Double', 'Golden']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle céréale est la plus utilisée pour fabriquer le malt ?', 'Which grain is most commonly used to make malt?', array['L’orge', 'Le maïs', 'Le riz', 'L’avoine']::text[], array['Barley', 'Corn', 'Rice', 'Oats']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle plante apporte l’amertume à la bière ?', 'Which plant gives beer its bitterness?', array['Le houblon', 'La lavande', 'La menthe', 'Le thym']::text[], array['Hops', 'Lavender', 'Mint', 'Thyme']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Une bière blanche belge est brassée avec du blé et souvent avec...', 'A Belgian witbier is brewed with wheat and often with...', array['De la coriandre et de l’écorce d’orange', 'De la cannelle et de la vanille', 'Du gingembre et du citron vert', 'Du poivre et du thym']::text[], array['Coriander and orange peel', 'Cinnamon and vanilla', 'Ginger and lime', 'Pepper and thyme']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le célèbre verre Kwak est tenu par...', 'The famous Kwak glass is held by...', array['Un support en bois', 'Une anse en cuir', 'Une chaîne en métal', 'Un socle en pierre']::text[], array['A wooden stand', 'A leather handle', 'A metal chain', 'A stone base']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Jupiler tire son nom de quel endroit ?', 'Jupiler takes its name from which place?', array['Jupille, près de Liège', 'La planète Jupiter', 'Jumet, près de Charleroi', 'Jodoigne']::text[], array['Jupille, near Liège', 'The planet Jupiter', 'Jumet, near Charleroi', 'Jodoigne']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le faro est un lambic adouci avec...', 'Faro is a lambic sweetened with...', array['Du sucre', 'Du miel', 'Du sel', 'Du lait']::text[], array['Sugar', 'Honey', 'Salt', 'Milk']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'D’où vient l’enseigne rouge et blanche des barbiers ?', 'Where does the red and white barber pole come from?', array['Des barbiers chirurgiens d’autrefois', 'D’un club de football', 'D’un drapeau de marins', 'D’une marque de bonbons']::text[], array['The barber surgeons of the past', 'A football club', 'A sailors’ flag', 'A candy brand']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle une coupe qui passe progressivement de très court à plus long ?', 'What do you call a cut that goes gradually from very short to longer?', array['Un dégradé', 'Un carré', 'Un chignon', 'Une frange']::text[], array['A fade', 'A bob', 'A bun', 'A fringe']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel est le surnom du rasoir droit traditionnel ?', 'What is the traditional straight razor also called?', array['Le coupe chou', 'Le coupe vent', 'Le taille haie', 'Le coupe papier']::text[], array['A cutthroat razor', 'A safety pin', 'A hedge trimmer', 'A paper cutter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le blaireau de rasage était traditionnellement fabriqué avec les poils de quel animal ?', 'Shaving brushes were traditionally made with the hair of which animal?', array['Le blaireau', 'Le chat', 'Le lapin', 'Le mouton']::text[], array['The badger', 'The cat', 'The rabbit', 'The sheep']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une moustache aux pointes relevées s’appelle une moustache...', 'A moustache with upturned tips is called a... moustache', array['En guidon', 'En brosse', 'En crayon', 'En fer à cheval']::text[], array['Handlebar', 'Toothbrush', 'Pencil', 'Horseshoe']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'À quoi sert la serviette chaude avant un rasage traditionnel ?', 'What is the hot towel for before a traditional shave?', array['À ramollir le poil et détendre la peau', 'À sécher la barbe', 'À colorer la peau', 'À couper le poil']::text[], array['Softening the hair and relaxing the skin', 'Drying the beard', 'Colouring the skin', 'Cutting the hair']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel est le surnom de la coupe mulet ?', 'What is the famous motto of the mullet?', array['La nuque longue', 'La boule à zéro', 'La coupe au bol', 'La crête']::text[], array['Business in the front, party in the back', 'Short and sweet', 'Less is more', 'Keep it clean']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe banane popularisée par Elvis Presley porte aussi le nom de...', 'The quiff popularised by Elvis Presley is also called a...', array['Pompadour', 'Mohawk', 'Undercut', 'Buzz cut']::text[], array['Pompadour', 'Mohawk', 'Undercut', 'Buzz cut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'En moyenne, les cheveux poussent de combien par mois ?', 'On average, how much does hair grow per month?', array['+/ 1 cm', '+/ 1 mm', '+/ 5 cm', '+/ 10 cm']::text[], array['+/ 1 cm', '+/ 1 mm', '+/ 5 cm', '+/ 10 cm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel produit coiffant donne un effet mat et naturel ?', 'Which styling product gives a matte, natural finish?', array['L’argile', 'La pommade brillante', 'Le gel effet mouillé', 'La laque brillante']::text[], array['Clay', 'Shiny pomade', 'Wet look gel', 'Shiny hairspray']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le sabot numéro 1 d’une tondeuse laisse environ...', 'A number 1 clipper guard leaves about...', array['+/ 3 mm', '+/ 1 cm', '+/ 2 cm', '+/ 5 cm']::text[], array['+/ 3 mm', '+/ 1 cm', '+/ 2 cm', '+/ 5 cm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'À quoi sert l’huile à barbe ?', 'What is beard oil for?', array['À nourrir la barbe et la peau', 'À faire pousser la barbe deux fois plus vite', 'À teindre la barbe en noir', 'À remplacer le savon']::text[], array['Nourishing the beard and the skin', 'Making the beard grow twice as fast', 'Dyeing the beard black', 'Replacing soap']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Rossini a composé un opéra célèbre sur un barbier. Lequel ?', 'Rossini wrote a famous opera about a barber. Which one?', array['Le Barbier de Séville', 'La Flûte enchantée', 'Carmen', 'La Traviata']::text[], array['The Barber of Seville', 'The Magic Flute', 'Carmen', 'La Traviata']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle la coupe où les côtés sont très courts et le dessus reste long ?', 'What is the cut with very short sides and a long top called?', array['L’undercut', 'Le carré plongeant', 'La coupe au bol', 'Le chignon']::text[], array['The undercut', 'The inverted bob', 'The bowl cut', 'The bun']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Un quatuor barbershop, c’est...', 'A barbershop quartet is...', array['Quatre chanteurs a cappella', 'Quatre barbiers qui coupent en même temps', 'Un groupe de rock', 'Une danse de salon']::text[], array['Four singers performing a cappella', 'Four barbers cutting at the same time', 'A rock band', 'A ballroom dance']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quelle ville est originaire le chanteur Stromae ?', 'Which city does the singer Stromae come from?', array['Bruxelles', 'Liège', 'Paris', 'Charleroi']::text[], array['Brussels', 'Liège', 'Paris', 'Charleroi']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui chante « Alors on danse » ?', 'Who sings “Alors on danse”?', array['Stromae', 'Angèle', 'Damso', 'Lost Frequencies']::text[], array['Stromae', 'Angèle', 'Damso', 'Lost Frequencies']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Adolphe Sax, l’inventeur du saxophone, est né dans quelle ville belge ?', 'Adolphe Sax, the inventor of the saxophone, was born in which Belgian town?', array['Dinant', 'Namur', 'Mons', 'Gand']::text[], array['Dinant', 'Namur', 'Mons', 'Ghent']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Jacques Brel, qui chante « Ne me quitte pas », était...', 'Jacques Brel, who sang “Ne me quitte pas”, was...', array['Belge', 'Français', 'Suisse', 'Canadien']::text[], array['Belgian', 'French', 'Swiss', 'Canadian']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans quelle commune a lieu le festival Tomorrowland ?', 'In which town does the Tomorrowland festival take place?', array['Boom', 'Dour', 'Werchter', 'Spa']::text[], array['Boom', 'Dour', 'Werchter', 'Spa']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le Dour Festival se déroule dans quelle province ?', 'Dour Festival takes place in which province?', array['Le Hainaut', 'Liège', 'Anvers', 'Namur']::text[], array['Hainaut', 'Liège', 'Antwerp', 'Namur']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse belge a sorti « Balance ton quoi » ?', 'Which Belgian singer released “Balance ton quoi”?', array['Angèle', 'Typh Barrow', 'Selah Sue', 'Lous and the Yakuza']::text[], array['Angèle', 'Typh Barrow', 'Selah Sue', 'Lous and the Yakuza']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le hip hop est né dans les années 1970 dans quel quartier ?', 'Hip hop was born in the 1970s in which neighbourhood?', array['Le Bronx, à New York', 'Hollywood, à Los Angeles', 'Soho, à Londres', 'Montmartre, à Paris']::text[], array['The Bronx, New York', 'Hollywood, Los Angeles', 'Soho, London', 'Montmartre, Paris']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Combien de touches compte un piano classique ?', 'How many keys does a standard piano have?', array['88', '64', '76', '100']::text[], array['88', '64', '76', '100']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quel pays vient le reggae ?', 'Which country does reggae come from?', array['La Jamaïque', 'Le Brésil', 'Cuba', 'Le Nigeria']::text[], array['Jamaica', 'Brazil', 'Cuba', 'Nigeria']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui est surnommé le roi de la pop ?', 'Who is nicknamed the King of Pop?', array['Michael Jackson', 'Elvis Presley', 'Prince', 'Freddie Mercury']::text[], array['Michael Jackson', 'Elvis Presley', 'Prince', 'Freddie Mercury']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel titre a été chanté par le groupe Queen ?', 'Which song was performed by the band Queen?', array['Bohemian Rhapsody', 'Billie Jean', 'Imagine', 'Hey Jude']::text[], array['Bohemian Rhapsody', 'Billie Jean', 'Imagine', 'Hey Jude']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quel pays vient le duo Daft Punk ?', 'Which country is the duo Daft Punk from?', array['La France', 'La Belgique', 'L’Allemagne', 'La Suède']::text[], array['France', 'Belgium', 'Germany', 'Sweden']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel tube a chanté le Belge Plastic Bertrand ?', 'Which hit was sung by the Belgian artist Plastic Bertrand?', array['Ça plane pour moi', 'Alors on danse', 'Tous les mêmes', 'Dernière danse']::text[], array['Ça plane pour moi', 'Alors on danse', 'Tous les mêmes', 'Dernière danse']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le DJ belge Lost Frequencies s’est fait connaître avec quel titre ?', 'Belgian DJ Lost Frequencies broke through with which track?', array['Are You With Me', 'Titanium', 'Wake Me Up', 'Lean On']::text[], array['Are You With Me', 'Titanium', 'Wake Me Up', 'Lean On']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de langues officielles compte la Belgique ?', 'How many official languages does Belgium have?', array['3', '2', '4', '1']::text[], array['3', '2', '4', '1']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel personnage de BD a été créé par Hergé ?', 'Which comic character was created by Hergé?', array['Tintin', 'Astérix', 'Lucky Luke', 'Gaston Lagaffe']::text[], array['Tintin', 'Asterix', 'Lucky Luke', 'Gaston']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'L’Atomium a été construit pour l’Exposition universelle de quelle année ?', 'The Atomium was built for the World’s Fair of which year?', array['1958', '1935', '1970', '2000']::text[], array['1958', '1935', '1970', '2000']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la date de la fête nationale belge ?', 'When is Belgian National Day?', array['Le 21 juillet', 'Le 14 juillet', 'Le 11 novembre', 'Le 1er mai']::text[], array['21 July', '14 July', '11 November', '1 May']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Que signifie l’abréviation IA ?', 'What does AI stand for?', array['Intelligence artificielle', 'Internet avancé', 'Information automatique', 'Image animée']::text[], array['Artificial intelligence', 'Advanced internet', 'Automatic information', 'Animated image']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel scientifique a imaginé un test célèbre pour savoir si une machine peut penser ?', 'Which scientist came up with a famous test to tell whether a machine can think?', array['Alan Turing', 'Albert Einstein', 'Isaac Newton', 'Marie Curie']::text[], array['Alan Turing', 'Albert Einstein', 'Isaac Newton', 'Marie Curie']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle planète est surnommée la planète rouge ?', 'Which planet is nicknamed the red planet?', array['Mars', 'Vénus', 'Jupiter', 'Saturne']::text[], array['Mars', 'Venus', 'Jupiter', 'Saturn']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand océan du monde ?', 'What is the largest ocean in the world?', array['Le Pacifique', 'L’Atlantique', 'L’océan Indien', 'L’Arctique']::text[], array['The Pacific', 'The Atlantic', 'The Indian Ocean', 'The Arctic']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de fois le Belge Eddy Merckx a remporté le Tour de France ?', 'How many times did Belgian cyclist Eddy Merckx win the Tour de France?', array['5', '3', '7', '2']::text[], array['5', '3', '7', '2']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année a eu lieu la bataille de Waterloo ?', 'In which year did the Battle of Waterloo take place?', array['1815', '1789', '1830', '1914']::text[], array['1815', '1789', '1830', '1914']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la formule chimique de l’eau ?', 'What is the chemical formula of water?', array['H2O', 'CO2', 'O2', 'NaCl']::text[], array['H2O', 'CO2', 'O2', 'NaCl']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel dessinateur belge a créé les Schtroumpfs ?', 'Which Belgian cartoonist created the Smurfs?', array['Peyo', 'Hergé', 'Franquin', 'Morris']::text[], array['Peyo', 'Hergé', 'Franquin', 'Morris']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de provinces compte la Belgique ?', 'How many provinces does Belgium have?', array['10', '9', '11', '12']::text[], array['10', '9', '11', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle ville belge est surnommée la Venise du Nord ?', 'Which Belgian city is nicknamed the Venice of the North?', array['Bruges', 'Gand', 'Anvers', 'Ostende']::text[], array['Bruges', 'Ghent', 'Antwerp', 'Ostend']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année la Belgique est devenue indépendante ?', 'In which year did Belgium become independent?', array['1830', '1815', '1789', '1914']::text[], array['1830', '1815', '1789', '1914']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de pattes a une araignée ?', 'How many legs does a spider have?', array['8', '6', '4', '10']::text[], array['8', '6', '4', '10']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Bleu et jaune mélangés, ça donne quelle couleur ?', 'Mix blue and yellow: which colour do you get?', array['Vert', 'Orange', 'Violet', 'Rose']::text[], array['Green', 'Orange', 'Purple', 'Pink']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le chien de Tintin ?', 'What is the name of Tintin’s dog?', array['Milou', 'Idéfix', 'Rantanplan', 'Pluto']::text[], array['Snowy', 'Dogmatix', 'Rin Tin Can', 'Pluto']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'De quelle couleur sont les Schtroumpfs ?', 'What colour are the Smurfs?', array['Bleus', 'Verts', 'Rouges', 'Jaunes']::text[], array['Blue', 'Green', 'Red', 'Yellow']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Une semaine compte combien de jours ?', 'How many days are there in a week?', array['7', '5', '6', '10']::text[], array['7', '5', '6', '10']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal fait « meuh » ?', 'Which animal says “moo”?', array['La vache', 'Le mouton', 'Le cochon', 'Le canard']::text[], array['The cow', 'The sheep', 'The pig', 'The duck']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel est l’animal le plus rapide sur terre ?', 'What is the fastest land animal?', array['Le guépard', 'Le lion', 'Le cheval', 'Le lapin']::text[], array['The cheetah', 'The lion', 'The horse', 'The rabbit']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le bébé de la grenouille ?', 'What is a baby frog called?', array['Le têtard', 'Le poussin', 'Le chaton', 'L’ourson']::text[], array['A tadpole', 'A chick', 'A kitten', 'A cub']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de couleurs compte un arc-en-ciel ?', 'How many colours are there in a rainbow?', array['7', '5', '3', '10']::text[], array['7', '5', '3', '10']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel est le plus gros animal qui vit sur terre ?', 'What is the biggest animal living on land?', array['L’éléphant', 'La girafe', 'Le rhinocéros', 'L’hippopotame']::text[], array['The elephant', 'The giraffe', 'The rhino', 'The hippo']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Une heure compte combien de minutes ?', 'How many minutes are there in an hour?', array['60', '100', '30', '24']::text[], array['60', '100', '30', '24']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel oiseau ne sait pas voler ?', 'Which bird cannot fly?', array['Le manchot', 'Le pigeon', 'Le moineau', 'L’aigle']::text[], array['The penguin', 'The pigeon', 'The sparrow', 'The eagle']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel outil sert à couper les cheveux ?', 'Which tool is used to cut hair?', array['Les ciseaux', 'La cuillère', 'Le marteau', 'Le pinceau']::text[], array['Scissors', 'A spoon', 'A hammer', 'A paintbrush']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de pattes a un insecte ?', 'How many legs does an insect have?', array['6', '8', '4', '2']::text[], array['6', '8', '4', '2']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Que fabriquent les abeilles ?', 'What do bees make?', array['Du miel', 'Du lait', 'Du chocolat', 'De la confiture']::text[], array['Honey', 'Milk', 'Chocolate', 'Jam']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'À quelle heure commence traditionnellement le Lumeçon, le dimanche du Doudou ?', 'At what time does the Lumeçon traditionally start on Doudou Sunday?', array['12 h 30', '9 h 00', '16 h 00', '21 h 00']::text[], array['12:30 pm', '9:00 am', '4:00 pm', '9:00 pm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Combien de temps dure environ le Combat dit Lumeçon ?', 'Roughly how long does the Lumeçon fight last?', array['+/ 30 minutes', '+/ 5 minutes', '+/ 3 heures', 'Toute la journée']::text[], array['+/ 30 minutes', '+/ 5 minutes', '+/ 3 hours', 'All day']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Où se déroule le Combat dit Lumeçon ?', 'Where does the Lumeçon fight take place?', array['Sur la Grand-Place', 'Dans la collégiale', 'Au stade Tondreau', 'Au bord du Grand Large']::text[], array['On the Grand-Place', 'Inside the collegiate church', 'At the Tondreau stadium', 'By the Grand Large lake']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Qui sort toujours vainqueur du Lumeçon ?', 'Who always wins the Lumeçon?', array['Saint Georges', 'Le Dragon', 'Les Diables', 'Personne, c’est un match nul']::text[], array['Saint George', 'The Dragon', 'The Devils', 'Nobody, it’s a draw']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Avec quoi Saint Georges achève-t-il finalement le Dragon ?', 'What does Saint George finally finish off the Dragon with?', array['Un coup de pistolet', 'Une flèche', 'Un coup de poing', 'Un seau d’eau']::text[], array['A pistol shot', 'An arrow', 'A punch', 'A bucket of water']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appellent les personnages couverts de lierre qui défendent le Dragon ?', 'What are the ivy-covered characters who defend the Dragon called?', array['Les Hommes de feuilles', 'Les Chinchins', 'Les Gilles', 'Les Hommes de paille']::text[], array['The Leaf Men', 'The Chinchins', 'The Gilles', 'The Straw Men']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'D’après la tradition, le nom « Lumeçon » viendrait de quel mot ?', 'According to tradition, the name “Lumeçon” comes from which French word?', array['Limaçon', 'Lumière', 'Leçon', 'Lumbago']::text[], array['Limaçon (snail)', 'Lumière (light)', 'Leçon (lesson)', 'Lumbago (back pain)']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le dimanche de la Trinité, jour du Doudou, suit directement quelle fête ?', 'Trinity Sunday, the day of the Doudou, comes right after which feast?', array['La Pentecôte', 'Pâques', 'La Toussaint', 'L’Ascension']::text[], array['Pentecost', 'Easter', 'All Saints’ Day', 'Ascension Day']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quel mois tombe le Doudou ?', 'In which month does the Doudou take place?', array['En mai ou en juin', 'En mars', 'En août', 'En décembre']::text[], array['In May or June', 'In March', 'In August', 'In December']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel est le nom officiel de la fête du Doudou ?', 'What is the official name of the Doudou festival?', array['La Ducasse rituelle de Mons', 'Le Carnaval de Mons', 'La Kermesse royale', 'La Foire du Hainaut']::text[], array['The Ritual Ducasse of Mons', 'The Mons Carnival', 'The Royal Kermesse', 'The Hainaut Fair']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le mot « ducasse », pour une fête de quartier ou de village, vient de quel mot ?', 'The word “ducasse”, for a local fête, comes from which French word?', array['Dédicace', 'Duc', 'Casserole', 'Ducat']::text[], array['Dédicace (dedication)', 'Duc (duke)', 'Casserole (saucepan)', 'Ducat (coin)']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quelle année l’UNESCO a-t-elle reconnu la Ducasse de Mons comme patrimoine immatériel ?', 'In which year did UNESCO recognise the Ducasse of Mons as intangible heritage?', array['2005', '1975', '1995', '2018']::text[], array['2005', '1975', '1995', '2018']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'La procession de Mons aurait été créée en 1349 pour lutter contre quoi ?', 'The Mons procession is said to have begun in 1349 to fight off what?', array['Une épidémie de peste', 'Une invasion viking', 'Une famine de pommes', 'Une inondation']::text[], array['A plague epidemic', 'A Viking invasion', 'An apple famine', 'A flood']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Selon la superstition, que doit absolument réussir le Car d’Or ?', 'According to superstition, what must the Car d’Or absolutely manage?', array['Monter la rampe d’un seul coup', 'Faire trois tours du beffroi', 'Arriver avant midi pile', 'Traverser la Trouille']::text[], array['Climb the ramp in one go', 'Circle the belfry three times', 'Arrive at exactly noon', 'Cross the Trouille river']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Qui tire le Car d’Or dans les rues de Mons pendant la procession ?', 'What pulls the Car d’Or through the streets of Mons during the procession?', array['Des chevaux de trait', 'Des bœufs', 'Un tracteur', 'Des ânes']::text[], array['Draught horses', 'Oxen', 'A tractor', 'Donkeys']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le samedi soir du Doudou, quelle cérémonie a lieu dans la collégiale ?', 'On the Saturday evening of the Doudou, what ceremony takes place in the collegiate church?', array['La descente de la châsse', 'Le couronnement du Dragon', 'Le bal des Chinchins', 'La bénédiction des frites']::text[], array['The lowering of the reliquary', 'The crowning of the Dragon', 'The Chinchins’ ball', 'The blessing of the chips']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Saint Georges, héros du Lumeçon, est aussi le saint patron de quel pays ?', 'Saint George, hero of the Lumeçon, is also the patron saint of which country?', array['L’Angleterre', 'L’Italie', 'L’Espagne', 'La Suède']::text[], array['England', 'Italy', 'Spain', 'Sweden']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Selon la légende, quel chevalier hennuyer aurait tué un dragon à Wasmes ?', 'According to legend, which Hainaut knight killed a dragon at Wasmes?', array['Gilles de Chin', 'Godefroid de Bouillon', 'Baudouin de Constantinople', 'Lancelot du Lac']::text[], array['Gilles de Chin', 'Godfrey of Bouillon', 'Baldwin of Constantinople', 'Lancelot of the Lake']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle est la hauteur du beffroi de Mons ?', 'How tall is the Mons belfry?', array['+/ 87 mètres', '+/ 25 mètres', '+/ 160 mètres', '+/ 300 mètres']::text[], array['+/ 87 metres', '+/ 25 metres', '+/ 160 metres', '+/ 300 metres']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le beffroi de Mons a été construit au cours de quel siècle ?', 'In which century was the Mons belfry built?', array['Le XVIIe siècle', 'Le XIe siècle', 'Le XIXe siècle', 'Le XXe siècle']::text[], array['The 17th century', 'The 11th century', 'The 19th century', 'The 20th century']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quelle année le beffroi de Mons a-t-il été inscrit au patrimoine mondial de l’UNESCO ?', 'In which year was the Mons belfry added to the UNESCO World Heritage list?', array['1999', '1958', '1975', '2020']::text[], array['1999', '1958', '1975', '2020']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le beffroi de Mons domine quel parc situé au sommet de la ville ?', 'The Mons belfry stands in which park at the top of the town?', array['Le parc du Château', 'Le parc du Cinquantenaire', 'Le parc de Mariemont', 'Le parc Josaphat']::text[], array['The Château park', 'The Cinquantenaire park', 'The Mariemont park', 'The Josaphat park']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Près du beffroi, quelle chapelle passe pour le plus ancien bâtiment de Mons ?', 'Near the belfry, which chapel is said to be the oldest building in Mons?', array['La chapelle Saint-Calixte', 'La chapelle Sainte-Anne', 'La chapelle Saint-Roch', 'La chapelle Notre-Dame']::text[], array['Saint Calixtus chapel', 'Saint Anne chapel', 'Saint Roch chapel', 'Our Lady chapel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'De quel style architectural est la collégiale Sainte-Waudru ?', 'What architectural style is the Sainte-Waudru collegiate church?', array['Gothique', 'Roman', 'Art nouveau', 'Baroque']::text[], array['Gothic', 'Romanesque', 'Art Nouveau', 'Baroque']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle est la particularité de la tour de la collégiale Sainte-Waudru ?', 'What is special about the tower of the Sainte-Waudru collegiate church?', array['Elle n’a jamais été achevée', 'Elle penche comme à Pise', 'Elle est en verre', 'Elle tourne sur elle-même']::text[], array['It was never finished', 'It leans like in Pisa', 'It is made of glass', 'It rotates']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Pendant des siècles, la collégiale Sainte-Waudru a accueilli un chapitre de qui ?', 'For centuries, the Sainte-Waudru collegiate church housed a chapter of whom?', array['De chanoinesses nobles', 'De moines trappistes', 'De chevaliers templiers', 'De frères dominicains']::text[], array['Noble canonesses', 'Trappist monks', 'Knights Templar', 'Dominican friars']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel artiste montois de la Renaissance a sculpté le jubé de Sainte-Waudru ?', 'Which Renaissance artist from Mons sculpted the rood screen of Sainte-Waudru?', array['Jacques Du Broeucq', 'Pierre Paul Rubens', 'Constantin Meunier', 'Victor Horta']::text[], array['Jacques Du Broeucq', 'Peter Paul Rubens', 'Constantin Meunier', 'Victor Horta']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'À quel siècle vivait Sainte Waudru ?', 'In which century did Saint Waltrude live?', array['Au VIIe siècle', 'Au IIe siècle', 'Au XIIIe siècle', 'Au XVIe siècle']::text[], array['The 7th century', 'The 2nd century', 'The 13th century', 'The 16th century']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Sainte Aldegonde, sœur de Sainte Waudru, a fondé une abbaye dans quelle ville ?', 'Saint Aldegund, Saint Waltrude’s sister, founded an abbey in which town?', array['Maubeuge', 'Lille', 'Namur', 'Bruges']::text[], array['Maubeuge', 'Lille', 'Namur', 'Bruges']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Saint Vincent Madelgaire, le mari de Sainte Waudru, a fondé une abbaye dans quelle ville ?', 'Saint Vincent Madelgarius, Saint Waltrude’s husband, founded an abbey in which town?', array['Soignies', 'Liège', 'Ostende', 'Arlon']::text[], array['Soignies', 'Liège', 'Ostend', 'Arlon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'D’où vient le nom de la ville de Mons ?', 'Where does the name Mons come from?', array['Du latin « mons », la colline', 'D’un roi nommé Mon', 'Du mot « monstre »', 'Du mot « monnaie »']::text[], array['Latin “mons”, meaning hill', 'A king called Mon', 'The word “monster”', 'The word “money”']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Dans quelle région de Belgique se trouve Mons ?', 'In which Belgian region is Mons located?', array['La Wallonie', 'La Flandre', 'Bruxelles-Capitale', 'La Communauté germanophone']::text[], array['Wallonia', 'Flanders', 'Brussels-Capital', 'The German-speaking Community']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le patois montois est une variante de quelle langue régionale ?', 'The Mons dialect is a variety of which regional language?', array['Le picard', 'Le wallon liégeois', 'Le flamand', 'Le luxembourgeois']::text[], array['Picard', 'Liège Walloon', 'Flemish', 'Luxembourgish']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le Hainaut doit son nom à quelle rivière ?', 'Hainaut takes its name from which river?', array['La Haine', 'La Meuse', 'L’Escaut', 'La Sambre']::text[], array['The Haine', 'The Meuse', 'The Scheldt', 'The Sambre']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel animal figure sur le drapeau de la province de Hainaut ?', 'Which animal appears on the flag of the province of Hainaut?', array['Le lion', 'Le coq', 'L’aigle', 'Le cerf']::text[], array['The lion', 'The rooster', 'The eagle', 'The stag']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Combien d’habitants compte environ la ville de Mons ?', 'Roughly how many people live in the city of Mons?', array['+/ 95 000', '+/ 15 000', '+/ 400 000', '+/ 1 million']::text[], array['+/ 95,000', '+/ 15,000', '+/ 400,000', '+/ 1 million']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'À quelle distance environ Mons se trouve-t-elle de Bruxelles ?', 'Roughly how far is Mons from Brussels?', array['+/ 60 km', '+/ 10 km', '+/ 180 km', '+/ 300 km']::text[], array['+/ 60 km', '+/ 10 km', '+/ 180 km', '+/ 300 km']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle autoroute relie Mons à Bruxelles ?', 'Which motorway links Mons to Brussels?', array['L’E19', 'L’E40', 'L’E411', 'L’E313']::text[], array['The E19', 'The E40', 'The E411', 'The E313']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Laquelle de ces localités fait partie de la commune de Mons ?', 'Which of these places is part of the municipality of Mons?', array['Jemappes', 'Frameries', 'Quaregnon', 'Boussu']::text[], array['Jemappes', 'Frameries', 'Quaregnon', 'Boussu']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Laquelle de ces anciennes communes a fusionné avec Mons ?', 'Which of these former municipalities merged into Mons?', array['Nimy', 'Quévy', 'Jurbise', 'Saint-Ghislain']::text[], array['Nimy', 'Quévy', 'Jurbise', 'Saint-Ghislain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel célèbre architecte espagnol a dessiné la nouvelle gare de Mons ?', 'Which famous Spanish architect designed the new Mons railway station?', array['Santiago Calatrava', 'Antoni Gaudí', 'Ricardo Bofill', 'Rafael Moneo']::text[], array['Santiago Calatrava', 'Antoni Gaudí', 'Ricardo Bofill', 'Rafael Moneo']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En 2015, Mons partageait le titre de Capitale européenne de la culture avec quelle ville ?', 'In 2015, Mons shared the European Capital of Culture title with which city?', array['Plzeň', 'Marseille', 'Riga', 'Matera']::text[], array['Plzeň', 'Marseille', 'Riga', 'Matera']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Que signifie le sigle BAM, le musée des beaux-arts de Mons ?', 'What does BAM, the major art museum in Mons, stand for?', array['Beaux-Arts Mons', 'Belgique Art Moderne', 'Bibliothèque Art Montois', 'Bureau des Archives de Mons']::text[], array['Beaux-Arts Mons', 'Belgique Art Moderne', 'Bibliothèque Art Montois', 'Bureau des Archives de Mons']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'À quoi est consacré le Musée du Doudou à Mons ?', 'What is the Doudou Museum in Mons about?', array['À la Ducasse et au Lumeçon', 'Aux peluches d’enfants', 'Aux mines du Borinage', 'Au football montois']::text[], array['The Ducasse and the Lumeçon', 'Children’s cuddly toys', 'Borinage coal mines', 'Mons football']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel est le thème du Mons Memorial Museum ?', 'What is the Mons Memorial Museum about?', array['L’histoire militaire et les guerres', 'La mode et la coiffure', 'Les trains miniatures', 'La gastronomie belge']::text[], array['Military history and wars', 'Fashion and hairdressing', 'Model trains', 'Belgian food']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Qui sont les deux fondateurs du Mundaneum ?', 'Who were the two founders of the Mundaneum?', array['Paul Otlet et Henri La Fontaine', 'Hergé et Edgar P. Jacobs', 'Ernest Solvay et Zénobe Gramme', 'Adolphe Sax et Victor Horta']::text[], array['Paul Otlet and Henri La Fontaine', 'Hergé and Edgar P. Jacobs', 'Ernest Solvay and Zénobe Gramme', 'Adolphe Sax and Victor Horta']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Henri La Fontaine, cofondateur du Mundaneum, a reçu quel prix Nobel en 1913 ?', 'Henri La Fontaine, co-founder of the Mundaneum, won which Nobel Prize in 1913?', array['Le prix Nobel de la paix', 'Le prix Nobel de physique', 'Le prix Nobel de médecine', 'Le prix Nobel de chimie']::text[], array['The Nobel Peace Prize', 'The Nobel Prize in Physics', 'The Nobel Prize in Medicine', 'The Nobel Prize in Chemistry']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel système de classement des livres a été créé par les fondateurs du Mundaneum ?', 'Which book classification system was created by the Mundaneum’s founders?', array['La Classification décimale universelle', 'Le code-barres', 'L’alphabet morse', 'Le système métrique']::text[], array['The Universal Decimal Classification', 'The barcode', 'Morse code', 'The metric system']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Dans quel village de Mons peut-on visiter la maison où Van Gogh a vécu ?', 'In which village of Mons can you visit the house where Van Gogh lived?', array['Cuesmes', 'Havré', 'Obourg', 'Ghlin']::text[], array['Cuesmes', 'Havré', 'Obourg', 'Ghlin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel métier Vincent van Gogh exerçait-il dans le Borinage avant de se consacrer à la peinture ?', 'What job did Vincent van Gogh do in the Borinage before devoting himself to painting?', array['Prédicateur', 'Mineur de fond', 'Boulanger', 'Instituteur']::text[], array['Preacher', 'Coal miner', 'Baker', 'Schoolteacher']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel compositeur de la Renaissance, star de son époque, est né à Mons ?', 'Which Renaissance composer, a star of his time, was born in Mons?', array['Roland de Lassus', 'Jean-Sébastien Bach', 'Antonio Vivaldi', 'Claudio Monteverdi']::text[], array['Orlande de Lassus', 'Johann Sebastian Bach', 'Antonio Vivaldi', 'Claudio Monteverdi']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel chanteur de « Tombe la neige » a grandi à Jemappes ?', 'Which singer of “Tombe la neige” grew up in Jemappes?', array['Salvatore Adamo', 'Jacques Brel', 'Johnny Hallyday', 'Julien Clerc']::text[], array['Salvatore Adamo', 'Jacques Brel', 'Johnny Hallyday', 'Julien Clerc']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel bourgmestre de Mons est devenu Premier ministre de Belgique en 2011 ?', 'Which mayor of Mons became Prime Minister of Belgium in 2011?', array['Elio Di Rupo', 'Guy Verhofstadt', 'Charles Michel', 'Yves Leterme']::text[], array['Elio Di Rupo', 'Guy Verhofstadt', 'Charles Michel', 'Yves Leterme']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appelle la statue du gamin montois espiègle, dans le Jardin du Mayeur ?', 'What is the statue of the cheeky Mons street kid in the Jardin du Mayeur called?', array['Le Ropieur', 'Le Manneken-Pis', 'Le Tchantchès', 'Le Gamin d’Ath']::text[], array['The Ropieur', 'The Manneken Pis', 'The Tchantchès', 'The Ath Kid']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En août 1914, l’armée de quel pays affronte les Allemands lors de la bataille de Mons ?', 'In August 1914, which country’s army fought the Germans at the Battle of Mons?', array['Le Royaume-Uni', 'Les États-Unis', 'L’Italie', 'Le Japon']::text[], array['The United Kingdom', 'The United States', 'Italy', 'Japan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Selon une célèbre légende de 1914, qui aurait protégé les soldats britanniques à Mons ?', 'According to a famous 1914 legend, who protected British soldiers at Mons?', array['Des anges', 'Des dragons', 'Des fantômes de Vikings', 'Des loups']::text[], array['Angels', 'Dragons', 'Viking ghosts', 'Wolves']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle armée libère Mons le 11 novembre 1918 ?', 'Which army liberated Mons on 11 November 1918?', array['L’armée canadienne', 'L’armée américaine', 'L’armée française', 'L’armée australienne']::text[], array['The Canadian army', 'The American army', 'The French army', 'The Australian army']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Au cimetière militaire de Saint-Symphorien repose John Parr, considéré comme quoi ?', 'John Parr, buried at Saint-Symphorien military cemetery, is considered what?', array['Le premier soldat britannique tué en 14-18', 'Le dernier roi de Mons', 'Un champion de boxe', 'L’inventeur du tank']::text[], array['The first British soldier killed in WW1', 'The last king of Mons', 'A boxing champion', 'The inventor of the tank']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle armée libère Mons en septembre 1944 ?', 'Which army liberated Mons in September 1944?', array['L’armée américaine', 'L’armée soviétique', 'L’armée canadienne', 'L’armée polonaise']::text[], array['The American army', 'The Soviet army', 'The Canadian army', 'The Polish army']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En 1792, quelle armée remporte la bataille de Jemappes ?', 'In 1792, which army won the Battle of Jemappes?', array['L’armée révolutionnaire française', 'L’armée prussienne', 'L’armée anglaise', 'L’armée espagnole']::text[], array['The French revolutionary army', 'The Prussian army', 'The English army', 'The Spanish army']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel roi de France assiège et prend Mons en 1691 ?', 'Which French king besieged and took Mons in 1691?', array['Louis XIV', 'Napoléon Ier', 'Henri IV', 'Louis XVI']::text[], array['Louis XIV', 'Napoleon I', 'Henry IV', 'Louis XVI']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle grande bataille de 1709 s’est déroulée près de Mons ?', 'Which major 1709 battle took place near Mons?', array['Malplaquet', 'Waterloo', 'Austerlitz', 'Verdun']::text[], array['Malplaquet', 'Waterloo', 'Austerlitz', 'Verdun']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel quartier général militaire est installé à Casteau, près de Mons ?', 'Which military headquarters is based at Casteau, near Mons?', array['Le SHAPE de l’OTAN', 'Le Pentagone', 'L’état-major de l’ONU', 'Le siège d’Interpol']::text[], array['NATO’s SHAPE', 'The Pentagon', 'The UN military staff', 'Interpol’s headquarters']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Depuis quelle année le SHAPE de l’OTAN est-il installé près de Mons ?', 'Since which year has NATO’s SHAPE been based near Mons?', array['1967', '1945', '1989', '2001']::text[], array['1967', '1945', '1989', '2001']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Mons était autrefois la capitale de quel État médiéval ?', 'Mons was once the capital of which medieval state?', array['Le comté de Hainaut', 'Le duché de Brabant', 'La principauté de Liège', 'Le comté de Namur']::text[], array['The County of Hainaut', 'The Duchy of Brabant', 'The Prince-Bishopric of Liège', 'The County of Namur']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En 1204, quel comte de Hainaut devient le premier empereur latin de Constantinople ?', 'In 1204, which Count of Hainaut became the first Latin Emperor of Constantinople?', array['Baudouin', 'Charlemagne', 'Godefroid', 'Philippe le Bon']::text[], array['Baldwin', 'Charlemagne', 'Godfrey', 'Philip the Good']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Valenciennes, ville natale du chroniqueur Froissart, faisait partie de quel comté ?', 'Valenciennes, birthplace of the chronicler Froissart, belonged to which county?', array['Le Hainaut', 'La Flandre', 'L’Artois', 'La Champagne']::text[], array['Hainaut', 'Flanders', 'Artois', 'Champagne']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle université a été créée en 2009 par la fusion de l’UMH et de la Faculté polytechnique de Mons ?', 'Which university was created in 2009 by merging the UMH and the Faculté polytechnique de Mons?', array['L’UMONS', 'L’UCLouvain', 'L’ULB', 'L’ULiège']::text[], array['UMONS', 'UCLouvain', 'ULB', 'ULiège']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appelle le stade historique du RAEC Mons ?', 'What is the name of RAEC Mons’s historic stadium?', array['Le stade Charles Tondreau', 'Le stade du Pays de Charleroi', 'Le stade Roi Baudouin', 'Le stade Maurice Dufrasne']::text[], array['Stade Charles Tondreau', 'Stade du Pays de Charleroi', 'King Baudouin Stadium', 'Stade Maurice Dufrasne']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelles sont les couleurs du RAEC Mons ?', 'What are RAEC Mons’s colours?', array['Rouge et blanc', 'Mauve et blanc', 'Jaune et noir', 'Vert et blanc']::text[], array['Red and white', 'Purple and white', 'Yellow and black', 'Green and white']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Dans le nom du RAEC Mons, à qui font référence les lettres « A » et « E » ?', 'In the name RAEC Mons, who do the letters “A” and “E” refer to?', array['Au roi Albert et à la reine Élisabeth', 'À Anvers et Eupen', 'À « Allez Ensemble »', 'À Athlétisme et Escrime']::text[], array['King Albert and Queen Elisabeth', 'Antwerp and Eupen', '“Allez Ensemble”', 'Athletics and Fencing']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quelle année a été fondé le club de football du RAEC Mons ?', 'In which year was the RAEC Mons football club founded?', array['1910', '1880', '1965', '1999']::text[], array['1910', '1880', '1965', '1999']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Les minières néolithiques de Spiennes sont inscrites à l’UNESCO depuis quelle année ?', 'Since which year have the Neolithic flint mines of Spiennes been on the UNESCO list?', array['2000', '1950', '1975', '2021']::text[], array['2000', '1950', '1975', '2021']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel festival de cinéma se tient chaque année à Mons ?', 'Which film festival is held every year in Mons?', array['Le Festival international du film d’amour', 'Le Festival du film d’horreur', 'La Mostra', 'Le Festival du court métrage polaire']::text[], array['The International Love Film Festival', 'The Horror Film Festival', 'The Venice Mostra', 'The Polar Short Film Festival']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Que trouve-t-on au lac du Grand Large, près de Mons ?', 'What can you find at the Grand Large lake near Mons?', array['Un port de plaisance', 'Un volcan éteint', 'Une station de ski', 'Une mine d’or']::text[], array['A marina', 'An extinct volcano', 'A ski resort', 'A gold mine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Qu’extrayaient les hommes préhistoriques dans les minières néolithiques de Spiennes ?', 'What did prehistoric people dig out of the Neolithic mines at Spiennes?', array['Du silex', 'De l’or', 'Du charbon', 'Du sel']::text[], array['Flint', 'Gold', 'Coal', 'Salt']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Pour quelle ressource le Borinage est-il historiquement célèbre ?', 'What resource is the Borinage historically famous for?', array['Le charbon', 'Le pétrole', 'Le vin', 'Le diamant']::text[], array['Coal', 'Oil', 'Wine', 'Diamonds']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment appelle-t-on les collines formées par les déchets des mines de charbon ?', 'What are the hills made of coal mining waste called in Belgium?', array['Des terrils', 'Des dunes', 'Des moraines', 'Des polders']::text[], array['Terrils (slag heaps)', 'Dunes', 'Moraines', 'Polders']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel surnom donnait-on aux mineurs de charbon ?', 'What nickname was given to coal miners in French?', array['Les gueules noires', 'Les cols blancs', 'Les mains d’or', 'Les têtes brûlées']::text[], array['Les gueules noires (black faces)', 'Les cols blancs (white collars)', 'Les mains d’or (golden hands)', 'Les têtes brûlées (hotheads)']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Après l’accord de 1946, de quel pays sont venus de nombreux mineurs dans le Hainaut ?', 'After the 1946 agreement, which country did many miners come from to work in Hainaut?', array['L’Italie', 'La Norvège', 'Le Portugal', 'L’Irlande']::text[], array['Italy', 'Norway', 'Portugal', 'Ireland']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel documentaire de 1933 d’Henri Storck et Joris Ivens montre la vie des mineurs boraines ?', 'Which 1933 documentary by Henri Storck and Joris Ivens shows the life of Borinage miners?', array['Misère au Borinage', 'Germinal', 'Les Gueules noires', 'Le Salaire de la peur']::text[], array['Misère au Borinage', 'Germinal', 'Les Gueules noires', 'The Wages of Fear']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel ancien site minier près de Mons abrite aujourd’hui le MACS, musée d’art contemporain ?', 'Which former mining site near Mons now houses the MACS contemporary art museum?', array['Le Grand-Hornu', 'Le Bois du Cazier', 'Blegny-Mine', 'Bois-du-Luc']::text[], array['Grand-Hornu', 'Bois du Cazier', 'Blegny-Mine', 'Bois-du-Luc']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel industriel a fait construire le complexe minier du Grand-Hornu ?', 'Which industrialist had the Grand-Hornu mining complex built?', array['Henri De Gorge', 'John Cockerill', 'Ernest Solvay', 'André Dumont']::text[], array['Henri De Gorge', 'John Cockerill', 'Ernest Solvay', 'André Dumont']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quelle année le Grand-Hornu a-t-il été inscrit à l’UNESCO avec d’autres sites miniers wallons ?', 'In which year was Grand-Hornu added to the UNESCO list with other Walloon mining sites?', array['2012', '1960', '1985', '2023']::text[], array['2012', '1960', '1985', '2023']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'La catastrophe minière du Bois du Cazier, en 1956, a eu lieu près de quelle ville ?', 'The 1956 Bois du Cazier mining disaster happened near which city?', array['Charleroi', 'Mons', 'Tournai', 'Ath']::text[], array['Charleroi', 'Mons', 'Tournai', 'Ath']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'À Frameries, comment s’appelle le parc d’aventures scientifiques ?', 'What is the name of the science adventure park in Frameries?', array['Le PASS', 'Le Pass’Sport', 'Le Technopolis', 'Le Futuroscope']::text[], array['PASS', 'Pass’Sport', 'Technopolis', 'Futuroscope']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel fleuve traverse la ville de Tournai ?', 'Which river flows through the city of Tournai?', array['L’Escaut', 'La Meuse', 'La Seine', 'Le Rhin']::text[], array['The Scheldt', 'The Meuse', 'The Seine', 'The Rhine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Comment s’appellent les habitants de Binche ?', 'What are the inhabitants of Binche called?', array['Les Binchois', 'Les Bincheurs', 'Les Binchiens', 'Les Binchons']::text[], array['Binchois', 'Bincheurs', 'Binchiens', 'Binchons']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quels personnages emblématiques défilent au carnaval de Binche ?', 'Which iconic figures parade at the Binche carnival?', array['Les Gilles', 'Les Chinchins', 'Les Blancs Moussis', 'Les Schtroumpfs']::text[], array['The Gilles', 'The Chinchins', 'The Blancs Moussis', 'The Smurfs']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Que lancent les Gilles de Binche à la foule le mardi gras ?', 'What do the Gilles of Binche throw to the crowd on Shrove Tuesday?', array['Des oranges', 'Des tomates', 'Des confettis dorés', 'Des œufs']::text[], array['Oranges', 'Tomatoes', 'Gold confetti', 'Eggs']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Combien de clochers compte la cathédrale Notre-Dame de Tournai ?', 'How many bell towers does Tournai’s Notre-Dame cathedral have?', array['Cinq', 'Un', 'Trois', 'Douze']::text[], array['Five', 'One', 'Three', 'Twelve']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Que permettent les célèbres ascenseurs du Canal du Centre, dans le Hainaut ?', 'What do the famous lifts of the Canal du Centre in Hainaut do?', array['Faire monter et descendre des bateaux', 'Monter au sommet d’un terril', 'Descendre au fond d’une mine', 'Grimper au beffroi']::text[], array['Raise and lower boats', 'Climb a slag heap', 'Go down a mine', 'Climb the belfry']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle rivière traverse la ville de Charleroi ?', 'Which river flows through the city of Charleroi?', array['La Sambre', 'L’Ourthe', 'La Lys', 'La Semois']::text[], array['The Sambre', 'The Ourthe', 'The Lys', 'The Semois']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quel animal se cache dans le nom de la ville de La Louvière ?', 'Which animal is hidden in the name of the town of La Louvière?', array['Le loup', 'L’ours', 'Le lièvre', 'Le lion']::text[], array['The wolf', 'The bear', 'The hare', 'The lion']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Le château de Belœil, dans le Hainaut, appartient à quelle famille princière ?', 'Belœil Castle in Hainaut belongs to which princely family?', array['Les princes de Ligne', 'Les princes de Monaco', 'Les Habsbourg', 'Les Médicis']::text[], array['The Princes of Ligne', 'The Princes of Monaco', 'The Habsburgs', 'The Medici']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Dans quelle commune du Hainaut se trouve le parc animalier Pairi Daiza ?', 'In which Hainaut municipality is the Pairi Daiza zoo located?', array['Brugelette', 'Waterloo', 'Durbuy', 'Ostende']::text[], array['Brugelette', 'Waterloo', 'Durbuy', 'Ostend']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Quelle est la plus grande ville de la province de Hainaut ?', 'What is the largest city in the province of Hainaut?', array['Charleroi', 'Mons', 'Tournai', 'La Louvière']::text[], array['Charleroi', 'Mons', 'Tournai', 'La Louvière']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'Où le Car d’Or est-il conservé le reste de l’année ?', 'Where is the Car d’Or kept the rest of the year?', array['Dans la collégiale Sainte-Waudru', 'Dans le beffroi', 'À l’hôtel de ville', 'Dans un hangar de la gare']::text[], array['In the Sainte-Waudru collegiate church', 'In the belfry', 'In the town hall', 'In a shed at the station']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quel mois se déroule la Ducasse d’Ath et ses géants ?', 'In which month does the Ducasse of Ath and its giants take place?', array['En août', 'En janvier', 'En avril', 'En novembre']::text[], array['In August', 'In January', 'In April', 'In November']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('mons', 'En quelle année le carnaval de Binche a-t-il été reconnu par l’UNESCO ?', 'In which year was the Binche carnival recognised by UNESCO?', array['2003', '1953', '1979', '2019']::text[], array['2003', '1953', '1979', '2019']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle trappiste est brassée à l’abbaye Saint-Sixte, en Flandre-Occidentale ?', 'Which trappist beer is brewed at Saint Sixtus Abbey, in West Flanders?', array['Westvleteren', 'Westmalle', 'Orval', 'Rochefort']::text[], array['Westvleteren', 'Westmalle', 'Orval', 'Rochefort']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’abbaye d’Orval se trouve dans quelle province belge ?', 'Orval Abbey is in which Belgian province?', array['Le Luxembourg', 'Namur', 'Liège', 'Le Hainaut']::text[], array['Luxembourg', 'Namur', 'Liège', 'Hainaut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La trappiste Rochefort est brassée dans quelle province ?', 'Rochefort trappist beer is brewed in which province?', array['Namur', 'Anvers', 'Le Hainaut', 'Le Limbourg']::text[], array['Namur', 'Antwerp', 'Hainaut', 'Limburg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’abbaye de Westmalle se situe dans quelle province ?', 'Westmalle Abbey is located in which province?', array['Anvers', 'Namur', 'Le Luxembourg', 'Le Hainaut']::text[], array['Antwerp', 'Namur', 'Luxembourg', 'Hainaut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le style « tripel » moderne est né en 1934 dans quelle abbaye ?', 'The modern “tripel” style was born in 1934 at which abbey?', array['Westmalle', 'Orval', 'Rochefort', 'Westvleteren']::text[], array['Westmalle', 'Orval', 'Rochefort', 'Westvleteren']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle forme a le logo « Authentic Trappist Product » ?', 'What shape is the “Authentic Trappist Product” logo?', array['Un hexagone', 'Un cercle', 'Un triangle', 'Une étoile']::text[], array['A hexagon', 'A circle', 'A triangle', 'A star']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À quel ordre religieux appartiennent les moines trappistes ?', 'Which religious order do Trappist monks belong to?', array['Les cisterciens', 'Les franciscains', 'Les dominicains', 'Les jésuites']::text[], array['The Cistercians', 'The Franciscans', 'The Dominicans', 'The Jesuits']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le mot « trappiste » vient de l’abbaye de La Trappe. Dans quel pays se trouve-t-elle ?', 'The word “trappist” comes from La Trappe Abbey. Which country is it in?', array['En France', 'En Belgique', 'Aux Pays-Bas', 'En Italie']::text[], array['France', 'Belgium', 'The Netherlands', 'Italy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Laquelle de ces trappistes est brassée aux Pays-Bas ?', 'Which of these trappist beers is brewed in the Netherlands?', array['La Trappe', 'Westmalle', 'Orval', 'Rochefort']::text[], array['La Trappe', 'Westmalle', 'Orval', 'Rochefort']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À quoi ressemble la bouteille d’Orval ?', 'What does the Orval bottle look like?', array['À une quille de bowling', 'À un petit tonneau', 'À une bouteille de champagne', 'À une gourde']::text[], array['A bowling pin', 'A small barrel', 'A champagne bottle', 'A flask']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Chimay est brassée à l’abbaye Notre-Dame de... ?', 'Chimay is brewed at the Abbey of Our Lady of...?', array['Scourmont', 'Leffe', 'Saint-Rémy', 'Maredsous']::text[], array['Scourmont', 'Leffe', 'Saint-Rémy', 'Maredsous']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'De quelle couleur est la capsule de la Chimay Grande Réserve ?', 'What colour is the cap of Chimay Grande Réserve?', array['Bleue', 'Rouge', 'Blanche', 'Noire']::text[], array['Blue', 'Red', 'White', 'Black']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À part la bière, quel produit porte aussi le nom de Chimay ?', 'Besides beer, which product also bears the Chimay name?', array['Du fromage', 'Du chocolat', 'Du vin', 'Du parfum']::text[], array['Cheese', 'Chocolate', 'Wine', 'Perfume']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Qu’ont de particulier les bouteilles de Westvleteren ?', 'What is special about Westvleteren bottles?', array['Elles n’ont pas d’étiquette', 'Elles sont en plastique', 'Elles sont carrées', 'Elles sont toutes vertes']::text[], array['They have no label', 'They are made of plastic', 'They are square', 'They are all green']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quels chiffres portent les trois Rochefort classiques ?', 'Which numbers do the three classic Rochefort beers carry?', array['6, 8 et 10', '4, 8 et 12', '5, 7 et 9', '6, 9 et 12']::text[], array['6, 8 and 10', '4, 8 and 12', '5, 7 and 9', '6, 9 and 12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle brasserie de Watou a brassé la Westvleteren sous licence jusqu’en 1992 ?', 'Which Watou brewery brewed Westvleteren under licence until 1992?', array['St. Bernardus', 'Rodenbach', 'Dupont', 'Duvel Moortgat']::text[], array['St. Bernardus', 'Rodenbach', 'Dupont', 'Duvel Moortgat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’abbaye de Leffe se trouve dans quelle ville ?', 'Leffe Abbey is located in which town?', array['Dinant', 'Namur', 'Huy', 'Liège']::text[], array['Dinant', 'Namur', 'Huy', 'Liège']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel oiseau mythique est l’emblème de la Grimbergen ?', 'Which mythical bird is the emblem of Grimbergen?', array['Le phénix', 'L’aigle', 'Le griffon', 'Le corbeau']::text[], array['The phoenix', 'The eagle', 'The griffin', 'The raven']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pour porter le nom de trappiste, une bière doit être brassée...', 'To be called a trappist, a beer must be brewed...', array['Dans l’enceinte d’une abbaye trappiste', 'Uniquement en Belgique', 'Avec de l’eau de source', 'Avec du blé local']::text[], array['Within a Trappist abbey', 'Only in Belgium', 'With spring water', 'With local wheat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À quoi doivent servir les bénéfices d’une bière trappiste ?', 'What must the profits from a trappist beer be used for?', array['À la communauté et à la charité', 'Au Vatican', 'À l’État belge', 'Aux actionnaires']::text[], array['The community and charity', 'The Vatican', 'The Belgian state', 'Shareholders']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La brasserie Saint-Feuillien est installée dans quelle ville du Hainaut ?', 'The Saint-Feuillien brewery is based in which Hainaut town?', array['Le Rœulx', 'Binche', 'Soignies', 'Ath']::text[], array['Le Rœulx', 'Binche', 'Soignies', 'Ath']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle brasserie de Tourpes est mondialement réputée pour sa saison ?', 'Which brewery in Tourpes is world famous for its saison?', array['Dupont', 'Dubuisson', 'Silly', 'Lefebvre']::text[], array['Dupont', 'Dubuisson', 'Silly', 'Lefebvre']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Dans quel village du Hainaut la brasserie Dubuisson brasse-t-elle la Bush ?', 'In which Hainaut village does the Dubuisson brewery make Bush?', array['Pipaix', 'Tourpes', 'Silly', 'Montignies-sur-Roc']::text[], array['Pipaix', 'Tourpes', 'Silly', 'Montignies-sur-Roc']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle brasserie hennuyère produit la Cuvée des Trolls ?', 'Which Hainaut brewery makes Cuvée des Trolls?', array['Dubuisson', 'Dupont', 'Saint-Feuillien', 'Silly']::text[], array['Dubuisson', 'Dupont', 'Saint-Feuillien', 'Silly']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle brasserie du Hainaut porte un nom qui fait sourire les Anglais ?', 'Which Hainaut brewery has a name that makes English speakers smile?', array['Silly', 'Dupont', 'Dubuisson', 'Saint-Feuillien']::text[], array['Silly', 'Dupont', 'Dubuisson', 'Saint-Feuillien']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’Hercule Stout, brassée à Ellezelles, rend hommage à quel détective ?', 'Hercule Stout, brewed in Ellezelles, pays tribute to which detective?', array['Hercule Poirot', 'Sherlock Holmes', 'Le commissaire Maigret', 'Arsène Lupin']::text[], array['Hercule Poirot', 'Sherlock Holmes', 'Inspector Maigret', 'Arsène Lupin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Gouyasse rend hommage au géant Goliath de quelle ville du Hainaut ?', 'Gouyasse beer honours the giant Goliath of which Hainaut town?', array['Ath', 'Mons', 'Tournai', 'Charleroi']::text[], array['Ath', 'Mons', 'Tournai', 'Charleroi']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La brasserie de l’Abbaye des Rocs est à Montignies-sur-Roc, dans quelle province ?', 'The Abbaye des Rocs brewery is in Montignies-sur-Roc, in which province?', array['Le Hainaut', 'Namur', 'Liège', 'Le Luxembourg']::text[], array['Hainaut', 'Namur', 'Liège', 'Luxembourg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle ville du Hainaut, célèbre pour ses Gilles, a aussi sa propre brasserie ?', 'Which Hainaut town, famous for its Gilles, also has its own brewery?', array['Binche', 'Ath', 'Mons', 'Tournai']::text[], array['Binche', 'Ath', 'Mons', 'Tournai']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’abbaye du Val-Dieu, qui brasse encore sa bière, est dans quelle province ?', 'Val-Dieu Abbey, which still brews its own beer, is in which province?', array['Liège', 'Le Hainaut', 'Namur', 'Le Brabant wallon']::text[], array['Liège', 'Hainaut', 'Namur', 'Walloon Brabant']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel ingrédient sucré fait la particularité de la Barbãr de la brasserie Lefebvre ?', 'Which sweet ingredient makes Lefebvre’s Barbãr special?', array['Le miel', 'Le sirop d’érable', 'Le caramel', 'La mélasse']::text[], array['Honey', 'Maple syrup', 'Caramel', 'Molasses']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le petit lutin de La Chouffe vient d’Achouffe, dans quelle province ?', 'The little gnome of La Chouffe comes from Achouffe, in which province?', array['Le Luxembourg', 'Le Hainaut', 'Anvers', 'Le Limbourg']::text[], array['Luxembourg', 'Hainaut', 'Antwerp', 'Limburg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Les saisons étaient brassées l’hiver pour désaltérer qui pendant l’été ?', 'Saisons were brewed in winter to refresh whom during summer?', array['Les ouvriers agricoles', 'Les soldats', 'Les mineurs', 'Les moines']::text[], array['Farm workers', 'Soldiers', 'Miners', 'Monks']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Dans quelle région près de Bruxelles le lambic est-il traditionnellement brassé ?', 'In which area near Brussels is lambic traditionally brewed?', array['Le Pajottenland', 'La Campine', 'La Gaume', 'Les Fagnes']::text[], array['The Pajottenland', 'The Campine', 'The Gaume', 'The Fagnes']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La brasserie Cantillon, véritable musée vivant du lambic, est dans quelle commune ?', 'The Cantillon brewery, a living lambic museum, is in which Brussels borough?', array['Anderlecht', 'Ixelles', 'Uccle', 'Schaerbeek']::text[], array['Anderlecht', 'Ixelles', 'Uccle', 'Schaerbeek']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel houblon utilise-t-on pour brasser le lambic ?', 'What kind of hops are used to brew lambic?', array['Du houblon vieilli', 'Du houblon très frais', 'Du houblon américain', 'Aucun houblon']::text[], array['Aged hops', 'Very fresh hops', 'American hops', 'No hops at all']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À côté de l’orge maltée, quelle céréale entre dans la recette du lambic ?', 'Alongside malted barley, which grain goes into lambic?', array['Du blé non malté', 'Du riz', 'Du maïs', 'Du sarrasin']::text[], array['Unmalted wheat', 'Rice', 'Maize', 'Buckwheat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Comment s’appelle le grand bac ouvert où le moût de lambic refroidit à l’air libre ?', 'What is the large open vessel where lambic wort cools in the open air?', array['Le koelschip', 'Le foudre', 'Le tonneau', 'La cuve inox']::text[], array['The koelschip', 'The foeder', 'The cask', 'The steel tank']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À quelle période de l’année brasse-t-on traditionnellement le lambic ?', 'At what time of year is lambic traditionally brewed?', array['Pendant les mois froids', 'En plein été', 'Uniquement en août', 'Au printemps seulement']::text[], array['During the cold months', 'In midsummer', 'Only in August', 'Only in spring']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel surnom donne-t-on souvent à la gueuze ?', 'What nickname is often given to gueuze?', array['Le champagne de Bruxelles', 'Le vin des moines', 'L’or du Hainaut', 'La reine des Flandres']::text[], array['The champagne of Brussels', 'The monks’ wine', 'The gold of Hainaut', 'The queen of Flanders']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel label européen protège l’« Oude Geuze » ?', 'Which European label protects “Oude Geuze”?', array['Spécialité traditionnelle garantie', 'Appellation d’origine contrôlée', 'Label rouge', 'Agriculture biologique']::text[], array['Traditional Speciality Guaranteed', 'Controlled designation of origin', 'Label Rouge', 'Organic farming']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle commune bruxelloise a donné son nom à une griotte utilisée pour la kriek ?', 'Which Brussels borough gave its name to a sour cherry used for kriek?', array['Schaerbeek', 'Etterbeek', 'Forest', 'Molenbeek']::text[], array['Schaerbeek', 'Etterbeek', 'Forest', 'Molenbeek']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La levure Brettanomyces bruxellensis doit son nom à quelle ville ?', 'The yeast Brettanomyces bruxellensis is named after which city?', array['Bruxelles', 'Bruges', 'Brême', 'Bratislava']::text[], array['Brussels', 'Bruges', 'Bremen', 'Bratislava']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Rodenbach, rouge de Flandre vieillie en foudres, est brassée dans quelle ville ?', 'Rodenbach, a Flemish red aged in foeders, is brewed in which town?', array['Roulers (Roeselare)', 'Louvain (Leuven)', 'Malines (Mechelen)', 'Hasselt']::text[], array['Roeselare', 'Leuven', 'Mechelen', 'Hasselt']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Dans le monde brassicole, qu’est-ce qu’un foudre ?', 'In brewing, what is a foeder?', array['Un grand tonneau en bois', 'Une bière très forte', 'Un type de houblon', 'Un verre à pied']::text[], array['A large wooden vat', 'A very strong beer', 'A hop variety', 'A stemmed glass']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Qui a relancé la bière blanche à Hoegaarden en 1966 ?', 'Who revived white beer in Hoegaarden in 1966?', array['Pierre Celis', 'Michel Moortgat', 'Jean Van Roy', 'Frank Boon']::text[], array['Pierre Celis', 'Michel Moortgat', 'Jean Van Roy', 'Frank Boon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Dans quel village est brassée la Duvel ?', 'In which village is Duvel brewed?', array['Breendonk', 'Melle', 'Achouffe', 'Watou']::text[], array['Breendonk', 'Melle', 'Achouffe', 'Watou']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'À quel style appartient la Duvel ?', 'Which style does Duvel belong to?', array['Blonde forte', 'Stout', 'Lambic', 'Bière de table']::text[], array['Strong golden ale', 'Stout', 'Lambic', 'Table beer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle brasserie de Buggenhout produit la Kwak ?', 'Which Buggenhout brewery makes Kwak?', array['Bosteels', 'Huyghe', 'Het Anker', 'De Halve Maan']::text[], array['Bosteels', 'Huyghe', 'Het Anker', 'De Halve Maan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Kwak doit son nom à Pauwel Kwak, qui était...', 'Kwak is named after Pauwel Kwak, who was...', array['Un aubergiste', 'Un moine', 'Un roi', 'Un peintre']::text[], array['An innkeeper', 'A monk', 'A king', 'A painter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Combien de céréales différentes entrent dans la Tripel Karmeliet ?', 'How many different grains go into Tripel Karmeliet?', array['Trois', 'Une', 'Cinq', 'Sept']::text[], array['Three', 'One', 'Five', 'Seven']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'En 1926, la Stella Artois a été lancée comme bière de quelle fête ?', 'In 1926, Stella Artois was launched as a beer for which holiday?', array['Noël', 'Pâques', 'Carnaval', 'Fête nationale']::text[], array['Christmas', 'Easter', 'Carnival', 'National Day']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Stella Artois est née dans quelle ville universitaire ?', 'Stella Artois was born in which university town?', array['Louvain (Leuven)', 'Gand', 'Liège', 'Namur']::text[], array['Leuven', 'Ghent', 'Liège', 'Namur']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel animal rose orne l’étiquette de la Delirium Tremens ?', 'Which pink animal appears on the Delirium Tremens label?', array['Un éléphant', 'Un flamant', 'Un cochon', 'Une panthère']::text[], array['An elephant', 'A flamingo', 'A pig', 'A panther']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Que signifie « zot » dans le nom de la Brugse Zot ?', 'What does “zot” mean in the name Brugse Zot?', array['Fou', 'Doré', 'Saint', 'Ours']::text[], array['Fool', 'Golden', 'Saint', 'Bear']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Qu’a construit la brasserie De Halve Maan sous les rues de Bruges ?', 'What did De Halve Maan brewery build under the streets of Bruges?', array['Un pipeline à bière', 'Un musée souterrain', 'Une cave à fromages', 'Un tunnel pour vélos']::text[], array['A beer pipeline', 'An underground museum', 'A cheese cellar', 'A bike tunnel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Gouden Carolus de Malines porte le nom de quel souverain ?', 'Gouden Carolus from Mechelen is named after which ruler?', array['Charles Quint', 'Charlemagne', 'Léopold Ier', 'Philippe le Bon']::text[], array['Charles V', 'Charlemagne', 'Leopold I', 'Philip the Good']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'D’où vient le nom de la bière Mort Subite ?', 'Where does the name of Mort Subite beer come from?', array['D’un jeu de dés dans un café', 'D’une épidémie', 'D’un duel célèbre', 'D’un roman policier']::text[], array['A dice game played in a café', 'An epidemic', 'A famous duel', 'A crime novel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Sur quelle place se trouve la Maison des Brasseurs, siège des brasseurs belges ?', 'On which square is the Brewers’ House, home of the Belgian brewers?', array['La Grand-Place de Bruxelles', 'La place du Marché de Bruges', 'La Grand-Place de Mons', 'La place Saint-Lambert']::text[], array['Brussels Grand-Place', 'Bruges Market Square', 'Mons Grand-Place', 'Place Saint-Lambert']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Comment appelle-t-on le liquide sucré obtenu avant la fermentation ?', 'What is the sweet liquid obtained before fermentation called?', array['Le moût', 'Le malt', 'Le marc', 'Le levain']::text[], array['Wort', 'Malt', 'Pomace', 'Sourdough']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pour faire du malt, on fait d’abord...', 'To make malt, you first...', array['Germer l’orge puis la sécher', 'Bouillir l’orge', 'Fermenter l’orge', 'Griller l’orge crue']::text[], array['Sprout the barley, then dry it', 'Boil the barley', 'Ferment the barley', 'Roast raw barley']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Lors de la fermentation, la levure transforme les sucres en...', 'During fermentation, yeast turns sugars into...', array['Alcool et gaz carbonique', 'Eau et sel', 'Protéines et vitamines', 'Amidon et fibres']::text[], array['Alcohol and carbon dioxide', 'Water and salt', 'Proteins and vitamins', 'Starch and fibre']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Une pils est une bière à fermentation...', 'A pils is a beer made by which fermentation?', array['Basse', 'Haute', 'Spontanée', 'Mixte au vin']::text[], array['Bottom fermentation', 'Top fermentation', 'Spontaneous', 'Mixed with wine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel est l’ingrédient le plus abondant dans une bière ?', 'What is the most abundant ingredient in beer?', array['L’eau', 'Le malt', 'Le houblon', 'La levure']::text[], array['Water', 'Malt', 'Hops', 'Yeast']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le houblon appartient à la même famille botanique que...', 'Hops belong to the same botanical family as...', array['Le chanvre', 'La vigne', 'Le tournesol', 'Le lierre']::text[], array['Hemp', 'Grapevine', 'Sunflower', 'Ivy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle partie du houblon utilise le brasseur ?', 'Which part of the hop plant does the brewer use?', array['Les cônes des plants femelles', 'Les racines', 'Les feuilles', 'Les graines des plants mâles']::text[], array['Female plant cones', 'The roots', 'The leaves', 'Male plant seeds']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle ville de Flandre-Occidentale est la capitale belge du houblon ?', 'Which West Flanders town is Belgium’s hop capital?', array['Poperinge', 'Ostende', 'Furnes', 'Dixmude']::text[], array['Poperinge', 'Ostend', 'Veurne', 'Diksmuide']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Au printemps, on déguste à Poperinge les « jets de houblon ». Qu’est-ce que c’est ?', 'In spring, Poperinge serves “hop shoots”. What are they?', array['De jeunes pousses de houblon', 'Une bière pétillante', 'Des bonbons au houblon', 'Une danse folklorique']::text[], array['Young hop sprouts', 'A sparkling beer', 'Hop sweets', 'A folk dance']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Avant le houblon, quel mélange d’herbes aromatisait la bière au Moyen Âge ?', 'Before hops, which herb mix flavoured beer in the Middle Ages?', array['Le gruit', 'Le pesto', 'Le garam masala', 'Le bouquet garni']::text[], array['Gruit', 'Pesto', 'Garam masala', 'Bouquet garni']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Que mesure l’échelle IBU ?', 'What does the IBU scale measure?', array['L’amertume', 'La couleur', 'Le taux d’alcool', 'La quantité de mousse']::text[], array['Bitterness', 'Colour', 'Alcohol content', 'Amount of foam']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pour une refermentation en bouteille, on ajoute avant de boucher...', 'For bottle refermentation, before capping you add...', array['Du sucre et de la levure', 'Du sel et du vinaigre', 'Du gaz et de l’eau', 'Du houblon et du miel']::text[], array['Sugar and yeast', 'Salt and vinegar', 'Gas and water', 'Hops and honey']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel sucre est souvent utilisé dans les bières fortes belges ?', 'Which sugar is often used in strong Belgian beers?', array['Le sucre candi', 'Le sucre de palme', 'Le sirop d’agave', 'L’aspartame']::text[], array['Candi sugar', 'Palm sugar', 'Agave syrup', 'Aspartame']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'D’où vient la couleur très foncée d’un stout ?', 'Where does the very dark colour of a stout come from?', array['De l’orge torréfiée', 'Du chocolat ajouté', 'D’un colorant', 'Du café soluble']::text[], array['Roasted barley', 'Added chocolate', 'A food colouring', 'Instant coffee']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Parmi ces styles, lequel est en général le plus fort en alcool ?', 'Which of these styles is usually the strongest in alcohol?', array['La tripel', 'La pils', 'La bière blanche', 'La bière de table']::text[], array['Tripel', 'Pils', 'White beer', 'Table beer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pourquoi la bière blanche porte-t-elle ce nom ?', 'Why is white beer called that?', array['Pour son aspect pâle et trouble', 'Parce qu’elle est incolore', 'Parce qu’on la boit en hiver', 'Pour sa mousse épaisse']::text[], array['Its pale, cloudy look', 'Because it is colourless', 'Because it is drunk in winter', 'For its thick foam']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pourquoi rince-t-on le verre à l’eau froide avant de servir une pression ?', 'Why is the glass rinsed with cold water before pouring a draught beer?', array['Pour une mousse plus belle', 'Pour ajouter de l’eau', 'Pour tiédir la bière', 'Pour enlever les bulles']::text[], array['For a better head of foam', 'To add water', 'To warm the beer', 'To remove the bubbles']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle contenance a le verre de pils classique servi dans les cafés belges ?', 'What is the size of the classic pils glass in Belgian cafés?', array['25 cl', '50 cl', '10 cl', '1 litre']::text[], array['25 cl', '50 cl', '10 cl', '1 litre']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Dans quel type de verre sert-on souvent les trappistes ?', 'What kind of glass are trappists often served in?', array['Un calice', 'Une flûte à champagne', 'Une chope en métal', 'Un gobelet en plastique']::text[], array['A chalice', 'A champagne flute', 'A metal tankard', 'A plastic cup']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pourquoi la plupart des bouteilles de bière sont-elles brunes ?', 'Why are most beer bottles brown?', array['Pour protéger la bière de la lumière', 'Pour cacher le niveau', 'Parce que c’est moins cher', 'Pour la garder chaude']::text[], array['To protect the beer from light', 'To hide the level', 'Because it is cheaper', 'To keep it warm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Avec une bière refermentée, pourquoi laisse-t-on un fond dans la bouteille ?', 'With a bottle-conditioned beer, why leave a little in the bottle?', array['Pour garder le dépôt de levure', 'Par politesse', 'Pour le brasseur', 'Parce qu’il est trop amer']::text[], array['To keep back the yeast sediment', 'Out of politeness', 'For the brewer', 'Because it is too bitter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Comment appelle-t-on la personne qui fabrique la bière ?', 'What do you call the person who makes beer?', array['Un brasseur', 'Un vigneron', 'Un distillateur', 'Un tonnelier']::text[], array['A brewer', 'A winegrower', 'A distiller', 'A cooper']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel saint est le patron des brasseurs en Belgique ?', 'Which saint is the patron of brewers in Belgium?', array['Saint Arnould', 'Saint Hubert', 'Saint Éloi', 'Saint Nicolas']::text[], array['Saint Arnold', 'Saint Hubert', 'Saint Eligius', 'Saint Nicholas']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel roi légendaire est considéré comme le roi de la bière ?', 'Which legendary king is known as the king of beer?', array['Gambrinus', 'Arthur', 'Midas', 'Dagobert']::text[], array['Gambrinus', 'Arthur', 'Midas', 'Dagobert']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Comment appelait-on la bière des Gaulois ?', 'What was the beer of the Gauls called?', array['La cervoise', 'L’hydromel', 'Le cidre', 'La piquette']::text[], array['Cervoise', 'Mead', 'Cider', 'Piquette']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Comment s’appelle l’étude et la dégustation de la bière ?', 'What is the study and tasting of beer called?', array['La zythologie', 'L’œnologie', 'La mixologie', 'La caféologie']::text[], array['Zythology', 'Oenology', 'Mixology', 'Coffeeology']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Pour trinquer en Flandre, on dit souvent...', 'To raise a glass in Flanders, people often say...', array['Schol !', 'Salud !', 'Skål !', 'Kanpai !']::text[], array['Schol!', 'Salud!', 'Skål!', 'Kanpai!']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'En Belgique, comment appelle-t-on le conducteur désigné qui ne boit pas ?', 'In Belgium, what is the designated sober driver called?', array['Bob', 'Bill', 'Ben', 'Bart']::text[], array['Bob', 'Bill', 'Ben', 'Bart']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle est la limite générale d’alcool au volant en Belgique ?', 'What is the general drink driving limit in Belgium?', array['0,5 g par litre de sang', '0,8 g par litre de sang', '1 g par litre de sang', '1,5 g par litre de sang']::text[], array['0.5 g per litre of blood', '0.8 g per litre of blood', '1 g per litre of blood', '1.5 g per litre of blood']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quelle bière légère était autrefois servie dans les cantines scolaires belges ?', 'Which light beer was once served in Belgian school canteens?', array['La bière de table', 'La tripel', 'La gueuze', 'La quadrupel']::text[], array['Table beer', 'Tripel', 'Gueuze', 'Quadrupel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel plat flamand mijote le bœuf dans la bière ?', 'Which Flemish dish slowly cooks beef in beer?', array['La carbonnade', 'Le waterzooi', 'Le stoemp', 'Le potjevleesch']::text[], array['Carbonnade', 'Waterzooi', 'Stoemp', 'Potjevleesch']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel savant français a publié des « Études sur la bière » en 1876 ?', 'Which French scientist published “Studies on Beer” in 1876?', array['Louis Pasteur', 'Marie Curie', 'Antoine Lavoisier', 'Blaise Pascal']::text[], array['Louis Pasteur', 'Marie Curie', 'Antoine Lavoisier', 'Blaise Pascal']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La pils doit son nom à quelle ville tchèque ?', 'Pilsner is named after which Czech city?', array['Plzeň (Pilsen)', 'Prague', 'Brno', 'Ostrava']::text[], array['Plzeň (Pilsen)', 'Prague', 'Brno', 'Ostrava']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'En quelle année la Bavière a-t-elle adopté sa célèbre loi de pureté de la bière ?', 'In which year did Bavaria adopt its famous beer purity law?', array['1516', '1789', '1066', '1914']::text[], array['1516', '1789', '1066', '1914']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'L’Oktoberfest de Munich commence en général au mois de...', 'Munich’s Oktoberfest usually starts in...', array['Septembre', 'Octobre', 'Novembre', 'Août']::text[], array['September', 'October', 'November', 'August']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Quel pays a la plus forte consommation de bière par habitant au monde ?', 'Which country drinks the most beer per person in the world?', array['La Tchéquie', 'L’Allemagne', 'La Belgique', 'L’Irlande']::text[], array['Czechia', 'Germany', 'Belgium', 'Ireland']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Guinness, célèbre stout, vient de quelle ville ?', 'Guinness, the famous stout, comes from which city?', array['Dublin', 'Londres', 'Édimbourg', 'Cardiff']::text[], array['Dublin', 'London', 'Edinburgh', 'Cardiff']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Que signifie le sigle IPA ?', 'What does IPA stand for?', array['India Pale Ale', 'International Pils Association', 'Irish Porter Ale', 'Imperial Pale Amber']::text[], array['India Pale Ale', 'International Pils Association', 'Irish Porter Ale', 'Imperial Pale Amber']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'La Kölsch est la bière typique de quelle ville allemande ?', 'Kölsch is the typical beer of which German city?', array['Cologne', 'Munich', 'Berlin', 'Hambourg']::text[], array['Cologne', 'Munich', 'Berlin', 'Hamburg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Ninkasi était la déesse de la bière de quel peuple antique ?', 'Ninkasi was the beer goddess of which ancient people?', array['Les Sumériens', 'Les Vikings', 'Les Romains', 'Les Aztèques']::text[], array['The Sumerians', 'The Vikings', 'The Romans', 'The Aztecs']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('beer', 'Le mot « lager » vient d’un verbe allemand qui signifie...', 'The word “lager” comes from a German verb meaning...', array['Stocker', 'Brûler', 'Partager', 'Chanter']::text[], array['To store', 'To burn', 'To share', 'To sing']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle marque a popularisé le rasoir de sûreté à lame jetable au début du XXe siècle ?', 'Which brand popularised the safety razor with disposable blades in the early 20th century?', array['Gillette', 'Bic', 'Philips', 'Nivea']::text[], array['Gillette', 'Bic', 'Philips', 'Nivea']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une barbe limitée au menton s’appelle...', 'A beard limited to the chin is called...', array['Un bouc', 'Un collier', 'Des favoris', 'Une moustache']::text[], array['A goatee', 'A chinstrap', 'Sideburns', 'A moustache']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le mot anglais « sideburns » (favoris) vient du nom de qui ?', 'The word “sideburns” comes from the name of whom?', array['Un général américain', 'Un roi d’Angleterre', 'Un barbier londonien', 'Un boxeur irlandais']::text[], array['An American general', 'An English king', 'A London barber', 'An Irish boxer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La petite moustache carrée de Charlie Chaplin est dite...', 'Charlie Chaplin’s small square moustache is called...', array['En brosse à dents', 'En guidon', 'En fer à cheval', 'De morse']::text[], array['A toothbrush moustache', 'A handlebar moustache', 'A horseshoe moustache', 'A walrus moustache']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel peintre surréaliste était célèbre pour sa moustache fine aux pointes dressées ?', 'Which surrealist painter was famous for his thin moustache with upturned tips?', array['Salvador Dalí', 'Pablo Picasso', 'René Magritte', 'Claude Monet']::text[], array['Salvador Dalí', 'Pablo Picasso', 'René Magritte', 'Claude Monet']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel chanteur de Queen arborait une célèbre moustache dans les années 80 ?', 'Which Queen singer sported a famous moustache in the 1980s?', array['Freddie Mercury', 'Brian May', 'Roger Taylor', 'John Deacon']::text[], array['Freddie Mercury', 'Brian May', 'Roger Taylor', 'John Deacon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel acteur de la série « Magnum » est célèbre pour sa moustache ?', 'Which star of the series “Magnum, P.I.” is famous for his moustache?', array['Tom Selleck', 'Don Johnson', 'David Hasselhoff', 'Burt Reynolds']::text[], array['Tom Selleck', 'Don Johnson', 'David Hasselhoff', 'Burt Reynolds']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment appelle-t-on en français la coupe « mohawk » ?', 'What is the French name for the mohawk?', array['La crête iroquoise', 'La coupe au bol', 'La tonsure', 'La coupe César']::text[], array['The Iroquois crest', 'The bowl cut', 'The tonsure', 'The Caesar cut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle le sommet du crâne rasé que portaient autrefois les moines ?', 'What is the shaved crown once worn by monks called?', array['La tonsure', 'La crête', 'Le dégradé', 'La houppe']::text[], array['The tonsure', 'The crest', 'The fade', 'The quiff']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe qui semble faite en posant un bol sur la tête s’appelle...', 'The haircut that looks like it was done around a bowl is called...', array['La coupe au bol', 'La coupe César', 'Le flat top', 'L’undercut']::text[], array['The bowl cut', 'The Caesar cut', 'The flat top', 'The undercut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Que signifie « se faire la boule à zéro » ?', 'What does the French phrase « se faire la boule à zéro » mean?', array['Se raser complètement la tête', 'Se teindre en blond', 'Se laisser pousser la barbe', 'Se faire une frange']::text[], array['To shave your head completely', 'To dye your hair blond', 'To grow a beard', 'To get a fringe']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans un dégradé « à blanc », les cheveux du bas descendent jusqu’à...', 'In a skin fade, the hair at the bottom goes down to...', array['La peau', '1 cm', '2 cm', '3 cm']::text[], array['Bare skin', '1 cm', '2 cm', '3 cm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle coiffure volumineuse est devenue un symbole du mouvement « Black is Beautiful » ?', 'Which voluminous hairstyle became a symbol of the “Black is Beautiful” movement?', array['L’afro', 'La coupe au bol', 'Le flat top', 'La tonsure']::text[], array['The afro', 'The bowl cut', 'The flat top', 'The tonsure']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle coiffure portait Bob Marley ?', 'Which hairstyle did Bob Marley wear?', array['Des dreadlocks', 'Une crête iroquoise', 'Une coupe au bol', 'Un crâne rasé']::text[], array['Dreadlocks', 'A mohawk', 'A bowl cut', 'A shaved head']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La célèbre coupe « Rachel » vient de quelle série ?', 'The famous “Rachel” haircut comes from which series?', array['Friends', 'Seinfeld', 'Dallas', 'Urgences']::text[], array['Friends', 'Seinfeld', 'Dallas', 'ER']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel membre de « L’Agence tous risques » portait une crête iroquoise ?', 'Which member of “The A-Team” wore a mohawk?', array['Barracuda', 'Hannibal', 'Looping', 'Futé']::text[], array['B.A. Baracus', 'Hannibal', 'Murdock', 'Face']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel acteur a rendu célèbre la coupe de Thomas Shelby dans « Peaky Blinders » ?', 'Which actor made Thomas Shelby’s haircut in “Peaky Blinders” famous?', array['Cillian Murphy', 'Tom Hardy', 'Colin Farrell', 'Tom Hiddleston']::text[], array['Cillian Murphy', 'Tom Hardy', 'Colin Farrell', 'Tom Hiddleston']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans la Bible, quel héros perd sa force quand on lui coupe les cheveux ?', 'In the Bible, which hero loses his strength when his hair is cut?', array['Samson', 'David', 'Moïse', 'Noé']::text[], array['Samson', 'David', 'Moses', 'Noah']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel barbier de fiction est surnommé le « diabolique barbier de Fleet Street » ?', 'Which fictional barber is known as the “Demon Barber of Fleet Street”?', array['Sweeney Todd', 'Figaro', 'Edward aux mains d’argent', 'Barbe-Bleue']::text[], array['Sweeney Todd', 'Figaro', 'Edward Scissorhands', 'Bluebeard']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel tsar russe a instauré une taxe sur la barbe ?', 'Which Russian tsar introduced a tax on beards?', array['Pierre le Grand', 'Ivan le Terrible', 'Nicolas II', 'Alexandre Ier']::text[], array['Peter the Great', 'Ivan the Terrible', 'Nicholas II', 'Alexander I']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'De quelle protéine les cheveux sont-ils principalement composés ?', 'Which protein is hair mainly made of?', array['La kératine', 'Le collagène', 'L’hémoglobine', 'L’insuline']::text[], array['Keratin', 'Collagen', 'Haemoglobin', 'Insulin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans quelle petite cavité de la peau le cheveu prend-il racine ?', 'In which small cavity of the skin does a hair grow from?', array['Le follicule pileux', 'La glande sudoripare', 'Le pore lacrymal', 'Le ganglion']::text[], array['The hair follicle', 'The sweat gland', 'The tear duct', 'The lymph node']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Combien de cheveux a en moyenne un adulte sur la tête ?', 'Roughly how many hairs does an adult have on their head?', array['+/ 100 000', '+/ 5 000', '+/ 10 000', '+/ 1 million']::text[], array['+/ 100,000', '+/ 5,000', '+/ 10,000', '+/ 1 million']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Combien de cheveux perd-on normalement par jour ?', 'How many hairs do we normally lose per day?', array['De 50 à 100', 'De 1 à 5', 'De 1 000 à 2 000', 'Aucun']::text[], array['From 50 to 100', 'From 1 to 5', 'From 1,000 to 2,000', 'None']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Pourquoi les cheveux blanchissent-ils avec l’âge ?', 'Why does hair turn grey with age?', array['Ils produisent moins de mélanine', 'Ils manquent de soleil', 'Ils boivent trop d’eau', 'Ils contiennent du calcaire']::text[], array['It produces less melanin', 'It lacks sunlight', 'It absorbs too much water', 'It fills with limescale']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle hormone est surtout liée à la calvitie masculine ?', 'Which hormone is most linked to male pattern baldness?', array['La DHT', 'L’insuline', 'L’adrénaline', 'La mélatonine']::text[], array['DHT', 'Insulin', 'Adrenaline', 'Melatonin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le rasage fait-il repousser la barbe plus épaisse ?', 'Does shaving make your beard grow back thicker?', array['Non, c’est un mythe', 'Oui, toujours', 'Oui, mais seulement en hiver', 'Oui, seulement la moustache']::text[], array['No, it’s a myth', 'Yes, always', 'Yes, but only in winter', 'Yes, only the moustache']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle l’huile naturelle produite par le cuir chevelu ?', 'What is the natural oil produced by the scalp called?', array['Le sébum', 'La lanoline', 'La kératine', 'La sueur']::text[], array['Sebum', 'Lanolin', 'Keratin', 'Sweat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Un poil qui repousse sous la peau au lieu d’en sortir est un poil...', 'A hair that grows back under the skin instead of out of it is...', array['Incarné', 'Fourchu', 'Électrique', 'Dormant']::text[], array['Ingrown', 'Split', 'Static', 'Dormant']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment appelle-t-on l’irritation rouge qui apparaît après un rasage ?', 'What is the red irritation that appears after shaving called?', array['Le feu du rasoir', 'Le coup de soleil', 'La pelade', 'L’urticaire du barbier']::text[], array['Razor burn', 'Sunburn', 'Alopecia', 'Barber’s hives']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Pour limiter les irritations, la première passe de rasage se fait...', 'To limit irritation, the first shaving pass should go...', array['Dans le sens du poil', 'À contresens du poil', 'En petits cercles', 'Sans mousse']::text[], array['With the grain', 'Against the grain', 'In small circles', 'Without lather']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle pierre minérale passe-t-on sur la peau après le rasage pour resserrer les petites coupures ?', 'Which mineral block is rubbed on the skin after shaving to close small nicks?', array['La pierre d’alun', 'La pierre ponce', 'Le quartz rose', 'L’ardoise']::text[], array['An alum block', 'A pumice stone', 'Rose quartz', 'Slate']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'À quoi sert la lanière de cuir sur laquelle on passe un rasoir droit ?', 'What is the leather strop used for with a straight razor?', array['À redresser le fil de la lame', 'À nettoyer la mousse', 'À chauffer la lame', 'À ranger le rasoir']::text[], array['Realigning the blade’s edge', 'Wiping off lather', 'Warming the blade', 'Storing the razor']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'À quoi servent les ciseaux à dents, dits « sculpteurs » ?', 'What are thinning scissors used for?', array['À désépaissir les cheveux', 'À couper les ongles', 'À friser les mèches', 'À tracer la raie']::text[], array['Removing bulk from hair', 'Cutting nails', 'Curling strands', 'Drawing the parting']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La technique « clipper over comb » consiste à...', 'The “clipper over comb” technique means...', array['Tondre en guidant avec un peigne', 'Couper aux ciseaux sans peigne', 'Raser au rasoir droit', 'Brosser après la coupe']::text[], array['Clipping hair held up by a comb', 'Cutting with scissors, no comb', 'Shaving with a straight razor', 'Brushing after the cut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'En barberie, le « line up » c’est...', 'In barbering, a “line up” is...', array['Le tracé net des contours', 'La file d’attente', 'Un soin de la barbe', 'Une coloration']::text[], array['Crisp tracing of the hairline', 'The waiting queue', 'A beard treatment', 'A hair colour']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une « hard part », c’est...', 'A “hard part” is...', array['Une raie tracée à la tondeuse ou au rasoir', 'Un gel extra fort', 'Une barbe très dense', 'Un peigne en métal']::text[], array['A parting cut in with clippers or razor', 'An extra strong gel', 'A very dense beard', 'A metal comb']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Par rapport à une pommade à base d’huile, une pommade à base d’eau...', 'Compared with an oil-based pomade, a water-based pomade...', array['Se rince plus facilement', 'Ne part jamais au lavage', 'Sent toujours le pétrole', 'Fait pousser les cheveux']::text[], array['Washes out more easily', 'Never washes out', 'Always smells of petrol', 'Makes hair grow']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle marque britannique de crème coiffante avait pour slogan « A little dab’ll do ya » ?', 'Which British hair cream brand used the slogan “A little dab’ll do ya”?', array['Brylcreem', 'Gillette', 'Nivea', 'Pantene']::text[], array['Brylcreem', 'Gillette', 'Nivea', 'Pantene']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Par rapport à l’huile à barbe, le baume à barbe apporte en plus...', 'Compared with beard oil, beard balm also adds...', array['Un peu de tenue', 'Une couleur', 'Un effet glacé', 'Une odeur de javel']::text[], array['Some hold', 'Colour', 'A frozen effect', 'A bleach smell']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel micro-organisme est souvent impliqué dans les pellicules ?', 'Which microorganism is often involved in dandruff?', array['Une levure', 'Un virus', 'Un pou', 'Une amibe']::text[], array['A yeast', 'A virus', 'A louse', 'An amoeba']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle la couche externe protectrice du cheveu ?', 'What is the protective outer layer of a hair called?', array['La cuticule', 'La médulla', 'Le bulbe', 'La racine']::text[], array['The cuticle', 'The medulla', 'The bulb', 'The root']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La partie visible du cheveu est-elle vivante ?', 'Is the visible part of a hair alive?', array['Non, ce sont des cellules mortes', 'Oui, elle a des nerfs', 'Oui, elle respire', 'Seulement la pointe']::text[], array['No, it’s made of dead cells', 'Yes, it has nerves', 'Yes, it breathes', 'Only the tip']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une moustache très fine juste au-dessus de la lèvre est une moustache...', 'A very thin moustache just above the lip is a...', array['En trait de crayon', 'De morse', 'En fer à cheval', 'En guidon']::text[], array['Pencil moustache', 'Walrus moustache', 'Horseshoe moustache', 'Handlebar moustache']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une moustache épaisse et tombante qui cache la lèvre est une moustache...', 'A thick, drooping moustache that covers the lip is a...', array['De morse', 'En trait de crayon', 'En brosse à dents', 'Fu Manchu']::text[], array['Walrus moustache', 'Pencil moustache', 'Toothbrush moustache', 'Fu Manchu']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La barbe « Van Dyke » doit son nom à un peintre né dans quelle ville ?', 'The Van Dyke beard is named after a painter born in which city?', array['Anvers', 'Mons', 'Liège', 'Paris']::text[], array['Antwerp', 'Mons', 'Liège', 'Paris']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une barbe courte de quelques jours s’appelle...', 'A short beard of just a few days is called...', array['Une barbe de trois jours', 'Une barbe de capitaine', 'Un collier', 'Un bouc']::text[], array['Stubble', 'A captain’s beard', 'A chinstrap', 'A goatee']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Pendant « Movember », les hommes se laissent pousser...', 'During “Movember”, men grow...', array['La moustache', 'Les cheveux', 'Les ongles', 'Les sourcils']::text[], array['A moustache', 'Their hair', 'Their nails', 'Their eyebrows']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe « high and tight » est associée aux...', 'The “high and tight” haircut is associated with...', array['Militaires américains', 'Moines bouddhistes', 'Rockeurs punk', 'Surfeurs australiens']::text[], array['US military personnel', 'Buddhist monks', 'Punk rockers', 'Australian surfers']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le « faux hawk », c’est...', 'A “faux hawk” is...', array['Une crête sans raser les côtés', 'Une perruque', 'Une barbe postiche', 'Un crâne rasé']::text[], array['A crest without shaved sides', 'A wig', 'A fake beard', 'A shaved head']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel détective de série télé au crâne rasé suçait des sucettes ?', 'Which bald TV detective was known for his lollipops?', array['Kojak', 'Columbo', 'Magnum', 'Derrick']::text[], array['Kojak', 'Columbo', 'Magnum', 'Derrick']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans « Dumb and Dumber », quelle coupe porte Lloyd (Jim Carrey) ?', 'In “Dumb and Dumber”, which haircut does Lloyd (Jim Carrey) have?', array['La coupe au bol', 'La crête iroquoise', 'Le mulet', 'Les dreadlocks']::text[], array['A bowl cut', 'A mohawk', 'A mullet', 'Dreadlocks']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel Gaulois de BD porte deux grosses tresses rousses ?', 'Which Gaulish comic character wears two big red braids?', array['Obélix', 'Astérix', 'Panoramix', 'Abraracourcix']::text[], array['Obelix', 'Asterix', 'Getafix', 'Vitalstatistix']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel compagnon de Tintin porte une barbe noire bien fournie ?', 'Which of Tintin’s companions has a full black beard?', array['Le capitaine Haddock', 'Nestor', 'Milou', 'Dupont']::text[], array['Captain Haddock', 'Nestor', 'Snowy', 'Thomson']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel attribut pileux partagent Dupond et Dupont ?', 'What facial hair do Thomson and Thompson share?', array['La moustache', 'La barbe en pointe', 'Les dreadlocks', 'La crête']::text[], array['A moustache', 'A pointed beard', 'Dreadlocks', 'A mohawk']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel directeur de Poudlard porte une très longue barbe blanche ?', 'Which Hogwarts headmaster has a very long white beard?', array['Albus Dumbledore', 'Severus Rogue', 'Remus Lupin', 'Argus Rusard']::text[], array['Albus Dumbledore', 'Severus Snape', 'Remus Lupin', 'Argus Filch']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Wolverine, des X-Men, est célèbre pour ses énormes...', 'Wolverine from the X-Men is famous for his huge...', array['Favoris', 'Tresses', 'Dreadlocks', 'Boucles blondes']::text[], array['Sideburns', 'Braids', 'Dreadlocks', 'Blond curls']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel détective belge d’Agatha Christie bichonne sa célèbre moustache ?', 'Which Belgian detective created by Agatha Christie pampers his famous moustache?', array['Hercule Poirot', 'Sherlock Holmes', 'Jules Maigret', 'Arsène Lupin']::text[], array['Hercule Poirot', 'Sherlock Holmes', 'Jules Maigret', 'Arsène Lupin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel président américain portait une barbe sans moustache ?', 'Which US president wore a beard without a moustache?', array['Abraham Lincoln', 'George Washington', 'John F. Kennedy', 'Barack Obama']::text[], array['Abraham Lincoln', 'George Washington', 'John F. Kennedy', 'Barack Obama']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans l’Égypte antique, les pharaons portaient souvent une barbe...', 'In ancient Egypt, pharaohs often wore a beard that was...', array['Postiche', 'Teinte en bleu', 'Tressée de fleurs', 'Taillée en cœur']::text[], array['False', 'Dyed blue', 'Braided with flowers', 'Heart-shaped']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Les rasoirs électriques à têtes rotatives sont la spécialité de quelle marque ?', 'Electric shavers with rotary heads are the speciality of which brand?', array['Philips', 'Gillette', 'Bic', 'Wilkinson']::text[], array['Philips', 'Gillette', 'Bic', 'Wilkinson']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le mot « barbier » vient du mot latin...', 'The word “barber” comes from the Latin word...', array['Barba, la barbe', 'Barbarus, l’étranger', 'Barca, le bateau', 'Barrus, l’éléphant']::text[], array['Barba, beard', 'Barbarus, foreigner', 'Barca, boat', 'Barrus, elephant']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment appelle-t-on une mèche qui pousse dans un sens rebelle ?', 'What is a stubborn tuft of hair growing in its own direction called?', array['Un épi', 'Un golfe', 'Une houppe', 'Une natte']::text[], array['A cowlick', 'A widow’s peak', 'A quiff', 'A braid']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quand les cheveux reculent sur les tempes, on dit qu’on a des...', 'When hair recedes at the temples, you have...', array['Golfes', 'Épis', 'Fourches', 'Favoris']::text[], array['A receding hairline', 'A cowlick', 'Split ends', 'Sideburns']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'À quoi sert l’huile avant-rasage ?', 'What is pre-shave oil for?', array['À faire mieux glisser la lame', 'À colorer la barbe', 'À remplacer le rasoir', 'À faire pousser les poils']::text[], array['Helping the blade glide', 'Colouring the beard', 'Replacing the razor', 'Making hair grow']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Pourquoi certains après-rasage piquent-ils ?', 'Why do some aftershaves sting?', array['Ils contiennent de l’alcool', 'Ils contiennent du piment', 'Ils sont trop froids', 'Ils contiennent du sable']::text[], array['They contain alcohol', 'They contain chilli', 'They are too cold', 'They contain sand']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Les roux ont surtout beaucoup de quel pigment ?', 'Redheads mainly have a lot of which pigment?', array['La phéomélanine', 'La chlorophylle', 'Le carotène', 'L’hémoglobine']::text[], array['Pheomelanin', 'Chlorophyll', 'Carotene', 'Haemoglobin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment s’appelle la science qui étudie les cheveux et le cuir chevelu ?', 'What is the science of hair and scalp called?', array['La trichologie', 'La dermatoglyphie', 'L’odontologie', 'L’ornithologie']::text[], array['Trichology', 'Dermatoglyphics', 'Odontology', 'Ornithology']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Une barbe « poivre et sel », c’est une barbe...', 'A “salt and pepper” beard is a beard that is...', array['Grisonnante', 'Rousse', 'Teinte en noir', 'Pleine de pellicules']::text[], array['Going grey', 'Ginger', 'Dyed black', 'Full of dandruff']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Que veut dire « couper les cheveux en quatre » ?', 'What does the French idiom « couper les cheveux en quatre » mean?', array['Chercher la petite bête', 'Faire une coupe rapide', 'Partager équitablement', 'Se disputer avec son barbier']::text[], array['To split hairs', 'To get a quick cut', 'To share fairly', 'To argue with your barber']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Que veut dire « avoir un poil dans la main » ?', 'What does the French idiom « avoir un poil dans la main » mean?', array['Être paresseux', 'Être très poilu', 'Être chanceux', 'Être généreux']::text[], array['To be lazy', 'To be very hairy', 'To be lucky', 'To be generous']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le « rasoir d’Ockham », c’est...', '“Occam’s razor” is...', array['Un principe de simplicité en philosophie', 'Le premier rasoir électrique', 'Une marque anglaise', 'Une coupe médiévale']::text[], array['A philosophical principle of simplicity', 'The first electric razor', 'An English brand', 'A medieval haircut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Qu’est-ce que la « barbe à papa » ?', 'What is « barbe à papa » in French?', array['Une confiserie de fête foraine', 'Un style de barbe', 'Un savon à barbe', 'Une coupe pour pères']::text[], array['Candy floss', 'A beard style', 'A shaving soap', 'A dad haircut']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Dans le conte de Perrault, de quelle couleur est la barbe du terrible mari ?', 'In Perrault’s fairy tale, what colour is the terrible husband’s beard?', array['Bleue', 'Rouge', 'Verte', 'Dorée']::text[], array['Blue', 'Red', 'Green', 'Gold']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel groupe de rock texan est célèbre pour les longues barbes de ses guitaristes ?', 'Which Texan rock band is famous for its guitarists’ long beards?', array['ZZ Top', 'AC/DC', 'Metallica', 'The Rolling Stones']::text[], array['ZZ Top', 'AC/DC', 'Metallica', 'The Rolling Stones']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'En Belgique, quel grand saint barbu apporte des cadeaux aux enfants le 6 décembre ?', 'In Belgium, which bearded saint brings children presents on 6 December?', array['Saint Nicolas', 'Saint Pierre', 'Saint Georges', 'Saint Martin']::text[], array['Saint Nicholas', 'Saint Peter', 'Saint George', 'Saint Martin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le « burst fade » est un dégradé qui...', 'A burst fade is a fade that...', array['Forme un arc autour de l’oreille', 'Couvre toute la barbe', 'Ne touche que la frange', 'Se fait aux ciseaux seuls']::text[], array['Curves in an arc around the ear', 'Covers the whole beard', 'Only affects the fringe', 'Is done with scissors only']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe faite entièrement à la tondeuse, courte et uniforme, s’appelle...', 'The short, even cut done entirely with clippers is called...', array['Le buzz cut', 'Le pompadour', 'Le mulet', 'Le chignon']::text[], array['A buzz cut', 'A pompadour', 'A mullet', 'A bun']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Les brosses à barbe traditionnelles sont souvent en poils de...', 'Traditional beard brushes are often made of which bristles?', array['Sanglier', 'Chat', 'Mouton', 'Lapin']::text[], array['Boar', 'Cat', 'Sheep', 'Rabbit']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Pourquoi met-on quelques gouttes d’huile sur les lames de la tondeuse ?', 'Why do you put a few drops of oil on clipper blades?', array['Pour réduire frottement et chauffe', 'Pour parfumer la coupe', 'Pour colorer les cheveux', 'Pour faire briller la peau']::text[], array['To reduce friction and heat', 'To scent the cut', 'To colour the hair', 'To make skin shine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le liquide bleu dans lequel trempent les peignes chez le barbier sert à...', 'The blue liquid that combs soak in at the barber’s is used to...', array['Les désinfecter', 'Les teindre', 'Les ramollir', 'Les parfumer']::text[], array['Disinfect them', 'Dye them', 'Soften them', 'Scent them']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Les cheveux et la barbe continuent-ils de pousser après la mort ?', 'Do hair and beards keep growing after death?', array['Non, c’est la peau qui se rétracte', 'Oui, pendant des années', 'Oui, seulement la barbe', 'Oui, seulement les cheveux']::text[], array['No, the skin retracts', 'Yes, for years', 'Yes, only the beard', 'Yes, only the hair']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quelle est la couleur de cheveux naturelle la plus répandue dans le monde ?', 'What is the most common natural hair colour in the world?', array['Noire', 'Blonde', 'Rousse', 'Châtain clair']::text[], array['Black', 'Blond', 'Red', 'Light brown']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel médicament en lotion est utilisé contre la chute de cheveux ?', 'Which medicine applied as a lotion is used against hair loss?', array['Le minoxidil', 'Le paracétamol', 'La pénicilline', 'L’ibuprofène']::text[], array['Minoxidil', 'Paracetamol', 'Penicillin', 'Ibuprofen']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe « à la garçonne » est née dans quelle décennie ?', 'The “garçonne” bob haircut was born in which decade?', array['Les années 1920', 'Les années 1850', 'Les années 1960', 'Les années 1990']::text[], array['The 1920s', 'The 1850s', 'The 1960s', 'The 1990s']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment appelait-on la coupe des Beatles au début des années 60 ?', 'What was the Beatles’ early 1960s haircut called?', array['La « mop top »', 'Le « flat top »', 'Le « high and tight »', 'Le « mulet »']::text[], array['The mop top', 'The flat top', 'The high and tight', 'The mullet']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'De quelle couleur sont les cheveux du Joker ?', 'What colour is the Joker’s hair?', array['Verts', 'Bleus', 'Roux', 'Blancs']::text[], array['Green', 'Blue', 'Red', 'White']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quand Goku devient Super Saiyan, ses cheveux deviennent...', 'When Goku turns Super Saiyan, his hair becomes...', array['Blonds et dressés', 'Roses et bouclés', 'Bleus et plaqués', 'Blancs et rasés']::text[], array['Blond and spiky', 'Pink and curly', 'Blue and slicked', 'White and shaved']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment appelait-on le barbier dans la Rome antique ?', 'What was a barber called in ancient Rome?', array['Le tonsor', 'Le gladiator', 'Le centurion', 'Le pontifex']::text[], array['A tonsor', 'A gladiator', 'A centurion', 'A pontifex']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel célèbre chirurgien français de la Renaissance a commencé comme barbier ?', 'Which famous French Renaissance surgeon started out as a barber?', array['Ambroise Paré', 'Louis Pasteur', 'Claude Bernard', 'René Laennec']::text[], array['Ambroise Paré', 'Louis Pasteur', 'Claude Bernard', 'René Laennec']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel surnom les soldats donnaient-ils à Napoléon, à cause de ses cheveux courts ?', 'What nickname did soldiers give Napoleon because of his short hair?', array['Le Petit Tondu', 'Le Grand Chauve', 'Le Barbu', 'Le Frisé']::text[], array['The Little Crop-Head', 'The Big Baldy', 'The Bearded One', 'Curly']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Le mot « shampoing » vient d’une langue de quel pays ?', 'The word “shampoo” comes from a language of which country?', array['L’Inde', 'La Chine', 'Le Japon', 'L’Égypte']::text[], array['India', 'China', 'Japan', 'Egypt']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La pogonophobie, c’est la peur...', 'Pogonophobia is the fear of...', array['Des barbes', 'Des ciseaux', 'Des miroirs', 'Des chauves']::text[], array['Beards', 'Scissors', 'Mirrors', 'Bald people']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Où place-t-on généralement la ligne de cou d’une barbe ?', 'Where is a beard’s neckline usually placed?', array['Juste au-dessus de la pomme d’Adam', 'Au niveau du menton', 'Sur la clavicule', 'Sous les oreilles']::text[], array['Just above the Adam’s apple', 'Level with the chin', 'On the collarbone', 'Below the ears']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Quel surnom donnait-on aux soldats français de la guerre de 14-18 ?', 'What nickname was given to French soldiers of the First World War?', array['Les poilus', 'Les barbus', 'Les tondus', 'Les chevelus']::text[], array['Les poilus, “the hairy ones”', 'The bearded ones', 'The shorn ones', 'The long-haired ones']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Comment se débarrasse-t-on vraiment des pointes fourchues ?', 'How do you really get rid of split ends?', array['En les coupant', 'Avec un shampoing', 'Avec du gel', 'En les brossant fort']::text[], array['By cutting them off', 'With shampoo', 'With gel', 'By brushing hard']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'La coupe « curtains » des années 90 se reconnaît à...', 'The 1990s “curtains” haircut is recognisable by...', array['Sa raie au milieu', 'Son crâne rasé', 'Sa crête', 'Ses tresses collées']::text[], array['Its middle parting', 'Its shaved head', 'Its crest', 'Its cornrows']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Un rasoir de sûreté traditionnel « double edge » utilise...', 'A traditional double-edge safety razor uses...', array['Une lame à deux tranchants', 'Trois lames', 'Cinq lames', 'Aucune lame']::text[], array['One blade with two edges', 'Three blades', 'Five blades', 'No blade']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Que veut dire « à un cheveu près » ?', 'What does the French phrase « à un cheveu près » mean?', array['De justesse', 'Avec beaucoup d’avance', 'Chez le coiffeur', 'En se rasant']::text[], array['By a whisker', 'With plenty of margin', 'At the hairdresser’s', 'While shaving']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('barber', 'Que veut dire « se faire des cheveux blancs » ?', 'What does the French phrase « se faire des cheveux blancs » mean?', array['S’inquiéter beaucoup', 'Se teindre en blond', 'Aller chez le barbier', 'Prendre sa retraite']::text[], array['To worry a lot', 'To dye your hair blond', 'To go to the barber', 'To retire']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Comment s’appelait le groupe qui accompagnait Bob Marley ?', 'What was the name of Bob Marley’s band?', array['The Wailers', 'The Specials', 'UB40', 'The Police']::text[], array['The Wailers', 'The Specials', 'UB40', 'The Police']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel album de Nirvana montre un bébé qui nage vers un billet d’un dollar ?', 'Which Nirvana album shows a baby swimming towards a dollar bill?', array['Nevermind', 'In Utero', 'Bleach', 'Unplugged in New York']::text[], array['Nevermind', 'In Utero', 'Bleach', 'Unplugged in New York']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quelle ville anglaise viennent les Beatles ?', 'Which English city are the Beatles from?', array['Liverpool', 'Manchester', 'Londres', 'Birmingham']::text[], array['Liverpool', 'Manchester', 'London', 'Birmingham']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Lequel de ces musiciens n’a jamais fait partie des Beatles ?', 'Which of these musicians was never a Beatle?', array['Mick Jagger', 'John Lennon', 'Ringo Starr', 'George Harrison']::text[], array['Mick Jagger', 'John Lennon', 'Ringo Starr', 'George Harrison']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui est le chanteur du groupe irlandais U2 ?', 'Who is the singer of the Irish band U2?', array['Bono', 'The Edge', 'Sting', 'Liam Gallagher']::text[], array['Bono', 'The Edge', 'Sting', 'Liam Gallagher']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quels frères étaient au cœur du groupe Oasis ?', 'Which brothers were at the heart of Oasis?', array['Les Gallagher', 'Les Jackson', 'Les Young', 'Les Davies']::text[], array['The Gallaghers', 'The Jacksons', 'The Youngs', 'The Davieses']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans quel pays le groupe AC/DC a-t-il été formé ?', 'In which country was AC/DC formed?', array['L’Australie', 'Le Royaume-Uni', 'Les États-Unis', 'Le Canada']::text[], array['Australia', 'The United Kingdom', 'The United States', 'Canada']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Freddie Mercury, chanteur de Queen, est né sur quelle île ?', 'Freddie Mercury, Queen’s singer, was born on which island?', array['Zanzibar', 'Madagascar', 'Chypre', 'Malte']::text[], array['Zanzibar', 'Madagascar', 'Cyprus', 'Malta']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel est le vrai nom d’Eminem ?', 'What is Eminem’s real name?', array['Marshall Mathers', 'Shawn Carter', 'Curtis Jackson', 'Calvin Broadus']::text[], array['Marshall Mathers', 'Shawn Carter', 'Curtis Jackson', 'Calvin Broadus']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse est mariée au rappeur Jay-Z ?', 'Which singer is married to the rapper Jay-Z?', array['Beyoncé', 'Rihanna', 'Alicia Keys', 'Nicki Minaj']::text[], array['Beyoncé', 'Rihanna', 'Alicia Keys', 'Nicki Minaj']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quelle île des Caraïbes vient Rihanna ?', 'Which Caribbean island does Rihanna come from?', array['La Barbade', 'La Jamaïque', 'Trinité-et-Tobago', 'Les Bahamas']::text[], array['Barbados', 'Jamaica', 'Trinidad and Tobago', 'The Bahamas']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le groupe de rap IAM vient de quelle ville ?', 'Which city does the rap group IAM come from?', array['Marseille', 'Paris', 'Lyon', 'Toulouse']::text[], array['Marseille', 'Paris', 'Lyon', 'Toulouse']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Suprême NTM, c’est JoeyStarr et qui d’autre ?', 'Suprême NTM is JoeyStarr and who else?', array['Kool Shen', 'Akhenaton', 'Oxmo Puccino', 'MC Solaar']::text[], array['Kool Shen', 'Akhenaton', 'Oxmo Puccino', 'MC Solaar']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le rappeur belge Damso est né dans quelle ville ?', 'In which city was the Belgian rapper Damso born?', array['Kinshasa', 'Bruxelles', 'Liège', 'Abidjan']::text[], array['Kinshasa', 'Brussels', 'Liège', 'Abidjan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel rappeur bruxellois se surnomme le « SauceGod » ?', 'Which Brussels rapper calls himself the “SauceGod”?', array['Hamza', 'Damso', 'Caballero', 'Roméo Elvis']::text[], array['Hamza', 'Damso', 'Caballero', 'Roméo Elvis']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel rappeur belge est le frère d’Angèle ?', 'Which Belgian rapper is Angèle’s brother?', array['Roméo Elvis', 'Damso', 'Hamza', 'JeanJass']::text[], array['Roméo Elvis', 'Damso', 'Hamza', 'JeanJass']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Comment s’appelle le premier album d’Angèle, sorti en 2018 ?', 'What is the title of Angèle’s first album, released in 2018?', array['Brol', 'Nonante-Cinq', 'Cheese', 'Racine carrée']::text[], array['Brol', 'Nonante-Cinq', 'Cheese', 'Racine carrée']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur quel album de Stromae trouve-t-on « Papaoutai » ?', 'Which Stromae album features “Papaoutai”?', array['Racine carrée', 'Cheese', 'Multitude', 'Brol']::text[], array['Racine carrée', 'Cheese', 'Multitude', 'Brol']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le nom « Stromae » est le verlan de quel mot ?', 'The name “Stromae” is French backslang for which word?', array['Maestro', 'Mystère', 'Marteau', 'Trésor']::text[], array['Maestro', 'Mystère', 'Marteau', 'Trésor']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le festival Pukkelpop se déroule près de quelle ville ?', 'The Pukkelpop festival takes place near which city?', array['Hasselt', 'Gand', 'Anvers', 'Louvain']::text[], array['Hasselt', 'Ghent', 'Antwerp', 'Leuven']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans quelle ville se tient le festival Les Ardentes ?', 'In which city is the Les Ardentes festival held?', array['Liège', 'Namur', 'Charleroi', 'Mons']::text[], array['Liège', 'Namur', 'Charleroi', 'Mons']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Les Francofolies de Belgique ont lieu chaque été dans quelle ville ?', 'Belgium’s Francofolies festival takes place every summer in which town?', array['Spa', 'Durbuy', 'Namur', 'Arlon']::text[], array['Spa', 'Durbuy', 'Namur', 'Arlon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le Graspop Metal Meeting se déroule dans quelle commune ?', 'The Graspop Metal Meeting takes place in which Belgian town?', array['Dessel', 'Boom', 'Ostende', 'Hasselt']::text[], array['Dessel', 'Boom', 'Ostend', 'Hasselt']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le festival Couleur Café se déroule dans quelle ville ?', 'In which city does the Couleur Café festival take place?', array['Bruxelles', 'Liège', 'Gand', 'Charleroi']::text[], array['Brussels', 'Liège', 'Ghent', 'Charleroi']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui a remporté l’Eurovision 1986 pour la Belgique avec « J’aime la vie » ?', 'Who won Eurovision 1986 for Belgium with “J’aime la vie”?', array['Sandra Kim', 'Lara Fabian', 'Axelle Red', 'Lio']::text[], array['Sandra Kim', 'Lara Fabian', 'Axelle Red', 'Lio']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel groupe a enregistré « Stairway to Heaven » en 1971 ?', 'Which band recorded “Stairway to Heaven” in 1971?', array['Led Zeppelin', 'Deep Purple', 'Black Sabbath', 'The Who']::text[], array['Led Zeppelin', 'Deep Purple', 'Black Sabbath', 'The Who']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Jacques Brel est enterré sur quelle île des Marquises ?', 'Jacques Brel is buried on which island of the Marquesas?', array['Hiva Oa', 'Tahiti', 'Bora Bora', 'Nuku Hiva']::text[], array['Hiva Oa', 'Tahiti', 'Bora Bora', 'Nuku Hiva']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quel instrument jouait le jazzman belge Toots Thielemans ?', 'Which instrument did the Belgian jazzman Toots Thielemans play?', array['L’harmonica', 'Le saxophone', 'La trompette', 'L’accordéon']::text[], array['The harmonica', 'The saxophone', 'The trumpet', 'The accordion']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le guitariste de jazz Django Reinhardt est né dans quel pays ?', 'In which country was jazz guitarist Django Reinhardt born?', array['La Belgique', 'La France', 'La Roumanie', 'L’Espagne']::text[], array['Belgium', 'France', 'Romania', 'Spain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Combien de cordes compte un violon ?', 'How many strings does a violin have?', array['4', '5', '6', '3']::text[], array['4', '5', '6', '3']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le tube « Pump Up the Jam » de Technotronic vient de quel pays ?', 'Which country does Technotronic’s hit “Pump Up the Jam” come from?', array['La Belgique', 'Les Pays-Bas', 'L’Allemagne', 'Le Royaume-Uni']::text[], array['Belgium', 'The Netherlands', 'Germany', 'The United Kingdom']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Les DJ belges Dimitri Vegas & Like Mike sont...', 'The Belgian DJs Dimitri Vegas & Like Mike are...', array['Frères', 'Cousins', 'Père et fils', 'Voisins d’enfance']::text[], array['Brothers', 'Cousins', 'Father and son', 'Childhood neighbours']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Combien de notes différentes compte la gamme de do majeur ?', 'How many different notes are in the C major scale?', array['7', '5', '8', '12']::text[], array['7', '5', '8', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur une partition, que signifie « forte » ?', 'On a music score, what does “forte” mean?', array['Jouer fort', 'Jouer doucement', 'Jouer vite', 'Jouer lentement']::text[], array['Play loudly', 'Play softly', 'Play fast', 'Play slowly']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'À quelle fréquence vibre le « la » du diapason standard ?', 'At what frequency does the standard tuning A vibrate?', array['440 Hz', '220 Hz', '500 Hz', '1000 Hz']::text[], array['440 Hz', '220 Hz', '500 Hz', '1000 Hz']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'En notation anglaise, la note « la » s’écrit...', 'In letter notation, what is the French note “la”?', array['A', 'C', 'E', 'G']::text[], array['A', 'C', 'E', 'G']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Lequel de ces instruments en métal fait partie de la famille des bois ?', 'Which of these metal instruments belongs to the woodwind family?', array['Le saxophone', 'La trompette', 'Le trombone', 'Le tuba']::text[], array['The saxophone', 'The trumpet', 'The trombone', 'The tuba']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans quelle ville est né Mozart ?', 'In which city was Mozart born?', array['Salzbourg', 'Vienne', 'Munich', 'Prague']::text[], array['Salzburg', 'Vienna', 'Munich', 'Prague']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel compositeur a écrit « Les Quatre Saisons » ?', 'Which composer wrote “The Four Seasons”?', array['Vivaldi', 'Mozart', 'Bach', 'Haendel']::text[], array['Vivaldi', 'Mozart', 'Bach', 'Handel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Frédéric Chopin a surtout composé pour quel instrument ?', 'Frédéric Chopin mainly composed for which instrument?', array['Le piano', 'Le violon', 'L’orgue', 'La flûte']::text[], array['The piano', 'The violin', 'The organ', 'The flute']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel compositeur français a écrit le célèbre « Boléro » ?', 'Which French composer wrote the famous “Boléro”?', array['Maurice Ravel', 'Claude Debussy', 'Erik Satie', 'Georges Bizet']::text[], array['Maurice Ravel', 'Claude Debussy', 'Erik Satie', 'Georges Bizet']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'L’« Ode à la joie », hymne européen, vient d’une symphonie de...', 'The “Ode to Joy”, Europe’s anthem, comes from a symphony by...', array['Beethoven', 'Mozart', 'Schubert', 'Brahms']::text[], array['Beethoven', 'Mozart', 'Schubert', 'Brahms']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quel instrument jouait Louis Armstrong ?', 'Which instrument did Louis Armstrong play?', array['La trompette', 'Le saxophone', 'La clarinette', 'Le trombone']::text[], array['The trumpet', 'The saxophone', 'The clarinet', 'The trombone']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel jazzman a enregistré l’album « Kind of Blue » en 1959 ?', 'Which jazzman recorded the album “Kind of Blue” in 1959?', array['Miles Davis', 'Charlie Parker', 'Duke Ellington', 'Louis Armstrong']::text[], array['Miles Davis', 'Charlie Parker', 'Duke Ellington', 'Louis Armstrong']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans quelle ville américaine le jazz est-il né ?', 'In which American city was jazz born?', array['La Nouvelle-Orléans', 'Chicago', 'New York', 'Memphis']::text[], array['New Orleans', 'Chicago', 'New York', 'Memphis']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel style jamaïcain a précédé le reggae ?', 'Which Jamaican style came before reggae?', array['Le ska', 'Le zouk', 'La salsa', 'La bossa nova']::text[], array['Ska', 'Zouk', 'Salsa', 'Bossa nova']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'À quel âge Bob Marley est-il mort, en 1981 ?', 'How old was Bob Marley when he died in 1981?', array['36 ans', '27 ans', '45 ans', '52 ans']::text[], array['36', '27', '45', '52']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel âge avaient Kurt Cobain, Jimi Hendrix et Amy Winehouse à leur mort ?', 'How old were Kurt Cobain, Jimi Hendrix and Amy Winehouse when they died?', array['27 ans', '25 ans', '30 ans', '33 ans']::text[], array['27', '25', '30', '33']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur quel album d’Amy Winehouse trouve-t-on « Rehab » ?', 'Which Amy Winehouse album features “Rehab”?', array['Back to Black', 'Frank', 'Lioness', '21']::text[], array['Back to Black', 'Frank', 'Lioness', '21']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Les albums d’Adele (19, 21, 25, 30) portent le nom de...', 'Adele’s albums (19, 21, 25, 30) are named after...', array['Son âge à l’époque', 'Ses dates de concert', 'Ses numéros de maison', 'Ses ventes en millions']::text[], array['Her age at the time', 'Her concert dates', 'Her house numbers', 'Her sales in millions']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Les albums d’Ed Sheeran portent des noms de...', 'Ed Sheeran’s albums are named after...', array['Symboles mathématiques', 'Couleurs', 'Villes anglaises', 'Prénoms']::text[], array['Mathematical symbols', 'Colours', 'English cities', 'First names']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'L’album « 1989 » de Taylor Swift doit son nom à...', 'Taylor Swift’s album “1989” is named after...', array['Son année de naissance', 'Sa première tournée', 'Son premier concert', 'La chute du mur de Berlin']::text[], array['Her birth year', 'Her first tour', 'Her first concert', 'The fall of the Berlin Wall']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel est le prénom du frère de Billie Eilish, qui produit ses chansons ?', 'What is the name of Billie Eilish’s brother, who produces her songs?', array['Finneas', 'Khalid', 'Jaden', 'Noah']::text[], array['Finneas', 'Khalid', 'Jaden', 'Noah']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'De quel pays vient The Weeknd, chanteur de « Blinding Lights » ?', 'Which country is The Weeknd, singer of “Blinding Lights”, from?', array['Le Canada', 'Les États-Unis', 'Le Royaume-Uni', 'L’Australie']::text[], array['Canada', 'The United States', 'The United Kingdom', 'Australia']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Luis Fonsi, interprète de « Despacito », est originaire de...', 'Luis Fonsi, the singer of “Despacito”, comes from...', array['Porto Rico', 'Mexique', 'Colombie', 'Espagne']::text[], array['Puerto Rico', 'Mexico', 'Colombia', 'Spain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Complète le titre de Prince : « ___ Rain »', 'Complete the Prince song title: “___ Rain”', array['Purple', 'Black', 'Red', 'Blue']::text[], array['Purple', 'Black', 'Red', 'Blue']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Graceland, la célèbre maison d’Elvis Presley, se trouve dans quelle ville ?', 'Graceland, Elvis Presley’s famous home, is in which city?', array['Memphis', 'Nashville', 'Las Vegas', 'La Nouvelle-Orléans']::text[], array['Memphis', 'Nashville', 'Las Vegas', 'New Orleans']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le père de Johnny Hallyday était de quelle nationalité ?', 'What nationality was Johnny Hallyday’s father?', array['Belge', 'Américain', 'Suisse', 'Italien']::text[], array['Belgian', 'American', 'Swiss', 'Italian']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse était surnommée « la Môme » ?', 'Which singer was nicknamed “la Môme” (the Kid)?', array['Édith Piaf', 'Dalida', 'Barbara', 'Juliette Gréco']::text[], array['Édith Piaf', 'Dalida', 'Barbara', 'Juliette Gréco']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Charlotte Gainsbourg est la fille de Serge Gainsbourg et de...', 'Charlotte Gainsbourg is the daughter of Serge Gainsbourg and...', array['Jane Birkin', 'Brigitte Bardot', 'France Gall', 'Françoise Hardy']::text[], array['Jane Birkin', 'Brigitte Bardot', 'France Gall', 'Françoise Hardy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui est le chanteur du groupe Indochine ?', 'Who is the singer of the band Indochine?', array['Nicola Sirkis', 'Jean-Louis Aubert', 'Bertrand Cantat', 'Matthieu Chedid']::text[], array['Nicola Sirkis', 'Jean-Louis Aubert', 'Bertrand Cantat', 'Matthieu Chedid']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse a cartonné avec « Djadja » ?', 'Which singer had a big hit with “Djadja”?', array['Aya Nakamura', 'Wejdene', 'Angèle', 'Louane']::text[], array['Aya Nakamura', 'Wejdene', 'Angèle', 'Louane']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur quel album de Daft Punk trouve-t-on « Get Lucky » ?', 'Which Daft Punk album features “Get Lucky”?', array['Random Access Memories', 'Discovery', 'Homework', 'Human After All']::text[], array['Random Access Memories', 'Discovery', 'Homework', 'Human After All']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse australienne chante sur « Titanium » de David Guetta ?', 'Which Australian singer features on David Guetta’s “Titanium”?', array['Sia', 'Kylie Minogue', 'Rita Ora', 'Dua Lipa']::text[], array['Sia', 'Kylie Minogue', 'Rita Ora', 'Dua Lipa']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel pas de danse Michael Jackson a-t-il rendu célèbre en 1983 ?', 'Which dance move did Michael Jackson make famous in 1983?', array['Le moonwalk', 'Le twist', 'Le robot', 'Le dab']::text[], array['The moonwalk', 'The twist', 'The robot', 'The dab']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel album de Pink Floyd a un prisme sur sa pochette ?', 'Which Pink Floyd album has a prism on its cover?', array['The Dark Side of the Moon', 'The Wall', 'Wish You Were Here', 'Animals']::text[], array['The Dark Side of the Moon', 'The Wall', 'Wish You Were Here', 'Animals']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur quelle pochette les Beatles traversent-ils un passage piéton ?', 'On which album cover do the Beatles walk across a zebra crossing?', array['Abbey Road', 'Revolver', 'Help!', 'Let It Be']::text[], array['Abbey Road', 'Revolver', 'Help!', 'Let It Be']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel guitariste de Guns N’ Roses porte un chapeau haut de forme ?', 'Which Guns N’ Roses guitarist wears a top hat?', array['Slash', 'Angus Young', 'Jimmy Page', 'The Edge']::text[], array['Slash', 'Angus Young', 'Jimmy Page', 'The Edge']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans le rap, que veut dire « MC » ?', 'In rap, what does “MC” stand for?', array['Master of Ceremonies', 'Music Creator', 'Microphone Controller', 'Mix Champion']::text[], array['Master of Ceremonies', 'Music Creator', 'Microphone Controller', 'Mix Champion']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel rappeur a reçu le prix Pulitzer de musique en 2018 ?', 'Which rapper won the Pulitzer Prize for Music in 2018?', array['Kendrick Lamar', 'Drake', 'Kanye West', 'Jay-Z']::text[], array['Kendrick Lamar', 'Drake', 'Kanye West', 'Jay-Z']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel chanteur, aveugle depuis l’enfance, a signé « Superstition » ?', 'Which singer, blind since childhood, wrote “Superstition”?', array['Stevie Wonder', 'Lionel Richie', 'James Brown', 'Barry White']::text[], array['Stevie Wonder', 'Lionel Richie', 'James Brown', 'Barry White']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Combien de notes différentes compte un accord parfait majeur ?', 'How many different notes are in a basic major chord?', array['3', '2', '5', '7']::text[], array['3', '2', '5', '7']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Sur une partition, que fait un dièse placé devant une note ?', 'On a score, what does a sharp in front of a note do?', array['Il la monte d’un demi-ton', 'Il la baisse d’un demi-ton', 'Il double sa durée', 'Il la rend muette']::text[], array['Raises it by a semitone', 'Lowers it by a semitone', 'Doubles its length', 'Silences it']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Avec quelle chanson ABBA a-t-il gagné l’Eurovision 1974 ?', 'With which song did ABBA win Eurovision 1974?', array['Waterloo', 'Dancing Queen', 'Mamma Mia', 'SOS']::text[], array['Waterloo', 'Dancing Queen', 'Mamma Mia', 'SOS']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Céline Dion a gagné l’Eurovision 1988 en représentant quel pays ?', 'Céline Dion won Eurovision 1988 representing which country?', array['La Suisse', 'Le Canada', 'La France', 'Le Luxembourg']::text[], array['Switzerland', 'Canada', 'France', 'Luxembourg']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', '« My Heart Will Go On » de Céline Dion est la chanson de quel film ?', 'Céline Dion’s “My Heart Will Go On” is the song from which film?', array['Titanic', 'Bodyguard', 'Pretty Woman', 'Ghost']::text[], array['Titanic', 'The Bodyguard', 'Pretty Woman', 'Ghost']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel format Sony et Philips ont-ils lancé au début des années 1980 ?', 'Which format did Sony and Philips launch in the early 1980s?', array['Le CD', 'La cassette', 'Le vinyle', 'Le MP3']::text[], array['The CD', 'The cassette', 'The vinyl record', 'The MP3']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel clip a été le tout premier diffusé par MTV en 1981 ?', 'Which music video was the very first one aired on MTV in 1981?', array['Video Killed the Radio Star', 'Thriller', 'Billie Jean', 'Take On Me']::text[], array['Video Killed the Radio Star', 'Thriller', 'Billie Jean', 'Take On Me']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'En quelle année s’est tenu le légendaire festival de Woodstock ?', 'In which year was the legendary Woodstock festival held?', array['1969', '1959', '1975', '1982']::text[], array['1969', '1959', '1975', '1982']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Spotify a été créé dans quel pays ?', 'In which country was Spotify founded?', array['La Suède', 'Les États-Unis', 'L’Allemagne', 'La Finlande']::text[], array['Sweden', 'The United States', 'Germany', 'Finland']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel chanteur de Blur a cocréé le groupe virtuel Gorillaz ?', 'Which Blur singer co-created the virtual band Gorillaz?', array['Damon Albarn', 'Thom Yorke', 'Liam Gallagher', 'Jarvis Cocker']::text[], array['Damon Albarn', 'Thom Yorke', 'Liam Gallagher', 'Jarvis Cocker']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel groupe anglais a percé en 1992 avec « Creep » ?', 'Which English band broke through in 1992 with “Creep”?', array['Radiohead', 'Coldplay', 'Muse', 'Oasis']::text[], array['Radiohead', 'Coldplay', 'Muse', 'Oasis']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel chanteur est invité par Mark Ronson sur « Uptown Funk » ?', 'Which singer features on Mark Ronson’s “Uptown Funk”?', array['Bruno Mars', 'Pharrell Williams', 'Justin Timberlake', 'Usher']::text[], array['Bruno Mars', 'Pharrell Williams', 'Justin Timberlake', 'Usher']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel chanteur français a créé « La Bohème » ?', 'Which French singer first recorded “La Bohème”?', array['Charles Aznavour', 'Georges Brassens', 'Léo Ferré', 'Gilbert Bécaud']::text[], array['Charles Aznavour', 'Georges Brassens', 'Léo Ferré', 'Gilbert Bécaud']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', '« My Way » de Frank Sinatra est l’adaptation d’une chanson de...', 'Frank Sinatra’s “My Way” is adapted from a song by...', array['Claude François', 'Johnny Hallyday', 'Michel Sardou', 'Joe Dassin']::text[], array['Claude François', 'Johnny Hallyday', 'Michel Sardou', 'Joe Dassin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse a cartonné avec « Dernière danse » ?', 'Which singer had a big hit with “Dernière danse”?', array['Indila', 'Zaz', 'Louane', 'Christine and the Queens']::text[], array['Indila', 'Zaz', 'Louane', 'Christine and the Queens']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Le groupe de rock belge dEUS vient de quelle ville ?', 'Which city does the Belgian rock band dEUS come from?', array['Anvers', 'Bruxelles', 'Liège', 'Gand']::text[], array['Antwerp', 'Brussels', 'Liège', 'Ghent']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'En quelle année a eu lieu la toute première édition de Tomorrowland ?', 'In which year did the very first Tomorrowland take place?', array['2005', '1995', '2000', '2010']::text[], array['2005', '1995', '2000', '2010']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel musicien français a sorti l’album électronique « Oxygène » en 1976 ?', 'Which French musician released the electronic album “Oxygène” in 1976?', array['Jean-Michel Jarre', 'David Guetta', 'Bob Sinclar', 'Thomas Bangalter']::text[], array['Jean-Michel Jarre', 'David Guetta', 'Bob Sinclar', 'Thomas Bangalter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel mouvement spirituel est souvent associé au reggae de Bob Marley ?', 'Which spiritual movement is often linked to Bob Marley’s reggae?', array['Le rastafarisme', 'Le bouddhisme', 'Le vaudou', 'L’hindouisme']::text[], array['Rastafari', 'Buddhism', 'Voodoo', 'Hinduism']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Alpha Blondy, star du reggae africain, est originaire de quel pays ?', 'Alpha Blondy, a star of African reggae, comes from which country?', array['La Côte d’Ivoire', 'Le Sénégal', 'Le Mali', 'Le Cameroun']::text[], array['Ivory Coast', 'Senegal', 'Mali', 'Cameroon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel rappeur français chante « Caroline », un classique des années 1990 ?', 'Which French rapper sings “Caroline”, a 1990s classic?', array['MC Solaar', 'Booba', 'Oxmo Puccino', 'Doc Gynéco']::text[], array['MC Solaar', 'Booba', 'Oxmo Puccino', 'Doc Gynéco']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Gims s’est d’abord fait connaître au sein de quel groupe ?', 'Gims first became known as a member of which group?', array['Sexion d’Assaut', 'Suprême NTM', 'IAM', 'PNL']::text[], array['Sexion d’Assaut', 'Suprême NTM', 'IAM', 'PNL']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel rappeur belge forme un célèbre duo avec JeanJass ?', 'Which Belgian rapper forms a famous duo with JeanJass?', array['Caballero', 'Hamza', 'Damso', 'Roméo Elvis']::text[], array['Caballero', 'Hamza', 'Damso', 'Roméo Elvis']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quelle chanteuse a sorti le tube « Banana Split » en 1979 ?', 'Which singer released the hit “Banana Split” in 1979?', array['Lio', 'Jeanne Mas', 'Vanessa Paradis', 'Mylène Farmer']::text[], array['Lio', 'Jeanne Mas', 'Vanessa Paradis', 'Mylène Farmer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Dans le Hainaut, le Ronquières Festival se tient au pied de quel ouvrage ?', 'In Hainaut, the Ronquières Festival is held at the foot of which structure?', array['Le plan incliné', 'Le beffroi', 'Un château fort', 'Un barrage']::text[], array['The inclined plane', 'The belfry', 'A castle', 'A dam']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel chanteur a reçu le prix Nobel de littérature en 2016 ?', 'Which singer won the Nobel Prize in Literature in 2016?', array['Bob Dylan', 'Leonard Cohen', 'Bruce Springsteen', 'Paul McCartney']::text[], array['Bob Dylan', 'Leonard Cohen', 'Bruce Springsteen', 'Paul McCartney']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Quel groupe a sorti « Seven Nation Army », repris dans tous les stades ?', 'Which band released “Seven Nation Army”, chanted in stadiums everywhere?', array['The White Stripes', 'The Strokes', 'Arctic Monkeys', 'The Killers']::text[], array['The White Stripes', 'The Strokes', 'Arctic Monkeys', 'The Killers']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', '« Happy » de Pharrell Williams a été écrite pour quel film d’animation ?', 'Pharrell Williams’s “Happy” was written for which animated film?', array['Moi, moche et méchant 2', 'La Reine des neiges', 'Shrek 2', 'Madagascar']::text[], array['Despicable Me 2', 'Frozen', 'Shrek 2', 'Madagascar']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('music', 'Qui chante le tube de Noël « All I Want for Christmas Is You » (1994) ?', 'Who sings the Christmas hit “All I Want for Christmas Is You” (1994)?', array['Mariah Carey', 'Whitney Houston', 'Céline Dion', 'Christina Aguilera']::text[], array['Mariah Carey', 'Whitney Houston', 'Céline Dion', 'Christina Aguilera']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la capitale de l’Australie ?', 'What is the capital of Australia?', array['Canberra', 'Sydney', 'Melbourne', 'Perth']::text[], array['Canberra', 'Sydney', 'Melbourne', 'Perth']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus long fleuve coulant entièrement en France ?', 'What is the longest river flowing entirely within France?', array['La Loire', 'La Seine', 'La Garonne', 'La Dordogne']::text[], array['The Loire', 'The Seine', 'The Garonne', 'The Dordogne']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Dans quelle chaîne de montagnes se trouve l’Everest ?', 'In which mountain range is Mount Everest?', array['L’Himalaya', 'Les Andes', 'Les Alpes', 'Les Rocheuses']::text[], array['The Himalayas', 'The Andes', 'The Alps', 'The Rockies']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel fleuve traverse la ville de Liège ?', 'Which river flows through the city of Liège?', array['La Meuse', 'L’Escaut', 'La Sambre', 'L’Yser']::text[], array['The Meuse', 'The Scheldt', 'The Sambre', 'The Yser']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le point culminant de la Belgique ?', 'What is the highest point in Belgium?', array['Le signal de Botrange', 'Le mont Kemmel', 'Le mont de l’Enclus', 'La citadelle de Namur']::text[], array['Signal de Botrange', 'Mount Kemmel', 'Kluisberg', 'Namur Citadel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand désert chaud du monde ?', 'What is the largest hot desert in the world?', array['Le Sahara', 'Le désert de Gobi', 'Le Kalahari', 'L’Atacama']::text[], array['The Sahara', 'The Gobi Desert', 'The Kalahari', 'The Atacama']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la capitale du Canada ?', 'What is the capital of Canada?', array['Ottawa', 'Toronto', 'Montréal', 'Vancouver']::text[], array['Ottawa', 'Toronto', 'Montreal', 'Vancouver']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus haut sommet d’Afrique ?', 'What is the highest mountain in Africa?', array['Le Kilimandjaro', 'Le mont Kenya', 'Le mont Cameroun', 'Le Toubkal']::text[], array['Kilimanjaro', 'Mount Kenya', 'Mount Cameroon', 'Toubkal']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel détroit sépare l’Espagne du Maroc ?', 'Which strait separates Spain from Morocco?', array['Le détroit de Gibraltar', 'Le détroit du Bosphore', 'Le pas de Calais', 'Le détroit de Messine']::text[], array['The Strait of Gibraltar', 'The Bosphorus', 'The Strait of Dover', 'The Strait of Messina']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Avec combien de pays la Belgique partage-t-elle une frontière terrestre ?', 'How many countries share a land border with Belgium?', array['4', '3', '5', '6']::text[], array['4', '3', '5', '6']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle ville est la capitale de la Wallonie ?', 'Which city is the capital of Wallonia?', array['Namur', 'Liège', 'Charleroi', 'Mons']::text[], array['Namur', 'Liège', 'Charleroi', 'Mons']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle langue parle-t-on principalement au Brésil ?', 'What is the main language spoken in Brazil?', array['Le portugais', 'L’espagnol', 'Le brésilien', 'L’italien']::text[], array['Portuguese', 'Spanish', 'Brazilian', 'Italian']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel pays a pour capitale Lisbonne ?', 'Which country has Lisbon as its capital?', array['Le Portugal', 'L’Espagne', 'Le Brésil', 'L’Italie']::text[], array['Portugal', 'Spain', 'Brazil', 'Italy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel métal est liquide à température ambiante ?', 'Which metal is liquid at room temperature?', array['Le mercure', 'Le plomb', 'L’étain', 'Le zinc']::text[], array['Mercury', 'Lead', 'Tin', 'Zinc']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel groupe sanguin est appelé « donneur universel » ?', 'Which blood type is known as the “universal donor”?', array['O négatif', 'AB positif', 'A positif', 'B négatif']::text[], array['O negative', 'AB positive', 'A positive', 'B negative']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui fut le premier roi des Belges ?', 'Who was the first King of the Belgians?', array['Léopold Ier', 'Albert Ier', 'Léopold II', 'Baudouin Ier']::text[], array['Leopold I', 'Albert I', 'Leopold II', 'Baudouin I']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Le Belge Ernest Solvay a fait fortune en produisant quoi ?', 'Belgian Ernest Solvay made his fortune producing what?', array['De la soude', 'De l’acier', 'Du verre', 'Du charbon']::text[], array['Soda ash', 'Steel', 'Glass', 'Coal']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel roi a succédé à Baudouin en 1993 ?', 'Which king succeeded Baudouin in 1993?', array['Albert II', 'Philippe', 'Léopold III', 'Albert Ier']::text[], array['Albert II', 'Philippe', 'Leopold III', 'Albert I']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année Philippe est-il devenu roi des Belges ?', 'In which year did Philippe become King of the Belgians?', array['2013', '2009', '2016', '2001']::text[], array['2013', '2009', '2016', '2001']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Selon Jules César, quel peuple était « le plus brave » de la Gaule ?', 'According to Julius Caesar, which people were “the bravest” in Gaul?', array['Les Belges', 'Les Helvètes', 'Les Arvernes', 'Les Bretons']::text[], array['The Belgae', 'The Helvetii', 'The Arverni', 'The Britons']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Dans quelle ville est né l’empereur Charles Quint, en 1500 ?', 'In which city was Emperor Charles V born, in 1500?', array['Gand', 'Bruxelles', 'Madrid', 'Vienne']::text[], array['Ghent', 'Brussels', 'Madrid', 'Vienna']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel peintre belge a écrit « Ceci n’est pas une pipe » sous une pipe ?', 'Which Belgian painter wrote “This is not a pipe” under a pipe?', array['René Magritte', 'Paul Delvaux', 'James Ensor', 'Pierre Paul Rubens']::text[], array['René Magritte', 'Paul Delvaux', 'James Ensor', 'Peter Paul Rubens']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel traité signé en 1957 a fondé la Communauté économique européenne ?', 'Which 1957 treaty founded the European Economic Community?', array['Le traité de Rome', 'Le traité de Maastricht', 'Le traité de Lisbonne', 'Le traité de Versailles']::text[], array['The Treaty of Rome', 'The Maastricht Treaty', 'The Treaty of Lisbon', 'The Treaty of Versailles']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel dessinateur belge a créé Gaston Lagaffe ?', 'Which Belgian artist created Gaston Lagaffe?', array['André Franquin', 'Hergé', 'Morris', 'Peyo']::text[], array['André Franquin', 'Hergé', 'Morris', 'Peyo']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel dessinateur belge a créé Lucky Luke ?', 'Which Belgian artist created Lucky Luke?', array['Morris', 'Franquin', 'Roba', 'Hergé']::text[], array['Morris', 'Franquin', 'Roba', 'Hergé']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel pays a remporté la Coupe du monde de football 2014 ?', 'Which country won the 2014 football World Cup?', array['L’Allemagne', 'L’Argentine', 'Le Brésil', 'L’Espagne']::text[], array['Germany', 'Argentina', 'Brazil', 'Spain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment s’appelle le château du capitaine Haddock ?', 'What is the name of Captain Haddock’s castle?', array['Moulinsart', 'Champignac', 'Chambord', 'Windsor']::text[], array['Marlinspike Hall', 'Champignac', 'Chambord', 'Windsor']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment s’appelle l’écureuil de Spirou ?', 'What is the name of Spirou’s squirrel?', array['Spip', 'Fantasio', 'Zorglub', 'Marsupilami']::text[], array['Spip', 'Fantasio', 'Zorglub', 'Marsupilami']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel auteur belge a créé Boule et Bill ?', 'Which Belgian author created Boule et Bill?', array['Jean Roba', 'André Franquin', 'Peyo', 'Morris']::text[], array['Jean Roba', 'André Franquin', 'Peyo', 'Morris']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel auteur belge a créé la BD « Le Chat » ?', 'Which Belgian author created the comic “Le Chat”?', array['Philippe Geluck', 'André Franquin', 'Hergé', 'François Walthéry']::text[], array['Philippe Geluck', 'André Franquin', 'Hergé', 'François Walthéry']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel scénariste belge a écrit les séries XIII et Thorgal ?', 'Which Belgian writer scripted the comics XIII and Thorgal?', array['Jean Van Hamme', 'René Goscinny', 'Hergé', 'Raoul Cauvin']::text[], array['Jean Van Hamme', 'René Goscinny', 'Hergé', 'Raoul Cauvin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le symbole chimique de l’or ?', 'What is the chemical symbol for gold?', array['Au', 'Ag', 'Fe', 'Pb']::text[], array['Au', 'Ag', 'Fe', 'Pb']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Environ quelle distance la lumière parcourt-elle en une seconde ?', 'Roughly how far does light travel in one second?', array['300 000 km', '30 000 km', '3 000 km', '3 millions de km']::text[], array['300,000 km', '30,000 km', '3,000 km', '3 million km']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien d’os compte le squelette d’un adulte ?', 'How many bones are in an adult human skeleton?', array['206', '186', '226', '306']::text[], array['206', '186', '226', '306']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand organe du corps humain ?', 'What is the largest organ of the human body?', array['La peau', 'Le foie', 'Les poumons', 'Le cerveau']::text[], array['The skin', 'The liver', 'The lungs', 'The brain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel gaz les plantes absorbent-elles pour la photosynthèse ?', 'Which gas do plants absorb for photosynthesis?', array['Le dioxyde de carbone', 'L’oxygène', 'L’azote', 'L’hélium']::text[], array['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de chromosomes possède une cellule humaine normale ?', 'How many chromosomes does a normal human cell have?', array['46', '23', '48', '44']::text[], array['46', '23', '48', '44']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a découvert la pénicilline en 1928 ?', 'Who discovered penicillin in 1928?', array['Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Robert Koch']::text[], array['Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Robert Koch']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Dans quels domaines Marie Curie a-t-elle reçu ses deux prix Nobel ?', 'In which fields did Marie Curie win her two Nobel Prizes?', array['Physique et chimie', 'Médecine et chimie', 'Physique et paix', 'Chimie et littérature']::text[], array['Physics and chemistry', 'Medicine and chemistry', 'Physics and peace', 'Chemistry and literature']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle unité mesure la résistance électrique ?', 'Which unit measures electrical resistance?', array['L’ohm', 'Le volt', 'L’ampère', 'Le watt']::text[], array['The ohm', 'The volt', 'The ampere', 'The watt']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel gaz est le plus abondant dans l’air que l’on respire ?', 'Which gas is the most abundant in the air we breathe?', array['L’azote', 'L’oxygène', 'Le dioxyde de carbone', 'L’argon']::text[], array['Nitrogen', 'Oxygen', 'Carbon dioxide', 'Argon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel prêtre et savant belge est considéré comme le père du Big Bang ?', 'Which Belgian priest and scientist is seen as the father of the Big Bang?', array['Georges Lemaître', 'Ernest Solvay', 'Christian de Duve', 'Zénobe Gramme']::text[], array['Georges Lemaître', 'Ernest Solvay', 'Christian de Duve', 'Zénobe Gramme']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Le Belge François Englert a reçu le Nobel 2013 pour ses travaux sur quoi ?', 'Belgian François Englert won the 2013 Nobel for his work on what?', array['Le boson de Higgs', 'Le Big Bang', 'Les trous noirs', 'L’ADN']::text[], array['The Higgs boson', 'The Big Bang', 'Black holes', 'DNA']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la planète la plus proche du Soleil ?', 'Which planet is closest to the Sun?', array['Mercure', 'Vénus', 'Mars', 'La Terre']::text[], array['Mercury', 'Venus', 'Mars', 'Earth']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a été le premier homme à marcher sur la Lune ?', 'Who was the first man to walk on the Moon?', array['Neil Armstrong', 'Buzz Aldrin', 'Youri Gagarine', 'Michael Collins']::text[], array['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a été le premier homme à voyager dans l’espace, en 1961 ?', 'Who was the first person to travel into space, in 1961?', array['Youri Gagarine', 'Neil Armstrong', 'John Glenn', 'Alexeï Leonov']::text[], array['Yuri Gagarin', 'Neil Armstrong', 'John Glenn', 'Alexei Leonov']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a été le premier astronaute belge, en 1992 ?', 'Who was the first Belgian astronaut, in 1992?', array['Dirk Frimout', 'Frank De Winne', 'Raphaël Liégeois', 'Thomas Pesquet']::text[], array['Dirk Frimout', 'Frank De Winne', 'Raphaël Liégeois', 'Thomas Pesquet']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de temps met la lumière du Soleil pour atteindre la Terre ?', 'How long does sunlight take to reach the Earth?', array['Environ 8 minutes', 'Environ 8 secondes', 'Environ 8 heures', 'Environ 1 seconde']::text[], array['About 8 minutes', 'About 8 seconds', 'About 8 hours', 'About 1 second']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment s’appelle notre galaxie ?', 'What is the name of our galaxy?', array['La Voie lactée', 'Andromède', 'Le Grand Nuage de Magellan', 'Orion']::text[], array['The Milky Way', 'Andromeda', 'The Large Magellanic Cloud', 'Orion']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel télescope spatial, lancé fin 2021, est le successeur de Hubble ?', 'Which space telescope, launched in late 2021, succeeded Hubble?', array['James Webb', 'Kepler', 'Spitzer', 'Chandra']::text[], array['James Webb', 'Kepler', 'Spitzer', 'Chandra']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année Pluton a-t-elle perdu son statut de planète ?', 'In which year did Pluto lose its planet status?', array['2006', '1996', '2012', '2001']::text[], array['2006', '1996', '2012', '2001']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand animal qui vit dans les océans ?', 'What is the largest animal living in the oceans?', array['La baleine bleue', 'L’éléphant d’Afrique', 'Le cachalot', 'Le requin baleine']::text[], array['The blue whale', 'The African elephant', 'The sperm whale', 'The whale shark']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand primate du monde ?', 'What is the largest primate in the world?', array['Le gorille', 'Le chimpanzé', 'L’orang-outan', 'Le babouin']::text[], array['The gorilla', 'The chimpanzee', 'The orangutan', 'The baboon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'De quoi se nourrit principalement le koala ?', 'What does the koala mainly eat?', array['De feuilles d’eucalyptus', 'De bambou', 'De bananes', 'D’insectes']::text[], array['Eucalyptus leaves', 'Bamboo', 'Bananas', 'Insects']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de cœurs possède une pieuvre ?', 'How many hearts does an octopus have?', array['3', '1', '2', '4']::text[], array['3', '1', '2', '4']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel arbre produit les glands ?', 'Which tree produces acorns?', array['Le chêne', 'Le hêtre', 'Le châtaignier', 'Le bouleau']::text[], array['The oak', 'The beech', 'The chestnut', 'The birch']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le plus grand oiseau du monde ?', 'What is the largest bird in the world?', array['L’autruche', 'Le condor', 'L’albatros', 'L’aigle royal']::text[], array['The ostrich', 'The condor', 'The albatross', 'The golden eagle']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le seul mammifère capable de vraiment voler ?', 'Which is the only mammal truly able to fly?', array['La chauve-souris', 'Le lémurien', 'La taupe', 'Le hérisson']::text[], array['The bat', 'The lemur', 'The mole', 'The hedgehog']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année est tombé le mur de Berlin ?', 'In which year did the Berlin Wall fall?', array['1989', '1991', '1985', '1979']::text[], array['1989', '1991', '1985', '1979']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui fut le premier empereur des Français ?', 'Who was the first Emperor of the French?', array['Napoléon Ier', 'Louis XIV', 'Charlemagne', 'Napoléon III']::text[], array['Napoleon I', 'Louis XIV', 'Charlemagne', 'Napoleon III']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année Christophe Colomb a-t-il atteint l’Amérique ?', 'In which year did Christopher Columbus reach the Americas?', array['1492', '1515', '1453', '1789']::text[], array['1492', '1515', '1453', '1789']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année a commencé la Révolution française ?', 'In which year did the French Revolution begin?', array['1789', '1815', '1648', '1848']::text[], array['1789', '1815', '1648', '1848']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année le Titanic a-t-il coulé ?', 'In which year did the Titanic sink?', array['1912', '1905', '1920', '1898']::text[], array['1912', '1905', '1920', '1898']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel pays a offert la statue de la Liberté aux États-Unis ?', 'Which country gave the Statue of Liberty to the United States?', array['La France', 'Le Royaume-Uni', 'L’Espagne', 'L’Italie']::text[], array['France', 'The United Kingdom', 'Spain', 'Italy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel inventeur allemand a mis au point l’imprimerie à caractères mobiles en Europe ?', 'Which German inventor developed movable type printing in Europe?', array['Gutenberg', 'Diesel', 'Daimler', 'Röntgen']::text[], array['Gutenberg', 'Diesel', 'Daimler', 'Röntgen']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel est le surnom de l’équipe nationale belge de football ?', 'What is the nickname of Belgium’s national football team?', array['Les Diables Rouges', 'Les Lions', 'Les Bleus', 'Les Aigles']::text[], array['The Red Devils', 'The Lions', 'The Blues', 'The Eagles']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'À quelle place la Belgique a-t-elle terminé la Coupe du monde 2018 ?', 'Where did Belgium finish at the 2018 World Cup?', array['3e', '2e', '4e', '1re']::text[], array['3rd', '2nd', '4th', '1st']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle ville belge a accueilli les Jeux olympiques de 1920 ?', 'Which Belgian city hosted the 1920 Olympic Games?', array['Anvers', 'Bruxelles', 'Liège', 'Gand']::text[], array['Antwerp', 'Brussels', 'Liège', 'Ghent']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de fois Justine Henin a-t-elle gagné Roland-Garros ?', 'How many times did Justine Henin win the French Open?', array['4', '2', '3', '5']::text[], array['4', '2', '3', '5']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Dans quelle discipline Nafi Thiam est-elle championne olympique ?', 'In which event is Nafi Thiam an Olympic champion?', array['L’heptathlon', 'Le saut en hauteur', 'Le 400 mètres', 'Le lancer du javelot']::text[], array['Heptathlon', 'High jump', '400 metres', 'Javelin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel Belge a gagné le chrono et la course en ligne aux JO de Paris 2024 ?', 'Which Belgian won both the time trial and road race at Paris 2024?', array['Remco Evenepoel', 'Wout van Aert', 'Jasper Philipsen', 'Tim Wellens']::text[], array['Remco Evenepoel', 'Wout van Aert', 'Jasper Philipsen', 'Tim Wellens']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel virage mythique se trouve sur le circuit de Spa-Francorchamps ?', 'Which legendary corner is found at the Spa-Francorchamps circuit?', array['L’Eau Rouge', 'La Rascasse', 'La Parabolica', 'Le Tertre Rouge']::text[], array['Eau Rouge', 'La Rascasse', 'Parabolica', 'Tertre Rouge']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel pilote allemand a remporté 7 titres de champion du monde de F1 ?', 'Which German driver won 7 Formula 1 world titles?', array['Michael Schumacher', 'Sebastian Vettel', 'Nico Rosberg', 'Ralf Schumacher']::text[], array['Michael Schumacher', 'Sebastian Vettel', 'Nico Rosberg', 'Ralf Schumacher']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de fois le Belge Jacky Ickx a-t-il gagné les 24 Heures du Mans ?', 'How many times did Belgian Jacky Ickx win the 24 Hours of Le Mans?', array['6', '3', '4', '9']::text[], array['6', '3', '4', '9']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Que récompense le maillot jaune du Tour de France ?', 'What does the Tour de France yellow jersey reward?', array['Le leader du classement général', 'Le meilleur grimpeur', 'Le meilleur sprinteur', 'Le meilleur jeune']::text[], array['The overall leader', 'The best climber', 'The best sprinter', 'The best young rider']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle classique cycliste belge est surnommée « la Doyenne » ?', 'Which Belgian cycling classic is nicknamed “La Doyenne”?', array['Liège-Bastogne-Liège', 'Le Tour des Flandres', 'La Flèche wallonne', 'Gand-Wevelgem']::text[], array['Liège-Bastogne-Liège', 'Tour of Flanders', 'La Flèche Wallonne', 'Gent-Wevelgem']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle est la distance officielle d’un marathon ?', 'What is the official distance of a marathon?', array['42,195 km', '40 km', '45 km', '41,5 km']::text[], array['42.195 km', '40 km', '45 km', '41.5 km']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel acteur belge est surnommé « The Muscles from Brussels » ?', 'Which Belgian actor is nicknamed “The Muscles from Brussels”?', array['Jean-Claude Van Damme', 'Benoît Poelvoorde', 'Matthias Schoenaerts', 'Jérémie Renier']::text[], array['Jean-Claude Van Damme', 'Benoît Poelvoorde', 'Matthias Schoenaerts', 'Jérémie Renier']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a réalisé le film Titanic sorti en 1997 ?', 'Who directed the 1997 film Titanic?', array['James Cameron', 'Steven Spielberg', 'Ridley Scott', 'Christopher Nolan']::text[], array['James Cameron', 'Steven Spielberg', 'Ridley Scott', 'Christopher Nolan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment s’appelle l’école de sorcellerie de Harry Potter ?', 'What is the name of Harry Potter’s school of wizardry?', array['Poudlard', 'Beauxbâtons', 'Durmstrang', 'Ilvermorny']::text[], array['Hogwarts', 'Beauxbatons', 'Durmstrang', 'Ilvermorny']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Dans Breaking Bad, quel est le métier de Walter White au début ?', 'In Breaking Bad, what is Walter White’s job at the start?', array['Professeur de chimie', 'Pharmacien', 'Policier', 'Avocat']::text[], array['Chemistry teacher', 'Pharmacist', 'Police officer', 'Lawyer']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de Palmes d’or les frères Dardenne ont-ils remportées ?', 'How many Palme d’Or awards have the Dardenne brothers won?', array['2', '1', '3', '4']::text[], array['2', '1', '3', '4']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quel studio d’animation a créé Toy Story ?', 'Which animation studio created Toy Story?', array['Pixar', 'DreamWorks', 'Illumination', 'Ghibli']::text[], array['Pixar', 'DreamWorks', 'Illumination', 'Ghibli']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a écrit le roman « Les Misérables » ?', 'Who wrote the novel “Les Misérables”?', array['Victor Hugo', 'Émile Zola', 'Honoré de Balzac', 'Alexandre Dumas']::text[], array['Victor Hugo', 'Émile Zola', 'Honoré de Balzac', 'Alexandre Dumas']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de cases compte un échiquier ?', 'How many squares are there on a chessboard?', array['64', '81', '100', '49']::text[], array['64', '81', '100', '49']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Qui a fondé Microsoft avec Paul Allen ?', 'Who founded Microsoft with Paul Allen?', array['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Larry Page']::text[], array['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Larry Page']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Combien de bits y a-t-il dans un octet ?', 'How many bits are there in a byte?', array['8', '4', '10', '16']::text[], array['8', '4', '10', '16']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En quelle année le premier iPhone a-t-il été présenté ?', 'In which year was the first iPhone unveiled?', array['2007', '2004', '2010', '2001']::text[], array['2007', '2004', '2010', '2001']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Avec qui le Belge Robert Cailliau a-t-il conçu le World Wide Web ?', 'With whom did Belgian Robert Cailliau design the World Wide Web?', array['Tim Berners-Lee', 'Alan Kay', 'Steve Jobs', 'Bill Gates']::text[], array['Tim Berners-Lee', 'Alan Kay', 'Steve Jobs', 'Bill Gates']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle machine le Belge Zénobe Gramme a-t-il inventée ?', 'Which machine did Belgian Zénobe Gramme invent?', array['La dynamo', 'Le moteur diesel', 'Le téléphone', 'La machine à vapeur']::text[], array['The dynamo', 'The diesel engine', 'The telephone', 'The steam engine']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle friandise belge en forme de cône est souvent violette ?', 'Which cone shaped Belgian sweet is often purple?', array['Le cuberdon', 'La praline', 'Le spéculoos', 'La gaufre']::text[], array['The cuberdon', 'The praline', 'The speculoos', 'The waffle']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Quelle maison belge a inventé la praline en 1912 ?', 'Which Belgian chocolatier invented the praline in 1912?', array['Neuhaus', 'Godiva', 'Leonidas', 'Côte d’Or']::text[], array['Neuhaus', 'Godiva', 'Leonidas', 'Côte d’Or']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'De quelle ville belge le waterzooi est-il originaire ?', 'Which Belgian city does waterzooi come from?', array['Gand', 'Liège', 'Namur', 'Ostende']::text[], array['Ghent', 'Liège', 'Namur', 'Ostend']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Le houmous est préparé principalement à base de quoi ?', 'Hummus is mainly made from what?', array['De pois chiches', 'De lentilles', 'De haricots rouges', 'De petits pois']::text[], array['Chickpeas', 'Lentils', 'Kidney beans', 'Green peas']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'De quelle province belge vient le fromage de Herve ?', 'Which Belgian province does Herve cheese come from?', array['Liège', 'Le Hainaut', 'Le Luxembourg', 'Namur']::text[], array['Liège', 'Hainaut', 'Luxembourg', 'Namur']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment appelle-t-on l’endive en Belgique ?', 'What do Belgians call the endive?', array['Le chicon', 'Le salsifis', 'Le cardon', 'Le panais']::text[], array['Chicon', 'Salsify', 'Cardoon', 'Parsnip']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En Belgique, comment dit-on habituellement le nombre 90 ?', 'In Belgium, how is the number 90 usually said in French?', array['Nonante', 'Novante', 'Neufante', 'Octante']::text[], array['Nonante', 'Novante', 'Neufante', 'Octante']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En Belgique, que veut dire « il drache » ?', 'In Belgium, what does “il drache” mean?', array['Il pleut très fort', 'Il fait très chaud', 'Il y a du vent', 'Il neige']::text[], array['It’s pouring with rain', 'It’s very hot', 'It’s windy', 'It’s snowing']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'En Belgique, « je ne sais pas venir » veut dire quoi ?', 'In Belgium, what does “je ne sais pas venir” mean?', array['Je ne peux pas venir', 'Je ne connais pas la route', 'Je viendrai plus tard', 'Je n’ai pas envie']::text[], array['I can’t come', 'I don’t know the way', 'I’ll come later', 'I don’t feel like it']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('general', 'Comment appelle-t-on un mot qui se lit pareil dans les deux sens ?', 'What do we call a word that reads the same both ways?', array['Un palindrome', 'Une anagramme', 'Un homonyme', 'Un acronyme']::text[], array['A palindrome', 'An anagram', 'A homonym', 'An acronym']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de pattes a un chien ?', 'How many legs does a dog have?', array['4', '2', '6', '8']::text[], array['4', '2', '6', '8']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal fait « cocorico » ?', 'Which animal says “cock-a-doodle-doo”?', array['Le coq', 'Le canard', 'Le chat', 'Le mouton']::text[], array['The rooster', 'The duck', 'The cat', 'The sheep']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Rouge et jaune mélangés, ça donne quelle couleur ?', 'Red and yellow mixed make which colour?', array['Orange', 'Violet', 'Vert', 'Bleu']::text[], array['Orange', 'Purple', 'Green', 'Blue']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de côtés a un triangle ?', 'How many sides does a triangle have?', array['3', '4', '5', '6']::text[], array['3', '4', '5', '6']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de côtés a un carré ?', 'How many sides does a square have?', array['4', '3', '5', '6']::text[], array['4', '3', '5', '6']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle forme a une roue de vélo ?', 'What shape is a bike wheel?', array['Un cercle', 'Un carré', 'Un triangle', 'Une étoile']::text[], array['A circle', 'A square', 'A triangle', 'A star']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle forme a un panneau « STOP » ?', 'What shape is a “STOP” sign?', array['Un octogone', 'Un cercle', 'Un triangle', 'Un carré']::text[], array['An octagon', 'A circle', 'A triangle', 'A square']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de faces a un dé à jouer ?', 'How many faces does a dice have?', array['6', '4', '8', '5']::text[], array['6', '4', '8', '5']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 2 + 3 ?', 'What is 2 + 3?', array['5', '4', '6', '7']::text[], array['5', '4', '6', '7']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 5 + 5 ?', 'What is 5 + 5?', array['10', '9', '11', '12']::text[], array['10', '9', '11', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 6 + 7 ?', 'What is 6 + 7?', array['13', '12', '14', '11']::text[], array['13', '12', '14', '11']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 10 moins 4 ?', 'What is 10 minus 4?', array['6', '5', '7', '4']::text[], array['6', '5', '7', '4']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 20 moins 5 ?', 'What is 20 minus 5?', array['15', '10', '25', '14']::text[], array['15', '10', '25', '14']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 3 fois 3 ?', 'What is 3 times 3?', array['9', '6', '12', '8']::text[], array['9', '6', '12', '8']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle est la moitié de 10 ?', 'What is half of 10?', array['5', '2', '4', '20']::text[], array['5', '2', '4', '20']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de doigts as-tu en tout sur tes deux mains ?', 'How many fingers do you have on both hands?', array['10', '8', '12', '5']::text[], array['10', '8', '12', '5']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Avec quoi sens-tu les odeurs ?', 'What do you smell with?', array['Le nez', 'Les oreilles', 'Les yeux', 'Les genoux']::text[], array['Your nose', 'Your ears', 'Your eyes', 'Your knees']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel organe pompe le sang dans ton corps ?', 'Which organ pumps blood around your body?', array['Le cœur', 'L’estomac', 'Le cerveau', 'Les poumons']::text[], array['The heart', 'The stomach', 'The brain', 'The lungs']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Que dois-tu faire avant de manger ?', 'What should you do before eating?', array['Te laver les mains', 'Sauter sur le lit', 'Crier très fort', 'Mettre un bonnet']::text[], array['Wash your hands', 'Jump on the bed', 'Shout very loud', 'Put on a hat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Sur quelle planète vivons-nous ?', 'Which planet do we live on?', array['La Terre', 'Mars', 'Vénus', 'Jupiter']::text[], array['Earth', 'Mars', 'Venus', 'Jupiter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle est la plus grosse planète du système solaire ?', 'What is the biggest planet in the solar system?', array['Jupiter', 'Saturne', 'La Terre', 'Mars']::text[], array['Jupiter', 'Saturn', 'Earth', 'Mars']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal fait « coin-coin » ?', 'Which animal says “quack quack”?', array['Le canard', 'Le chien', 'La vache', 'Le cochon']::text[], array['The duck', 'The dog', 'The cow', 'The pig']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle étoile est la plus proche de la Terre ?', 'Which star is the closest to Earth?', array['Le Soleil', 'La Lune', 'Mars', 'Jupiter']::text[], array['The Sun', 'The Moon', 'Mars', 'Jupiter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de planètes compte le système solaire ?', 'How many planets are in the solar system?', array['8', '6', '10', '12']::text[], array['8', '6', '10', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qu’est-ce qui tourne autour de la Terre ?', 'What goes around the Earth?', array['La Lune', 'Le Soleil', 'Mars', 'Jupiter']::text[], array['The Moon', 'The Sun', 'Mars', 'Jupiter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal a des rayures noires et blanches ?', 'Which animal has black and white stripes?', array['Le zèbre', 'Le lion', 'L’ours', 'Le chameau']::text[], array['The zebra', 'The lion', 'The bear', 'The camel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le capitaine ami de Tintin ?', 'What is the name of Tintin’s captain friend?', array['Haddock', 'Crochet', 'Nemo', 'America']::text[], array['Haddock', 'Hook', 'Nemo', 'America']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qui a créé Tintin ?', 'Who created Tintin?', array['Hergé', 'Peyo', 'Franquin', 'Morris']::text[], array['Hergé', 'Peyo', 'Franquin', 'Morris']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel personnage de BD a une houppe sur la tête ?', 'Which comic hero has a quiff on his head?', array['Tintin', 'Lucky Luke', 'Astérix', 'Gaston']::text[], array['Tintin', 'Lucky Luke', 'Asterix', 'Gaston']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le sorcier qui veut attraper les Schtroumpfs ?', 'What is the name of the wizard who chases the Smurfs?', array['Gargamel', 'Jafar', 'Bowser', 'Scar']::text[], array['Gargamel', 'Jafar', 'Bowser', 'Scar']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le chat de Gargamel ?', 'What is the name of Gargamel’s cat?', array['Azraël', 'Garfield', 'Grosminet', 'Tom']::text[], array['Azrael', 'Garfield', 'Sylvester', 'Tom']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le cheval de Lucky Luke ?', 'What is the name of Lucky Luke’s horse?', array['Jolly Jumper', 'Rantanplan', 'Milou', 'Idéfix']::text[], array['Jolly Jumper', 'Rantanplan', 'Snowy', 'Dogmatix']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le petit chien d’Obélix ?', 'What is the name of Obelix’s little dog?', array['Idéfix', 'Milou', 'Pluto', 'Rantanplan']::text[], array['Dogmatix', 'Snowy', 'Pluto', 'Rantanplan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel Pokémon jaune est le meilleur ami de Sacha ?', 'Which yellow Pokémon is Ash’s best friend?', array['Pikachu', 'Salamèche', 'Bulbizarre', 'Carapuce']::text[], array['Pikachu', 'Charmander', 'Bulbasaur', 'Squirtle']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'De quel type est le Pokémon Salamèche ?', 'What type is the Pokémon Charmander?', array['Feu', 'Eau', 'Plante', 'Électrik']::text[], array['Fire', 'Water', 'Grass', 'Electric']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le frère de Mario ?', 'What is the name of Mario’s brother?', array['Luigi', 'Wario', 'Yoshi', 'Toad']::text[], array['Luigi', 'Wario', 'Yoshi', 'Toad']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel gros méchant enlève souvent la princesse Peach ?', 'Which big villain often kidnaps Princess Peach?', array['Bowser', 'Luigi', 'Yoshi', 'Toad']::text[], array['Bowser', 'Luigi', 'Yoshi', 'Toad']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Dans « La Reine des neiges », comment s’appelle la sœur d’Elsa ?', 'In “Frozen”, what is the name of Elsa’s sister?', array['Anna', 'Ariel', 'Belle', 'Raiponce']::text[], array['Anna', 'Ariel', 'Belle', 'Rapunzel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le bonhomme de neige de « La Reine des neiges » ?', 'What is the name of the snowman in “Frozen”?', array['Olaf', 'Sven', 'Kristoff', 'Hans']::text[], array['Olaf', 'Sven', 'Kristoff', 'Hans']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le jeune lion héros du « Roi lion » ?', 'What is the name of the young lion hero of “The Lion King”?', array['Simba', 'Dumbo', 'Bambi', 'Nemo']::text[], array['Simba', 'Dumbo', 'Bambi', 'Nemo']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel poisson bleu oublie tout dans « Le Monde de Nemo » ?', 'Which blue fish forgets everything in “Finding Nemo”?', array['Dory', 'Nemo', 'Simba', 'Olaf']::text[], array['Dory', 'Nemo', 'Simba', 'Olaf']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Dans « Toy Story », comment s’appelle le cow-boy ?', 'In “Toy Story”, what is the cowboy’s name?', array['Woody', 'Buzz l’Éclair', 'Rex', 'Monsieur Patate']::text[], array['Woody', 'Buzz Lightyear', 'Rex', 'Mr. Potato Head']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel personnage de Disney est une souris ?', 'Which Disney character is a mouse?', array['Mickey', 'Donald', 'Pluto', 'Dingo']::text[], array['Mickey', 'Donald', 'Pluto', 'Goofy']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle voiture de course rouge est un héros de Pixar ?', 'Which red race car is a Pixar hero?', array['Flash McQueen', 'Woody', 'Nemo', 'Buzz l’Éclair']::text[], array['Lightning McQueen', 'Woody', 'Nemo', 'Buzz Lightyear']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal est Peppa ?', 'What animal is Peppa?', array['Un cochon', 'Un mouton', 'Un chat', 'Un chien']::text[], array['A pig', 'A sheep', 'A cat', 'A dog']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qui perd sa pantoufle de verre au bal ?', 'Who loses her glass slipper at the ball?', array['Cendrillon', 'Blanche-Neige', 'Raiponce', 'Le Petit Chaperon rouge']::text[], array['Cinderella', 'Snow White', 'Rapunzel', 'Little Red Riding Hood']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de nains vivent avec Blanche-Neige ?', 'How many dwarfs live with Snow White?', array['7', '5', '3', '12']::text[], array['7', '5', '3', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qui le Petit Chaperon rouge rencontre-t-il dans la forêt ?', 'Who does Little Red Riding Hood meet in the forest?', array['Le loup', 'Un dragon', 'Un lion', 'Un tigre']::text[], array['The wolf', 'A dragon', 'A lion', 'A tiger']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle maison des trois petits cochons résiste au loup ?', 'Which house of the three little pigs stands up to the wolf?', array['En briques', 'En paille', 'En bois', 'En papier']::text[], array['Brick', 'Straw', 'Wood', 'Paper']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel pantin a un nez qui grandit quand il ment ?', 'Which puppet’s nose grows when he lies?', array['Pinocchio', 'Peter Pan', 'Aladdin', 'Hercule']::text[], array['Pinocchio', 'Peter Pan', 'Aladdin', 'Hercules']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel garçon ne veut jamais grandir ?', 'Which boy never wants to grow up?', array['Peter Pan', 'Pinocchio', 'Mowgli', 'Aladdin']::text[], array['Peter Pan', 'Pinocchio', 'Mowgli', 'Aladdin']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle est la capitale de la Belgique ?', 'What is the capital of Belgium?', array['Bruxelles', 'Mons', 'Liège', 'Anvers']::text[], array['Brussels', 'Mons', 'Liège', 'Antwerp']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel monument de Bruxelles ressemble à un atome géant ?', 'Which Brussels monument looks like a giant atom?', array['L’Atomium', 'La tour Eiffel', 'Big Ben', 'Le Colisée']::text[], array['The Atomium', 'The Eiffel Tower', 'Big Ben', 'The Colosseum']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien font 4 + 4 ?', 'What is 4 + 4?', array['8', '6', '9', '10']::text[], array['8', '6', '9', '10']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Dans quel pays se trouve la ville de Mons ?', 'In which country is the city of Mons?', array['La Belgique', 'La France', 'Les Pays-Bas', 'La Suisse']::text[], array['Belgium', 'France', 'The Netherlands', 'Switzerland']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel dessert belge est plein de petits carrés ?', 'Which Belgian treat is full of little squares?', array['La gaufre', 'La crêpe', 'Le croissant', 'La tarte']::text[], array['The waffle', 'The pancake', 'The croissant', 'The pie']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Avec quel légume fait-on les frites ?', 'Which vegetable are chips made from?', array['La pomme de terre', 'La carotte', 'La tomate', 'Le chou']::text[], array['The potato', 'The carrot', 'The tomato', 'The cabbage']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel est le contraire de « grand » ?', 'What is the opposite of “big”?', array['Petit', 'Gros', 'Long', 'Haut']::text[], array['Small', 'Fat', 'Long', 'High']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal a une trompe ?', 'Which animal has a trunk?', array['L’éléphant', 'La girafe', 'Le lion', 'Le zèbre']::text[], array['The elephant', 'The giraffe', 'The lion', 'The zebra']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal a le cou le plus long ?', 'Which animal has the longest neck?', array['La girafe', 'L’éléphant', 'Le cheval', 'Le chameau']::text[], array['The giraffe', 'The elephant', 'The horse', 'The camel']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'La baleine est un… ?', 'A whale is a…?', array['Mammifère', 'Poisson', 'Reptile', 'Insecte']::text[], array['Mammal', 'Fish', 'Reptile', 'Insect']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'La chauve-souris est un… ?', 'A bat is a…?', array['Mammifère', 'Oiseau', 'Insecte', 'Reptile']::text[], array['Mammal', 'Bird', 'Insect', 'Reptile']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Que mange surtout le panda ?', 'What does a panda mostly eat?', array['Du bambou', 'Du poisson', 'De la viande', 'Des carottes']::text[], array['Bamboo', 'Fish', 'Meat', 'Carrots']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal porte sa coquille sur son dos ?', 'Which animal carries its shell on its back?', array['L’escargot', 'Le lapin', 'Le chien', 'La souris']::text[], array['The snail', 'The rabbit', 'The dog', 'The mouse']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal porte son bébé dans une poche ?', 'Which animal carries its baby in a pouch?', array['Le kangourou', 'Le lapin', 'La grenouille', 'Le singe']::text[], array['The kangaroo', 'The rabbit', 'The frog', 'The monkey']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal vit sur la glace du pôle Nord ?', 'Which animal lives on the ice at the North Pole?', array['L’ours polaire', 'Le manchot', 'Le lion', 'La girafe']::text[], array['The polar bear', 'The penguin', 'The lion', 'The giraffe']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Comment s’appelle le bébé du chat ?', 'What is a baby cat called?', array['Le chaton', 'Le chiot', 'Le poussin', 'L’agneau']::text[], array['A kitten', 'A puppy', 'A chick', 'A lamb']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'En quoi la chenille se transforme-t-elle ?', 'What does a caterpillar turn into?', array['En papillon', 'En abeille', 'En coccinelle', 'En fourmi']::text[], array['A butterfly', 'A bee', 'A ladybird', 'An ant']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal tisse une toile ?', 'Which animal spins a web?', array['L’araignée', 'La fourmi', 'Le papillon', 'Le ver de terre']::text[], array['The spider', 'The ant', 'The butterfly', 'The earthworm']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de bosses a un dromadaire ?', 'How many humps does a dromedary have?', array['1', '2', '3', '4']::text[], array['1', '2', '3', '4']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel oiseau peut répéter des mots ?', 'Which bird can repeat words?', array['Le perroquet', 'Le pigeon', 'La poule', 'Le canard']::text[], array['The parrot', 'The pigeon', 'The hen', 'The duck']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel oiseau dort le jour et chasse la nuit ?', 'Which bird sleeps by day and hunts at night?', array['La chouette', 'Le pigeon', 'Le moineau', 'Le canard']::text[], array['The owl', 'The pigeon', 'The sparrow', 'The duck']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal peut changer de couleur ?', 'Which animal can change colour?', array['Le caméléon', 'Le lapin', 'Le cheval', 'La vache']::text[], array['The chameleon', 'The rabbit', 'The horse', 'The cow']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel insecte fait de la lumière la nuit ?', 'Which insect makes light at night?', array['La luciole', 'La fourmi', 'L’abeille', 'La mouche']::text[], array['The firefly', 'The ant', 'The bee', 'The fly']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal dort tout l’hiver dans son terrier ?', 'Which animal sleeps all winter in its burrow?', array['La marmotte', 'Le chien', 'La vache', 'Le pigeon']::text[], array['The marmot', 'The dog', 'The cow', 'The pigeon']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'En quelle saison les feuilles tombent-elles des arbres ?', 'In which season do leaves fall from the trees?', array['L’automne', 'Le printemps', 'L’été', 'L’hiver']::text[], array['Autumn', 'Spring', 'Summer', 'Winter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien d’heures compte une journée ?', 'How many hours are in a day?', array['24', '12', '60', '100']::text[], array['24', '12', '60', '100']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel est le premier mois de l’année ?', 'What is the first month of the year?', array['Janvier', 'Mars', 'Juin', 'Décembre']::text[], array['January', 'March', 'June', 'December']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel fruit est brun et poilu dehors, vert dedans ?', 'Which fruit is brown and hairy outside, green inside?', array['Le kiwi', 'La pomme', 'La banane', 'La cerise']::text[], array['The kiwi', 'The apple', 'The banana', 'The cherry']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle partie de la plante est cachée sous la terre ?', 'Which part of a plant is hidden under the ground?', array['Les racines', 'Les fleurs', 'Les feuilles', 'Les pétales']::text[], array['The roots', 'The flowers', 'The leaves', 'The petals']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'À quelle température l’eau gèle-t-elle ?', 'At what temperature does water freeze?', array['0 °C', '10 °C', '50 °C', '100 °C']::text[], array['0 °C', '10 °C', '50 °C', '100 °C']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qu’est-ce qui apparaît dans le ciel avec soleil et pluie ?', 'What often appears in the sky with sun and rain?', array['Un arc-en-ciel', 'Un volcan', 'Une baleine', 'Un château']::text[], array['A rainbow', 'A volcano', 'A whale', 'A castle']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'De quelle couleur est une banane bien mûre ?', 'What colour is a ripe banana?', array['Jaune', 'Bleue', 'Rouge', 'Violette']::text[], array['Yellow', 'Blue', 'Red', 'Purple']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Au feu, quelle couleur veut dire « stop » ?', 'At traffic lights, which colour means “stop”?', array['Rouge', 'Vert', 'Bleu', 'Blanc']::text[], array['Red', 'Green', 'Blue', 'White']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de joueurs a une équipe de foot sur le terrain ?', 'How many players does a football team have on the pitch?', array['11', '5', '7', '15']::text[], array['11', '5', '7', '15']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel sport joue-t-on avec une raquette et un volant ?', 'Which sport uses a racket and a shuttlecock?', array['Le badminton', 'Le football', 'Le basket', 'Le judo']::text[], array['Badminton', 'Football', 'Basketball', 'Judo']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel sport fait-on sur la neige avec deux longues planches ?', 'Which sport is done on snow with two long boards?', array['Le ski', 'Le judo', 'Le tennis', 'Le football']::text[], array['Skiing', 'Judo', 'Tennis', 'Football']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel animal pond les œufs que l’on mange souvent ?', 'Which animal lays the eggs we often eat?', array['La poule', 'La vache', 'Le cochon', 'Le chat']::text[], array['The hen', 'The cow', 'The pig', 'The cat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Avec quelle céréale fait-on le plus souvent le pain ?', 'Which grain is bread most often made from?', array['Le blé', 'La carotte', 'La banane', 'La pomme']::text[], array['Wheat', 'Carrot', 'Banana', 'Apple']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel fruit rouge a des petits grains sur sa peau ?', 'Which red fruit has tiny seeds on its skin?', array['La fraise', 'La banane', 'La poire', 'Le kiwi']::text[], array['The strawberry', 'The banana', 'The pear', 'The kiwi']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Avec quoi fabrique-t-on le chocolat ?', 'What is chocolate made from?', array['Le cacao', 'Le café', 'La noix de coco', 'Le blé']::text[], array['Cocoa', 'Coffee', 'Coconut', 'Wheat']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Avec quoi lave-t-on ses cheveux ?', 'What do you wash your hair with?', array['Du shampoing', 'Du dentifrice', 'Du beurre', 'De la colle']::text[], array['Shampoo', 'Toothpaste', 'Butter', 'Glue']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qui coupe les cheveux et la barbe des messieurs ?', 'Who cuts men’s hair and beards?', array['Le barbier', 'Le boulanger', 'Le facteur', 'Le pompier']::text[], array['The barber', 'The baker', 'The postman', 'The firefighter']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Qui soigne les animaux malades ?', 'Who looks after sick animals?', array['Le vétérinaire', 'Le boulanger', 'Le facteur', 'Le coiffeur']::text[], array['The vet', 'The baker', 'The postman', 'The hairdresser']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de saisons y a-t-il dans une année ?', 'How many seasons are there in a year?', array['4', '2', '6', '12']::text[], array['4', '2', '6', '12']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Dans quel pays se trouve la tour Eiffel ?', 'In which country is the Eiffel Tower?', array['La France', 'La Belgique', 'L’Italie', 'L’Espagne']::text[], array['France', 'Belgium', 'Italy', 'Spain']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel pays a la forme d’une botte ?', 'Which country is shaped like a boot?', array['L’Italie', 'L’Espagne', 'La France', 'La Belgique']::text[], array['Italy', 'Spain', 'France', 'Belgium']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quelle est la plus haute montagne du monde ?', 'What is the highest mountain in the world?', array['L’Everest', 'Le mont Blanc', 'Le Kilimandjaro', 'Le Vésuve']::text[], array['Everest', 'Mont Blanc', 'Kilimanjaro', 'Vesuvius']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Quel pays a le kangourou pour symbole ?', 'Which country has the kangaroo as its symbol?', array['L’Australie', 'Le Canada', 'La Belgique', 'Le Japon']::text[], array['Australia', 'Canada', 'Belgium', 'Japan']::text[], 0, true);
insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values ('kids', 'Combien de pattes a un oiseau ?', 'How many legs does a bird have?', array['2', '4', '6', '8']::text[], array['2', '4', '6', '8']::text[], 0, true);

commit;
