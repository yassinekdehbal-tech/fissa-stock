# ÉTAT PROJET — FISSA STOCK / FISSA PIÈCE AUTO

> **Rôle de ce fichier** : document vivant de pilotage. Il décrit *où en est le projet*, *la logique métier*, *les décisions prises* et *ce qui reste à faire*, afin que n'importe quelle session (humaine ou IA) puisse reprendre le dossier sans contexte préalable.
>
> **À tenir à jour** : à chaque évolution significative, ajouter une entrée dans le §10 Journal des mises à jour et actualiser les sections concernées.

- **Dernière mise à jour** : 25/07/2026
- **Version du document** : 2.8
- **Repo** : `github.com/yassinekdehbal-tech/fissa-stock` (branche `main`)
- **Documents compagnons** : `SCHEMA_PROJET.md` (schéma des pages, fonctions, modèle de données) · `MIGRATION_SUPABASE.md` (état du branchement app ↔ Supabase et reste à câbler)

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
| 3 — Stock + code-barres | Oui | 🟢 Branché sur Supabase | Câbler l'UI restante, photos en upload direct, pagination |
| 4 — Atelier / chantiers | Partiel | 🟡 Store Supabase + RPC | Brancher les boutons ajout/retrait pièce sur `addPart`/`removePart`, facture chantier, planning daté/heuré |
| 5 — Comptes / caisse | Partiel | 🟡 Auth Supabase branchée | Migrer stores `users`/`history`/`caisse`, facturation TVA (UI) |
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
| Backend / BDD | **Supabase Postgres** (socle + app branchée le 22/07/2026, voir §3bis) — *stores `users`/`history`/`cart`/`caisse` encore sur Firebase, à migrer* |
| Auth | **Supabase Auth** (branchée ; finaliser LoginView) |
| App native | Capacitor 8 (iOS ; Android possible) |
| Code-barres | JsBarcode (génération) + html5-qrcode (lecture caméra) |
| PWA | Service Worker + manifest |
| Hébergement web | GitHub Pages (actuel) |

### Arborescence `src/`

```
src/
├── App.vue
├── main.ts               # init session Supabase avant montage
├── router.ts             # 10 routes + garde d'auth
├── lib/supabase.ts       # client Supabase typé
├── types/
│   ├── index.ts          # Piece, Intervention, ...
│   └── database.types.ts # types générés depuis la base
├── stores/               # auth, stock, planning → SUPABASE · cart, history, users → Firebase (à migrer)
├── composables/          # useFirebase (legacy, en cours de retrait)
└── components/
    ├── auth/  dashboard/  stock/  scanner/  planning/
    ├── history/  reporting/  caisse/  users/  ui/
```

### 3bis. Infrastructure Supabase (socle créé + app branchée le 22/07/2026)

Projet Supabase dédié créé dans l'organisation **FISSA LIV**. Le client `@supabase/supabase-js` est branché (voir `MIGRATION_SUPABASE.md` pour le reste à câbler).

| Élément | Valeur |
|---------|--------|
| Nom du projet | `fissa-stock` |
| Project ref / ID | `mkgxnnihcldspbedqwge` |
| Région | eu-central-1 (Francfort) |
| URL API | `https://mkgxnnihcldspbedqwge.supabase.co` |
| Clé publique (publishable) | `sb_publishable_yry1baN65W8aJxPs28bk8Q_A_LskQQq` |

> La clé *publishable* est publique par nature (destinée au client) : la sécurité repose sur l'**auth + les RLS**, pas sur le secret de cette clé. La clé `service_role` (secrète, côté serveur uniquement) est à récupérer dans le dashboard Supabase et **ne doit jamais** être mise dans le frontend. La config front est dans `.env` (modèle : `.env.example`).

**12 tables** (toutes avec RLS activé) : `profiles` (rôles), `pieces` (+ colonne `notes`), `stock_movements`, `interventions`, `intervention_parts`, `invoices`, `invoice_lines`, `sales_channels` (3 canaux pré-remplis : LeBonCoin/eBay/OVOKO), `publications`, `sales`, `sale_items`.

