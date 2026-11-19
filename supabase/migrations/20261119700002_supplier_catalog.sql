-- =============================================================
-- FISSA STOCK - catalogues (tarifs) fournisseurs + références associées
--
-- Besoin : au comptoir, à partir d'une référence trouvée chez un fournisseur,
-- sur PartsLink24, Oscaro…, savoir en une recherche si la pièce est en stock
-- chez nous (neuve ou occasion) et sinon chez quel fournisseur, à quel prix.
--   - supplier_catalog : lignes des fichiers tarifs importés (référence
--     fournisseur, EAN, désignation, prix) ; recherche par RPC.
--   - suppliers.search_url / import_mapping : lien de recherche sur le site
--     du fournisseur ({ref}) et correspondance des colonnes du dernier import.
--   - pieces.alt_refs : références associées à une pièce, ajoutées au fil des
--     ventes quand un vendeur retrouve la pièce par une autre référence.
-- =============================================================

alter table public.suppliers add column search_url text not null default '';
alter table public.suppliers add column import_mapping jsonb not null default '{}'::jsonb;
alter table public.suppliers add column catalog_imported_at timestamptz;

alter table public.pieces add column alt_refs text[] not null default '{}';

create table public.supplier_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  ref text not null,
  ref_norm text generated always as (regexp_replace(upper(ref), '[^A-Z0-9]', '', 'g')) stored,
  ean text not null default '',
  label text not null default '',
  family text not null default '',
  price_public numeric(10,2),
  price_net numeric(10,2),
  discount numeric(6,2),
  imported_at timestamptz not null default now(),
  constraint supplier_catalog_ref_check check (length(btrim(ref)) between 1 and 60)
);
create unique index supplier_catalog_org_supplier_ref_key on public.supplier_catalog (org_id, supplier_id, ref);
create index idx_supplier_catalog_ref_norm on public.supplier_catalog (org_id, ref_norm);
create index idx_supplier_catalog_ean on public.supplier_catalog (org_id, ean) where ean <> '';
create index idx_supplier_catalog_label on public.supplier_catalog using gin (to_tsvector('simple', label));
alter table public.supplier_catalog enable row level security;

create policy supplier_catalog_read on public.supplier_catalog for select to authenticated
  using (org_id = public.current_org_id());
create policy supplier_catalog_write on public.supplier_catalog for insert to authenticated
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));
create policy supplier_catalog_update on public.supplier_catalog for update to authenticated
  using (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')))
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));
create policy supplier_catalog_delete on public.supplier_catalog for delete to authenticated
  using (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));

-- Un magasinier peut mettre à jour la correspondance d'import et la date du catalogue
drop policy suppliers_admin_update on public.suppliers;
create policy suppliers_update on public.suppliers for update to authenticated
  using (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')))
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));

-- -------------------------------------------------------------
-- Recherche comptoir dans les catalogues fournisseurs : référence exacte
-- (séparateurs ignorés), EAN, début de référence, puis désignation.
-- -------------------------------------------------------------
create or replace function public.search_supplier_catalog(p_q text, p_limit integer default 40)
returns table (
  id uuid, supplier_id uuid, supplier_name text, search_url text,
  ref text, ean text, label text, family text,
  price_public numeric, price_net numeric, discount numeric, match text
)
language sql stable security invoker
set search_path to 'public'
as $$
  with n as (
    select regexp_replace(upper(coalesce(p_q, '')), '[^A-Z0-9]', '', 'g') as norm,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits,
           btrim(coalesce(p_q, '')) as raw
  ),
  hits as (
    select c.id, c.supplier_id, s.name as supplier_name, s.search_url, c.ref, c.ean, c.label, c.family,
           c.price_public, c.price_net, c.discount,
           case
             when length(n.norm) >= 2 and c.ref_norm = n.norm then 'ref'
             when length(n.digits) >= 8 and c.ean = n.digits then 'ean'
             when length(n.norm) >= 4 and c.ref_norm like n.norm || '%' then 'ref-prefix'
             else 'label'
           end as match
    from public.supplier_catalog c
    join public.suppliers s on s.id = c.supplier_id
    cross join n
    where c.org_id = public.current_org_id()
      and s.archived = false
      and (
        (length(n.norm) >= 2 and c.ref_norm = n.norm)
        or (length(n.digits) >= 8 and c.ean = n.digits)
        or (length(n.norm) >= 4 and c.ref_norm like n.norm || '%')
        or (length(n.raw) >= 4 and c.label ilike '%' || n.raw || '%')
      )
  )
  select * from hits
  order by case match when 'ref' then 0 when 'ean' then 1 when 'ref-prefix' then 2 else 3 end, supplier_name, ref
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;
revoke execute on function public.search_supplier_catalog(text, integer) from public, anon;
grant execute on function public.search_supplier_catalog(text, integer) to authenticated;

/** Nombre de lignes de catalogue par fournisseur (pour l'écran Fournisseurs). */
create or replace function public.supplier_catalog_counts()
returns table (supplier_id uuid, n bigint)
language sql stable security invoker
set search_path to 'public'
as $$
  select supplier_id, count(*) from public.supplier_catalog
  where org_id = public.current_org_id()
  group by supplier_id;
$$;
revoke execute on function public.supplier_catalog_counts() from public, anon;
grant execute on function public.supplier_catalog_counts() to authenticated;
