-- =============================================================
-- FISSA STOCK - sous-catégories de pièces
--
-- Les catégories (Moteur, Carrosserie…) sont trop larges pour retrouver une
-- pièce : « Moteur » couvre alternateur, démarreur, turbo… Une sous-catégorie
-- par organisation et par catégorie, pré-remplie avec les familles classiques,
-- complétée par l'admin (Paramètres → Catégories) ou à la volée par un
-- magasinier depuis le formulaire d'ajout. `pieces.subcat` porte le libellé
-- (texte libre : une pièce garde sa sous-catégorie même si elle est renommée).
-- =============================================================

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  cat text not null,
  label text not null,
  sort integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint subcategories_cat_fkey foreign key (org_id, cat) references public.categories(org_id, key) on delete cascade,
  constraint subcategories_label_check check (length(btrim(label)) between 1 and 60)
);
create unique index subcategories_org_cat_label_key on public.subcategories (org_id, cat, lower(label));
create index idx_subcategories_org_cat on public.subcategories (org_id, cat);
alter table public.subcategories enable row level security;

create policy subcategories_read on public.subcategories for select to authenticated
  using (org_id = public.current_org_id());
create policy subcategories_read_public on public.subcategories for select to anon
  using (true);
-- Ajout à la volée depuis le formulaire : admin ou magasinier
create policy subcategories_insert on public.subcategories for insert to authenticated
  with check (org_id = public.current_org_id() and (public.is_admin() or public.has_perm('magasinier')));
create policy subcategories_admin_update on public.subcategories for update to authenticated
  using (org_id = public.current_org_id() and public.is_admin())
  with check (org_id = public.current_org_id() and public.is_admin());
create policy subcategories_admin_delete on public.subcategories for delete to authenticated
  using (org_id = public.current_org_id() and public.is_admin());

alter table public.pieces add column subcat text not null default '';
create index idx_pieces_org_cat_subcat on public.pieces (org_id, cat, subcat);

-- Sous-catégories classiques d'une organisation (clés des catégories par défaut)
create or replace function public.seed_default_subcategories(p_org uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $$
declare
  v_cat text;
  v_labels text[];
  v_i integer;
  v_sets constant jsonb := jsonb_build_object(
    'moteur', jsonb_build_array('Moteur complet','Alternateur','Démarreur','Turbo','Injecteur','Pompe à injection','Pompe à eau','Pompe à huile','Radiateur','Compresseur de clim','Boîte de vitesses','Embrayage','Volant moteur','Culasse','Collecteur','Vanne EGR','Débitmètre','Boîtier papillon','Support moteur','Courroie / galet','Carter'),
    'carrosserie', jsonb_build_array('Pare-chocs avant','Pare-chocs arrière','Capot','Aile avant','Porte avant','Porte arrière','Hayon / coffre','Rétroviseur','Phare','Feu arrière','Antibrouillard','Pare-brise','Vitre','Lève-vitre','Calandre','Poignée','Serrure','Pare-boue'),
    'train-avant', jsonb_build_array('Triangle','Amortisseur','Cardan','Moyeu / roulement','Étrier de frein','Disque de frein','Crémaillère de direction','Biellette','Rotule','Berceau','Ressort','Barre stabilisatrice','Jante'),
    'train-arriere', jsonb_build_array('Train arrière complet','Amortisseur','Moyeu / roulement','Étrier de frein','Disque / tambour','Ressort','Essieu','Bras'),
    'electronique', jsonb_build_array('Calculateur moteur','Boîtier BSI / fusibles','Faisceau','Autoradio / GPS','Combiné / compteur','Capteur','Bobine d''allumage','Batterie','Commodo','Airbag','Module ABS','Moteur d''essuie-glace'),
    'autre', jsonb_build_array('Siège','Ceinture','Volant','Tableau de bord','Climatisation','Échappement','Réservoir','Roue de secours')
  );
begin
  for v_cat in select key from public.categories where org_id = p_org loop
    if v_sets ? v_cat then
      select array_agg(x) into v_labels from jsonb_array_elements_text(v_sets -> v_cat) as x;
      for v_i in 1 .. coalesce(array_length(v_labels, 1), 0) loop
        insert into public.subcategories (org_id, cat, label, sort)
        values (p_org, v_cat, v_labels[v_i], v_i)
        on conflict do nothing;
      end loop;
    end if;
  end loop;
end; $$;
revoke execute on function public.seed_default_subcategories(uuid) from public, anon, authenticated;

select public.seed_default_subcategories(id) from public.organizations;

-- Toute nouvelle organisation reçoit catégories + sous-catégories par défaut
create or replace function public.on_organization_created()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  perform public.seed_default_categories(new.id);
  perform public.seed_default_subcategories(new.id);
  return new;
end; $$;

alter publication supabase_realtime add table public.subcategories;
