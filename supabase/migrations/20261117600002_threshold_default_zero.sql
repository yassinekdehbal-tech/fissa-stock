-- Alertes stock : une pièce d'occasion est presque toujours à 1 exemplaire.
-- Avec un seuil par défaut de 1, toutes les pièces étaient « en alerte ».
-- Le seuil par défaut passe à 0 : alerte seulement en rupture, sauf seuil saisi.
alter table public.pieces alter column threshold set default 0;
-- Les pièces existantes portent le seuil 1 par défaut, jamais choisi dans l'app
-- (le formulaire envoyait « 0 » comme « non renseigné ») : on les remet à 0.
update public.pieces set threshold = 0 where threshold = 1;
