-- Tests de la base : RLS, inscriptions, roue, codes gagnants.
-- Chaque vérification lève une exception en cas d'échec.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Prépare un admin.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000a001', 'admin@cutshop.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000a001');

-- ---------------------------------------------------------------------------
-- 1. Données d'exemple présentes
do $$ begin
  assert (select count(*) from public.quiz_questions) >= 80, 'au moins 80 questions';
  assert (select count(*) from public.events where starts_at > now()) >= 15, 'événements futurs créés';
  assert (select count(*) from public.wheel_prizes where is_losing) = 1, 'une case perdante';
  assert (select data -> 'modules' ->> 'battle' from public.settings) = 'true', 'réglages chargés';
end $$;

-- Événements : bon jour et bonne heure à Bruxelles.
do $$ declare r record; begin
  for r in select title_fr, starts_at from public.events loop
    if r.title_fr = 'Cutsession' then
      assert extract(isodow from r.starts_at at time zone 'Europe/Brussels') = 6, 'Cutsession le samedi';
      assert to_char(r.starts_at at time zone 'Europe/Brussels', 'HH24:MI') = '18:00', 'Cutsession à 18h';
    elsif r.title_fr = 'Cut and Talk' then
      assert extract(isodow from r.starts_at at time zone 'Europe/Brussels') = 5, 'Cut and Talk le vendredi';
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rôle anon (tablette)
set role anon;
select set_config('request.jwt.claim.sub', '', false);

do $$ begin
  assert (select count(*) from public.get_public_events()) >= 15, 'anon voit les événements publics';
  assert (select count(*) from public.quiz_questions) >= 80, 'anon lit les questions';
  assert (select count(*) from public.get_wheel_segments()) = 5, 'anon lit les segments';
  assert (select count(*) from public.services) = 21, 'anon lit les prestations';
  assert (select student_price from public.services where name_fr = 'Coupe taper') = 22, 'tarif étudiant de la coupe taper';
end $$;

-- anon ne peut pas modifier les prestations.
do $$ begin
  begin
    update public.services set price = 0;
    raise exception 'anon a pu modifier les prestations';
  exception when insufficient_privilege then null;
  end;
end $$;

-- anon ne peut pas lire les données personnelles.
do $$ begin
  begin
    perform * from public.event_registrations;
    raise exception 'anon a pu lire event_registrations';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.newsletter_subscribers;
    raise exception 'anon a pu lire newsletter_subscribers';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.staff_settings;
    raise exception 'anon a pu lire le code PIN';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.invoice_requests;
    raise exception 'anon a pu lire invoice_requests';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.wheel_prizes;
    raise exception 'anon a pu lire les probabilités';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.redeem_code('ABCDEF');
    raise exception 'anon a pu valider un code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.check_pin_internal('2468', 'x');
    raise exception 'anon a pu appeler check_pin_internal';
  exception when insufficient_privilege then null;
  end;
end $$;

-- anon ne peut pas modifier les contenus.
do $$ begin
  begin
    update public.settings set data = '{}'::jsonb;
    raise exception 'anon a pu modifier les réglages';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Insertions autorisées.
insert into public.product_requests (first_name, product_ids, product_names, profile, tablet) values ('Sam', '{a}', '{Huile}', '{"hair":"fine"}', 'Tablette 1');
insert into public.invoice_requests (company, vat, address, email, first_name, last_name, consent, tablet)
  values ('Studio SRL', 'BE0123456749', 'Rue X 1, 7000 Mons', 'compta@studio.be', 'Alex', 'Martin', true, 'Tablette 2');
insert into public.desk_requests (kind, tablet) values ('gift', 'Tablette 3');
insert into public.game_plays (game, players, ref, tablet) values ('battle', 3, 'b1', 'Tablette 1');
insert into public.stop10_scores (pseudo, delta_ms, elapsed_ms, tablet) values ('Flash', 30, 10030, 'Tablette 1');

do $$ begin
  assert (select count(*) from public.stop10_scores) = 1, 'classement du jour lisible';
  begin
    insert into public.product_requests (first_name, status) values ('Triche', 'done');
    raise exception 'anon a pu insérer une demande déjà traitée';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- Inscriptions : capacité contrôlée.
reset role;
update public.events set capacity = 3 where id = (select id from public.events where title_fr = 'Chut' order by starts_at limit 1);
set role anon;

do $$ declare v_event uuid; v_res jsonb; begin
  select id into v_event from public.get_public_events() where title_fr = 'Chut' order by starts_at limit 1;
  v_res := public.register_event(v_event, 'Lina', 'Dupont', 'Lina@Example.com', 2, true, true, 'Tablette 1');
  assert (v_res ->> 'ok')::boolean, 'première inscription acceptée : ' || v_res::text;
  assert (v_res ->> 'seats_left')::int = 1, 'une place restante';
  v_res := public.register_event(v_event, 'Tom', 'Durand', 'tom@example.com', 2, false, true, 'Tablette 2');
  assert v_res ->> 'error' = 'not_enough', 'pas assez de places : ' || v_res::text;
  v_res := public.register_event(v_event, 'Tom', 'Durand', 'tom@example.com', 1, false, true, 'Tablette 2');
  assert (v_res ->> 'ok')::boolean, 'dernière place acceptée';
  v_res := public.register_event(v_event, 'Zoé', 'Leroy', 'zoe@example.com', 1, false, true, 'Tablette 3');
  assert v_res ->> 'error' = 'full', 'événement complet : ' || v_res::text;
  v_res := public.register_event(v_event, 'Zoé', 'Leroy', 'zoe@example.com', 1, false, false, 'Tablette 3');
  assert v_res ->> 'error' = 'consent', 'consentement obligatoire';
  v_res := public.register_event(v_event, 'Zoé', 'Leroy', 'pas un mail', 1, false, true, 'Tablette 3');
  assert v_res ->> 'error' = 'invalid', 'mail invalide refusé';
  assert (select seats_left from public.get_public_events() where id = v_event) = 0, 'places restantes à zéro';
