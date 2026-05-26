# CAHIER DES CHARGES — FISSA PIECE AUTO

## Application de gestion de stock de pieces automobiles d'occasion

---

## 1. PRESENTATION DU PROJET

### 1.1 Contexte

FISSA PIECE AUTO est une application web Progressive (PWA) destinee a la gestion de stock de pieces automobiles d'occasion. L'application permet de gerer l'inventaire, les ventes, le suivi des mouvements et la gestion d'equipe pour un commerce de pieces auto.

### 1.2 Objectifs principaux

- Gerer un inventaire de pieces automobiles d'occasion en temps reel
- Faciliter les ventes avec un systeme de panier et scanner code-barres
- Assurer la tracabilite de tous les mouvements (ajouts, ventes, modifications)
- Fournir des indicateurs de performance (CA, tendances, alertes stock)
- Gerer les utilisateurs et leurs permissions

### 1.3 Public cible

- Proprietaire/gerant du magasin (admin)
- Magasiniers (gestion de stock)
- Vendeurs (ventes et scanner)
- Employes avec acces restreint

---

## 2. ETAT ACTUEL — FONCTIONNALITES EXISTANTES

### 2.1 Architecture technique

| Composant | Technologie |
|-----------|-------------|
| Frontend | HTML/CSS/JS vanilla (single-file) |
| Backend/BDD | Firebase Realtime Database |
| Authentification | Custom (stockage mdp en clair dans Firebase) |
| Hebergement | GitHub Pages |
| PWA | Service Worker + Manifest |
| Code-barres | JsBarcode (generation) + Html5-QRCode (lecture) |
| Export visuel | html2canvas |

### 2.2 Modules fonctionnels

#### A. Authentification et sessions
- Login par identifiant + mot de passe
- Roles : Admin / Utilisateur
- Session avec timeout de 8h
- Log des connexions (device mobile/desktop)

#### B. Dashboard (Admin)
- Statistiques temps reel : references actives, CA jour/semaine/mois, valeur stock
- Graphique CA sur 7 jours
- Dernieres ventes
- Repartition des paiements (30j)
- Activite de l'equipe
- Alertes stock bas

#### C. Gestion de stock
- Ajout de pieces avec champs : reference, designation, categorie, vehicule compatible, N OEM, fournisseur, vehicule donneur, quantite, prix catalogue, seuil d'alerte, zone/emplacement, etat, compatibilites, photo (URL), notes
- 6 categories : Moteur, Carrosserie, Train avant, Train arriere, Electronique, Autre
- 4 etats : Bon etat, Tres bon etat, Etat moyen, Pour pieces
- Modification, archivage, suppression
- Filtres : categorie, etat, archive/actif
- Recherche multi-criteres
- Export CSV du stock
- Import CSV en masse

#### D. Scanner et ventes
- Scanner par camera (code-barres multiples formats : CODE128, CODE39, EAN13, EAN8, ITF, QR)
- Saisie manuelle / douchette USB
- Panier multi-pieces
- Modes de paiement : Especes, Carte bancaire, Virement, Cheque
- Remise globale en pourcentage
- Nom du client (optionnel)
- Generation et impression de ticket de vente

#### E. Etiquetage
- Generation de codes-barres (CODE128, CODE39)
- Impression d'etiquettes format 62x29mm (Brother/Dymo/NIIMBOT)
- Impression en lot apres import CSV

#### F. Devis
- Generation a partir du panier
- Nom client, validite (7/15/30 jours), conditions
- Impression formatee

#### G. Historique
- Tracabilite complete : ventes, ajouts, modifications, connexions
- Filtres par type et recherche
- Vue admin (tout) / vue utilisateur (personnel)

#### H. Reporting (Admin)
- CA mensuel avec tendance
- Pieces vendues sur 30 jours
- Delai moyen entree → vente
- Top 10 des pieces les plus vendues
- Comparaison mois sur mois (6 mois)

#### I. Caisse journaliere (Admin)
- Total du jour
- Repartition par mode de paiement
- Liste des ventes du jour
- Impression du recapitulatif

