-- Fichier de mise à jour : version de l'application par tablette (admin, Arcade, Tables).
-- À coller dans SQL Editor de Supabase, puis Run. Copie de supabase/migrations/20261023000001_arcade_app_version.sql.
alter table public.arcade_devices add column if not exists app_version text;

-- Appelée par chaque tablette (jeton de la tablette, version en cours).
create or replace function public.arcade_report_version(p_token text, p_version text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.arcade_devices set app_version = left(coalesce(p_version, ''), 40) where token = p_token;
$$;

-- Admin : version et dernière activité de la tablette de chaque table.
create or replace function public.arcade_admin_versions()
returns table (table_no smallint, app_version text, last_seen bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'arcade:not_allowed'; end if;
  return query select d.table_no, d.app_version, d.last_seen from public.arcade_devices d where d.table_no is not null order by d.table_no;
end;
$$;

revoke all on function public.arcade_report_version(text, text) from public;
revoke all on function public.arcade_admin_versions() from public;
grant execute on function public.arcade_report_version(text, text) to anon, authenticated;
grant execute on function public.arcade_admin_versions() to authenticated;
