# Multidiffusion — FISSA STOCK

Objectif : référencer une pièce **une seule fois** dans FISSA STOCK, la mettre en ligne sur les canaux de vente, et piloter depuis l'app ce qui suit la vente : **stock mis à jour automatiquement** (anti-survente), **expédition** et **encaissement**.

## Parcours utilisateur

1. **Fin de référencement** (`/add`) : après l'enregistrement et le marquage (étiquette ou référence écrite), une étape **« Mettre en ligne »** propose de publier la pièce sur chaque canal actif. Bouton « Plus tard » si on ne publie pas tout de suite.
2. **Pièce déjà enregistrée** : la fiche pièce (`/piece/:id`) contient un bloc **« Mise en ligne »** avec le même panneau (publier / retirer / vendue ici) et les commandes liées à la pièce. L'écran **Multidiffusion** (`/multidiffusion`) donne la vue d'ensemble de toutes les pièces.
3. **Vente** : la pièce passe à **0 en stock**, un mouvement `vente-marketplace` est tracé, l'annonce est **retirée des autres canaux**, et une **commande** apparaît dans **« Commandes en ligne »** (`/commandes`).
4. **Expédition** : depuis `/commandes`, « Expédier » = transporteur + n° de suivi. Pour eBay, le suivi est **transmis à l'acheteur** automatiquement. Puis « Marquer livrée ».
5. **Encaissement** : réalisé par la marketplace (eBay, OVOKO…), qui reverse ensuite le montant. L'app suit l'état **Paiement en attente / Payée / Remboursée** (automatique pour eBay, manuel pour les autres) et affiche le total encaissé du mois.

## Canaux listés (`sales_channels`, 9 canaux, tous inactifs au départ — à activer dans Multidiffusion)

