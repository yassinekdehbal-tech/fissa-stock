# Fournisseurs et disponibilité au comptoir — FISSA STOCK

Besoin : au comptoir, le vendeur part de l'immatriculation du client, trouve la référence de la pièce sur PartsLink24 ou un site fournisseur, et doit savoir **en une recherche dans FISSA STOCK** si la pièce est **en stock chez nous (neuve ou occasion)** et sinon **chez quel fournisseur, à quel prix**.

## Ce qui est en place

- **Écran Disponibilité** (`/disponibilite`, vendeurs et admin ; tuile et recherche du tableau de bord) :
  1. *Chez nous* : pièces du stock correspondant à la référence (FISSA, OEM, réf. fournisseur, EAN, références associées, séparateurs ignorés) ou aux mots-clés ; ajout direct au panier.
  2. *Chez nos fournisseurs* : lignes des **tarifs importés** (référence exacte, EAN, début de référence, désignation) avec prix net / public, lien vers la fiche sur le site du fournisseur pour vérifier stock et délai.
  3. Liens « Chercher chez … » vers les sites fournisseurs avec la référence pré-remplie.
  4. **Associer cette référence à une pièce** : quand le vendeur retrouve quand même la pièce, la référence est ajoutée à la fiche (`pieces.alt_refs`) et sera reconnue partout la prochaine fois (stock, scanner, disponibilité). Le stock s'enrichit à chaque vente au lieu de dépendre de la saisie initiale du magasinier.
- **Import des tarifs** : Paramètres → Fournisseurs → bouton **Tarif** (admin ou magasinier). Fichier Excel ou CSV du fournisseur, colonnes reconnues d'après les en-têtes (référence, EAN, désignation, famille, prix public, prix net, remise), correspondance mémorisée par fournisseur. L'import remplace le catalogue précédent (`supplier_catalog`, recherche par la RPC `search_supplier_catalog`).
- **Fiche fournisseur** : site, téléphone, notes, **lien de recherche** (`{ref}` remplacé par la référence).
- Scanner : un code inconnu propose « Chercher chez les fournisseurs ».

## Fournisseurs de FISSA PIÈCE AUTO (état au 19/11/2026)

| Fournisseur | Portail | Ce qu'on peut brancher |
|---|---|---|
| **MGA** (MGA Distribution) | mymga.fr — login = code client suivi de `-1` | **Tarif personnalisé téléchargeable** dans Espace client → Tarifs (Excel, ~22 700 références : famille, désignation, référence MGA, EAN, prix public, prix net, remise) → à importer dans FISSA STOCK. Lien de recherche : `https://mymga.fr/AfficherProduit?Refs={ref}` (convertit aussi une référence concurrente en référence MGA ; prix et « DISPO » visibles une fois connecté). |
| **OTTO'GO** (portail Inoshop / Inovaxo) | ottogo.inoshop.net | Recherche par référence (prix, remises, EAN, équivalences) et par immatriculation. **API REST « connexion DMS »** exposée dans Espace client → Connexion DMS (URL `/rest/xat2v2`, code client et identifiant utilisateur fournis) : il manque l'**identifiant interface (DmsLoginIo)** à demander à Otto'Go (01 80 96 19 90). Avec lui : disponibilité et prix en direct depuis FISSA STOCK. |
| **Auto Partner** (catalogue APCAT, carparts-cat) | apcat.eu | Catalogue TecDoc : stock et délai (24 h / 48 h), prix net / brut / détail, références OE, EAN, recherche par immatriculation et VIN. Pas d'API publique : **webservice B2B à demander** au commercial Auto Partner (utilisé par les logiciels de gestion partenaires) ou liaison via Base.com. |

Aucun identifiant fournisseur n'est stocké dans ce dépôt ni dans la base.

## Prochaines étapes

1. Importer le tarif MGA (Paramètres → Fournisseurs → MGA → Tarif) et renseigner son lien de recherche.
2. Obtenir l'identifiant interface Otto'Go → connecteur temps réel (fonction Edge dédiée, même modèle que le connecteur eBay).
3. Obtenir l'accès webservice Auto Partner → idem.
4. Option : « pièce créée à la commande » — quand le vendeur commande chez un fournisseur pour un client, créer la fiche en statut « commandée », confirmée à la réception par le magasinier (photos, EAN).