**3 fonctions métier** (RPC, logique atomique côté base) :
- `add_intervention_part(intervention, piece, qty, prix)` → ajoute la pièce au chantier **+ décompte le stock + trace le mouvement** (garde-fou stock insuffisant).
- `remove_intervention_part(part)` → désistement : **retour au stock** + mouvement de retour.
- `mark_piece_sold(piece, channel, prix)` → vente marketplace : stock à 0 + **délistage automatique des autres canaux** (anti-survente).

**Auth & bootstrap** : Supabase Auth (email + mot de passe), profil auto-créé à l'inscription, **le 1er compte inscrit devient automatiquement `admin`**, rôle non modifiable par un non-admin. Realtime activé sur `pieces`, `interventions`, `intervention_parts`, `publications`.

**Sécurité** : RLS par rôle, lecture publique limitée au catalogue diffusable. Advisors : alertes critiques corrigées ; restent des avertissements attendus (écritures ouvertes à l'équipe authentifiée) à durcir plus tard si besoin.

---

## 4. Logique métier (référence pour toute reprise)

### 4.1 Module Stock (fondamental 3)

**Entité `Piece`** — une pièce référencée en stock. Champs clés : `ref` (référence unique interne, sert de code-barres), `name`, `cat` (catégorie), `vehicle` (véhicule compatible), `oem` (n° OEM constructeur), `supplier`, `donor` (véhicule donneur pour l'occasion), `qty`, `price`, `threshold` (seuil d'alerte), `zone` (emplacement), `etat` (état de la pièce d'occasion), `compat` (compatibilités), `photo`, `notes`, `fmt` (format code-barres CODE128/CODE39), `added`, `archived`.

**Cycle de vie d'une pièce**
1. Un **préparateur** remplit le formulaire d'ajout (vue `AddPieceView`).
2. La pièce est enregistrée dans la base via `stockStore.addPiece()` (Supabase).
3. Une **étiquette code-barres** est générée (à partir de `ref`) et imprimée (format 62×29 mm, Brother/Dymo/NIIMBOT), à coller sur la pièce physique.
4. À la vente : le **scanner** lit le code-barres → la pièce est ajoutée au panier → la vente décrémente `qty` et écrit un mouvement de type `vente`.
5. Archivage possible (`toggleArchive`) : passe `archived=true` et `qty=0`.

**Catégories** : moteur, carrosserie, train-avant, train-arrière, électronique, autre.
**États (occasion)** : Bon état, Très bon état, État moyen, Pour pièces.

> **Règle métier importante** : chaque pièce d'occasion est le plus souvent **unique** (qty = 1, issue d'un véhicule donneur précis). Ce n'est pas du stock fongible « classique ». → Impacte fortement la vente en ligne (§7.3) : catalogue de pièces uniques + **risque de survente** si la même pièce est listée sur plusieurs marketplaces.

### 4.2 Module Atelier / chantiers (fondamental 4)

**Entité `Intervention`** (table `interventions` + `intervention_parts`). Champs : client, véhicule, `description`, `notes`, `status` (`todo` / `in_progress` / `done`), pièces utilisées, `estimated_total`, `date_scheduled`, `date_done`, etc.

**Cycle de vie d'un chantier**
1. Création : client + véhicule + date/heure planifiée (`date_scheduled`) + description.
2. Ajout des **pièces utilisées** (neuves ou occasion) sélectionnées depuis le stock.
3. **Décision métier (validée 22/07/2026)** : **ajouter une pièce à un chantier = le chantier est validé pour cette pièce → le stock est décompté immédiatement** (`qty -= part.qty`) au moment de l'ajout. Il n'y a **pas d'état intermédiaire « réservé »**.
4. **Désistement / retrait d'une pièce** : le retrait du chantier **la retourne au stock** (`qty += part.qty`) et trace un mouvement de retour.
5. Suivi Kanban : `todo` → `in_progress` → `done`.
6. **Édition d'une facture-chiffrage** (devis puis facture, TVA normale).

> ✅ **IMPLÉMENTÉ (Supabase + store, 22/07/2026)** : la logique est disponible côté base (`add_intervention_part` / `remove_intervention_part`) **et exposée dans le store** `planning.ts` via `addPart(interventionId, part)` et `removePart(partId)`. **Reste à câbler côté UI** : brancher les boutons d'ajout/retrait de pièce de `PlanningView` sur ces méthodes (l'ancienne UI mettait juste à jour `parts[]` sans toucher au stock).

