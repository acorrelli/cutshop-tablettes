-- Cutshop Mons : installation complète de la base (fichier généré par scripts/build-setup-sql.mjs).
-- À coller en une fois dans SQL Editor d'un projet Supabase neuf, puis Run. Ne pas exécuter deux fois.
-- Contenu : supabase/migrations/20261015000001_init.sql, supabase/migrations/20261018000001_services.sql, supabase/migrations/20261018000002_arcade.sql, supabase/seed.sql

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

-- Questions de quiz (90)
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

commit;
