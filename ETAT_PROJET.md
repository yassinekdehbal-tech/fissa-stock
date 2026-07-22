# ÉTAT PROJET — FISSA STOCK / FISSA PIÈCE AUTO

> **Rôle de ce fichier** : document vivant de pilotage. Il décrit *où en est le projet*, *la logique métier*, *les décisions prises* et *ce qui reste à faire*, afin que n'importe quelle session (humaine ou IA) puisse reprendre le dossier sans contexte préalable.
>
> **À tenir à jour** : à chaque évolution significative, ajouter une entrée dans le §10 Journal des mises à jour et actualiser les sections concernées.

- **Dernière mise à jour** : 22/07/2026
- **Version du document** : 2.0
- **Repo** : `github.com/yassinekdehbal-tech/fissa-stock` (branche `main`)
- **Document compagnon** : `SCHEMA_PROJET.md` (schéma des pages, fonctions, modèle de données)

---

## 1. Vision & objectif du projet

Digitaliser l'activité **FISSA PIÈCE AUTO** : vente de pièces détachées automobiles (occasion + neuf) et chantiers de mécanique (atelier). L'outil doit couvrir toute la chaîne, du référencement d'une pièce jusqu'à sa vente ou son intégration dans un chantier facturé, avec un vrai suivi du stock et des comptes.

Le projet est un **repositionnement** d'un premier jet démarré début 2026. On repart de l'existant (déjà solide sur le stock) en le structurant autour de 5 fondamentaux.

### Les 5 fondamentaux

| N° | Module | Description | Priorité actuelle |
|----|--------|-------------|-------------------|
| 1 | **Site vitrine** | Présentation publique de l'activité FISSA PIÈCE AUTO | P2 (moyen terme) |
| 2 | **Boutique en ligne** | Vente des pièces en ligne aux clients | P2 (moyen terme) |
| 3 | **Stock + code-barres** | Référencement des pièces par les préparateurs (formulaire → étiquette code-barres), sortie de stock à la vente | **P0 (prioritaire)** |
| 4 | **Atelier / chantiers** | Enregistrement daté/heuré des chantiers, facture-chiffrage, pièces (neuves ou occasion) sélectionnables et déduites du stock, suivi des chantiers réalisés | **P0 (prioritaire)** |
| 5 | **Gestion des comptes** | Comptes utilisateurs + suivi financier (caisse, CA, à terme comptabilité) | P1 |

> **Décision de session (22/07/2026)** : cette phase se concentre sur les modules **3 (Stock)** et **4 (Atelier)**, déjà les plus avancés. La vitrine et la boutique viennent ensuite, une fois le socle backend consolidé.

---

## 2. État d'avancement synthétique

| Module | Existant | État | Reste à faire (clé) |
|--------|----------|------|---------------------|
| 3 — Stock + code-barres | Oui | 🟢 Fonctionnel | Photos en upload direct, pagination, fiche produit |
| 4 — Atelier / chantiers | Partiel | 🟡 En cours | **Déduction stock à la validation**, facture/devis chantier, planning daté/heuré complet |
| 5 — Comptes / caisse | Partiel | 🟡 En cours | Facturation légale (TVA, numérotation), export comptable |
| 1 — Vitrine | Non | 🔴 À faire | Catalogue public, SEO |
| 2 — Boutique | Non | 🔴 À faire | Panier client, paiement en ligne, réservation |

Légende : 🟢 opérationnel · 🟡 démarré / incomplet · 🔴 non commencé

---

## 3. Stack technique actuelle

Le projet a été migré d'un **mono-fichier HTML/JS vanilla** (`index.old.html`, ~103 Ko, conservé pour référence) vers une application **Vue 3 componentisée**.

| Couche | Technologie |
|--------|-------------|
| Frontend | Vue 3 (`<script setup>`) + TypeScript |
| Build | Vite 8 |
| State | Pinia (stores par domaine) |
| Routing | vue-router (routes lazy-loaded) |
| Style | Tailwind CSS 4 |
| Backend / BDD | **Firebase Realtime Database** (temps réel) |
| Auth | Custom (hash mot de passe côté client + rate limiting + token de session) |
| App native | Capacitor 8 (iOS ; Android possible) |
| Code-barres | JsBarcode (génération) + html5-qrcode (lecture caméra) |
| PWA | Service Worker + manifest |
| Hébergement web | GitHub Pages (actuel) |