end $$;

-- Roue désactivée par défaut.
do $$ begin
  assert public.spin_wheel('staff', '2468', 'Tablette 1') ->> 'error' = 'disabled', 'roue désactivée';
end $$;

reset role;
update public.settings set data = jsonb_set(data, '{modules,wheel}', 'true'::jsonb);
set role anon;

do $$ declare v_res jsonb; begin
  assert public.verify_wheel_pin('0000', 'Tablette 1') ->> 'error' = 'pin', 'mauvais PIN refusé';
  assert (public.verify_wheel_pin('2468', 'Tablette 1') ->> 'ok')::boolean, 'bon PIN accepté';
  v_res := public.spin_wheel('staff', '9999', 'Tablette 1');
  assert v_res ->> 'error' = 'pin', 'spin avec mauvais PIN refusé';
  v_res := public.spin_wheel('staff', '2468', 'Tablette 1');
  assert (v_res ->> 'ok')::boolean, 'spin staff : ' || v_res::text;
  assert (v_res ->> 'is_losing')::boolean or (v_res ->> 'code') ~ '^[A-HJ-NP-Z2-9]{6}$', 'code gagnant au bon format';
  v_res := public.spin_wheel('battle', null, 'Tablette 4');
  assert (v_res ->> 'ok')::boolean, 'tour offert après Battle';
  v_res := public.spin_wheel('battle', null, 'Tablette 4');
  assert v_res ->> 'error' = 'rate', 'deuxième tour automatique trop rapproché refusé';
  v_res := public.spin_wheel('hack', null, 'Tablette 4');
  assert v_res ->> 'error' = 'invalid', 'raison inconnue refusée';
end $$;

-- Blocage après 8 échecs.
do $$ declare i int; begin
  for i in 1..8 loop perform public.verify_wheel_pin('1111', 'Tablette 2'); end loop;
  assert public.verify_wheel_pin('2468', 'Tablette 2') ->> 'error' = 'locked', 'roue bloquée après trop d''essais';
end $$;

reset role;
delete from public.pin_attempts;

-- Distribution du tirage : sur 3000 tours, chaque gain est proche de sa probabilité.
do $$ declare i int; v_res jsonb; begin
  for i in 1..3000 loop
    v_res := public.spin_wheel('staff', '2468', 'Stat');
    assert (v_res ->> 'ok')::boolean, 'spin statistique';
    delete from public.pin_attempts;
  end loop;
end $$;

do $$ declare r record; v_total numeric; begin
  select count(*) into v_total from public.wheel_spins where tablet = 'Stat';
  for r in
    select p.label_fr, p.weight, count(s.id)::numeric / v_total * 100 as pct
    from public.wheel_prizes p left join public.wheel_spins s on s.prize_id = p.id and s.tablet = 'Stat'
    group by p.id
  loop
    assert abs(r.pct - r.weight) < 4, format('probabilité de %s : %s %% au lieu de %s %%', r.label_fr, round(r.pct, 1), r.weight);
  end loop;
  assert (select count(distinct code) = count(code) from public.wheel_spins), 'codes uniques';
end $$;

-- Stock limité : un gain épuisé n'est plus tiré.
update public.wheel_prizes set stock = 1, weight = 1000 where label_fr = 'Une bière offerte';
do $$ declare v_res jsonb; v_count int := 0; i int; begin
  for i in 1..50 loop
    v_res := public.spin_wheel('staff', '2468', 'Stock');
    delete from public.pin_attempts;
    if v_res ->> 'label_fr' = 'Une bière offerte' then v_count := v_count + 1; end if;
  end loop;
  assert v_count = 1, 'gain tiré une seule fois avec un stock de 1 : ' || v_count;
  assert (select stock from public.wheel_prizes where label_fr = 'Une bière offerte') = 0, 'stock à zéro';
  assert not exists (select 1 from public.get_wheel_segments() where label_fr = 'Une bière offerte'), 'segment épuisé masqué';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Admin authentifié
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);

do $$ declare v_code text; v_res jsonb; begin
  assert (select count(*) from public.event_registrations) = 2, 'admin lit les inscriptions';
  assert (select count(*) from public.newsletter_subscribers where email = 'lina@example.com') = 1, 'newsletter enregistrée en minuscules';
  assert (select wheel_pin from public.staff_settings) = '2468', 'admin lit le PIN';
  select code into v_code from public.wheel_spins where code is not null limit 1;
  v_res := public.redeem_code(lower(v_code));
  assert (v_res ->> 'ok')::boolean, 'code validé : ' || v_res::text;
  v_res := public.redeem_code(v_code);
  assert v_res ->> 'error' = 'used', 'code déjà utilisé';
  v_res := public.redeem_code('ZZZZZZ');
  assert v_res ->> 'error' = 'unknown', 'code inconnu';
  update public.staff_settings set wheel_pin = '1357';
  update public.product_requests set status = 'done';
