# Migration Supabase — FISSA STOCK

Branchement de l'app Vue sur Supabase (session du 22/07/2026). Ce fichier explique ce qui a été fait et comment finir le câblage.

## Ce qui est en place

- **Client** : `src/lib/supabase.ts` (client typé via `src/types/database.types.ts`).
- **Config** : `.env.example` (copier vers `.env`). Variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
- **Auth** : `src/stores/auth.ts` réécrit sur **Supabase Auth** (email + mot de passe). Rôle/permissions lus depuis `profiles`. Le **1er compte inscrit devient admin** automatiquement.
- **Stock** : `src/stores/stock.ts` sur Supabase (CRUD + realtime). API publique inchangée.
- **Atelier** : `src/stores/planning.ts` sur Supabase + **RPC métier** :
  - `addPart(interventionId, part)` → décompte le stock immédiatement (RPC `add_intervention_part`).
  - `removePart(partId)` → désistement, retour au stock (RPC `remove_intervention_part`).
- **Bootstrap** : `src/main.ts` restaure la session avant le montage ; `src/router.ts` a un garde d'auth.

## Pour démarrer en local

```bash
cp .env.example .env
npm install            # installe @supabase/supabase-js
npm run dev
```

Puis, sur l'écran de connexion, **créer le premier compte** (il sera admin). Si la confirmation d'email est activée sur le projet Supabase, la désactiver dans Authentication > Providers > Email pour un usage interne, ou confirmer via l'email reçu.

## Reste à faire (câblage restant)

- **LoginView** : la connexion se fait désormais par **email** (plus par identifiant). Adapter le libellé du champ et, si besoin, ajouter un bouton d'inscription (`authStore.signUp`).
- **Stores non encore migrés** : `history`, `users`, `cart`, ainsi que `reporting`/`caisse` (encore sur Firebase via `useFirebase`). À migrer vers Supabase (tables `stock_movements`, `sales`/`sale_items`, `profiles`).
- **Atelier UI** : brancher les boutons d'ajout/retrait de pièce sur `planning.addPart` / `planning.removePart` (l'ancienne UI mettait juste à jour `parts[]` sans toucher au stock).
- **Facturation** : construire l'UI sur la table `invoices` (numérotation auto, TVA 20 %).
- **Migration des données** existantes Firebase → Supabase si nécessaire (export/import).

## Références

- Détails infra (project ref, URL, clé, tables, fonctions) : `ETAT_PROJET.md` §3bis.
- Modèle de données et flux : `SCHEMA_PROJET.md`.