#### J. Gestion utilisateurs (Admin)
- Creation de comptes
- Permissions granulaires : Magasinier, Vendeur, Historique
- Modification des droits et mot de passe
- Suppression de comptes

### 2.3 Qualites actuelles

- Application mono-fichier, zero dependance serveur custom
- PWA installable sur mobile/desktop
- Interface responsive (mobile-first)
- Synchronisation temps reel Firebase
- Design sombre professionnel
- Mode hors-ligne basique (Service Worker)
- Aucun framework lourd = performance instantanee

---

## 3. FAIBLESSES ET DETTE TECHNIQUE

### 3.1 Securite (CRITIQUE)

| Probleme | Risque | Priorite |
|----------|--------|----------|
| Mots de passe en clair dans Firebase | Vol de credentials | P0 |
| Config Firebase exposee dans le client | Acces DB par n'importe qui | P0 |
| Pas de Firebase Security Rules documentees | Lecture/ecriture non protegee | P0 |
| Pas de validation cote serveur | Injection de donnees | P1 |
| Session geree uniquement en memoire JS | Contournable | P1 |

### 3.2 Architecture

| Probleme | Impact |
|----------|--------|
| Fichier unique de 1262 lignes | Maintenabilite difficile |
| Pas de separation HTML/CSS/JS | Evolution complexe |
| Pas de build system / bundler | Pas de minification, pas de modules |
| Pas de tests | Regressions possibles |
| Pas de versionning semantique | Pas de rollback propre |

### 3.3 Fonctionnel

| Limitation | Impact metier |
|------------|---------------|
| Pas de gestion multi-magasins | Limite a un point de vente |
| Pas de notifications push fonctionnelles | Alertes stock non recues |
| Pas de gestion des retours / SAV | Pas de suivi apres-vente |
| Pas de facturation / TVA | Non conforme legalement |
| Pas de sauvegarde / export automatique | Risque de perte de donnees |
| Photos par URL uniquement | Pas de stockage local |

---

## 4. PLAN D'EVOLUTION — COURT TERME (0-3 mois)

### 4.1 Securisation (Sprint 1 — Urgent)

**Objectif : Proteger les donnees et les acces**

- [ ] Migration vers Firebase Authentication (email/password ou magic link)
- [ ] Hashage des mots de passe (bcrypt via Cloud Function)
- [ ] Regles de securite Firebase strictes (read/write par role)
- [ ] Variables d'environnement pour la config Firebase
- [ ] Validation des donnees cote serveur (Cloud Functions)
- [ ] Rate limiting sur les tentatives de connexion
- [ ] HTTPS force

### 4.2 Refactoring technique (Sprint 2)

**Objectif : Base de code maintenable et scalable**

- [ ] Separation en modules ES6 (auth.js, stock.js, sales.js, etc.)
- [ ] Introduction de Vite comme bundler
- [ ] Ajout de TypeScript (typage des entites)
- [ ] Tests unitaires (Vitest)
- [ ] CI/CD avec GitHub Actions (lint + tests + deploy)
- [ ] Migration CSS vers fichier separe ou Tailwind

### 4.3 UX amelioree (Sprint 3)

- [ ] Mode hors-ligne complet (IndexedDB + sync a la reconnexion)
- [ ] Upload de photos directement (Firebase Storage ou Cloudinary)
- [ ] Suggestions auto-complete (vehicules, references OEM)
- [ ] Historique des prix de vente par piece
- [ ] Undo/annulation des actions recentes
- [ ] Pagination de la liste stock (performance > 1000 pieces)

---

## 5. PLAN D'EVOLUTION — MOYEN TERME (3-9 mois)

### 5.1 Facturation et conformite

- [ ] Generation de factures conformes (mentions legales, TVA si applicable)
- [ ] Numerotation sequentielle des factures
- [ ] Regime TVA configurable (franchise, normal)
- [ ] Export comptable (format FEC ou compatible)
- [ ] Mentions legales sur tickets et devis
- [ ] Archivage legal des documents (duree de conservation)