end $$;

-- Purge RGPD : les inscriptions d'un événement terminé depuis plus de 90 jours disparaissent.
reset role;
insert into public.events (id, title_fr, starts_at, capacity) values ('00000000-0000-0000-0000-0000000000e1', 'Ancien', now() - interval '120 days', 10);
insert into public.event_registrations (event_id, first_name, last_name, email, seats, consent) values ('00000000-0000-0000-0000-0000000000e1', 'Old', 'Timer', 'old@example.com', 1, true);
set role authenticated;
do $$ declare v_res jsonb; begin
  v_res := public.purge_personal_data();
  assert (v_res ->> 'registrations')::int = 1, 'purge : ' || v_res::text;
  assert (select count(*) from public.event_registrations) = 2, 'inscriptions récentes conservées';
end $$;

-- Un utilisateur connecté qui n'est pas admin ne voit rien de personnel.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b002', false);
do $$ begin
  assert (select count(*) from public.event_registrations) = 0, 'non admin : aucune inscription visible';
  assert (select count(*) from public.staff_settings) = 0, 'non admin : PIN invisible';
  assert public.redeem_code('ABCDEF') ->> 'error' = 'forbidden', 'non admin : validation interdite';
  begin
    perform public.purge_personal_data();
    raise exception 'non admin : purge autorisée';
  exception when insufficient_privilege then null;
  end;
end $$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform public.purge_personal_data();
    raise exception 'anon : purge autorisée';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. Cutshop Arcade : serveur autoritaire des mini jeux (supabase/migrations/20261018000002_arcade.sql)

-- Vérifie qu'un appel échoue avec l'erreur métier attendue ('arcade:<code>').
create or replace function public.test_arcade_expect(p_sql text, p_code text)
returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'attendu arcade:% pour %', p_code, p_sql;
exception when others then
  if sqlerrm <> 'arcade:' || p_code then
    raise exception 'attendu arcade:% pour %, obtenu : %', p_code, p_sql, sqlerrm;
  end if;
end;
$$;

-- Les tablettes n'ont aucun accès direct aux tables ni aux fonctions d'administration.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform * from public.arcade_scores;
    raise exception 'anon a pu lire arcade_scores';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.arcade_devices (token, table_no) values ('tok-pirate-0001', 1);
    raise exception 'anon a pu s''associer à une table';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.arcade_admin_pair_device('tok-pirate-0001', 1);
    raise exception 'anon a pu appeler arcade_admin_pair_device';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.arcade_admin_scores(10);
    raise exception 'anon a pu appeler arcade_admin_scores';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.arcade_admin_reset(null);
    raise exception 'anon a pu appeler arcade_admin_reset';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.arcade_housekeeping(0);
    raise exception 'anon a pu appeler une fonction interne';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tablette inconnue : enregistrée sans table, aucune action de jeu possible.
do $$ declare v jsonb; begin
  v := public.arcade_snapshot('tok-table-1-aaaa');
  assert v -> 'table' = 'null'::jsonb, 'tablette non associée : ' || v::text;
  assert jsonb_array_length(v -> 'tables') = 4, 'quatre tables listées';
  assert v -> 'tables' -> 0 ->> 'status' = 'offline', 'table 1 hors ligne';
  assert v -> 'invites' = '[]'::jsonb and v -> 'room' = 'null'::jsonb, 'ni invitation ni partie';
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'std', '[2]') $q$, 'not_paired');
  perform public.test_arcade_expect($q$ select public.arcade_start_solo('tok-table-1-aaaa', 'pour', 'std') $q$, 'not_paired');
end $$;

-- Un compte connecté non admin est refusé.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b002', false);
do $$ begin
  perform public.test_arcade_expect($q$ select public.arcade_admin_pair_device('tok-table-1-aaaa', 1) $q$, 'not_allowed');
  perform public.test_arcade_expect($q$ select public.arcade_admin_scores(10) $q$, 'not_allowed');
  perform public.test_arcade_expect($q$ select public.arcade_admin_rename('a', 'b') $q$, 'not_allowed');
end $$;

-- Association des tablettes par l'admin ; une nouvelle tablette sur une table en dissocie l'ancienne.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$ begin
  perform public.arcade_admin_pair_device('tok-table-1-aaaa', 1);
  perform public.arcade_admin_pair_device('tok-table-2-aaaa', 2);
  perform public.arcade_admin_pair_device('tok-table-3-aaaa', 3);
  perform public.arcade_admin_pair_device('tok-old-table-4', 4);
  perform public.arcade_admin_pair_device('tok-table-4-aaaa', 4);
  perform public.test_arcade_expect($q$ select public.arcade_admin_pair_device('tok-table-4-aaaa', 5) $q$, 'invalid');
end $$;
reset role;
do $$ begin
  assert (select table_no from public.arcade_devices where token = 'tok-old-table-4') is null, 'ancienne tablette de la table 4 dissociée';
  assert (select count(*) from public.arcade_devices where table_no is not null) = 4, 'quatre tablettes associées';