### 4.3 Module Comptes (fondamental 5)

- **Comptes utilisateurs** : rôles `admin` / `user`, permissions granulaires (`magasinier`, `vendeur`, `historique`).
- **Caisse journalière** : total du jour, répartition par mode de paiement, récapitulatif imprimable.
- **Reporting** : CA mensuel/tendance, top pièces, délai entrée→vente.
- **À construire** : facturation conforme **TVA normale** (mentions légales, TVA, numérotation séquentielle — table `invoices` avec numérotation auto déjà prête), export comptable (FEC/Pennylane), suivi financier consolidé pièces + chantiers.

### 4.4 Modules Vitrine & Vente en ligne (fondamentaux 1 & 2)

Reformulés en session (22/07/2026). Le besoin réel n'est **pas** une boutique isolée mais la **multidiffusion** : une annonce créée dans FISSA STOCK est publiée automatiquement sur les marketplaces où FISSA a des comptes (LeBonCoin aujourd'hui ; cible eBay, OVOKO, autres). Le stock reste la **source de vérité unique** ; chaque pièce porte un **état de publication par canal** (table `publications`). Enjeu critique : **éviter la survente** d'une pièce unique → délistage automatique dès qu'elle est vendue sur un canal (fonction `mark_piece_sold`). Faisabilité par plateforme et reco en §7.3. La vitrine SEO sur le domaine propre devient secondaire.

---

## 5. Sécurité & conformité (points de vigilance)

| Sujet | État | Action |
|-------|------|--------|
| Auth | **Supabase Auth + RLS branchées** | Finaliser LoginView (email), créer le 1er compte (= admin) |
| Config secrets | Clé publishable OK dans le front ; `service_role` à garder secrète | Ne jamais exposer la clé service_role |
| Validation données | Contraintes + RLS côté Postgres | Compléter la validation applicative |
| Facturation légale | Table `invoices` prête (TVA, numérotation auto) | Construire l'UI + mentions légales |
| RGPD | Non traité | Données clients (chantiers) → registre, durée de conservation |

---

## 6. Priorités court terme (feuille de route)

**Sprint A — Consolider le socle métier (modules 3 & 4)**
1. ✅ Socle Supabase (schéma + RLS + fonctions déduction/retour/anti-survente) — fait 22/07/2026.
2. ✅ Brancher l'app Vue sur Supabase (client + stores auth/stock/planning, build vérifié OK) — fait 22/07/2026.
3. 🟡 Câbler la déduction/retour stock↔chantier sur les RPC — **méthodes du store faites** (`addPart`/`removePart`), reste l'UI `PlanningView`. *(P0)*
4. Migrer les stores restants (`users`, `history`, `cart`, `caisse`) vers Supabase. *(P0)*
5. **Facture-chiffrage chantier** : devis → facture, pièces + main d'œuvre, TVA normale. *(P0)*
6. **Planning daté/heuré** complet (vue calendrier + statut). *(P1)*

**Sprint B — Sécuriser & fiabiliser**
7. Finaliser l'auth (LoginView email + inscription) ; créer le compte admin. *(P0)*
8. Upload photos direct (Supabase Storage). *(P1)*
9. Pagination du stock (> 1000 pièces). *(P2)*

**Sprint C — Vente en ligne (modules 1 & 2)**
10. **Moteur de multidiffusion** : couche « canaux » + publication eBay + OVOKO (API), anti-survente. *(P1)*
11. LeBonCoin via connecteur tiers ; vitrine SEO. *(P2)*

