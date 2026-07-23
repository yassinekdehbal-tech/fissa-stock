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

- **Encaissement au comptoir (checkout)** : le panier (`cart`) se remplit mais **aucun écran ne valide la vente**. À créer : un écran panier qui, à la validation, écrit dans `sales` + `sale_items`, décrémente le stock, et laisse un mouvement `vente-comptoir`. Le store `history` sait déjà lire ces ventes.
- **Facturation** : construire l'UI sur la table `invoices` (numérotation auto, TVA 20 %). *(mise de côté pour l'instant)*
- **Retrait de Firebase** : `src/composables/useFirebase.ts` et la dépendance `firebase` ne sont plus utilisés (tous les stores sont sur Supabase). À supprimer.
- **Multidiffusion (Sprint C)** : eBay + OVOKO via API, LeBonCoin via connecteur tiers ; anti-survente via `mark_piece_sold`.
- **Migration des données** existantes Firebase → Supabase si nécessaire (export/import).

## Gestion des comptes (users)

Créer/supprimer un compte ne peut pas se faire depuis le client (nécessite `service_role`). C'est géré par la fonction **Edge `admin-users`** (déployée), réservée aux admins :
- `create` (email + mot de passe + nom + permissions), `set_password`, `delete`.
- Les employés peuvent aussi **s'inscrire eux-mêmes** depuis l'écran de connexion (ils démarrent en rôle `user` ; l'admin ajuste ensuite leurs permissions).
- ⚠️ Dans l'écran `UsersView`, le champ « identifiant » doit désormais recevoir un **email**.

## Fait (sessions 22–23/07/2026)

- Écran de **connexion** migré (email + inscription, 1er compte = admin).
- Écran **atelier** câblé sur les RPC (déduction à l'ajout, retour au désistement, ajustement de quantité).
- Stores **`history`** (lecture depuis `stock_movements` + `sale_items`/`sales`) et **`users`** (`profiles` + fonction Edge `admin-users`) migrés vers Supabase. Realtime activé.
- Build de production vérifié OK à chaque étape.

## Références

- Détails infra (project ref, URL, clé, tables, fonctions) : `ETAT_PROJET.md` §3bis.
- Modèle de données et flux : `SCHEMA_PROJET.md`.