end $$;

-- Duel complet : invitation, prêt, départ synchronisé, résultats, classement et scores.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ declare v jsonb; v_room text; begin
  perform public.arcade_snapshot('tok-table-' || t || '-aaaa') from generate_series(1, 4) t;
  v := public.arcade_snapshot('tok-table-1-aaaa');
  assert (v ->> 'table')::int = 1, 'table 1 associée';
  assert (select bool_and(x ->> 'status' = 'available') from jsonb_array_elements(v -> 'tables') x), 'tables disponibles : ' || (v -> 'tables')::text;

  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'connard', 'pour', 'std', '[2]') $q$, 'invalid');
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'hard', '[2]') $q$, 'invalid');
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'std', '[1]') $q$, 'invalid');
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'std', '[5]') $q$, 'invalid');

  v := public.arcade_create_room('tok-table-1-aaaa', '  Alpha  ', 'pour', 'std', '[2, 2, 1]');
  v_room := v ->> 'id';
  perform set_config('arcade.test_duel', v_room, false);
  assert v ->> 'mode' = 'duel' and v ->> 'status' = 'lobby' and (v ->> 'host')::int = 1, 'duel créé : ' || v::text;
  assert (v ->> 'duration_ms')::int = 60000 and v -> 'claims' = '{}'::jsonb, 'durée Perfect Pour';
  assert jsonb_array_length(v -> 'players') = 2, 'deux joueurs';
  assert v -> 'players' -> 0 ->> 'pseudo' = 'Alpha' and v -> 'players' -> 0 ->> 'state' = 'joined', 'organisateur en premier';
  assert v -> 'players' -> 1 ->> 'state' = 'invited'
    and (v -> 'players' -> 1 ->> 'expires_at')::bigint = (v ->> 'created_at')::bigint + 45000, 'invitation de 45 s';

  v := public.arcade_snapshot('tok-table-2-aaaa');
  assert v -> 'tables' -> 1 ->> 'status' = 'invited', 'table 2 invitée';
  assert jsonb_array_length(v -> 'invites') = 1 and v -> 'invites' -> 0 ->> 'room_id' = v_room
    and v -> 'invites' -> 0 ->> 'host_pseudo' = 'Alpha' and v -> 'invites' -> 0 ->> 'game' = 'pour', 'invitation reçue : ' || (v -> 'invites')::text;

  -- L'organisateur est déjà dans une partie.
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'std', '[3]') $q$, 'busy');

  v := public.arcade_respond('tok-table-2-aaaa', v_room, true, 'Bravo');
  assert v -> 'players' -> 1 ->> 'state' = 'joined' and v -> 'players' -> 1 ->> 'pseudo' = 'Bravo', 'invitation acceptée';
  assert public.arcade_snapshot('tok-table-2-aaaa') -> 'tables' -> 1 ->> 'status' = 'waiting', 'table 2 en attente';
  -- Une table déjà dans une partie ne peut pas être invitée.
  perform public.test_arcade_expect(format($q$ select public.arcade_create_room('tok-table-3-aaaa', 'Charlie', 'pour', 'std', '[2]') $q$), 'unavailable');
  perform public.test_arcade_expect(format('select public.arcade_respond(%L, %L, true, %L)', 'tok-table-2-aaaa', v_room, 'Bravo'), 'expired');
  perform public.test_arcade_expect(format('select public.arcade_start(%L, %L)', 'tok-table-1-aaaa', v_room), 'not_ready');
  perform public.arcade_set_ready('tok-table-2-aaaa', v_room, true);
  perform public.test_arcade_expect(format('select public.arcade_start(%L, %L)', 'tok-table-2-aaaa', v_room), 'not_allowed');
  perform public.test_arcade_expect(format('select public.arcade_start(%L, %L)', 'tok-table-3-aaaa', 'r-inconnue'), 'not_found');
  v := public.arcade_start('tok-table-1-aaaa', v_room);
  assert v ->> 'status' = 'playing' and v ->> 'mode' = 'duel', 'partie lancée';
  assert (v ->> 'starts_at')::bigint between public.now_ms() + 3000 and public.now_ms() + 4000, 'compte à rebours de 4 s';
  assert (v ->> 'ends_at')::bigint = (v ->> 'starts_at')::bigint + 60000, 'fin = départ + durée';
  assert public.arcade_snapshot('tok-table-1-aaaa') -> 'tables' -> 0 ->> 'status' = 'playing', 'table 1 en jeu';
  assert public.arcade_snapshot('tok-table-1-aaaa') -> 'room' ->> 'seed' = public.arcade_snapshot('tok-table-2-aaaa') -> 'room' ->> 'seed', 'même graine';
  -- Résultat envoyé avant la fin officielle.
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 500, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_room), 'too_early');
end $$;

-- Simule la fin du temps de jeu.
reset role;
update public.arcade_rooms set starts_at = public.now_ms() - 64000, ends_at = public.now_ms() - 100 where id = current_setting('arcade.test_duel');
set role anon;