### 5.2 Gestion avancee du stock

- [ ] Multi-emplacements / multi-depots
- [ ] Inventaire physique avec assistant (scan + validation)
- [ ] Gestion des lots et prix d'achat (marge calculee)
- [ ] Seuils d'alerte dynamiques (bases sur la vitesse de vente)
- [ ] Suggestions de reapprovisionnement
- [ ] Historique complet par piece (fiche produit)
- [ ] QR Code avec lien vers la fiche en ligne

### 5.3 Relation client (CRM light)

- [ ] Fiche client avec historique d'achats
- [ ] Systeme de fidelite (remise progressive)
- [ ] Envoi de devis par email ou SMS
- [ ] Relances automatiques (devis expires)
- [ ] Notes et suivi par client

### 5.4 Gestion retours / garantie

- [ ] Enregistrement des retours avec motif
- [ ] Suivi de garantie par piece (duree configurable)
- [ ] Avoir / remboursement trace
- [ ] Statistiques de retours par categorie

---

## 6. PLAN D'EVOLUTION — LONG TERME (9-18 mois)

### 6.1 Marketplace et visibilite en ligne

- [ ] Vitrine web publique (catalogue consultable)
- [ ] Recherche par immatriculation (API SIV ou equivalent)
- [ ] Integration avec LeBonCoin / Facebook Marketplace (publication automatique)
- [ ] Panier en ligne avec reservation
- [ ] SEO optimise par piece / vehicule

### 6.2 Intelligence artificielle

- [ ] Suggestion de prix basee sur l'historique et le marche
- [ ] Detection automatique de la piece via photo (classification IA)
- [ ] Prediction de demande (quelles pieces stocker)
- [ ] Chatbot client pour recherche de piece

### 6.3 Multi-magasins et franchise

- [ ] Architecture multi-tenant
- [ ] Transfert de stock entre magasins
- [ ] Dashboard consolide (vue groupe)
- [ ] Gestion des droits par magasin
- [ ] Benchmarking entre points de vente

### 6.4 Integrations

- [ ] Comptabilite : export vers QuickBooks, Sage, Pennylane
- [ ] Logistique : etiquettes Colissimo/Mondial Relay pour expedition
- [ ] TecDoc / ETAI : base de donnees pieces compatible
- [ ] Stripe / SumUp : paiement integre
- [ ] Calendrier : RDV client pour pieces sur commande

---

## 7. REFLEXION COMMERCIALE

### 7.1 Positionnement

**Marche cible :** Casseurs automobiles, deconstructeurs, revendeurs de pieces d'occasion, garages avec stock de pieces de recuperation.

**Proposition de valeur :** Solution tout-en-un, accessible sans formation technique, installable sur telephone, avec suivi en temps reel du stock et des ventes.

