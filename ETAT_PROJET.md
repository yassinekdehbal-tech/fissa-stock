# ÉTAT PROJET — FISSA STOCK / FISSA PIÈCE AUTO

> **Rôle de ce fichier** : document vivant de pilotage. Il décrit *où en est le projet*, *la logique métier*, *les décisions prises* et *ce qui reste à faire*, afin que n'importe quelle session (humaine ou IA) puisse reprendre le dossier sans contexte préalable.
>
> **À tenir à jour** : à chaque évolution significative, ajouter une entrée dans le §10 Journal des mises à jour et actualiser les sections concernées.

- **Dernière mise à jour** : 22/07/2026
- **Version du document** : 2.2
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
| 2 | **Vente en ligne (multidiffusion)** | Publier une annonce une seule fois dans FISSA STOCK → diffusion auto sur les marketplaces (LeBonCoin actuel ; cible eBay, OVOKO, autres) | P2 (moyen terme) |
| 3 | **Stock + code-barres** | Référencement des pièces par les préparateurs (formulaire → étiquette code-barres), sortie de stock à la vente | **P0 (prioritaire)** |
| 4 | **Atelier / chantiers** | Enregistrement daté/heuré des chantiers, facture-chiffrage, pièces (neuves ou occasion) sélectionnables et déduites du stock, suivi des chantiers réalisés | **P0 (prioritaire)** |
| 5 | **Gestion des comptes** | Comptes utilisateurs + suivi financier (caisse, CA, à terme comptabilité) | P1 |

> **Décision de session (22/07/2026)** : cette phase se concentre sur les modules **3 (Stock)** et **4 (Atelier)**, déjà les plus avancés. La vitrine et la vente en ligne viennent ensuite, une fois le socle backend consolidé.

---

## 2. État d'avancement synthétique

| Module | Existant | État | Reste à faire (clé) |
|--------|----------|------|---------------------|
| 3 — Stock + code-barres | Oui | 🟢 Fonctionnel | Photos en upload direct, pagination, fiche produit |
| 4 — Atelier / chantiers | Partiel | 🟡 En cours | **Déduction stock à l'ajout de pièce + retour si désistement**, facture/devis chantier, planning daté/heuré complet |
| 5 — Comptes / caisse | Partiel | 🟡 En cours | Facturation légale (TVA, numérotation), export comptable |
| 1 — Vitrine | Non | 🔴 À faire | Catalogue public, SEO |
| 2 — Vente en ligne | Non | 🔴 À faire | Moteur de multidiffusion (eBay/OVOKO/LeBonCoin), anti-survente |

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
| Backend / BDD | **Firebase Realtime Database** (temps réel) → **cible : Supabase (voir §7.2)** |
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

> **Règle métier importante** : chaque pièce d'occasion est le plus souvent **unique** (qty = 1, issue d'un véhicule donneur précis). Ce n'est pas du stock fongible « classique ». → Impacte fortement la vente en ligne (§7.3) : catalogue de pièces uniques + **risque de survente** si la même pièce est listée sur plusieurs marketplaces.

### 4.2 Module Atelier / chantiers (fondamental 4)

**Entité `Intervention`** (déjà définie dans `types/index.ts`, store `planning.ts`). Champs : client (`clientName`, `clientPhone`, `clientEmail`), véhicule (`vehicleMake`, `vehicleModel`, `vehiclePlate`), `description`, `notes`, `status` (`todo` / `in_progress` / `done`), `parts[]` (pièces utilisées), `estimatedTotal`, `dateScheduled`, `dateCreated`, `dateUpdated`, `dateDone`.

**Entité `InterventionPart`** : `pieceId`, `ref`, `name`, `qty`, `prixUnitaire` — lien vers une pièce du stock utilisée dans le chantier.

**Cycle de vie d'un chantier**
1. Création : client + véhicule + date/heure planifiée (`dateScheduled`) + description.
2. Ajout des **pièces utilisées** (neuves ou occasion) sélectionnées depuis le stock → alimentent `parts[]` et `estimatedTotal`.
3. **Décision métier (validée 22/07/2026)** : **ajouter une pièce à un chantier = le chantier est validé pour cette pièce → le stock est décompté immédiatement** (`qty -= part.qty`) au moment de l'ajout. Il n'y a **pas d'état intermédiaire « réservé »**.
4. **Désistement / retrait d'une pièce** : si, pour une raison quelconque, une pièce n'est finalement pas utilisée, son retrait du chantier **la retourne au stock** (`qty += part.qty`) et trace un mouvement de retour.
5. Suivi Kanban : `todo` → `in_progress` → `done`.
6. **Édition d'une facture-chiffrage** (devis puis facture).

