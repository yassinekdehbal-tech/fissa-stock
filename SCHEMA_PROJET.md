# SCHEMA PROJET — FISSA STOCK / FISSA PIÈCE AUTO

> **Rôle de ce fichier** : schéma technique de référence. Il décrit **l'arborescence des pages/écrans**, **les fonctions par module**, **le modèle de données** et **les flux métier**. Complément de `ETAT_PROJET.md` (qui, lui, décrit l'état et la logique métier).
>
> **À tenir à jour** : à chaque ajout de page, fonction ou entité, mettre à jour la section correspondante et le §7 Journal.

- **Dernière mise à jour** : 22/07/2026
- **Version** : 1.0
- **Repo** : `github.com/yassinekdehbal-tech/fissa-stock`

---

## 1. Vue d'ensemble — les 3 surfaces cibles

```
                        ┌───────────────────────────────┐
                        │       BASE DE DONNÉES          │
                        │  (Supabase Postgres — cible)   │
                        │  stock · interventions ·       │
                        │  factures · ventes · users ·   │
                        │  commandes · mouvements        │
                        └───────────────┬───────────────┘
              ┌───────────────────────┬─┴─┬───────────────────────┐
              ▼                       ▼   ▼                       ▼
   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │  1. SITE PUBLIC    │  │  2. APP INTERNE    │  │  3. ESPACE ADMIN   │
   │  Vitrine + Boutique│  │  Préparateurs +    │  │  Comptes, caisse,  │
   │  (SEO, panier)     │  │  Atelier (PWA/app) │  │  factures, reporting│
   └────────────────────┘  └────────────────────┘  └────────────────────┘
        [À construire]         [🟢 avancé]              [🟡 partiel]
```

Aujourd'hui, seule la **surface 2 (app interne)** existe réellement (Vue + Firebase), avec des briques admin. Les surfaces 1 et 3 sont à développer.

---

## 2. Carte des pages / routes (existant)

Source : `src/router.ts`. Toutes les routes hors `/login` exigent une authentification (`requiresAuth`).

| Route | Nom | Composant | Rôle | Module |
|-------|-----|-----------|------|--------|
| `/login` | login | `auth/LoginView.vue` | Connexion | 5 |
| `/` | dashboard | `dashboard/DashboardView.vue` | Tableau de bord (stats, CA, alertes) | 5 |
| `/stock` | stock | `stock/StockView.vue` | Liste + recherche + filtres du stock | 3 |
| `/add` | add | `stock/AddPieceView.vue` | Formulaire d'ajout de pièce + étiquette | 3 |
| `/scanner` | scanner | `scanner/ScannerView.vue` | Scan code-barres + panier + vente | 3 |
| `/planning` | planning | `planning/PlanningView.vue` | Chantiers atelier (Kanban todo/in progress/done) | 4 |
| `/history` | history | `history/HistoryView.vue` | Historique des mouvements | 3/5 |
| `/reporting` | reporting | `reporting/ReportingView.vue` | Rapports CA / top pièces | 5 |
| `/caisse` | caisse | `caisse/CaisseView.vue` | Caisse journalière | 5 |
| `/users` | users | `users/UsersView.vue` | Gestion des comptes (admin) | 5 |

### Pages cibles à ajouter

| Route (proposée) | Surface | Module | Objectif |
|------------------|---------|--------|----------|
| `/atelier/:id` | Interne | 4 | Fiche chantier détaillée + facture-chiffrage |
| `/atelier/planning` | Interne | 4 | Vue calendrier datée/heurée |
| `/factures` | Admin | 5 | Liste + génération de factures conformes |
| `/piece/:id` | Interne/Public | 3 | Fiche produit détaillée |
| `(public) /` | Public | 1 | Vitrine (accueil, présentation) |
| `(public) /boutique` | Public | 2 | Catalogue + recherche véhicule |
| `(public) /boutique/:id` | Public | 2 | Fiche pièce + ajout panier |
| `(public) /panier` | Public | 2 | Panier + réservation + paiement |

---

## 3. Modèle de données

État actuel : `src/types/index.ts` (Firebase RTDB, nœuds `stock`, `interventions`, `historique`, `users`). Ci-dessous le modèle **logique** (valable pour la cible Supabase, où chaque entité devient une table).

### 3.1 `Piece` — pièce en stock (module 3)