### Arborescence `src/`

```
src/
├── App.vue
├── main.ts
├── router.ts              # 10 routes (login + 9 vues protégées)
├── types/index.ts         # Piece, HistoryEntry, User, Intervention, ...
├── stores/                # Pinia : auth, stock, cart, planning, history, users
├── composables/           # useFirebase (accès BDD)
├── utils/                 # security (hash, rate limit, token)
└── components/
    ├── auth/  dashboard/  stock/  scanner/  planning/
    ├── history/  reporting/  caisse/  users/  ui/
```

---

## 4. Logique métier (référence pour toute reprise)

### 4.1 Module Stock (fondamental 3)

**Entité `Piece`** — une pièce référencée en stock. Champs clés : `ref` (référence unique interne, sert de code-barres), `name`, `cat` (catégorie), `vehicle` (véhicule compatible), `oem` (n° OEM constructeur), `supplier`, `donor` (véhicule donneur pour l'occasion), `qty`, `price`, `threshold` (seuil d'alerte), `zone` (emplacement), `etat` (état de la pièce d'occasion), `compat` (compatibilités), `photo`, `fmt` (format code-barres CODE128/CODE39), `added`, `archived`.

**Cycle de vie d'une pièce**
1. Un **préparateur** remplit le formulaire d'ajout (vue `AddPieceView`).
2. La pièce est enregistrée dans Firebase (`stock/{id}`) via `stockStore.addPiece()`.
3. Une **étiquette code-barres** est générée (à partir de `ref`) et imprimée (format 62×29 mm, Brother/Dymo/NIIMBOT), à coller sur la pièce physique.
4. À la vente : le **scanner** lit le code-barres → la pièce est ajoutée au panier → la vente décrémente `qty` et écrit une entrée `historique` de type `vente`.
5. Archivage possible (`toggleArchive`) : passe `archived=true` et `qty=0`.

**Catégories** : moteur, carrosserie, train-avant, train-arrière, électronique, autre.
**États (occasion)** : Bon état, Très bon état, État moyen, Pour pièces.

> **Règle métier importante** : chaque pièce d'occasion est le plus souvent **unique** (qty = 1, issue d'un véhicule donneur précis). Ce n'est pas du stock fongible « classique ». → Impacte fortement le design de la boutique (§7) : un catalogue de pièces uniques, pas un e-commerce à variantes.

### 4.2 Module Atelier / chantiers (fondamental 4)

**Entité `Intervention`** (déjà définie dans `types/index.ts`, store `planning.ts`). Champs : client (`clientName`, `clientPhone`, `clientEmail`), véhicule (`vehicleMake`, `vehicleModel`, `vehiclePlate`), `description`, `notes`, `status` (`todo` / `in_progress` / `done`), `parts[]` (pièces utilisées), `estimatedTotal`, `dateScheduled`, `dateCreated`, `dateUpdated`, `dateDone`.

**Entité `InterventionPart`** : `pieceId`, `ref`, `name`, `qty`, `prixUnitaire` — lien vers une pièce du stock utilisée dans le chantier.

**Cycle de vie d'un chantier**
1. Création : client + véhicule + date/heure planifiée (`dateScheduled`) + description.
2. Ajout des **pièces utilisées** (neuves ou occasion) sélectionnées depuis le stock → alimentent `parts[]` et `estimatedTotal`.
3. Suivi Kanban : `todo` → `in_progress` → `done`.
4. **Édition d'une facture-chiffrage** (devis puis facture).
5. À la validation (`done`) : les pièces de `parts[]` doivent être **déduites du stock**.

> ⚠️ **ÉCART CONNU (à corriger, P0)** : dans `planning.ts`, `moveStatus(id, 'done')` ne fait que positionner `dateDone`. **La déduction du stock n'est pas implémentée.** C'est LE point métier central du module 4 : sans déduction, pas de vrai suivi. À câbler : à la validation (ou à la sélection des pièces), décrémenter `qty` de chaque `Piece` correspondante + écrire une entrée `historique` liée au chantier.

> ⚠️ **À clarifier avec le métier** : au moment précis où une pièce est « réservée » pour un chantier, doit-elle être décomptée du stock disponible dès l'ajout au chantier, ou seulement à la validation finale ? (Recommandation : réservation à l'ajout, décompte définitif à la validation, avec libération si la pièce est retirée du chantier.)