> ⚠️ **ÉCART CONNU (à corriger, P0)** : aujourd'hui dans `planning.ts`, ni l'ajout ni la validation ne touchent le stock (`moveStatus('done')` ne fait que positionner `dateDone`). **La déduction du stock n'est pas implémentée.** C'est LE point métier central du module 4.
>
> **À câbler (logique cible validée)** :
> - `addPart(interventionId, part)` → ajoute à `parts[]` **et** `stockStore.updatePiece(part.pieceId, { qty: qty - part.qty })` + entrée `historique` type `sortie-chantier`.
> - `removePart(interventionId, part)` (désistement) → retire de `parts[]` **et** `stockStore.updatePiece(part.pieceId, { qty: qty + part.qty })` + entrée `historique` type `retour-chantier`.
> - Garde-fou : refuser l'ajout si `qty` disponible insuffisante (surtout pour les pièces d'occasion uniques, qty = 1).

### 4.3 Module Comptes (fondamental 5)

- **Comptes utilisateurs** : rôles `admin` / `user`, permissions granulaires (`magasinier`, `vendeur`, `historique`). Store `auth.ts` + `users.ts`.
- **Caisse journalière** : total du jour, répartition par mode de paiement, récapitulatif imprimable.
- **Reporting** : CA mensuel/tendance, top pièces, délai entrée→vente.
- **À construire** : facturation conforme **TVA normale** (mentions légales, TVA, numérotation séquentielle), export comptable (FEC/Pennylane), suivi financier consolidé pièces + chantiers.

### 4.4 Modules Vitrine & Vente en ligne (fondamentaux 1 & 2)

Reformulés en session (22/07/2026). Le besoin réel n'est **pas** une boutique isolée mais la **multidiffusion** : une annonce créée dans FISSA STOCK est publiée automatiquement sur les marketplaces où FISSA a des comptes (LeBonCoin aujourd'hui ; cible eBay, OVOKO, autres). Le stock reste la **source de vérité unique** ; chaque pièce porte un **état de publication par canal**. Enjeu critique : **éviter la survente** d'une pièce unique → délistage automatique dès qu'elle est vendue sur un canal. Faisabilité par plateforme et reco en §7.3. La vitrine SEO sur le domaine propre devient secondaire.

---

## 5. Sécurité & conformité (points de vigilance)