| Champ | Type | Description |
|-------|------|-------------|
| `_id` / `id` | string/uuid | Identifiant |
| `ref` | string | Référence interne unique = **valeur du code-barres** |
| `name` | string | Désignation |
| `cat` | enum | moteur · carrosserie · train-avant · train-arriere · electronique · autre |
| `vehicle` | string | Véhicule compatible |
| `oem` | string | N° OEM constructeur |
| `supplier` | string | Fournisseur |
| `donor` | string | Véhicule donneur (occasion) |
| `qty` | number | Quantité en stock |
| `price` | number | Prix de vente |
| `threshold` | number? | Seuil d'alerte stock bas |
| `zone` | string | Emplacement physique |
| `etat` | enum | Bon état · Très bon état · État moyen · Pour pièces |
| `compat` | string | Compatibilités |
| `photo` | string | URL photo (cible : upload Storage) |
| `fmt` | enum | CODE128 · CODE39 (format code-barres) |
| `added` | string | Date d'ajout |
| `archived` | boolean | Archivée |
| *(cible)* `publishable` | boolean | Visible sur la boutique publique |
| *(cible)* `costPrice` | number | Prix d'achat (calcul de marge) |

### 3.2 `Intervention` — chantier atelier (module 4)

| Champ | Type | Description |
|-------|------|-------------|
| `_id` | string | Identifiant |
| `clientName` / `clientPhone` / `clientEmail` | string | Client |
| `vehicleMake` / `vehicleModel` / `vehiclePlate` | string | Véhicule |
| `description` / `notes` | string | Détail du chantier |
| `status` | enum | todo · in_progress · done |
| `parts` | `InterventionPart[]` | Pièces utilisées |
| `estimatedTotal` | number | Total chiffré |
| `dateScheduled` | string | Date/heure planifiée |
| `dateCreated` / `dateUpdated` / `dateDone` | string | Horodatage |
| *(cible)* `laborLines` | array | Lignes de main d'œuvre (temps × taux) |
| *(cible)* `invoiceId` | string | Facture liée |

### 3.3 `InterventionPart` — pièce utilisée dans un chantier

| Champ | Type | Description |
|-------|------|-------------|
| `pieceId` | string | Réf. vers `Piece` |
| `ref` / `name` | string | Copie dénormalisée |
| `qty` | number | Quantité utilisée |
| `prixUnitaire` | number | Prix unitaire appliqué |

### 3.4 `HistoryEntry` — mouvement / traçabilité

| Champ | Type | Description |
|-------|------|-------------|
| `type` | enum | vente · ajout · modif · suppression · connexion |
| `ref` / `name` | string | Pièce concernée |
| `qty` / `prixVente` / `prixCatalogue` / `remise` | number? | Détail vente |
| `payment` | string? | espèces · carte · virement · chèque |
| `client` | string? | Client |
| `user` / `device` | string | Auteur / appareil |
| `ts` / `date` | number/string | Horodatage |

### 3.5 `User` — compte (module 5)

| Champ | Type | Description |
|-------|------|-------------|
| `id` / `name` | string | Identifiant / nom |
| `role` | enum | admin · user |
| `pwd` / `hashed` | string/bool | Auth actuelle (à remplacer par Supabase Auth) |
| `perms` | object | magasinier · vendeur · historique |

### 3.6 Entités cibles à créer

- **`Facture`** : numéro séquentiel, type (devis/facture), client, lignes (pièces + MO), HT/TVA/TTC, statut, date, `interventionId?`, mentions légales.
- **`Vente`** : distincte de `HistoryEntry`, pour la boutique/caisse (panier, paiement, remise).
- **`Commande`** (boutique) : client en ligne, pièces réservées, paiement Stripe, statut (réservée/payée/retirée/expédiée).
- **`MouvementStock`** : entrée/sortie unifiée (ajout, vente comptoir, sortie chantier, commande en ligne) → **source de vérité du stock**.

---

## 4. Fonctions par module (stores Pinia existants)

### 4.1 `stores/stock.ts` (module 3) 🟢
`listen()` · `addPiece()` · `updatePiece()` · `deletePiece()` · `toggleArchive()` · `findByRef()` · getters : `activePieces`, `archivedPieces`, `totalValue`, `totalQty`, `lowStockPieces`.

