# Boutique publique & Flux produit — FISSA STOCK

## Boutique / vitrine publique (en place)

Pages publiques (sans connexion), lisibles par tout visiteur :

- `/boutique` — catalogue : recherche par référence / véhicule, filtre par catégorie, grille de pièces.
- `/boutique/:id` — fiche pièce : photo, détails, prix, bouton « Demander cette pièce » (email pré-rempli).

Ne sont affichées que les pièces **publiables** (bouton « Publiable » dans l'écran Multidiffusion), **non archivées** et **en stock** (règle de sécurité `pieces_read_public` déjà en place — lecture anonyme autorisée uniquement sur ces pièces).

Le lien « Espace pro » en haut renvoie vers la connexion de l'app interne.

### À personnaliser
- Coordonnées de contact dans `src/components/public/BoutiquePieceView.vue` (`CONTACT_EMAIL`, `CONTACT_TEL`).
- Le paiement en ligne n'est pas inclus (géré par les marketplaces / TPE en magasin) : la boutique sert de **canal direct sans commission** + vitrine.

### Note SEO
L'app est rendue côté client (SPA). Pour un référencement optimal, prévoir plus tard un pré-rendu / SSR des pages `/boutique`. Fonctionnel dès maintenant pour le partage de liens et la navigation.

## Flux produit (code prêt, déploiement à faire)

Fonction Edge `supabase/functions/product-feed/index.ts` — **écrite mais pas encore déployée**. Elle expose un flux public des pièces publiables, à brancher sur les agrégateurs (Iziflux, Lengow, BeezUP…) et outils partenaires (LeBonCoin Pro, La Centrale…).

- `…/functions/v1/product-feed` → XML Google Shopping (RSS 2.0)
- `…/functions/v1/product-feed?format=csv` → CSV

### Pour l'activer
1. Déployer la fonction (`product-feed`, sans JWT).
2. Définir le secret `PUBLIC_SITE_URL` (l'URL publique de la boutique) pour que les liens des annonces soient corrects.
3. Donner l'URL du flux à l'agrégateur / à l'outil partenaire.

## Références
- Multidiffusion : `MULTIDIFFUSION.md`
- État & stratégie : `ETAT_PROJET.md`
