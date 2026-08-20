-- Bucket public pour les photos de pieces.
-- Lecture : publique (vitrines, marketplaces, flux produit).
-- Ecriture : utilisateurs authentifies, uniquement dans le dossier
-- de LEUR organisation (chemin <org_id>/...).
insert into storage.buckets (id, name, public)
values ('piece-photos', 'piece-photos', true)
on conflict (id) do nothing;

create policy "photos_public_read"
on storage.objects for select
using (bucket_id = 'piece-photos');

create policy "photos_org_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'piece-photos'
  and (storage.foldername(name))[1] = public.current_org_id()::text
);

create policy "photos_org_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'piece-photos'
  and (storage.foldername(name))[1] = public.current_org_id()::text
)
with check (
  bucket_id = 'piece-photos'
  and (storage.foldername(name))[1] = public.current_org_id()::text
);

create policy "photos_org_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'piece-photos'
  and (storage.foldername(name))[1] = public.current_org_id()::text
);
