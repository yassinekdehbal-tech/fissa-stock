-- Demandes entrantes du site public FISSA GROUPE (devis atelier, dépôt-vente,
-- demande de pièce). Insérées anonymement depuis le site, lues par l'exploitant.

create or replace function public.default_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations where slug = 'fissa-piece-auto' limit 1
$$;
revoke all on function public.default_org_id() from public;
grant execute on function public.default_org_id() to anon, authenticated;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org_id() references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('garage', 'auto', 'piece', 'contact')),
  name text not null check (char_length(name) between 2 and 120),
  phone text not null default '' check (char_length(phone) <= 40),
  email text not null default '' check (char_length(email) <= 160),
  vehicle text not null default '' check (char_length(vehicle) <= 160),
  message text not null default '' check (char_length(message) <= 2000),
  piece_id uuid,
  page text not null default '' check (char_length(page) <= 300),
  status text not null default 'nouveau' check (status in ('nouveau', 'traite', 'archive')),
  created_at timestamptz not null default now()
);
create index leads_org_created_idx on public.leads (org_id, created_at desc);

alter table public.leads enable row level security;

-- Le site public (clé publishable, rôle anon) ne peut qu'insérer, jamais lire.
create policy leads_anon_insert on public.leads for insert to anon
  with check (org_id = public.default_org_id() and (phone <> '' or email <> ''));

-- L'exploitant voit et traite ses demandes.
create policy leads_org_select on public.leads for select to authenticated
  using (org_id = public.current_org_id());
create policy leads_org_update on public.leads for update to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
create policy leads_org_delete on public.leads for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());
