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

## Publication sur l'App Store

1. Dans Xcode : Product > Archive
2. Distribute App > App Store Connect
3. Remplis les infos sur App Store Connect (description, screenshots, etc.)
4. Soumets pour review Apple

## Fonctionnalites natives

L'app utilise :
- **StatusBar** : barre d'etat sombre assortie au theme
- **SplashScreen** : ecran de chargement avec fond sombre
- **Haptics** : retour haptique sur les actions (toast, scan)
- **Keyboard** : gestion du clavier natif
- **Safe areas** : compatibilite notch / Dynamic Island
- **Camera** : scanner de codes-barres via la camera native