### 4.3 Module Comptes (fondamental 5)

- **Comptes utilisateurs** : rôles `admin` / `user`, permissions granulaires (`magasinier`, `vendeur`, `historique`). Store `auth.ts` + `users.ts`.
- **Caisse journalière** : total du jour, répartition par mode de paiement, récapitulatif imprimable.
- **Reporting** : CA mensuel/tendance, top pièces, délai entrée→vente.
- **À construire** : facturation conforme (mentions légales, TVA, numérotation séquentielle), export comptable (FEC/Pennylane), suivi financier consolidé pièces + chantiers.

### 4.4 Modules Vitrine & Boutique (fondamentaux 1 & 2)

Non commencés. Logique cible : catalogue public alimenté par **la même base stock** (une pièce visible en ligne = une pièce du stock non archivée et marquée « publiable »), recherche par véhicule / référence, panier avec **réservation** (pièces uniques → gestion de la concurrence d'achat), paiement en ligne. Voir §7 pour la reco.

---

## 5. Sécurité & conformité (points de vigilance)

| Sujet | État | Action |
|-------|------|--------|
| Mots de passe | Hash côté client (mieux que l'ancien clair, mais **insuffisant**) | Migrer vers une vraie auth serveur (voir §7) — P0 |
| Config Firebase | Exposée côté client | Règles de sécurité strictes indispensables |
| Règles Firebase | Présentes (`database.rules.json`), basiques | Durcir par rôle (read/write granulaire) |
| Validation données | Côté client uniquement | Validation serveur nécessaire |
| Facturation légale | Absente | TVA, numérotation, archivage légal — bloquant avant commercialisation |
| RGPD | Non traité | Données clients (chantiers) → registre, durée de conservation |

---

## 6. Priorités court terme (proposition de feuille de route)

**Sprint A — Consolider le socle métier (modules 3 & 4)**
1. Implémenter la **déduction de stock à la validation d'un chantier** (écart §4.2). *(P0)*
2. **Facture-chiffrage chantier** : devis → facture, avec pièces + main d'œuvre, numérotation séquentielle. *(P0)*
3. **Planning daté/heuré** complet côté atelier (vue calendrier + statut). *(P1)*
4. Fiabiliser le lien pièce↔chantier (réservation, libération). *(P1)*

**Sprint B — Sécuriser & fiabiliser**
5. Migration de l'authentification vers une vraie auth (voir §7). *(P0)*
6. Upload photos direct (au lieu d'URL). *(P1)*
7. Pagination du stock (> 1000 pièces). *(P2)*

**Sprint C — Ouvrir au public (modules 1 & 2)**
8. Vitrine + catalogue public (SEO).
9. Boutique : panier, réservation, paiement (Stripe/SumUp).

---

## 7. Recommandation technique (demandée en session du 22/07/2026)

> Contexte : l'utilisateur a demandé « recommande-moi ». Voici l'orientation conseillée, avec justification. **Rien n'est imposé** : ces choix sont à valider avant exécution.

### 7.1 Garder ce qui est bon

Le **frontend est moderne et bien choisi** : Vue 3 + Vite + Pinia + Tailwind + Capacitor. On **le conserve**. Le scanner (JsBarcode + html5-qrcode) et l'app native Capacitor sont adaptés au terrain. Pas de refonte frontend.

### 7.2 Décision structurante n°1 — Backend : migrer Firebase RTDB → Supabase

**Recommandation : passer de Firebase Realtime Database à Supabase (PostgreSQL + Auth + Storage + Row Level Security).**

Pourquoi :
- Le métier devient **relationnel** : pièces ↔ chantiers ↔ factures ↔ mouvements de stock ↔ comptes ↔ commandes boutique. Un arbre NoSQL (RTDB) gère mal l'intégrité référentielle et les jointures ; Postgres est fait pour ça.
- **Facturation & comptabilité** : numérotation séquentielle fiable, TVA, exports (FEC/Pennylane) → beaucoup plus simples en SQL.
- **Auth réelle** : Supabase Auth remplace le hash maison fragile ; les **RLS policies** appliquent les droits par rôle *côté serveur* (magasinier/vendeur/admin) — ce qui règle le point sécurité P0.
- **Reporting** : requêtes SQL agrégées (CA, top pièces, marges) natives.
- Offre gratuite généreuse, migration progressive possible.
- Un serveur MCP Supabase est déjà disponible dans l'environnement de travail → mise en place assistée.

Coût du changement : réécrire la couche d'accès données (`composables/useFirebase` → client Supabase) et les stores. Le frontend et les composants restent. **Effort modéré, bénéfice structurel majeur.** À faire *avant* de construire boutique + facturation, pas après.

> Alternative si l'on veut minimiser le changement immédiat : rester sur Firebase, mais migrer au minimum l'auth vers **Firebase Auth** et durcir les règles. Acceptable à court terme, mais repousse un problème qui grossira avec la boutique et la compta.

### 7.3 Décision structurante n°2 — Vitrine & boutique : catalogue sur-mesure, pas un e-commerce à variantes

Les pièces d'occasion sont **uniques** (qty 1). Un Shopify/WooCommerce classique (pensé pour des produits à stock fongible et variantes) s'adapte mal. **Reco : construire vitrine + boutique dans la même app Vue**, en lecture directe de la base stock Supabase, avec :
- catalogue public (pièces marquées « publiable »),
- recherche par véhicule / immatriculation / référence,
- **réservation** à l'ajout au panier (verrou sur pièce unique),
- paiement **Stripe** (en ligne) et **SumUp** (au comptoir).

Bénéfice : une seule source de vérité (le stock), pas de synchronisation à maintenir entre l'app interne et une boutique tierce.

### 7.4 Architecture cible en une phrase

Une base **Supabase** unique, un **frontend Vue** unique décliné en 3 surfaces : (1) **site public** vitrine + boutique (SEO), (2) **app interne** préparateurs/atelier (PWA + Capacitor), (3) **espace admin** (comptes, caisse, factures, reporting).

### 7.5 Récapitulatif des choix conseillés

| Sujet | Reco |
|-------|------|
| Frontend | Vue 3 + Vite + Pinia + Tailwind (conserver) |
| App native | Capacitor (conserver) |
| Backend/BDD | **Supabase (Postgres)** — migration depuis Firebase RTDB |
| Auth | **Supabase Auth + RLS** par rôle |
| Fichiers/photos | Supabase Storage |
| Vitrine + Boutique | Sur-mesure dans l'app Vue, source = stock |
| Paiement | Stripe (en ligne) + SumUp (comptoir) |
| Hébergement web | Vercel / Netlify / Cloudflare Pages |
| Code-barres | JsBarcode + html5-qrcode (conserver) |
| Monitoring | Sentry (déjà dispo en MCP) |

---

## 8. Décisions à trancher (en attente de l'utilisateur)

1. **Backend** : valider la migration vers Supabase, ou rester Firebase pour l'instant ? *(bloque Sprint B/C)*
2. **Réservation pièce chantier** : décompte à l'ajout ou à la validation ? *(§4.2)*
3. **Régime TVA** : franchise en base ou TVA normale ? (impacte facturation)
4. **Paiement en ligne** : Stripe et/ou SumUp — comptes déjà existants ?
5. **Vitrine/boutique** : sur-mesure (reco) ou solution tierce (Shopify) ?

---

## 9. Glossaire métier

- **Préparateur** : opérateur qui démonte les véhicules et référence les pièces en stock.
- **Véhicule donneur** : véhicule d'où provient une pièce d'occasion.
- **Pièce « pour pièces »** : pièce vendue en l'état, non garantie fonctionnelle.
- **OEM** : référence constructeur d'origine (Original Equipment Manufacturer).
- **Chantier / intervention** : prestation atelier sur un véhicule client.
- **Chiffrage** : devis estimatif d'un chantier (pièces + main d'œuvre).

---

## 10. Journal des mises à jour

| Date | Version | Auteur | Résumé |
|------|---------|--------|--------|
| 26/05/2026 | 1.0 | — | CAHIER_DES_CHARGES initial (repo) |
| 22/07/2026 | 2.0 | Session Cowork | Repositionnement autour des 5 fondamentaux ; analyse de l'existant Vue/Firebase ; recommandation technique (migration Supabase) ; identification de l'écart « déduction stock chantier » ; création de ETAT_PROJET.md + SCHEMA_PROJET.md |

---

*Fin du document. Voir `SCHEMA_PROJET.md` pour le détail des pages, fonctions et modèle de données.*
