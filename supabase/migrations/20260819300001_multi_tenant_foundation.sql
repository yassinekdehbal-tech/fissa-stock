-- =============================================================
-- FISSA STOCK - fondation multi-tenant (SaaS)
-- Base vide au moment de l'ecriture (audit 19/08/2026) :
-- restructuration sans risque de perte de donnees.
-- =============================================================

-- 1) Organisations (exploitants du SaaS) -----------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  legal_name text not null default '',
  address text not null default '',
  siret text not null default '',
  vat_number text not null default '',
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.sites enable row level security;

-- Exploitant n1 : FISSA PIECE AUTO
insert into public.organizations (name, slug, legal_name)
values ('FISSA PIÈCE AUTO', 'fissa-piece-auto', 'FISSA PIÈCE AUTO');

insert into public.sites (org_id, name)
select id, 'Magasin principal' from public.organizations where slug = 'fissa-piece-auto';

-- 2) Rattachement des profils ---------------------------------
alter table public.profiles
  add column org_id uuid references public.organizations(id);
update public.profiles
  set org_id = (select id from public.organizations where slug = 'fissa-piece-auto')
  where org_id is null;
alter table public.profiles alter column org_id set not null;

-- 3) Helper : organisation de l'utilisateur courant ------------
create or replace function public.current_org_id()
returns uuid
language sql stable security definer
set search_path to 'public'
as $$ select org_id from public.profiles where id = auth.uid() $$;

-- 4) org_id sur toutes les tables metier -----------------------
alter table public.pieces             add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.stock_movements    add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.interventions      add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.intervention_parts add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.invoices           add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.invoice_lines      add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.sales              add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.sale_items         add column org_id uuid not null default public.current_org_id() references public.organizations(id);
alter table public.publications       add column org_id uuid not null default public.current_org_id() references public.organizations(id);

-- sales_channels contient les 9 canaux pre-remplis : backfill puis NOT NULL.
alter table public.sales_channels add column org_id uuid default public.current_org_id() references public.organizations(id);
update public.sales_channels
  set org_id = (select id from public.organizations where slug = 'fissa-piece-auto')
  where org_id is null;
alter table public.sales_channels alter column org_id set not null;

-- 5) Unicites globales -> unicites par organisation ------------
alter table public.pieces drop constraint pieces_ref_key;
alter table public.pieces add constraint pieces_org_ref_key unique (org_id, ref);

alter table public.sales_channels drop constraint sales_channels_key_key;
alter table public.sales_channels add constraint sales_channels_org_key_key unique (org_id, key);

alter table public.invoices drop constraint invoices_number_key;
alter table public.invoices add constraint invoices_org_number_key unique (org_id, number);

create index idx_pieces_org on public.pieces (org_id);
create index idx_mov_org on public.stock_movements (org_id);
create index idx_interv_org on public.interventions (org_id);
create index idx_inv_org on public.invoices (org_id);
create index idx_sales_org on public.sales (org_id);

-- 6) Provenance des pieces + site de rattachement --------------
alter table public.pieces add column source text not null default 'autre'
  check (source in ('don','demontage','lot-occasion','grossiste-neuf','web','autre'));
alter table public.pieces add column site_id uuid references public.sites(id);

-- 7) Inscription : le 1er inscrit D'UNE ORGANISATION devient admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_org uuid;
  v_count integer;
begin
  -- v1 : tout nouvel inscrit rejoint l'organisation par defaut.
  -- (la creation d'autres organisations passera par un RPC dedie)
  select id into v_org from public.organizations where slug = 'fissa-piece-auto';
  select count(*) into v_count from public.profiles where org_id = v_org;
  insert into public.profiles (id, name, username, role, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    case when v_count = 0 then 'admin'::public.user_role else 'user'::public.user_role end,
    v_org
  )
  on conflict (id) do nothing;
  return new;
end; $function$;

-- 8) Garde-fou profil : role ET organisation proteges ----------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.perm_magasinier := old.perm_magasinier;
    new.perm_vendeur := old.perm_vendeur;
    new.perm_historique := old.perm_historique;
  end if;
  -- le changement d'organisation est reserve au super-admin plateforme (plus tard)
  new.org_id := old.org_id;
  return new;
end; $function$;

-- 9) Numerotation de facture sequentielle PAR ORGANISATION -----
create table public.invoice_counters (
  org_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  last_value integer not null default 0,
  primary key (org_id, year)
);
alter table public.invoice_counters enable row level security;
-- Aucune policy : la table n'est accessible que via le trigger security definer.

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_year integer;
  v_next integer;
begin
  if new.number is null then
    v_year := extract(year from coalesce(new.date_issued, now()))::integer;
    insert into public.invoice_counters (org_id, year, last_value)
    values (new.org_id, v_year, 1)
    on conflict (org_id, year)
    do update set last_value = public.invoice_counters.last_value + 1
    returning last_value into v_next;
    new.number := 'FACT-' || v_year || '-' || lpad(v_next::text, 5, '0');
  end if;
  return new;
end; $function$;