---

## 7. Recommandation technique (demandée en session du 22/07/2026)

> Contexte : l'utilisateur a demandé « recommande-moi ». Voici l'orientation conseillée, avec justification.

### 7.1 Garder ce qui est bon

Le **frontend est moderne et bien choisi** : Vue 3 + Vite + Pinia + Tailwind + Capacitor. On **le conserve**. Le scanner (JsBarcode + html5-qrcode) et l'app native Capacitor sont adaptés au terrain. Pas de refonte frontend.

### 7.2 Décision structurante n°1 — Backend : migrer Firebase RTDB → Supabase ✅ VALIDÉE + SOCLE + APP BRANCHÉE (22/07/2026)

**Décision actée et exécutée : Supabase (PostgreSQL + Auth + Storage + Row Level Security).** Projet, schéma, RLS, fonctions métier en place (§3bis), et **app Vue branchée** (client + stores auth/stock/planning, build OK). Reste à migrer les stores secondaires et finaliser l'UI.

Pourquoi :
- Le métier est **relationnel** : pièces ↔ chantiers ↔ factures ↔ mouvements ↔ comptes ↔ publications marketplace. Postgres gère l'intégrité référentielle et les jointures.
- **Facturation & comptabilité** : numérotation séquentielle fiable, TVA, exports (FEC/Pennylane) simples en SQL.
- **Auth réelle** : Supabase Auth + **RLS** appliquent les droits par rôle *côté serveur*.
- **Multidiffusion** : les **Edge Functions** hébergent les appels aux API marketplaces et les webhooks entrants.
- Offre gratuite généreuse, migration progressive.

### 7.3 Décision structurante n°2 — Vente en ligne : moteur de MULTIDIFFUSION, pas une boutique classique

Reformulation du besoin (22/07/2026) : créer une annonce **une seule fois** dans FISSA STOCK et la **publier automatiquement** sur les marketplaces où FISSA a des comptes (LeBonCoin ; cible eBay, OVOKO, autres).

**État réel des canaux (vérifié 22/07/2026)** :
- **eBay** : API officielle **Sell / Inventory** complète → publication par programme. ✅ Automatisable proprement.
- **OVOKO** : API fournisseur (intégration à notre charge). Bonus : OVOKO **rediffuse lui-même vers eBay et Allegro** et gère une partie de la logistique. ✅ Automatisable.
- **LeBonCoin** : **pas d'API publique de dépôt d'annonces** pour les pièces → **connecteur de multidiffusion tiers** (AllYouCanPost / X-Studio) ou dépôt semi-manuel. ⚠️ Ne pas bloquer le projet dessus.

**Reco** : FISSA STOCK = **PIM / source de vérité** + une **couche « canaux »** (tables `sales_channels` / `publications` déjà créées). Démarrer par **eBay + OVOKO**. LeBonCoin en best-effort.

**⚠️ Point technique central — la survente** : pièce unique (qty 1) listée sur plusieurs plateformes → dès la vente sur un canal, **retrait immédiat des autres** (webhooks → `mark_piece_sold` → délistage). C'est LE vrai défi et la vraie valeur.

### 7.4 Architecture cible en une phrase

Une base **Supabase** unique, un **frontend Vue** unique décliné en 3 surfaces : (1) **site public** vitrine + moteur de multidiffusion, (2) **app interne** préparateurs/atelier (PWA + Capacitor), (3) **espace admin** (comptes, caisse, factures, reporting).

### 7.5 Récapitulatif des choix conseillés

| Sujet | Reco |
|-------|------|
| Frontend | Vue 3 + Vite + Pinia + Tailwind (conserver) |
| App native | Capacitor (conserver) |
| Backend/BDD | **Supabase (Postgres)** ✅ socle créé + app branchée |
| Auth | **Supabase Auth + RLS** par rôle |
| Fichiers/photos | Supabase Storage |
| Vente en ligne | **Multidiffusion** : eBay + OVOKO (API) d'abord, LeBonCoin via connecteur tiers ; vitrine SEO secondaire |
| Paiement | **TPE physique en magasin** ; en ligne = géré par chaque marketplace ; Stripe reporté |
| Hébergement web | Vercel / Netlify / Cloudflare Pages |
| Code-barres | JsBarcode + html5-qrcode (conserver) |
| Monitoring | Sentry (déjà dispo en MCP) |

