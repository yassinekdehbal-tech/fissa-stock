# Publication sur l'App Store et le Play Store — FISSA PIECE AUTO

> **Rôle de ce fichier** : la procédure complète, pas à pas, pour sortir l'application
> native iOS (App Store / TestFlight) et Android (Play Store) à partir du dépôt.
> Tout le code et l'automatisation sont prêts : **ce qui reste est administratif**
> (comptes développeur, clés, fiches app) et ne peut être fait que par le titulaire
> des comptes.

- **Dernière mise à jour** : 19/10/2026 — ✅ premier build iOS envoyé sur TestFlight (run #14)
- **Identifiant d'app (les deux stores)** : `com.fissa.pieceauto`
- **Nom affiché** : FISSA PIECE AUTO

---

## 0. Comment ça marche (vue d'ensemble)

Les dossiers natifs `ios/` et `android/` ne sont **pas** versionnés. À chaque build,
GitHub Actions les régénère avec Capacitor, génère les icônes et écrans de démarrage
depuis `resources/icon.svg` et `resources/splash.svg`, applique les réglages obligatoires
(`scripts/prepare-native.mjs` : permissions caméra, numéro de version) puis compile et
envoie sur le store.

| Chaîne | Workflow | Déclenchement | Résultat |
|--------|----------|---------------|----------|
| iOS | `.github/workflows/ios-testflight.yml` | Bouton *Run workflow* ou tag `v*` | Build envoyé sur **TestFlight** (puis soumission App Store depuis App Store Connect) |
| Android | `.github/workflows/android-playstore.yml` | Bouton *Run workflow*, tag `v*`, ou PR touchant la chaîne | AAB + APK téléchargeables ; envoi sur la **piste interne** Play Store si les secrets sont présents |

Le **numéro de build** (`CFBundleVersion` iOS / `versionCode` Android) = numéro du run
GitHub, donc toujours croissant. La **version marketing** (`1.0.0`) = champ `version`
de `package.json` : l'augmenter à chaque sortie publique.

Le workflow iOS commence par **vérifier le compte Apple** (`scripts/check-asc.mjs`) et
s'arrête en 10 secondes avec un message en français si une étape ci-dessous manque,
au lieu d'échouer après 15 minutes de compilation.

---

## 1. App Store (iOS) — ce qu'il faut faire côté Apple

### Pourquoi ça échouait

Les 5 derniers builds (juillet 2026) compilaient l'archive puis échouaient à l'export :

```
error: exportArchive Cloud signing permission error
error: exportArchive No profiles for 'com.fissa.pieceauto' were found
error: exportArchive No signing certificate "iOS Distribution" found
```

Traduction : la **clé API App Store Connect n'a pas le rôle Admin** (le *cloud signing*,
qui crée automatiquement certificat et profil, l'exige), et l'**App ID n'est pas
enregistré**. Ce n'est pas un problème de code.

### Checklist (≈ 30 min, compte Apple Developer payant requis : 99 €/an)

1. **Adhésion Apple Developer Program active** sur https://developer.apple.com/account
   et **contrat de licence accepté** : https://appstoreconnect.apple.com/business
   (*Business → Accords, taxes et services bancaires*), avec le compte **titulaire**
   (Account Holder). Le *Paid Apps Agreement* n'est pas nécessaire, mais le contrat
   « Free Apps » / License Agreement doit être « Active ». Tant qu'il ne l'est pas, l'API
   Apple répond `REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED` et le cloud signing échoue
   (c'est ce que le workflow a détecté le 19/10/2026).

2. **Enregistrer l'App ID** : https://developer.apple.com/account/resources/identifiers/list
   → **+** → *App IDs* → *App* → Description `FISSA PIECE AUTO`, Bundle ID **Explicit**
   `com.fissa.pieceauto`, aucune capability à cocher → *Register*.

3. **Créer la fiche app** : https://appstoreconnect.apple.com/apps → **+** → *New App*
   → Plateforme iOS, nom `FISSA PIECE AUTO`, langue principale Français, Bundle ID
   `com.fissa.pieceauto`, SKU `fissa-pieceauto`, accès complet.

4. **Générer une clé API avec le rôle Admin** : https://appstoreconnect.apple.com/access/integrations/api
   → *Team Keys* → **+** → Nom `GitHub CI`, Accès **Admin** → *Generate* → **télécharger
   le fichier `.p8` immédiatement** (téléchargeable une seule fois). Noter l'**Issuer ID**
   (en haut de la page) et le **Key ID**.
   > Si une clé existe déjà avec un rôle *Developer* ou *App Manager*, la révoquer et en
   > créer une nouvelle en Admin : le rôle d'une clé ne se modifie pas.

5. **Team ID** : https://developer.apple.com/account → *Membership details* → *Team ID*
   (10 caractères).

6. **Secrets GitHub** : https://github.com/yassinekdehbal-tech/fissa-stock/settings/secrets/actions
   (mettre à jour ceux qui existent déjà) :

   | Secret | Valeur |
   |--------|--------|
   | `ASC_KEY_ID` | Key ID de l'étape 4 |
   | `ASC_ISSUER_ID` | Issuer ID de l'étape 4 |
   | `ASC_KEY_CONTENT` | contenu intégral du fichier `.p8` (lignes BEGIN/END comprises) |
   | `APPLE_TEAM_ID` | Team ID de l'étape 5 |

7. **Lancer le build** : https://github.com/yassinekdehbal-tech/fissa-stock/actions/workflows/ios-testflight.yml
   → *Run workflow* → branche `main`. Durée ≈ 15 min. Le build apparaît ensuite dans
   App Store Connect → TestFlight (traitement Apple : 10 à 30 min).

8. **Tester sur iPhone** : TestFlight → *Internal Testing* → créer un groupe, ajouter les
   testeurs par e-mail Apple → ils installent l'app TestFlight et reçoivent l'invitation.

9. **Soumettre à l'App Store** (quand l'app est validée en interne) : App Store Connect
   → fiche app → *Distribution* → captures d'écran (iPhone 6,7" et 6,5"), description,
   mots-clés, **URL de politique de confidentialité** (obligatoire), catégorie *Business*,
   classification d'âge, puis choisir le build TestFlight et *Submit for Review*.
   Délai de review Apple : 24 à 48 h en général.

---

## 2. Play Store (Android) — ce qu'il faut faire côté Google

### État actuel

La chaîne Android est **nouvelle** (octobre 2026). Sans aucun secret, le workflow produit
déjà un **APK debug installable** sur n'importe quel téléphone Android (Paramètres →
autoriser les sources inconnues), utile pour tester en magasin dès maintenant.

