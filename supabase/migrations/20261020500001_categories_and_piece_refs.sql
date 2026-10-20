-- =============================================================
-- FISSA STOCK - catégories paramétrables par l'exploitant
--                + génération des références de pièces
--
-- 1) Table `categories` (par organisation) : libellé, code à 2 lettres
--    sûres (sans I, O, Q), couleur, ordre, archivage.
-- 2) `pieces.cat` passe de l'enum figé `piece_category` à un texte
--    rattaché à `categories(org_id, key)`.
-- 3) Référence générée à l'insertion quand elle est vide :
--    code catégorie + numéro sur 4 positions (MT0142), toujours 6
--    caractères jusqu'à 32 999 pièces par catégorie, jamais recyclée.
-- =============================================================

-- 1) Catégories ------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  key text not null,
  label text not null,
  code text not null,
  color text not null default 'gray',
  sort integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint categories_org_key_key unique (org_id, key),
  constraint categories_org_code_key unique (org_id, code),
  -- 2 lettres majuscules, sans I, O ni Q (confusion avec 1 et 0)
  constraint categories_code_check check (code ~ '^[A-HJ-NPR-Z]{2}$'),
  constraint categories_key_check check (key ~ '^[a-z0-9-]{1,40}$'),
  constraint categories_label_check check (length(btrim(label)) between 1 and 60)
);
alter table public.categories enable row level security;

create policy categories_read on public.categories for select to authenticated
  using (org_id = public.current_org_id());
-- Boutique publique : libellés/couleurs visibles sans compte (aucune donnée sensible)
create policy categories_read_public on public.categories for select to anon
  using (true);
create policy categories_admin_insert on public.categories for insert to authenticated
  with check (org_id = public.current_org_id() and public.is_admin());
create policy categories_admin_update on public.categories for update to authenticated
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());
create policy categories_admin_delete on public.categories for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());

create index idx_categories_org on public.categories (org_id);

-- Catégories par défaut d'une organisation (reprise des 6 catégories historiques)
create or replace function public.seed_default_categories(p_org uuid)
returns void
language sql security definer
set search_path to 'public'
as $$
  insert into public.categories (org_id, key, label, code, color, sort) values
    (p_org, 'moteur',        'Moteur',        'MT', 'red',    1),
    (p_org, 'carrosserie',   'Carrosserie',   'CA', 'blue',   2),
    (p_org, 'train-avant',   'Train avant',   'TA', 'green',  3),
    (p_org, 'train-arriere', 'Train arrière', 'TR', 'orange', 4),
    (p_org, 'electronique',  'Électricité',   'EL', 'violet', 5),
    (p_org, 'autre',         'Autre',         'AU', 'gray',   6)
  on conflict (org_id, key) do nothing;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Organisations existantes
select public.seed_default_categories(id) from public.organizations;

-- Toute nouvelle organisation reçoit les catégories par défaut
create or replace function public.on_organization_created()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end; $$;
create trigger organizations_seed_categories
  after insert on public.organizations
  for each row execute function public.on_organization_created();

-- 2) pieces.cat : enum figé -> texte rattaché aux catégories -----
alter table public.pieces alter column cat type text using cat::text;
-- NB : `drop type public.piece_category` bloque indéfiniment sur l'instance
-- hébergée (appliqué le 20/10/2026 en plusieurs morceaux) ; le type, orphelin,
-- est laissé en place : sans effet.
-- drop type public.piece_category;
alter table public.pieces
  add constraint pieces_org_cat_fkey
  foreign key (org_id, cat) references public.categories (org_id, key)
  on update cascade;

-- 3) Compteurs et génération de référence ----------------------
create table public.ref_counters (
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_key text not null,
  last_value integer not null default 0,
  primary key (org_id, category_key)
);
alter table public.ref_counters enable row level security;
-- Aucune policy : table manipulée uniquement par les fonctions security definer.

-- Numéro n -> suffixe de 4 positions.
--   1..9999         : 0001..9999
--   10000..32999    : A000..Y999 (lettre sûre = bloc de 1000, sans I, O, Q)
--   au-delà         : le numéro complet (la référence dépasse 6 caractères)
create or replace function public.format_piece_ref(p_code text, p_n integer)
returns text
language sql immutable
as $$
  select case
    when p_n <= 9999 then p_code || lpad(p_n::text, 4, '0')
    when p_n <= 32999 then p_code
      || substr('ABCDEFGHJKLMNPRSTUVWXYZ', ((p_n - 10000) / 1000) + 1, 1)
      || lpad(((p_n - 10000) % 1000)::text, 3, '0')
    else p_code || p_n::text
  end
$$;

-- Attribution atomique (verrou sur la ligne de compteur). Saute les
-- références déjà prises (saisies à la main) : jamais de doublon.
create or replace function public.next_piece_ref_for(p_org uuid, p_cat text)
returns text
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_code text;
  v_n integer;
  v_ref text;
begin
  select code into v_code from public.categories where org_id = p_org and key = p_cat;
  if v_code is null then
    raise exception 'Catégorie inconnue : %', p_cat using errcode = 'P0001';
  end if;
  insert into public.ref_counters (org_id, category_key, last_value)
  values (p_org, p_cat, 1)
  on conflict (org_id, category_key)
  do update set last_value = public.ref_counters.last_value + 1
  returning last_value into v_n;
  loop
    v_ref := public.format_piece_ref(v_code, v_n);
    exit when not exists (select 1 from public.pieces where org_id = p_org and ref = v_ref);
    update public.ref_counters set last_value = last_value + 1
      where org_id = p_org and category_key = p_cat
      returning last_value into v_n;
  end loop;
  return v_ref;
end; $$;
revoke execute on function public.next_piece_ref_for(uuid, text) from public, anon, authenticated;

-- Aperçu (sans consommer de numéro) de la prochaine référence d'une catégorie
create or replace function public.peek_piece_ref(p_cat text)
returns text
language plpgsql stable security definer
set search_path to 'public'
as $$
declare
  v_org uuid := public.current_org_id();
  v_code text;
  v_n integer;
  v_ref text;
begin
  if v_org is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;
  select code into v_code from public.categories where org_id = v_org and key = p_cat;
  if v_code is null then
    return null;
  end if;
  select coalesce(last_value, 0) + 1 into v_n from public.ref_counters
    where org_id = v_org and category_key = p_cat;
  if v_n is null then v_n := 1; end if;
  loop
    v_ref := public.format_piece_ref(v_code, v_n);
    exit when not exists (select 1 from public.pieces where org_id = v_org and ref = v_ref);
    v_n := v_n + 1;
  end loop;
  return v_ref;
end; $$;
revoke execute on function public.peek_piece_ref(text) from anon;
grant execute on function public.peek_piece_ref(text) to authenticated;

-- Référence vide à l'insertion -> générée depuis la catégorie
create or replace function public.assign_piece_ref()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  if new.ref is null or btrim(new.ref) = '' then
    if new.cat is null or btrim(new.cat) = '' then
      raise exception 'Choisissez une catégorie pour générer la référence' using errcode = 'P0001';
    end if;
    new.ref := public.next_piece_ref_for(new.org_id, new.cat);
  else
    new.ref := upper(btrim(new.ref));
  end if;
  return new;
end; $$;
create trigger pieces_assign_ref
  before insert on public.pieces
  for each row execute function public.assign_piece_ref();

-- 4) Temps réel : les écrans suivent les changements de catégories
alter publication supabase_realtime add table public.categories;