do $$ declare v jsonb; v_room text := current_setting('arcade.test_duel'); begin
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 99999, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_room), 'implausible');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 3000, '{"glasses":5}') $q$, 'tok-table-1-aaaa', v_room), 'implausible');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 12.5, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_room), 'implausible');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 500, '{}') $q$, 'tok-table-3-aaaa', v_room), 'not_allowed');
  v := public.arcade_submit_result('tok-table-1-aaaa', v_room, 1200, '{"glasses":20}');
  assert v ->> 'status' = 'playing' and (v -> 'players' -> 0 ->> 'score')::int = 1200, 'premier résultat enregistré';
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 900, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_room), 'duplicate');
  v := public.arcade_submit_result('tok-table-2-aaaa', v_room, 1500, '{"glasses":20}');
  assert v ->> 'status' = 'finished', 'partie terminée : ' || v::text;
  assert (v -> 'players' -> 1 ->> 'rank')::int = 1 and (v -> 'players' -> 0 ->> 'rank')::int = 2, 'classement : ' || (v -> 'players')::text;
  -- Les deux tables voient le même résultat.
  assert public.arcade_snapshot('tok-table-1-aaaa') -> 'room' -> 'players' = public.arcade_snapshot('tok-table-2-aaaa') -> 'room' -> 'players', 'résultat identique';
  v := public.arcade_scores(0);
  assert jsonb_array_length(v) = 2, 'deux scores : ' || v::text;
  assert exists (select 1 from jsonb_array_elements(v) s where s ->> 'id' = v_room || ':2' and (s ->> 'table')::int = 2
    and s ->> 'mode' = 'duel' and (s ->> 'rank')::int = 1 and (s ->> 'players')::int = 2 and (s ->> 'score')::int = 1500
    and s ->> 'pseudo' = 'Bravo' and s ->> 'room_id' = v_room), 'ligne de score du vainqueur';
  assert jsonb_array_length(public.arcade_scores(public.now_ms() + 1000)) = 0, 'filtre p_since';
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 900, '{"glasses":20}') $q$, 'tok-table-2-aaaa', v_room), 'duplicate');

  -- Revanche : nouvelle salle qui attend la confirmation de l'adversaire.
  v := public.arcade_rematch('tok-table-2-aaaa', v_room, 'Bravo');
  assert v ->> 'status' = 'lobby' and (v ->> 'host')::int = 2 and v ->> 'rematch_of' = v_room and v ->> 'game' = 'pour', 'revanche : ' || v::text;
  assert v -> 'players' -> 1 ->> 'state' = 'invited' and (v -> 'players' -> 1 ->> 'table')::int = 1, 'adversaire réinvité';
  perform public.test_arcade_expect(format('select public.arcade_start(%L, %L)', 'tok-table-2-aaaa', v ->> 'id'), 'not_ready');
  v := public.arcade_leave('tok-table-2-aaaa', v ->> 'id');
  assert v ->> 'status' = 'cancelled', 'l''organisateur annule la revanche';
end $$;

-- Refus, invitation expirée, déconnexion dans le lobby.
do $$ declare v jsonb; v_room text; begin
  v := public.arcade_create_room('tok-table-3-aaaa', 'Charlie', 'barber', 'std', '[4]');
  v_room := v ->> 'id';
  v := public.arcade_respond('tok-table-4-aaaa', v_room, false, '');
  assert v -> 'players' -> 1 ->> 'state' = 'declined', 'invitation refusée';
  assert public.arcade_snapshot('tok-table-4-aaaa') -> 'tables' -> 3 ->> 'status' = 'available', 'table 4 disponible après refus';
  perform public.test_arcade_expect(format('select public.arcade_start(%L, %L)', 'tok-table-3-aaaa', v_room), 'not_ready');
  perform public.arcade_leave('tok-table-3-aaaa', v_room);

  v := public.arcade_create_room('tok-table-3-aaaa', 'Charlie', 'beat', 'hard', '[4]');
  perform set_config('arcade.test_expire', v ->> 'id', false);
  assert (v ->> 'duration_ms')::int = 72000, 'durée Beat Drop';
  v := public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'findit', 'race', '[2, 4]');
  perform set_config('arcade.test_offline', v ->> 'id', false);
  assert v ->> 'mode' = 'battle', 'deux invités : battle';
  perform public.arcade_respond('tok-table-2-aaaa', v ->> 'id', true, 'Bravo');
end $$;
reset role;
update public.arcade_room_players set expires_at = public.now_ms() - 1 where room_id = current_setting('arcade.test_expire') and table_no = 4;
-- La table 2 ne donne plus signe de vie.
update public.arcade_devices set last_seen = public.now_ms() - 16000 where table_no = 2;
set role anon;
do $$ declare v jsonb; v_room text; begin
  v := public.arcade_snapshot('tok-table-4-aaaa');
  assert jsonb_array_length(v -> 'invites') = 1 and v -> 'invites' -> 0 ->> 'room_id' = current_setting('arcade.test_offline'), 'invitation expirée masquée : ' || (v -> 'invites')::text;
  perform public.test_arcade_expect(format('select public.arcade_respond(%L, %L, true, %L)', 'tok-table-4-aaaa', current_setting('arcade.test_expire'), 'Delta'), 'expired');
  assert v -> 'tables' -> 1 ->> 'status' = 'offline', 'table 2 hors ligne';
  v := public.arcade_snapshot('tok-table-1-aaaa');
  assert v -> 'room' -> 'players' -> 1 ->> 'state' = 'left', 'table déconnectée sortie du lobby : ' || (v -> 'room')::text;
  assert v -> 'tables' -> 3 ->> 'status' = 'invited', 'table 4 invitée';
  perform public.arcade_snapshot('tok-table-2-aaaa');
  -- Accepter une invitation refuse les autres invitations en attente.
  v_room := public.arcade_create_room('tok-table-2-aaaa', 'Bravo', 'pour', 'std', '[4]') ->> 'id';
  perform public.arcade_respond('tok-table-4-aaaa', v_room, true, 'Delta');
  v := public.arcade_snapshot('tok-table-1-aaaa');
  assert v -> 'room' -> 'players' -> 2 ->> 'state' = 'declined', 'autre invitation refusée implicitement';
  perform public.arcade_leave('tok-table-1-aaaa', v -> 'room' ->> 'id');
  perform public.arcade_leave('tok-table-2-aaaa', v_room);
  perform public.arcade_leave('tok-table-3-aaaa', current_setting('arcade.test_expire'));