### Checklist (≈ 45 min, compte développeur Google Play : 25 $ une fois)

1. **Créer la clé de signature** (une seule fois, à conserver précieusement) :

   ```bash
   bash scripts/generate-android-keystore.sh
   ```

   Le script demande un mot de passe, crée `~/fissa-release.jks` et affiche les 4 secrets
   à copier. Prérequis : Java installé (`brew install --cask temurin` sur Mac).
   Sauvegarder le fichier `.jks` et le mot de passe hors du dépôt (gestionnaire de mots
   de passe).

2. **Secrets GitHub** :

   | Secret | Valeur |
   |--------|--------|
   | `ANDROID_KEYSTORE_BASE64` | affiché par le script (une longue ligne) |
   | `ANDROID_KEYSTORE_PASSWORD` | le mot de passe saisi |
   | `ANDROID_KEY_ALIAS` | `fissa` |
   | `ANDROID_KEY_PASSWORD` | le même mot de passe |

3. **Compte Play Console** : https://play.google.com/console → s'inscrire comme
   organisation (FISSA LIV) → frais 25 $ → vérification d'identité (quelques jours).

4. **Créer l'app** : Play Console → *Créer une application* → nom `FISSA PIECE AUTO`,
   langue Français, *Application*, Gratuite.
   Garder **Signature d'application par Google Play** activée (proposée par défaut) :
   Google conserve la clé finale, la clé de l'étape 1 sert de clé d'upload.

5. **Premier envoi manuel** : lancer le workflow Android
   (https://github.com/yassinekdehbal-tech/fissa-stock/actions/workflows/android-playstore.yml
   → *Run workflow*, piste `none`), télécharger l'artefact `fissa-android-N`, puis
   Play Console → *Tests* → *Tests internes* → *Créer une version* → déposer
   `fissa-release.aab`. Ce premier dépôt manuel est **obligatoire** : il active la
   signature Google Play et débloque l'API.

