-- Connexion par identifiant court (sans e-mail) pour les comptes employés.
-- L'edge function `admin-users` stocke l'identifiant dans `profiles.username`
-- (une adresse e-mail pour les comptes créés avec un e-mail) et crée le compte
-- Auth avec une adresse technique dérivée de celle de l'admin.

-- 1) Un identifiant est unique dans son organisation (insensible à la casse)
create unique index if not exists profiles_username_org_unique
  on public.profiles (org_id, lower(username))
  where username is not null;

-- 2) Résolution identifiant -> e-mail de connexion, appelable avant connexion.
--    Ne répond que pour les identifiants courts (jamais pour une adresse e-mail),
--    pour ne pas permettre de vérifier l'existence d'une adresse.
create or replace function public.login_email_for_username(p_username text)
returns text
language sql
security definer
stable
set search_path = public, auth
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username is not null
    and position('@' in p.username) = 0
    and lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.login_email_for_username(text) from public;
grant execute on function public.login_email_for_username(text) to anon, authenticated;
