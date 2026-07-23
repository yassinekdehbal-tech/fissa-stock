# Multidiffusion — FISSA STOCK

Objectif : publier une pièce **une seule fois** dans FISSA STOCK et la diffuser sur le maximum de marketplaces, avec **anti-survente** automatique (une pièce vendue quelque part est retirée partout).

## Ce qui est en place

- **Écran « Multidiffusion »** (`/multidiffusion`, menu admin/vendeur) : centre de contrôle.
  - Active/désactive les canaux de vente.
  - Marque une pièce « publiable » (pour le futur catalogue public).
  - Publie / retire une pièce par canal, avec le statut en direct (`En ligne`, `En file`, `Erreur`, `Retiré`, `Vendu`).
- **Canaux pré-créés** (`sales_channels`) : LeBonCoin, eBay, OVOKO, Allegro, Facebook Marketplace, La Centrale, Rakuten, Cdiscount, ParuVendu. Tous **inactifs** au départ.
- **Store** `src/stores/publications.ts` + table `publications` (état par pièce × canal).
- **Fonction Edge `publish-listing`** (déployée) : reçoit une demande de publication/retrait et écrit le statut. Contient les **connecteurs eBay / OVOKO** (à finaliser avec les clés API).
- **Fonction Edge `marketplace-webhook`** (déployée) : reçoit les ventes des marketplaces et déclenche l'**anti-survente** (`mark_piece_sold` → stock à 0 + délistage des autres canaux).

## Statut réel des canaux

| Type | Canaux | Diffusion auto ? |
|------|--------|------------------|
| **API** | eBay, OVOKO, Allegro, Rakuten, Cdiscount | Oui, **une fois les clés configurées** (sinon statut `Erreur` « non configuré »). Connecteurs eBay/OVOKO à finaliser. |
| **Connecteur** | LeBonCoin | Pas d'API publique de dépôt → connecteur tiers (AllYouCanPost / X-Studio) ou dépôt semi-manuel. |
| **Manuel** | Facebook, La Centrale, ParuVendu | Suivi du dépôt manuel (pas de push auto). |

## Pour activer un canal réel

1. **Secrets** (Dashboard Supabase → Edge Functions → Secrets) :
   - `EBAY_OAUTH_TOKEN` — jeton OAuth eBay (compte vendeur + app développeur).
   - `OVOKO_API_KEY` — clé API fournisseur OVOKO.
   - `MARKETPLACE_WEBHOOK_SECRET` — secret partagé pour sécuriser le webhook entrant.
2. **Finaliser les connecteurs** dans `supabase/functions/publish-listing/index.ts` :
   - `publishEbay()` → eBay Sell API : `createOrReplaceInventoryItem` → `createOffer` → `publishOffer`.
   - `publishOvoko()` → OVOKO supplier API : upload de la pièce (réf, désignation, prix, photos, véhicule).
3. **Webhook anti-survente** : configurer chaque marketplace (ou le connecteur) pour appeler, à chaque vente :
   - `POST https://mkgxnnihcldspbedqwge.supabase.co/functions/v1/marketplace-webhook`
   - Corps : `{ "secret": "<MARKETPLACE_WEBHOOK_SECRET>", "channel": "ebay", "external_id": "<id annonce>", "prix": 120 }`
   - À défaut d'`external_id`, on peut passer `"ref": "<référence interne>"`.

## Anti-survente (déjà fonctionnel côté base)

`mark_piece_sold(piece, canal, prix)` : met le stock de la pièce à 0, trace un mouvement `vente-marketplace`, passe la publication du canal vendeur à `sold` et **déliste toutes les autres** (`delisted`). Déclenchée par le webhook ci-dessus.

## Reste à faire

- Écrire le code d'appel réel dans `publishEbay` / `publishOvoko` (structure prête, il manque les requêtes API + le mapping des catégories par plateforme).
- Choisir le connecteur LeBonCoin (tiers) ou acter le dépôt semi-manuel.
- Optionnel : gestion des photos (upload vers Supabase Storage) pour les envoyer aux marketplaces.

## Références

- Reco & faisabilité par plateforme : `ETAT_PROJET.md` §7.3.
- Modèle de données et flux : `SCHEMA_PROJET.md` §5.4.