6. **Fiche Play Store à compléter** (bloquant pour toute publication, y compris en test
   interne) : *Configuration de l'application* → politique de confidentialité (URL),
   accès à l'application (identifiants de test pour la review : créer un compte `user`
   dédié), publicités (non), classification du contenu (questionnaire), public cible
   (18+), **sécurité des données** (déclarer : e-mail + nom du compte, photos prises
   par l'utilisateur ; données chiffrées en transit ; suppression sur demande), catégorie
   *Professionnel*, coordonnées, et *Fiche Play Store principale* (icône 512×512, bannière
   1024×500, 2 captures d'écran minimum, description courte et longue).

7. **Automatiser les envois suivants** (optionnel mais recommandé) :
   - Google Cloud Console → créer un projet → *IAM* → *Comptes de service* → créer
     `play-ci` → *Clés* → *Ajouter une clé* → JSON → télécharger.
   - Play Console → *Utilisateurs et autorisations* → *Inviter un utilisateur* → l'e-mail
     du compte de service → droits *Gérer les versions de test* + *Publier en production*
     sur l'app FISSA PIECE AUTO.
   - Secret GitHub `PLAY_SERVICE_ACCOUNT_JSON` = contenu du fichier JSON.
   - Désormais chaque *Run workflow* (piste `internal` par défaut) ou tag `v*` envoie
     l'AAB directement sur la piste choisie.

8. **Passer en production** : Play Console → *Production* → *Créer une version* →
   promouvoir depuis les tests internes → envoyer pour review (quelques heures à
   quelques jours la première fois).

---

## 3. Points communs aux deux stores

- **Politique de confidentialité** : URL publique obligatoire sur les deux stores (l'app
  utilise la caméra et stocke des données de compte). Page en place :
  **https://yassinekdehbal-tech.github.io/fissa-stock/confidentialite** (à renseigner dans
  App Store Connect et Play Console ; texte dans `src/components/public/PrivacyView.vue`).
- **Compte de test pour les reviewers** : créer un utilisateur `user` (pas admin) avec
  quelques pièces de démonstration ; Apple et Google refusent une app dont ils ne peuvent
  pas passer l'écran de connexion.
- **Captures d'écran** : les prendre sur la PWA en mode responsive ou sur le build
  TestFlight / APK ; au minimum : tableau de bord, stock, scanner, fiche pièce.
- **Sortir une version** : augmenter `version` dans `package.json`, commiter, puis
  `git tag v1.0.1 && git push origin v1.0.1` → les deux workflows partent seuls.

---

## 4. Dépannage

| Message | Cause | Action |
|---------|-------|--------|
| `Clé API App Store Connect refusée (401)` | Key ID / Issuer ID / `.p8` incohérents ou clé révoquée | Refaire l'étape 1.4 et les 3 secrets |
| `rôle insuffisant (403)` | clé créée en *Developer* / *App Manager* | Nouvelle clé en **Admin** |
| `App ID … absent` | étape 1.2 non faite | Enregistrer l'App ID |
| `Aucune fiche app` | étape 1.3 non faite | Créer l'app dans App Store Connect |
| `un contrat requis n'est pas signé ou a expiré` (`REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED`) | contrat Apple Developer Program non accepté par le titulaire | https://appstoreconnect.apple.com/business → accepter le contrat « Free Apps » / License Agreement (compte Account Holder) |
| `Cloud signing permission error` malgré une clé Admin | contrat Apple non accepté | idem ci-dessus |
| `AAB non signé` (warning Android) | secrets keystore absents | Étapes 2.1–2.2 |
| Play : `The caller does not have permission` | compte de service pas invité sur l'app | Étape 2.7, 2e point |
| Play : `APK/AAB must be uploaded manually first` | aucun envoi manuel initial | Étape 2.5 |

---

## 5. Secrets GitHub — récapitulatif

| Secret | iOS | Android | Obligatoire ? |
|--------|-----|---------|---------------|
| `ASC_KEY_ID` | ✔ | | oui |
| `ASC_ISSUER_ID` | ✔ | | oui |
| `ASC_KEY_CONTENT` | ✔ | | oui |
| `APPLE_TEAM_ID` | ✔ | | oui |
| `ANDROID_KEYSTORE_BASE64` | | ✔ | pour un build installable signé |
| `ANDROID_KEYSTORE_PASSWORD` | | ✔ | idem |
| `ANDROID_KEY_ALIAS` | | ✔ | idem |
| `ANDROID_KEY_PASSWORD` | | ✔ | idem |
| `PLAY_SERVICE_ACCOUNT_JSON` | | ✔ | non (envoi automatique) |