| Sujet | État | Action |
|-------|------|--------|
| Mots de passe | Hash côté client (mieux que l'ancien clair, mais **insuffisant**) | Migrer vers une vraie auth serveur (voir §7) — P0 |
| Config Firebase | Exposée côté client | Règles de sécurité strictes indispensables |
| Règles Firebase | Présentes (`database.rules.json`), basiques | Durcir par rôle (read/write granulaire) |
| Validation données | Côté client uniquement | Validation serveur nécessaire |
| Facturation légale | Absente | TVA normale, numérotation, archivage légal — bloquant avant commercialisation |
| RGPD | Non traité | Données clients (chantiers) → registre, durée de conservation |

---

## 6. Priorités court terme (proposition de feuille de route)

**Sprint A — Consolider le socle métier (modules 3 & 4)**
1. Implémenter la **déduction de stock à l'ajout d'une pièce au chantier + le retour au stock en cas de désistement** (écart §4.2). *(P0)*
2. **Facture-chiffrage chantier** : devis → facture, avec pièces + main d'œuvre, TVA normale, numérotation séquentielle. *(P0)*
3. **Planning daté/heuré** complet côté atelier (vue calendrier + statut). *(P1)*
4. Fiabiliser le lien pièce↔chantier (garde-fou stock insuffisant, traçabilité des retours). *(P1)*

**Sprint B — Sécuriser & fiabiliser (via migration Supabase)**
5. Migration backend Firebase → **Supabase** (Postgres + Auth + RLS). *(P0)*
6. Upload photos direct (Supabase Storage, au lieu d'URL). *(P1)*
7. Pagination du stock (> 1000 pièces). *(P2)*

**Sprint C — Vente en ligne (modules 1 & 2)**
8. **Moteur de multidiffusion** : couche « canaux » + publication eBay + OVOKO (API), gestion anti-survente. *(P1)*
9. LeBonCoin via connecteur tiers ; vitrine SEO sur domaine propre. *(P2)*

---

## 7. Recommandation technique (demandée en session du 22/07/2026)

> Contexte : l'utilisateur a demandé « recommande-moi ». Voici l'orientation conseillée, avec justification.

### 7.1 Garder ce qui est bon

Le **frontend est moderne et bien choisi** : Vue 3 + Vite + Pinia + Tailwind + Capacitor. On **le conserve**. Le scanner (JsBarcode + html5-qrcode) et l'app native Capacitor sont adaptés au terrain. Pas de refonte frontend.

### 7.2 Décision structurante n°1 — Backend : migrer Firebase RTDB → Supabase ✅ VALIDÉE (22/07/2026)

**Décision actée : passer de Firebase Realtime Database à Supabase (PostgreSQL + Auth + Storage + Row Level Security).**

Pourquoi :
- Le métier devient **relationnel** : pièces ↔ chantiers ↔ factures ↔ mouvements de stock ↔ comptes ↔ publications marketplace. Un arbre NoSQL (RTDB) gère mal l'intégrité référentielle et les jointures ; Postgres est fait pour ça.
- **Facturation & comptabilité** : numérotation séquentielle fiable, TVA, exports (FEC/Pennylane) → beaucoup plus simples en SQL.
- **Auth réelle** : Supabase Auth remplace le hash maison fragile ; les **RLS policies** appliquent les droits par rôle *côté serveur* (magasinier/vendeur/admin) — ce qui règle le point sécurité P0.
- **Multidiffusion** : les **Edge Functions** Supabase hébergent proprement les appels aux API marketplaces et les webhooks de commande entrants.
- **Reporting** : requêtes SQL agrégées (CA, top pièces, marges) natives.
- Offre gratuite généreuse, migration progressive possible.
- Un serveur MCP Supabase est déjà disponible dans l'environnement de travail → mise en place assistée.

Coût du changement : réécrire la couche d'accès données (`composables/useFirebase` → client Supabase) et les stores. Le frontend et les composants restent. **Effort modéré, bénéfice structurel majeur.** À faire *avant* de construire la facturation et la multidiffusion, pas après.

### 7.3 Décision structurante n°2 — Vente en ligne : moteur de MULTIDIFFUSION, pas une boutique classique

Reformulation du besoin (session 22/07/2026) : l'objectif n'est pas d'abord une boutique e-commerce sur le domaine FISSA, mais de **créer une annonce une seule fois dans FISSA STOCK et la publier automatiquement sur les marketplaces** où FISSA a des comptes (aujourd'hui LeBonCoin ; cible eBay, OVOKO, et autres).

**État réel des canaux (vérifié 22/07/2026)** :
- **eBay** : API officielle **Sell / Inventory** complète → création et publication d'annonces par programme. ✅ Automatisable proprement.
- **OVOKO** : API fournisseur (« Ovoko API allows scrap yards to connect their warehouse management systems »). L'intégration est **à notre charge**. Bonus : OVOKO **rediffuse lui-même vers eBay et Allegro** et gère une partie de la logistique. ✅ Automatisable.
- **LeBonCoin** : **pas d'API publique de dépôt d'annonces** pour les pièces. Passage obligé par un **connecteur de multidiffusion tiers** (type AllYouCanPost / X-Studio) ou dépôt semi-manuel. ⚠️ Maillon le plus contraignant — ne pas bloquer le projet dessus.

**Reco** : faire de FISSA STOCK le **PIM / source de vérité** (déjà le cas — 1 pièce = 1 fiche) et construire une **couche « canaux »** qui publie vers chaque marketplace via son API. Démarrer par **eBay + OVOKO** (API propres, large couverture). Traiter **LeBonCoin** en best-effort via connecteur tiers.

**⚠️ Point technique central — la survente (overselling)** : une pièce d'occasion est **unique (qty 1)** et sera listée sur plusieurs plateformes en même temps. Dès qu'elle se vend sur un canal, il faut **la retirer immédiatement des autres** (webhooks de commande entrants → statut `vendue` → délistage partout). C'est LE vrai défi et la vraie valeur du système.

La **boutique/vitrine sur le domaine propre** devient secondaire (SEO + vente directe éventuelle), à faire après le moteur de multidiffusion.

### 7.4 Architecture cible en une phrase

Une base **Supabase** unique, un **frontend Vue** unique décliné en 3 surfaces : (1) **site public** vitrine + moteur de multidiffusion, (2) **app interne** préparateurs/atelier (PWA + Capacitor), (3) **espace admin** (comptes, caisse, factures, reporting).

### 7.5 Récapitulatif des choix conseillés

| Sujet | Reco |
|-------|------|
| Frontend | Vue 3 + Vite + Pinia + Tailwind (conserver) |
| App native | Capacitor (conserver) |
| Backend/BDD | **Supabase (Postgres)** — migration depuis Firebase RTDB ✅ validée |
| Auth | **Supabase Auth + RLS** par rôle |
| Fichiers/photos | Supabase Storage |
| Vente en ligne | **Multidiffusion** marketplaces : eBay + OVOKO (API) d'abord, LeBonCoin via connecteur tiers ; vitrine SEO secondaire |
| Paiement | **TPE physique en magasin** (actuel) ; en ligne = géré par chaque marketplace ; Stripe reporté à une éventuelle vente directe |
| Hébergement web | Vercel / Netlify / Cloudflare Pages |
| Code-barres | JsBarcode + html5-qrcode (conserver) |
| Monitoring | Sentry (déjà dispo en MCP) |

---

## 8. Décisions

### 8.1 Décisions actées (22/07/2026)

1. ✅ **Backend** : migration vers **Supabase** (Postgres + Auth + Storage + RLS).
2. ✅ **Pièce ↔ chantier** : décompte du stock **dès l'ajout**, **retour au stock si désistement** (§4.2).
3. ✅ **TVA** : régime **TVA normale** → facturation avec TVA, numérotation séquentielle, mentions légales.
4. ✅ **Paiement** : **TPE physique en magasin** pour l'instant. Aucun compte de paiement en ligne créé → le paiement en ligne est géré par chaque marketplace ; passerelle (Stripe) reportée à une éventuelle vente directe.
5. ✅ **Vente en ligne** : priorité au **moteur de multidiffusion marketplaces** (eBay + OVOKO d'abord, LeBonCoin via connecteur tiers) plutôt qu'à une boutique classique. Voir §7.3.

### 8.2 Décisions encore à trancher

6. **LeBonCoin** : connecteur de multidiffusion tiers (lequel, budget) ou dépôt semi-manuel ?
7. **OVOKO** : l'utiliser comme canal **et** rediffuseur (eBay/Allegro), ou intégrer eBay en direct pour garder marge + relation client ?
8. **Vitrine/boutique directe** sur le domaine FISSA : à faire (SEO, vente directe) ou non prioritaire ?

---

## 9. Glossaire métier

- **Préparateur** : opérateur qui démonte les véhicules et référence les pièces en stock.
- **Véhicule donneur** : véhicule d'où provient une pièce d'occasion.
- **Pièce « pour pièces »** : pièce vendue en l'état, non garantie fonctionnelle.
- **OEM** : référence constructeur d'origine (Original Equipment Manufacturer).
- **Chantier / intervention** : prestation atelier sur un véhicule client.
- **Chiffrage** : devis estimatif d'un chantier (pièces + main d'œuvre).
- **Désistement** : retrait d'une pièce d'un chantier → retour au stock.
- **Multidiffusion** : publication automatique d'une même annonce sur plusieurs marketplaces depuis une source unique.
- **Survente (overselling)** : vendre deux fois une pièce unique parce que le retrait n'a pas été propagé aux autres canaux.

---

## 10. Journal des mises à jour

| Date | Version | Auteur | Résumé |
|------|---------|--------|--------|
| 26/05/2026 | 1.0 | — | CAHIER_DES_CHARGES initial (repo) |
| 22/07/2026 | 2.0 | Session Cowork | Repositionnement autour des 5 fondamentaux ; analyse de l'existant Vue/Firebase ; recommandation technique (migration Supabase) ; identification de l'écart « déduction stock chantier » ; création de ETAT_PROJET.md + SCHEMA_PROJET.md |
| 22/07/2026 | 2.1 | Session Cowork | Décisions actées : migration Supabase **validée** ; logique pièce↔chantier arrêtée (décompte à l'ajout, retour au stock si désistement). MAJ §4.2, §7.2, §8, §10 |
| 22/07/2026 | 2.2 | Session Cowork | Décisions : **TVA normale**, **paiement TPE magasin** (online reporté). Reformulation vente en ligne en **multidiffusion marketplaces** (eBay/OVOKO API, LeBonCoin via tiers) + enjeu anti-survente ; recherche faisabilité plateformes. MAJ §1, §4.4, §7.3, §7.5, §8, §10 |

---

*Fin du document. Voir `SCHEMA_PROJET.md` pour le détail des pages, fonctions et modèle de données.*