---

## 8. Décisions

### 8.1 Décisions actées (22/07/2026)

1. ✅ **Backend** : migration vers **Supabase** — socle créé **et app branchée** (auth/stock/atelier, build OK), voir §3bis + `MIGRATION_SUPABASE.md`.
2. ✅ **Pièce ↔ chantier** : décompte du stock **dès l'ajout**, **retour au stock si désistement** — implémenté (base + store).
3. ✅ **TVA** : régime **TVA normale** → facturation avec TVA, numérotation séquentielle, mentions légales.
4. ✅ **Paiement** : **TPE physique en magasin** pour l'instant. Aucun compte de paiement en ligne créé → le paiement en ligne est géré par chaque marketplace ; passerelle (Stripe) reportée.
5. ✅ **Vente en ligne** : priorité au **moteur de multidiffusion marketplaces** (eBay + OVOKO d'abord, LeBonCoin via connecteur tiers). Voir §7.3.

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
| 22/07/2026 | 2.1 | Session Cowork | Décisions : migration Supabase **validée** ; logique pièce↔chantier (décompte à l'ajout, retour si désistement) |
| 22/07/2026 | 2.2 | Session Cowork | Décisions : **TVA normale**, **paiement TPE magasin**. Vente en ligne = **multidiffusion marketplaces** (eBay/OVOKO API, LeBonCoin via tiers) + anti-survente |
| 22/07/2026 | 2.3 | Session Cowork | **Socle Supabase créé** : projet `fissa-stock` (§3bis), 11 tables + RLS, 3 fonctions métier (déduction/retour/anti-survente), durcissement sécurité |
| 22/07/2026 | 2.4 | Session Cowork | **App Vue branchée sur Supabase** : client + stores auth/stock/planning, RPC exposés (`addPart`/`removePart`), types générés, 1er inscrit = admin, realtime, colonne `notes`. **Build de production vérifié OK.** Voir `MIGRATION_SUPABASE.md`. MAJ §2, §3, §4, §5, §6, §7, §8, §10 |
| 23/07/2026 | 2.5 | Session Cowork | **Encaissement comptoir** (`/panier`, RPC `checkout_sale` atomique : stock + vente + mouvements), **historique** sur `stock_movements`/`sales`, **gestion utilisateurs** (edge `admin-users`). Firebase retiré des stores. |
| 23/07/2026 | 2.6 | Session Cowork | **Multidiffusion** : tour de contrôle (`/multidiffusion`), 9 canaux, entités `sales_channels`/`publications`, edge `publish-listing` (connecteurs eBay/OVOKO en stubs lisant les secrets), edge `marketplace-webhook` anti-survente (`mark_piece_sold`). Voir `MULTIDIFFUSION.md`. |
| 23/07/2026 | 2.7 | Session Cowork | **Boutique publique** : `/boutique` + `/boutique/:id`, lecture anonyme scopée RLS (`pieces_read_public` : publiable + non archivée + stock>0), bouton « Publiable ». Edge `product-feed` (Google Shopping XML/CSV) écrite, non déployée. Voir `BOUTIQUE.md`. |
| 25/07/2026 | 2.8 | Session Cowork | **Hébergement web** : `.env.production` public commité (URL Supabase + clé publishable) pour que `deploy.yml` produise un build connecté au backend. Site GitHub Pages : `https://yassinekdehbal-tech.github.io/fissa-stock/` (à activer : Settings → Pages → Source = GitHub Actions). Build prod vérifié : creds injectés dans le bundle, fallback SPA `404.html` OK. |

---

*Fin du document. Voir `SCHEMA_PROJET.md` pour le détail des pages, fonctions et modèle de données.*
