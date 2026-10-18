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
