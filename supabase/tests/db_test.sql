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
    if r.title_fr = 'Cut Session' then
      assert extract(isodow from r.starts_at at time zone 'Europe/Brussels') = 6, 'Cut Session le samedi';
      assert to_char(r.starts_at at time zone 'Europe/Brussels', 'HH24:MI') = '21:00', 'Cut Session à 21h';
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
select 'TOUS LES TESTS BASE DE DONNÉES SONT PASSÉS' as resultat;