end $$;

-- Limite d'invitations : 6 sur 2 minutes par défaut.
reset role;
insert into public.arcade_invite_log (from_table, at) select 3, public.now_ms() from generate_series(1, 5);
set role anon;
do $$ begin
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-3-aaaa', 'Charlie', 'pour', 'std', '[1]') $q$, 'rate_limited');
end $$;
reset role;
delete from public.arcade_invite_log;
set role anon;

-- Délai de grâce dépassé : la table muette est classée en abandon, l'autre gagne.
do $$ declare v jsonb; v_room text; begin
  v := public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'pour', 'std', '[2]');
  v_room := v ->> 'id';
  perform set_config('arcade.test_grace', v_room, false);
  perform public.arcade_respond('tok-table-2-aaaa', v_room, true, 'Bravo');
  perform public.arcade_set_ready('tok-table-2-aaaa', v_room, true);
  perform public.arcade_start('tok-table-1-aaaa', v_room);
end $$;
reset role;
update public.arcade_rooms set starts_at = public.now_ms() - 64000, ends_at = public.now_ms() - 100 where id = current_setting('arcade.test_grace');
set role anon;
do $$ declare v_room text := current_setting('arcade.test_grace'); begin
  perform public.arcade_submit_result('tok-table-1-aaaa', v_room, 400, '{"glasses":10}');
end $$;
reset role;
update public.arcade_rooms set ends_at = public.now_ms() - 20001 where id = current_setting('arcade.test_grace');
set role anon;
do $$ declare v jsonb; v_room text := current_setting('arcade.test_grace'); begin
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_result(%L, %L, 500, '{"glasses":20}') $q$, 'tok-table-2-aaaa', v_room), 'too_late');
  v := public.arcade_snapshot('tok-table-2-aaaa') -> 'room';
  assert v ->> 'id' = v_room and v ->> 'status' = 'finished', 'partie terminée à l''échéance : ' || coalesce(v::text, 'null');
  assert (v -> 'players' -> 1 ->> 'abandoned')::boolean and (v -> 'players' -> 1 ->> 'rank')::int = 2, 'abandon classé dernier';
  assert (v -> 'players' -> 0 ->> 'rank')::int = 1, 'l''autre joueur gagne';
  assert (select count(*) from jsonb_array_elements(public.arcade_scores(0)) s where s ->> 'room_id' = v_room) = 1, 'un seul score enregistré';
end $$;

-- Find It, chasse compétitive : chaque objet n'est attribué qu'une fois, au premier.
do $$ declare v jsonb; v_room text; begin
  v := public.arcade_create_room('tok-table-1-aaaa', 'Alpha', 'findit', 'hunt', '[2]');
  v_room := v ->> 'id';
  perform set_config('arcade.test_hunt', v_room, false);
  perform public.arcade_respond('tok-table-2-aaaa', v_room, true, 'Bravo');
  perform public.arcade_set_ready('tok-table-2-aaaa', v_room, true);
  perform public.arcade_start('tok-table-1-aaaa', v_room);
  -- Pas de réclamation pendant le compte à rebours.
  perform public.test_arcade_expect(format('select public.arcade_claim(%L, %L, %L)', 'tok-table-2-aaaa', v_room, '0:comb'), 'not_allowed');
end $$;
reset role;
update public.arcade_rooms set starts_at = public.now_ms() - 1000, ends_at = public.now_ms() + 89000 where id = current_setting('arcade.test_hunt');
set role anon;
do $$ declare v jsonb; v_room text := current_setting('arcade.test_hunt'); begin
  v := public.arcade_claim('tok-table-2-aaaa', v_room, '0:comb');
  assert v = '{"won": true, "owner": 2}'::jsonb, 'premier arrivé : ' || v::text;
  v := public.arcade_claim('tok-table-1-aaaa', v_room, '0:comb');
  assert v = '{"won": false, "owner": 2}'::jsonb, 'déjà trouvé : ' || v::text;
  perform public.test_arcade_expect(format('select public.arcade_claim(%L, %L, %L)', 'tok-table-2-aaaa', v_room, '0:vinyl'), 'rate_limited');
  perform public.test_arcade_expect(format('select public.arcade_claim(%L, %L, %L)', 'tok-table-1-aaaa', v_room, 'BAD'), 'invalid');
