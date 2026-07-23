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
  - `adjustPart(partId, delta)` → ajuste la quantité (+/-) en synchronisant le stock (RPC `adjust_intervention_part`).
- **Écran connexion** : `LoginView.vue` sur email + mot de passe, avec bascule **inscription** (1er compte = admin).
- **Écran atelier** : `PlanningView.vue` branché sur les RPC ci-dessus — ajout/retrait/quantité d'une pièce agissent **en direct** sur le stock ; la clôture (`Terminé`) ne double plus la déduction.
- **Bootstrap** : `src/main.ts` restaure la session avant le montage ; `src/router.ts` a un garde d'auth.

## Pour démarrer en local

```bash
cp .env.example .env
npm install            # installe @supabase/supabase-js
npm run dev
```

Puis, sur l'écran de connexion, **créer le premier compte** (il sera admin). Si la confirmation d'email est activée sur le projet Supabase, la désactiver dans Authentication > Providers > Email pour un usage interne, ou confirmer via l'email reçu.

## Reste à faire (câblage restant)

- **Stores non encore migrés** : `history`, `users`, ainsi que les écrans `reporting`/`caisse`/`users` (encore sur Firebase via `useFirebase`). À migrer vers Supabase (tables `stock_movements`, `sales`/`sale_items`, `profiles`). Tant qu'ils ne le sont pas, ces écrans afficheront des données vides (Firebase refuse l'accès sans session Firebase). `cart` reste local (pas de backend) et la vente comptoir (checkout) est à brancher sur `sales`/`sale_items` + décrément stock.
- **Facturation** : construire l'UI sur la table `invoices` (numérotation auto, TVA 20 %). *(mise de côté pour l'instant)*
- **Migration des données** existantes Firebase → Supabase si nécessaire (export/import).

## Fait (session 23/07/2026)

- Écran de **connexion** migré (email + inscription, 1er compte = admin).
- Écran **atelier** câblé sur les RPC (déduction à l'ajout, retour au désistement, ajustement de quantité). Build de production vérifié OK.

## Références

- Détails infra (project ref, URL, clé, tables, fonctions) : `ETAT_PROJET.md` §3bis.
- Modèle de données et flux : `SCHEMA_PROJET.md`.
