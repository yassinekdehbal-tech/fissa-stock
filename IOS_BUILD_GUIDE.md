# Guide de build iOS — FISSA PIECE AUTO

## Prerequis

- macOS (Sonoma ou plus recent)
- Xcode 15+ (App Store)
- Node.js 20+
- Un compte Apple Developer (gratuit pour tester sur ton iPhone, payant pour publier)

## Etapes

### 1. Cloner et installer

```bash
git clone https://github.com/yassinekdehbal-tech/fissa-stock.git
cd fissa-stock
npm install
```

### 2. Initialiser le projet iOS

```bash
npm run cap:init
```

Cela cree le dossier `ios/` avec le projet Xcode.

### 3. Build et sync

```bash
npm run cap:sync
```

Cela build l'app Vue avec `base: /` et synchronise dans le projet iOS.

### 4. Ouvrir dans Xcode

```bash
npm run cap:open
```

Cela ouvre le projet dans Xcode.

### 5. Configurer dans Xcode

- Selectionne ton **Team** (Apple Developer account) dans Signing & Capabilities
- Change le **Bundle Identifier** si besoin : `com.fissa.pieceauto`
- Selectionne ton iPhone comme destination

### 6. Lancer sur iPhone

- Branche ton iPhone en USB
- Clique **Run** (bouton play) dans Xcode
- La premiere fois, va dans Reglages > General > Gestion des appareils sur l'iPhone pour autoriser l'app

## Commandes disponibles

| Commande | Description |
|----------|-------------|
| `npm run build:ios` | Build web pour Capacitor (base: /) |
| `npm run cap:sync` | Build + sync vers le projet iOS |
| `npm run cap:open` | Ouvrir dans Xcode |
| `npm run build` | Build web pour GitHub Pages |

## Mettre a jour l'app

Apres chaque modification du code :

```bash
npm run cap:sync
```

Puis relance dans Xcode.

## Icone et Splash Screen

Les fichiers source sont dans `resources/` :
- `icon.svg` — Icone de l'app
- `splash.svg` — Ecran de demarrage

Pour generer les assets iOS aux bonnes tailles :

```bash
npx @capacitor/assets generate --ios
```

## TestFlight automatise (CI/CD)

Le repo inclut un workflow GitHub Actions qui build et upload sur TestFlight automatiquement.

### 1. Creer l'app sur App Store Connect

- Va sur https://appstoreconnect.apple.com
- Apps > + > Nouvelle app
- Nom : FISSA PIECE AUTO
- Bundle ID : com.fissa.pieceauto
- SKU : fissa-piece-auto

### 2. Generer une cle API App Store Connect

- App Store Connect > Utilisateurs et acces > Integrations > Cles d'API
- Cree une cle avec le role "Admin" ou "App Manager"
- Note le **Key ID** et l'**Issuer ID**
- Telecharge le fichier `.p8`

### 3. Configurer Fastlane Match (certificats)

Cree un repo Git prive pour stocker les certificats :

```bash
fastlane match init
fastlane match appstore
```

### 4. Ajouter les secrets GitHub

Va dans Settings > Secrets and variables > Actions du repo et ajoute :

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Ton Apple ID (email) |
| `APPLE_TEAM_ID` | Team ID (visible sur developer.apple.com) |
| `APPLE_ITC_TEAM_ID` | Meme valeur que APPLE_TEAM_ID generalement |
| `ASC_KEY_ID` | Key ID de la cle API App Store Connect |
| `ASC_ISSUER_ID` | Issuer ID de la cle API |
| `ASC_KEY_CONTENT` | Contenu du fichier .p8 encode en base64 |
| `MATCH_GIT_URL` | URL du repo prive pour les certificats |
| `MATCH_PASSWORD` | Mot de passe pour chiffrer les certificats |

Pour encoder le fichier .p8 en base64 :
```bash
base64 -i AuthKey_XXXXX.p8 | tr -d '\n'
```

### 5. Declencher le build

Deux facons :
- **Tag** : `git tag v1.0.0 && git push --tags` → build auto
- **Manuel** : GitHub > Actions > "Build iOS & Deploy to TestFlight" > Run workflow

### 6. Tester sur iPhone

- Ouvre l'app **TestFlight** sur ton iPhone
- L'app FISSA apparait dans quelques minutes apres le build
- Installe et teste

## Publication sur l'App Store

1. Dans Xcode : Product > Archive
2. Distribute App > App Store Connect
3. Remplis les infos sur App Store Connect (description, screenshots, etc.)
4. Soumets pour review Apple

Ou via le meme workflow en changeant `upload_to_testflight` par `upload_to_app_store` dans le Fastfile.

## Fonctionnalites natives

L'app utilise :
- **StatusBar** : barre d'etat sombre assortie au theme
- **SplashScreen** : ecran de chargement avec fond sombre
- **Haptics** : retour haptique sur les actions (toast, scan)
- **Keyboard** : gestion du clavier natif
- **Safe areas** : compatibilite notch / Dynamic Island
- **Camera** : scanner de codes-barres via la camera native
