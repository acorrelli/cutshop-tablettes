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
