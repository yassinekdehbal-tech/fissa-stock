-- =============================================================
-- FISSA STOCK - pièces NEUVES / OCCASION, photos multiples, fournisseurs
--
-- Le magasin référence des pièces neuves (achetées à des fournisseurs pour la
-- revente en boutique) et des pièces d'occasion (don, démontage, réutilisation).
--   - pieces.condition : 'neuve' | 'occasion' (provenances et photos adaptées)
--   - pieces.photos    : galerie (3 angles minimum pour une occasion) ;
--                        pieces.photo reste la photo principale (= photos[1])
--   - pieces.supplier_ref / pieces.ean : référence article et code-barres du
--     fournisseur, pour retrouver la pièce au comptoir à partir de la référence
--     donnée par le site du fournisseur (recherche par immatriculation / VIN)
--   - suppliers : fournisseurs de pièces neuves, par organisation
-- =============================================================

alter type public.piece_state add value if not exists 'Neuf';

alter table public.pieces add column condition text not null default 'occasion'
  check (condition in ('neuve', 'occasion'));
alter table public.pieces add column photos text[] not null default '{}';
alter table public.pieces add column supplier_ref text not null default '';
alter table public.pieces add column ean text not null default '';

update public.pieces set photos = array[photo] where coalesce(photo, '') <> '';
update public.pieces set condition = 'neuve' where source = 'grossiste-neuf';

alter table public.pieces drop constraint pieces_source_check;
alter table public.pieces add constraint pieces_source_check
  check (source in ('don', 'demontage', 'reutilisation', 'lot-occasion', 'grossiste-neuf', 'web', 'autre'));

create index idx_pieces_org_supplier_ref on public.pieces (org_id, supplier_ref) where supplier_ref <> '';
create index idx_pieces_org_ean on public.pieces (org_id, ean) where ean <> '';

-- Fournisseurs ----------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  name text not null,
  website text not null default '',
  phone text not null default '',
  notes text not null default '',
  sort integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint suppliers_name_check check (length(btrim(name)) between 1 and 80)
);
create unique index suppliers_org_name_key on public.suppliers (org_id, lower(name));
alter table public.suppliers enable row level security;

create policy suppliers_read on public.suppliers for select to authenticated
  using (org_id = public.current_org_id());
-- Ajout à la volée depuis le formulaire de référencement : admin ou magasinier
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));
create policy suppliers_admin_update on public.suppliers for update to authenticated
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());
create policy suppliers_admin_delete on public.suppliers for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());

-- Fournisseurs déjà saisis sur des pièces existantes
insert into public.suppliers (org_id, name)
select distinct org_id, btrim(supplier) from public.pieces
where coalesce(btrim(supplier), '') <> ''
on conflict do nothing;

alter publication supabase_realtime add table public.suppliers;