### 4.2 `stores/planning.ts` (module 4) 🟡
`listen()` · `addIntervention()` · `updateIntervention()` · `moveStatus()` · `deleteIntervention()` · `getClientHistory()` · getters : `todo`, `inProgress`, `done`.
> **Manque (P0)** : `moveStatus('done')` ne **déduit pas** les `parts[]` du stock. Fonction à ajouter : `validateAndDeductStock(id)` → pour chaque part, `stockStore.updatePiece(part.pieceId, { qty: qty - part.qty })` + écriture `historique` type `vente`/`sortie-chantier`.

### 4.3 `stores/auth.ts` (module 5) 🟡
`login()` · `logout()` · `ensureAdmin()` · `hasPerm()` · getters `isAdmin`, `isLoggedIn`. Hash côté client + rate limit + token session. → à migrer vers Supabase Auth.

### 4.4 `stores/cart.ts` (module 3) 🟢
Panier de vente (ajout/retrait pièces, total, remise).

### 4.5 `stores/history.ts` · `stores/users.ts` (modules 3/5)
Traçabilité et gestion des comptes.

### 4.6 Fonctions cibles à créer
- **Facturation** : `createInvoice(interventionOrCart)`, numérotation séquentielle, calcul TVA, PDF.
- **Stock unifié** : `recordMovement(type, pieceId, qty)` centralisant toutes les entrées/sorties.
- **Boutique** : `reservePiece()`, `releaseReservation()`, `checkout()` (Stripe).

---

## 5. Flux métier clés (diagrammes)

### 5.1 Référencement d'une pièce (module 3)

```
Préparateur
   │  remplit formulaire (AddPieceView)
   ▼
addPiece()  ──►  stock/{id} (BDD)
   │
   ▼
Génération code-barres (JsBarcode, à partir de `ref`)
   │
   ▼
Impression étiquette 62×29mm ──► collée sur la pièce physique
```

### 5.2 Sortie de stock à la vente (module 3)

```
Scanner (caméra / douchette)  ──►  findByRef(ref)  ──►  Panier (cart)
   │
   ▼
Validation vente + paiement
   │
   ├──►  décrément qty de chaque pièce (updatePiece)
   └──►  historique: type=vente (+ client, paiement, remise)
```

### 5.3 Chantier atelier avec déduction stock (module 4) — **cible**

```
Création chantier (client + véhicule + date/heure)
   │
   ▼
Sélection pièces depuis le stock ──► parts[] + estimatedTotal
   │                                   (option: réservation qty)
   ▼
Suivi Kanban : todo ─► in_progress ─► done
   │
   ▼  VALIDATION (done)
   ├──►  déduction stock : pour chaque part → qty -= part.qty   ◄── À IMPLÉMENTER (P0)
   ├──►  historique: type=sortie-chantier
   └──►  génération facture-chiffrage (pièces + main d'œuvre)
```

### 5.4 Vente en ligne (module 2) — **cible**

```
Client (boutique publique)
   │  recherche par véhicule / réf
   ▼
Fiche pièce ──► Ajout panier ──► RÉSERVATION (verrou pièce unique)
   │
   ▼
Paiement Stripe ──► Commande "payée"
   │
   ├──►  sortie de stock (qty -= 1)
   └──►  notification retrait / expédition
```

---

## 6. Dépendances entre modules

```
        ┌──────────────┐
        │  3. STOCK    │  (source de vérité)
        └──────┬───────┘
     ┌─────────┼──────────┬───────────────┐
     ▼         ▼          ▼               ▼
 Vente      Chantier   Boutique       Reporting
 comptoir   (atelier)  en ligne       / Caisse
     │         │          │               ▲
     └─────────┴──────────┴───────────────┘
        toutes les sorties décrémentent le STOCK
        et alimentent l'HISTORIQUE / les COMPTES
```

**Principe directeur** : le **stock est la source de vérité unique**. Vente comptoir, chantier atelier et commande boutique sont trois canaux de sortie qui doivent tous décrémenter le même stock et tracer un mouvement. C'est la cohérence de ce principe qui garantit un « vrai suivi ».

---

## 7. Journal des mises à jour

| Date | Version | Résumé |
|------|---------|--------|
| 22/07/2026 | 1.0 | Création : cartographie des routes existantes, modèle de données (Piece, Intervention, HistoryEntry, User), fonctions des stores, flux métier des 5 modules, entités et pages cibles |

---

*Fin du document. Voir `ETAT_PROJET.md` pour l'état, la logique métier détaillée et la recommandation technique.*
