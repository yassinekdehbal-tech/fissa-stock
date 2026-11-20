-- Les demandes du site public apparaissent dans FISSA STOCK sans rechargement :
-- la table `leads` rejoint la publication realtime (comme marketplace_orders).
alter publication supabase_realtime add table public.leads;
