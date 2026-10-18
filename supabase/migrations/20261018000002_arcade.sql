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
    when 'beat' then case p_variant when 'medium' then 125600 when 'hard' then 158800 else 48000 end
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