**Avantage concurrentiel :**
- Zero installation serveur (Firebase = serverless)
- PWA = utilisable sur n'importe quel device
- Interface pensee pour le terrain (scanner rapide, gros boutons)
- Prix agressif possible (cout d'infrastructure tres bas)

### 7.2 Modele economique envisageable

| Formule | Prix/mois | Contenu |
|---------|-----------|---------|
| **Solo** | Gratuit ou 9 EUR | 1 utilisateur, 500 pieces, fonctions de base |
| **Pro** | 29 EUR | 5 utilisateurs, illimite, reporting, export |
| **Business** | 59 EUR | Multi-magasins, CRM, facturation, integrations |
| **Enterprise** | Sur devis | Franchise, API, support dedie |

### 7.3 Canaux d'acquisition

1. **Referencement local** : "logiciel gestion stock casse auto", "gestion pieces occasion"
2. **Partenariats** : Federations de deconstructeurs (CNPA, INDRA)
3. **Demo terrain** : Visite des casses automobiles avec demo sur tablette
4. **Bouche-a-oreille** : Programme de parrainage (-1 mois offert)
5. **Reseaux sociaux** : Tutos video YouTube/TikTok sur la gestion de stock

### 7.4 Metriques de succes

| KPI | Objectif 6 mois | Objectif 12 mois |
|-----|------------------|-------------------|
| Utilisateurs inscrits | 50 | 200 |
| Clients payants | 10 | 50 |
| MRR (Monthly Recurring Revenue) | 300 EUR | 1 500 EUR |
| Taux de retention | > 80% | > 85% |
| NPS (satisfaction) | > 40 | > 50 |
| Pieces gerees sur la plateforme | 10 000 | 100 000 |

### 7.5 Analyse concurrentielle

| Concurrent | Forces | Faiblesses vs FISSA |
|------------|--------|---------------------|
| GPA (Gestion Pieces Auto) | Complet, historique | Cher, interface vieillotte, install locale |
| Autodoc Pro | Base TecDoc | Pas de gestion stock interne |
| Excel / Google Sheets | Gratuit, flexible | Zero automatisation, pas de scanner |
| EBP Gestion commerciale | Comptabilite integree | Generaliste, pas adapte au metier |
| Solutions custom | Sur-mesure | Cout de dev eleve, maintenance |

**Positionnement FISSA :** Le "Shopify de la piece auto d'occasion" — simple, mobile-first, abordable, specialise metier.

### 7.6 Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Securite (fuite de donnees) | Haute | Critique | Sprint securite P0 immediat |
| Scalabilite Firebase | Moyenne | Fort | Migration Supabase ou backend custom si > 10k users |
| Reglementation (RGPD, facturation) | Haute | Fort | Mise en conformite obligatoire avant commercialisation |
| Concurrence SaaS generaliste | Moyenne | Moyen | Focus metier, UX terrain, prix bas |
| Dependance Firebase/Google | Moyenne | Moyen | Abstraction de la couche BDD |

---

## 8. ROADMAP RESUMEE

```
Q3 2025  ██████████  Securisation + refactoring
Q4 2025  ██████████  UX avancee + mode hors-ligne complet
Q1 2026  ██████████  Facturation + CRM + retours
Q2 2026  ██████████  Beta publique + premiers clients payants
Q3 2026  ██████████  Marketplace + integrations
Q4 2026  ██████████  IA + multi-magasins
```

---

## 9. SPECIFICATIONS TECHNIQUES CIBLES

### 9.1 Stack recommandee (evolution)

| Couche | Actuel | Cible |
|--------|--------|-------|
| Frontend | HTML/JS vanilla | Vue 3 ou Svelte + TypeScript |
| State management | Variables globales | Pinia ou stores natifs |
| Style | CSS inline/embedded | Tailwind CSS |
| Backend | Firebase RTDB direct | Firebase + Cloud Functions (ou Supabase) |
| Auth | Custom (dangereux) | Firebase Auth / Supabase Auth |
| Stockage fichiers | Aucun | Firebase Storage / Cloudinary |
| Tests | Aucun | Vitest + Playwright (E2E) |
| CI/CD | Manuel | GitHub Actions → deploy auto |
| Monitoring | Aucun | Sentry + Firebase Analytics |

### 9.2 Performance cibles

| Metrique | Cible |
|----------|-------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Lighthouse score | > 90 |
| Temps de scan → resultat | < 500ms |
| Sync offline → online | < 5s au retour de connexion |

---

## 10. CONCLUSION

FISSA PIECE AUTO est un MVP fonctionnel et bien pense pour le terrain. Les fondamentaux metier sont solides : gestion de stock, ventes, etiquetage, reporting. Le principal chantier immediat est la **securisation** (mots de passe, regles Firebase), suivi d'un **refactoring** pour permettre une evolution sereine.

Le potentiel commercial est reel sur un marche de niche (casses auto, deconstructeurs) mal servi par les solutions existantes. La cle du succes sera de rester **simple, rapide, et specialise** tout en ajoutant progressivement les fonctions attendues (facturation, CRM, conformite).

---

*Document genere le 26/05/2026 — Version 1.0*