end $$;
reset role;
update public.arcade_claim_log set at = at - 400;
set role anon;
do $$ declare v_room text := current_setting('arcade.test_hunt'); begin
  perform public.arcade_claim('tok-table-2-aaaa', v_room, '0:vinyl');
  perform public.arcade_claim('tok-table-1-aaaa', v_room, '0:mic');
end $$;
reset role;
update public.arcade_rooms set ends_at = public.now_ms() - 10 where id = current_setting('arcade.test_hunt');
set role anon;
do $$ declare v jsonb; v_room text := current_setting('arcade.test_hunt'); begin
  -- Le score officiel vient des objets attribués, pas de ce que la tablette annonce.
  perform public.arcade_submit_result('tok-table-2-aaaa', v_room, 99999, '{"wrong":1}');
  v := public.arcade_submit_result('tok-table-1-aaaa', v_room, 5000, '{"wrong":0}');
  assert v ->> 'status' = 'finished', 'chasse terminée';
  assert (v -> 'players' -> 1 ->> 'score')::int = 190 and (v -> 'players' -> 1 ->> 'rank')::int = 1, 'table 2 : ' || (v -> 'players')::text;
  assert (v -> 'players' -> 0 ->> 'score')::int = 100 and (v -> 'players' -> 0 ->> 'rank')::int = 2, 'table 1 : ' || (v -> 'players')::text;
  assert v -> 'claims' = '{"0:comb": 2, "0:vinyl": 2, "0:mic": 1}'::jsonb, 'objets attribués : ' || (v -> 'claims')::text;
end $$;

-- Solo : durée minimale, un seul enregistrement, pseudo filtré, jeu désactivé.
do $$ declare v jsonb; begin
  v := public.arcade_start_solo('tok-table-1-aaaa', 'pour', 'std');
  perform set_config('arcade.test_solo', v ->> 'id', false);
  assert (v ->> 'started_at')::bigint = (v ->> 'now')::bigint and (v ->> 'seed')::bigint between 0 and 4294967295, 'session solo : ' || v::text;
  perform public.test_arcade_expect($q$ select public.arcade_start_solo('tok-table-1-aaaa', 'pour', 'std') $q$, 'rate_limited');
  perform public.test_arcade_expect($q$ select public.arcade_start_solo('tok-table-2-aaaa', 'findit', 'hunt') $q$, 'invalid');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'Léa', 800, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v ->> 'id'), 'too_early');
end $$;
reset role;
update public.arcade_solo set started_at = started_at - 59000 where id = current_setting('arcade.test_solo');
update public.settings set data = jsonb_set(data, '{arcade}', '{"games":{"beat":false}}'::jsonb);
set role anon;
do $$ declare v jsonb; v_id text := current_setting('arcade.test_solo'); begin
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'Léa', 800, '{"glasses":20}') $q$, 'tok-table-2-aaaa', v_id), 'not_found');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'Léa', 8001, '{"glasses":30}') $q$, 'tok-table-1-aaaa', v_id), 'implausible');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'connard', 800, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_id), 'invalid');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'Sale PD', 800, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_id), 'invalid');
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, ' x ', 800, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_id), 'invalid');
  v := public.arcade_submit_solo('tok-table-1-aaaa', v_id, 'Léa', 800, '{"glasses":20}');
  assert v ->> 'mode' = 'solo' and v ->> 'pseudo' = 'Léa' and (v ->> 'table')::int = 1 and (v ->> 'score')::int = 800
    and v -> 'room_id' = 'null'::jsonb and v -> 'rank' = 'null'::jsonb and v ->> 'id' = v_id, 'score solo : ' || v::text;
  perform public.test_arcade_expect(format($q$ select public.arcade_submit_solo(%L, %L, 'Léa', 800, '{"glasses":20}') $q$, 'tok-table-1-aaaa', v_id), 'duplicate');
  -- Jeu désactivé dans les réglages.
  perform public.test_arcade_expect($q$ select public.arcade_start_solo('tok-table-3-aaaa', 'beat', 'easy') $q$, 'invalid');
  perform public.test_arcade_expect($q$ select public.arcade_create_room('tok-table-3-aaaa', 'Charlie', 'beat', 'easy', '[4]') $q$, 'invalid');
  perform public.arcade_start_solo('tok-table-3-aaaa', 'barber', 'std');
end $$;

-- Contrôles de cohérence (mêmes règles que validation.ts).
reset role;
do $$ begin
  assert public.arcade_is_plausible('barber', 'std', 9000, '{"served":23}'), 'barber au plafond';
  assert not public.arcade_is_plausible('barber', 'std', 9001, '{"served":23}'), 'barber au-delà du plafond';
  assert not public.arcade_is_plausible('barber', 'std', 1000, '{"served":2}'), 'barber : trop de points par client';
  assert public.arcade_is_plausible('findit', 'race', 1700, '{"found":10,"scenes":1}'), 'findit plausible';
  assert not public.arcade_is_plausible('findit', 'race', 1701, '{"found":10,"scenes":1}'), 'findit invraisemblable';
  assert public.arcade_is_plausible('beat', 'hard', 157200, '{"perfect":400,"good":0,"judgements":400}'), 'beat hard au plafond';
  assert not public.arcade_is_plausible('beat', 'easy', 48001, '{"perfect":400,"good":0,"judgements":400}'), 'beat easy au-delà du plafond';
  assert not public.arcade_is_plausible('beat', 'medium', 800, '{"perfect":2,"good":1,"judgements":2}'), 'beat : plus de touches que de notes';
  assert not public.arcade_is_plausible('pour', 'std', -1, '{"glasses":5}'), 'score négatif';
  assert public.arcade_is_plausible('pour', 'std', 0, '{"glasses":"x"}'), 'statistique non numérique comptée 0';
  assert public.arcade_pseudo_key('  Léa   MARTIN ') = 'lea martin', 'clé de pseudo';
  assert not public.arcade_is_offensive('Monique'), 'Monique autorisé';
  assert public.arcade_is_offensive('FuckYou'), 'fragment bloqué';
  assert public.arcade_is_offensive('c0n'), 'chiffres leet convertis';
