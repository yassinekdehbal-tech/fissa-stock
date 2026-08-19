# ÉTAT PROJET — FISSA STOCK / FISSA PIÈCE AUTO

> **Rôle de ce fichier** : document vivant de pilotage. Il décrit *où en est le projet*, *la logique métier*, *les décisions prises* et *ce qui reste à faire*, afin que n'importe quelle session (humaine ou IA) puisse reprendre le dossier sans contexte préalable.
>
> **À tenir à jour** : à chaque évolution significative, ajouter une entrée dans le §11 Journal des mises à jour et actualiser les sections concernées.

- **Dernière mise à jour** : 19/08/2026
- **Version du document** : 3.1
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

### 1bis. Vision SaaS (exprimée le 19/08/2026)

**FISSA STOCK est pensé comme un SaaS** : la solution doit pouvoir être vendue à d'autres exploitants (magasins de pièces auto). **FISSA PIÈCE AUTO est le premier exploitant** — le client n°1 et le banc d'essai du produit.

Conséquences structurantes :

- **Hiérarchie de comptes** : super-admin plateforme (FISSA LIV) → **admin exploitant** → **utilisateur** → **sous-utilisateur** (permissions granulaires `magasinier` / `vendeur` / `historique`, déjà amorcées dans le store `users`).
- **Isolation des données par exploitant** : table `organizations` + colonne `org_id` sur toutes les tables métier + RLS par organisation. ⚠️ **À faire AVANT la première donnée réelle** : la base est vide aujourd'hui (audit v2.9), la migration est donc triviale ; elle deviendrait risquée une fois le stock FISSA référencé.
- **Séquencement volontaire** : le schéma multi-tenant se pose maintenant (coût quasi nul), mais la **plomberie SaaS** (inscription self-service, facturation d'abonnement Stripe Billing, branding par exploitant, CGU/CGV/DPA RGPD) attend que FISSA utilise l'outil au quotidien — pas de produit à vendre avant un produit validé en magasin.
- **Provenance des pièces** : les pièces proviennent de canaux distincts — don, démontage (véhicule donneur), achat de lot d'occasion, grossiste neuf, web. Un champ `source` normalisé doit être ajouté à `pieces` (analyse de marge par canal). L'« achat de lot » implique aussi un **import en masse** (CSV) + impression d'étiquettes en lot.
- **Style** : UI et app voulues **dynamiques** ; le passage design se fera une fois les écrans stabilisés par l'usage réel.

---

## 2. État d'avancement synthétique

> **⚠️ Constat d'audit (19/08/2026)** — Le code est bien plus avancé que l'usage réel. La base Supabase de production est **totalement vide** : 0 profil, 0 pièce, 0 vente, 0 chantier (seuls les 9 canaux de vente sont pré-remplis). **Aucun compte admin n'a jamais été créé**, donc l'application n'a jamais été mise en service. Le projet est par ailleurs **sans commit depuis le 31/07/2026**. Le blocage n°1 n'est donc pas technique : c'est la mise en service.

| Module | Existant | État | Reste à faire (clé) |
|--------|----------|------|---------------------|
| 3 — Stock + code-barres | Oui | 🟢 Opérationnel (jamais utilisé) | Upload photos direct (aujourd'hui : simple champ URL), pagination |
| 4 — Atelier / chantiers | Oui | 🟢 Câblé sur les RPC stock | **Facture non conforme** (voir §5), planning calendrier daté/heuré |
| 5 — Comptes / caisse | Oui | 🟡 Écrans en place, base vide | **Créer le 1er compte (= admin)**, facturation TVA conforme |
| 1 — Vitrine | Oui | 🟡 Boutique publique en place | SEO, déployer l'edge `product-feed` (écrite, non déployée) |
| 2 — Vente en ligne | Partiel | 🟡 Tour de contrôle + anti-survente | **Connecteurs eBay/OVOKO = stubs** (`TODO` dans `publish-listing`) : ne diffuse rien en réel |

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
| Backend / BDD | **Supabase Postgres** (socle + app branchée le 22/07/2026, voir §3bis) — *migration terminée : plus aucun store sur Firebase* |
| Auth | **Supabase Auth** (branchée, LoginView email + inscription en place) |
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
├── stores/               # auth, stock, planning, cart, history, users, publications → tous sur SUPABASE
├── composables/          # useFirebase (legacy, orphelin : plus importé nulle part → à supprimer)
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

> ✅ **IMPLÉMENTÉ DE BOUT EN BOUT (base + store + UI)** : logique atomique côté base (`add_intervention_part` / `remove_intervention_part`), exposée dans le store `planning.ts` (`addPart` / `removePart` / `adjustPart`), et **câblée dans l'UI** — `PlanningView.vue:162-208` appelle bien ces méthodes. *(Vérifié le 19/08/2026 ; la mention « reste à câbler » des versions 2.4 à 2.8 était obsolète.)*

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
| Auth | **Supabase Auth + RLS branchées**, LoginView OK | ⚠️ **Aucun compte n'existe encore** → créer le 1er (devient admin) |
| Config secrets | Clé publishable OK dans le front ; `service_role` à garder secrète | Ne jamais exposer la clé service_role |
| Validation données | Contraintes + RLS côté Postgres | Compléter la validation applicative |
| Facturation légale | ⚠️ **NON CONFORME** : `PlanningView.vue:308` numérote avec `Date.now()` — numéro ni séquentiel ni persisté, table `invoices` **inutilisée** | Brancher la facture sur la table `invoices` (numérotation séquentielle en base) + mentions légales |
| RGPD | Non traité | Données clients (chantiers) → registre, durée de conservation |
| Intégrité CI | ⚠️ Aucune validation automatique sur les PR jusqu'au 19/08/2026 — un lockfile désynchronisé est passé inaperçu ~1 mois | Workflow `ci.yml` ajouté (`npm ci` + typecheck + build) |

---

## 6. Priorités court terme (feuille de route)

> Feuille de route **réordonnée le 19/08/2026** d'après l'audit : le socle logiciel est fait, ce qui bloque est la mise en service et la conformité.

**Sprint 0 — Démarrer pour de vrai (le vrai blocage)**
1. 🟡 **Schéma multi-tenant** — **écrit et versionné** (19/08/2026) : 3 migrations dans `supabase/migrations/` (`organizations`+`sites`, `org_id` partout, unicités par org, RLS par org, RPC org-aware, champ `source`, compteur de factures par org). ⚠️ **Reste à APPLIQUER sur le projet Supabase** — action utilisateur ou permission requise (l'agent a été bloqué par les permissions). **À faire avant de merger la PR frontend et avant la première donnée réelle.** *(P0)*
2. **Créer le 1er compte** sur l'app déployée (il devient automatiquement admin de l'organisation FISSA PIÈCE AUTO), puis les comptes préparateurs. *(P0)*
3. **Saisir 10 pièces réelles** + imprimer les étiquettes : c'est ce qui transforme le livrable en outil et fera remonter les vrais irritants terrain. *(P0)*

**Sprint A — Conformité (le seul risque réglementaire)**
3. 🟡 **Facture chantier sur la table `invoices`** — **implémentée** (19/08/2026) : RPC `create_invoice_for_intervention` (numéro séquentiel par org/année via `invoice_counters`, idempotent, lignes pièces + main d'œuvre, prix TTC → HT/TVA 20 % décomposées) + `PlanningView` réécrit (impression avec vrai numéro, totaux HT/TVA/TTC, mentions légales). Actif dès que la migration du point 1 est appliquée. Reste : SIRET/adresse/TVA intracom à saisir dans `organizations` (colonnes prêtes). *(P0)* — voir §5.
4. **Planning daté/heuré** complet (vue calendrier + statut). *(P1)*

**Sprint B — Fiabiliser**
5. ✅ Garde-fou CI sur les PR (`npm ci` + typecheck + build) — fait 19/08/2026, workflow `ci.yml`.
6. **Build iOS TestFlight** : débloquer côté compte Apple (droits de la clé App Store Connect, App ID `com.fissa.pieceauto`, certificat de distribution) — le code et le workflow ne sont pas en cause. *(P1)* — voir §10.
7. Upload photos direct (Supabase Storage) — aujourd'hui simple champ URL. *(P1)*
8. ✅ `useFirebase.ts`, `firebase.json`, `database.rules.json` supprimés + dépendance `firebase` retirée (−72 paquets) — fait 19/08/2026.
9. Pagination du stock (> 1000 pièces). *(P2)*

**Sprint C — Vente en ligne (modules 1 & 2)**
10. **Connecteurs marketplaces réels** : remplacer les stubs `TODO` de `publish-listing` par les appels API eBay + OVOKO. L'écran, les canaux et l'anti-survente sont déjà là ; il ne manque que la couche API. *(P1)*
11. Déployer l'edge `product-feed` (écrite, non déployée) ; LeBonCoin via connecteur tiers ; vitrine SEO. *(P2)*

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
9. **Multi-tenant** : valider le passage du schéma en multi-organisation **maintenant** (base vide, recommandé §1bis) — puis calendrier de la plomberie SaaS (billing, self-service).
10. **Étiquettes** : ajouter un QR code en complément du CODE128 (scan téléphone plus rapide et tolérant) ?
11. **Compatibilité véhicule** : passer de `compat` texte libre à des champs structurés marque/modèle/motorisation (voire données type TecDoc, payantes) ?

### 8.3 Standards à prévoir (suggestions actées comme backlog, 19/08/2026)

| Sujet | Détail | Priorité |
|-------|--------|----------|
| Inventaire tournant | Comptage par scan d'un rayon, écart théorique/réel automatique | Haute |
| Ordre de réparation signé | Devis accepté → OR signé client → facture (protection juridique atelier) | Haute |
| Garantie légale occasion | Vente pro→particulier : garantie légale de conformité 12 mois, à mentionner sur les factures | Haute (conformité) |
| Import en masse + étiquettes en lot | Indispensable pour les achats de lots d'occasion | Haute |
| Mode hors-ligne de l'app | File d'attente locale synchronisée (wifi d'entrepôt peu fiable) | Moyenne |
| Multi-site par exploitant | Table `sites`, stock par dépôt — schéma dès maintenant, UI plus tard | Moyenne |
| CGU/CGV + DPA RGPD du SaaS | Bloquant avant le premier exploitant tiers, pas avant | Basse aujourd'hui |

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

## 10. État des chaînes de build & déploiement (19/08/2026)

| Chaîne | Workflow | État | Détail |
|--------|----------|------|--------|
| Validation PR | `ci.yml` | 🟢 Ajouté le 19/08/2026 | `npm ci` (strict lockfile) + `vue-tsc --noEmit` + `npm run build`. Jusque-là **aucune** validation ne tournait sur les PR. |
| Web (GitHub Pages) | `deploy.yml` | 🟢 Vert (passé à `npm ci` le 19/08/2026) | Déclenché sur push `main`. Reste à confirmer l'activation Settings → Pages → Source = GitHub Actions. |
| iOS (TestFlight) | `ios-testflight.yml` | 🔴 **En échec** (5 échecs, dernier le 30/07/2026) | L'archive **se compile** ; c'est l'`exportArchive` qui casse. |

**Diagnostic du build iOS** — erreurs renvoyées par `xcodebuild -exportArchive` :

```
error: exportArchive Cloud signing permission error
error: exportArchive No profiles for 'com.fissa.pieceauto' were found
error: exportArchive No signing certificate "iOS Distribution" found
```

C'est un problème **de compte Apple, pas de code** : la clé App Store Connect API doit avoir un rôle suffisant (Admin ou App Manager) pour le *cloud signing*, l'App ID `com.fissa.pieceauto` doit exister sur le portail développeur, et un certificat de distribution doit être disponible. Les trois derniers commits du dépôt (26/07 et 31/07) sont des retouches successives du YAML : **inutile de continuer à modifier le workflow** tant que les droits Apple ne sont pas réglés. En attendant, la PWA servie par GitHub Pages couvre l'usage terrain.

---

## 11. Journal des mises à jour

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
| 19/08/2026 | 2.9 | Session Claude Code | **Audit d'état** (code + Supabase + CI, pas seulement la doc). Constats : base de production **vide** (0 profil / 0 pièce → jamais mise en service) ; **facture non conforme** (`Date.now()`, table `invoices` inutilisée) ; **connecteurs marketplaces = stubs** ; **build iOS en échec** (cloud signing Apple) ; `PlanningView` en fait **déjà câblé** (la doc 2.4→2.8 disait le contraire). Correctifs : **lockfile resynchronisé** (`@supabase/supabase-js` absent depuis `99f1e71`, `npm ci` cassé) + **workflow `ci.yml`** (garde-fou `npm ci`/typecheck/build sur les PR). Feuille de route §6 réordonnée, §10 ajoutée. |
| 19/08/2026 | 3.0 | Session Claude Code | **Vision SaaS actée** (§1bis) : FISSA STOCK = solution multi-exploitant, FISSA PIÈCE AUTO = premier exploitant. Hiérarchie super-admin → admin exploitant → utilisateur → sous-utilisateur. Reco : **schéma multi-tenant maintenant** (base vide, migration triviale), plomberie SaaS (billing, self-service) après validation en magasin. Champ `source` (don/démontage/lot/grossiste/web), import en masse, backlog standards (§8.3 : inventaire tournant, OR signé, garantie légale occasion, offline, multi-site). Décisions 9-11 ouvertes (§8.2). |
| 19/08/2026 | 3.1 | Session Claude Code | **Exécution Sprint 0/A** : PR #2 mergée + déployée. **3 migrations multi-tenant écrites et versionnées** (`supabase/migrations/`) — ⚠️ à appliquer sur Supabase (permission requise). **Facture conforme implémentée** (RPC `create_invoice_for_intervention` + PlanningView : numéro séquentiel par org, HT/TVA/TTC, mentions légales, idempotence). Champ `source` (provenance) dans AddPieceView. **Firebase supprimé** (code + config + dépendance). `deploy.yml` passé à `npm ci`. Types Supabase complétés (`source`, RPC). |

---

*Fin du document. Voir `SCHEMA_PROJET.md` pour le détail des pages, fonctions et modèle de données.*