| Canal | Type | Comment ça marche aujourd'hui |
|-------|------|-------------------------------|
| **eBay** | API | **Connecteur réel** (`_shared/ebay.ts`) : publication, retrait, import des commandes, envoi du n° de suivi. Fonctionne dès que les accès eBay sont configurés (voir ci-dessous). |
| **OVOKO** | API | Pas encore de connecteur : OVOKO n'a **pas d'API vendeur publique**, l'accès et la documentation sont fournis par OVOKO après onboarding vendeur (voir § OVOKO). En attendant : dépôt dans l'espace vendeur OVOKO + « Vendue ici » dans l'app (ou webhook). OVOKO rediffuse lui-même vers eBay/Allegro. |
| **Allegro, Rakuten, Cdiscount** | API | Pas de connecteur (message explicite). Vente : webhook ou « Vendue ici ». |
| **LeBonCoin** | Dépôt manuel (pas d'API publique de dépôt) | Annonce déposée à la main sur LeBonCoin ; dans l'app : **« Marquer déposée »** (lien de l'annonce) puis **« Vendue ici »** à la vente → stock à 0, retrait partout, commande à expédier. |
| **Facebook Marketplace, La Centrale, ParuVendu** | Dépôt manuel | Idem LeBonCoin. |

Le canal **Boutique en ligne FISSA** (catalogue public `/boutique`, sans commission) se pilote par le bouton « Boutique » (`pieces.publishable`) ; il n'a pas de paiement en ligne (Stripe reporté — voir `ETAT_PROJET.md`).

## Ce qui est en place (code)

- **Panneau de mise en ligne** `src/components/multidiffusion/PiecePublishPanel.vue` : utilisé en fin de référencement, sur la fiche pièce et dans l'écran Multidiffusion.
- **Écran Commandes en ligne** `src/components/multidiffusion/OrdersView.vue` (`/commandes`) : à expédier / expédiées / livrées, acheteur, adresse, paiement, n° de suivi, synchro eBay. Badge « à expédier » dans le menu et sur le tableau de bord.
- **Store** `src/stores/publications.ts` : canaux, publications, commandes (temps réel), actions `publish`, `delist`, `recordSale`, `ship`, `setDelivered`, `setPaid`, `syncOrders`.
- **Base** :
  - table `marketplace_orders` (migration `20261118700001_marketplace_orders.sql`), RLS par organisation, écriture admin/vendeur ;
  - RPC `record_marketplace_sale(piece, canal, prix, n° commande, n° ligne, acheteur…)` : **idempotente** (un même n° de commande n'est traité qu'une fois), appelle `mark_piece_sold` (stock à 0 + mouvement + délistage) puis crée la commande.
- **Fonctions Edge** (déployées) :
  - `publish-listing` : publie / retire (eBay réel ; dépôt manuel tracé avec URL ; API sans connecteur → erreur explicite).
  - `marketplace-orders` : `sync` (import des commandes eBay des 30 derniers jours, statut de paiement) et `ship` (expédition + n° de suivi transmis à eBay).
  - `marketplace-webhook` : réception d'une vente (OVOKO, connecteur LeBonCoin, …) → `record_marketplace_sale`.
  - `product-feed` : flux produit public (Google Shopping XML / CSV) des pièces publiables.

## Activer eBay (seule configuration à faire)

1. **Compte développeur eBay** (developer.ebay.com) : créer une application (keyset production), puis obtenir un **refresh token utilisateur** pour le compte vendeur FISSA avec les scopes `sell.inventory` et `sell.fulfillment` (flux « User access token » / consentement).
2. **Secrets Supabase** (Dashboard → Edge Functions → Secrets) :
   - `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REFRESH_TOKEN` (jeton renouvelé automatiquement) — ou, pour un test rapide, `EBAY_OAUTH_TOKEN` ;
   - `EBAY_ENV=sandbox` pour tester sur le bac à sable.
3. **Paramètres d'annonce**, dans `sales_channels.config` du canal eBay (SQL) ou en secrets `EBAY_*` :
   ```json
   { "marketplaceId": "EBAY_FR",
     "categoryId": "<catégorie eBay feuille, ex. pièces auto>",
     "categoryByCat": { "moteur": "…", "carrosserie": "…" },
     "fulfillmentPolicyId": "…", "paymentPolicyId": "…", "returnPolicyId": "…",
     "merchantLocationKey": "…" }
   ```
   Les politiques (livraison, paiement, retour) et le lieu d'expédition se créent une fois dans le compte vendeur eBay (ou via l'API Account). Tant qu'il manque quelque chose, le statut « Erreur » liste précisément ce qui manque.
4. Activer le canal eBay dans Multidiffusion. Publier une pièce de test. Les ventes remontent par « Synchroniser eBay » (écran Commandes) ; pour automatiser, programmer un appel horaire de `marketplace-orders` (`{ "action": "sync" }`) avec `pg_cron` + `pg_net` ou un cron externe.

## OVOKO : comment obtenir le connecteur

OVOKO (ex-RRR.lt) ne publie pas d'API vendeur : la seule API visible publiquement (`supply-connector.ms.ovoko.com`) sert à brancher des logiciels déjà partenaires (WooCommerce, Bosab, Bildelsbasen), sans endpoint de création de pièce ni de commande. Sa page partenaires indique que l'intégration API est à la charge du vendeur et prend « quelques semaines » une fois les accès fournis.

Marche à suivre :
1. Demander à votre contact / support vendeur OVOKO : « l'accès API d'intégration pour un logiciel de gestion de stock maison » (documentation, identifiants, environnement de test), et s'il existe un webhook ou un flux de commandes.
2. Avec la documentation, le connecteur se code dans `supabase/functions/_shared/` sur le même modèle qu'eBay (publier / retirer / commandes / suivi) : estimation 1 à 2 jours de travail.
3. Alternative sans développement : un connecteur tiers payant déjà branché sur OVOKO (BaseLinker, Kamikstudio…), auquel FISSA STOCK fournirait le flux produit `product-feed` et recevrait les ventes par webhook.

## Webhook anti-survente (OVOKO, connecteur LeBonCoin…)

- Secret `MARKETPLACE_WEBHOOK_SECRET` à définir côté Supabase.
- `POST https://mkgxnnihcldspbedqwge.supabase.co/functions/v1/marketplace-webhook`
- Corps : `{ "secret": "…", "channel": "ovoko", "external_id": "<id annonce>", "ref": "<réf. interne à défaut>", "prix": 120, "order_id": "<n° commande>", "buyer_name": "…", "buyer_address": "…", "buyer_contact": "…", "paid": true }`

## Reste à faire

- Connecteur de dépôt **OVOKO** : bloqué tant qu'OVOKO n'a pas fourni l'accès API (voir § OVOKO).
- Choisir un **connecteur LeBonCoin** tiers (AllYouCanPost / X-Studio…) si le dépôt manuel devient trop lourd.
- **Cron** de synchronisation eBay (aujourd'hui bouton manuel).
- Paiement en ligne de la boutique FISSA (Stripe) si on veut encaisser en direct sans marketplace.

## Références

- Reco & faisabilité par plateforme : `ETAT_PROJET.md` §7.3.
- Modèle de données et flux : `SCHEMA_PROJET.md` §5.4.