end $$;

-- Administration : scores, renommage, parties, challenges, remise à zéro.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
do $$ declare v jsonb; v_n int; begin
  v := public.arcade_admin_scores(2);
  assert jsonb_array_length(v) = 2, 'admin : derniers scores';
  assert v -> 0 ->> 'mode' = 'solo', 'admin : plus récent en premier';
  v_n := public.arcade_admin_rename('LEA', 'Léa M');
  assert v_n = 1, 'renommage sans casse ni accents : ' || v_n;
  assert exists (select 1 from jsonb_array_elements(public.arcade_scores(0)) s where s ->> 'pseudo' = 'Léa M'), 'pseudo renommé';
  v := public.arcade_admin_rooms(50);
  assert jsonb_array_length(v) >= 8, 'admin : parties listées';
  assert v -> 0 ? 'players' and v -> 0 -> 'players' -> 0 ? 'abandoned', 'format AdminRoomRow';
  perform public.arcade_admin_save_challenge('{"id":"week-42","game":"pour","title_fr":"Perfect Pour Challenge","title_en":"Perfect Pour Challenge","description_fr":"","description_en":"","reward_fr":"Une bière","reward_en":"A beer","starts_at":"2026-10-12T00:00:00.000Z","ends_at":"2026-10-18T23:59:00.000Z","active":true}');
  perform public.arcade_admin_save_challenge('{"id":"week-42","game":"pour","title_fr":"Perfect Pour","title_en":"Perfect Pour","description_fr":"","description_en":"","reward_fr":"","reward_en":"","starts_at":"2026-10-12T00:00:00.000Z","ends_at":"2026-10-18T23:59:00.000Z","active":false}');
  perform public.test_arcade_expect($q$ select public.arcade_admin_save_challenge('{"id":"x","game":"pour","starts_at":"pas une date","ends_at":"2026-10-18T23:59:00.000Z"}') $q$, 'invalid');
  v := public.arcade_challenges();
  assert jsonb_array_length(v) = 1 and v -> 0 ->> 'title_fr' = 'Perfect Pour' and not (v -> 0 ->> 'active')::boolean, 'challenge modifié : ' || v::text;
  assert v -> 0 ->> 'starts_at' = '2026-10-12T00:00:00.000Z', 'date ISO : ' || (v -> 0 ->> 'starts_at');
  perform public.arcade_admin_delete_challenge('week-42');
  assert public.arcade_challenges() = '[]'::jsonb, 'challenge supprimé';
  perform public.arcade_admin_delete_score(current_setting('arcade.test_duel') || ':1');
  assert jsonb_array_length(public.arcade_scores(0)) = 5, 'score supprimé';
  v_n := public.arcade_admin_reset('findit');
  assert v_n = 2, 'remise à zéro de Find It : ' || v_n;
  v_n := public.arcade_admin_reset(null);
  assert v_n = 3, 'remise à zéro complète : ' || v_n;
end $$;

reset role;
update public.settings set data = data - 'arcade';
drop function public.test_arcade_expect(text, text);


-- ---------------------------------------------------------------------------
-- Beat Drop : musiques importées (lecture publique des morceaux actifs, écriture réservée à l'admin).
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
insert into public.beat_tracks (title, artist, audio_url, bpm, charts) values
  ('Morceau actif', 'Artiste', 'https://x.test/a.mp3', 120, '{"easy": [[2000, 0, 0]]}'),
  ('Morceau caché', 'Artiste', 'https://x.test/b.mp3', 98.5, '{"easy": [[2000, 1, 0]]}');
update public.beat_tracks set active = false where title = 'Morceau caché';
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select count(*) from public.beat_tracks) = 1, 'anon lit seulement les morceaux actifs';
  begin
    insert into public.beat_tracks (title, audio_url, bpm, charts) values ('Pirate', 'https://x.test/p.mp3', 120, '{}');
    raise exception 'anon a pu ajouter un morceau';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.beat_tracks;
    if (select count(*) from public.beat_tracks) <> 1 then raise exception 'anon a pu supprimer un morceau'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  begin
    insert into public.beat_tracks (title, audio_url, bpm, charts) values ('Tempo absurde', 'https://x.test/t.mp3', 400, '{}');
    raise exception 'tempo hors limites accepté';
  exception when check_violation then null;
  end;
end $$;
delete from public.beat_tracks;

select 'TOUS LES TESTS BASE DE DONNÉES SONT PASSÉS' as resultat;
