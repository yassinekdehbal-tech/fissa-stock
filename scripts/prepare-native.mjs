#!/usr/bin/env node
/**
 * Prépare les projets natifs générés par Capacitor (`npx cap add ios|android`)
 * avant un build store. Les dossiers `ios/` et `android/` ne sont PAS versionnés :
 * ils sont régénérés à chaque build CI, donc toute personnalisation doit passer
 * par ce script (idempotent, relançable sans effet de bord).
 *
 * Usage : node scripts/prepare-native.mjs <ios|android|all>
 *
 * Variables d'environnement :
 *   APP_VERSION   version marketing (défaut : "version" de package.json)
 *   BUILD_NUMBER  numéro de build entier, strictement croissant (défaut : 1)
 *
 * Ce qui est appliqué :
 *   iOS     → Info.plist : textes d'usage caméra / photothèque (obligatoires
 *             App Store, sinon crash au 1er scan et rejet en review),
 *             langue de développement "fr".
 *   Android → AndroidManifest.xml : permissions CAMERA + accès images
 *             (scanner code-barres, photo de pièce) ;
 *             build.gradle : versionCode / versionName + signature release
 *             lue dans l'environnement (ANDROID_KEYSTORE_PATH, …) si présente.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const target = (process.argv[2] || 'all').toLowerCase()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const appVersion = process.env.APP_VERSION || pkg.version
const buildNumber = parseInt(process.env.BUILD_NUMBER || '1', 10)

if (!Number.isInteger(buildNumber) || buildNumber < 1) {
  console.error(`BUILD_NUMBER invalide : "${process.env.BUILD_NUMBER}" (entier ≥ 1 attendu)`)
  process.exit(1)
}

const IOS_USAGE = {
  NSCameraUsageDescription:
    "L'appareil photo sert à scanner les codes-barres des pièces et à photographier les pièces en stock.",
  NSPhotoLibraryUsageDescription:
    'La photothèque permet de choisir une photo existante pour une pièce en stock.',
  NSPhotoLibraryAddUsageDescription:
    "L'enregistrement dans la photothèque permet de conserver les photos de pièces prises depuis l'application.",
}

const ANDROID_PERMISSIONS = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
]

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function prepareIos() {
  const plistPath = resolve(root, 'ios/App/App/Info.plist')
  if (!existsSync(plistPath)) {
    console.error(`iOS : ${plistPath} introuvable. Lancer d'abord \`npx cap add ios\`.`)
    process.exit(1)
  }
  let plist = readFileSync(plistPath, 'utf8')
  let added = 0
  for (const [key, text] of Object.entries(IOS_USAGE)) {
    if (plist.includes(`<key>${key}</key>`)) continue
    plist = plist.replace(
      /<\/dict>\s*<\/plist>\s*$/,
      `\t<key>${key}</key>\n\t<string>${escapeXml(text)}</string>\n</dict>\n</plist>\n`,
    )
    added++
  }
  plist = plist.replace(
    /<key>CFBundleDevelopmentRegion<\/key>\s*<string>[^<]*<\/string>/,
    '<key>CFBundleDevelopmentRegion</key>\n\t<string>fr</string>',
  )
  writeFileSync(plistPath, plist)
  console.log(`iOS : Info.plist OK (${added} clé(s) d'usage ajoutée(s), région fr).`)
  console.log(
    `iOS : version ${appVersion} (build ${buildNumber}) → à passer à xcodebuild via MARKETING_VERSION / CURRENT_PROJECT_VERSION.`,
  )
}

function prepareAndroid() {
  const manifestPath = resolve(root, 'android/app/src/main/AndroidManifest.xml')
  const gradlePath = resolve(root, 'android/app/build.gradle')
  if (!existsSync(manifestPath) || !existsSync(gradlePath)) {
    console.error("Android : projet introuvable. Lancer d'abord `npx cap add android`.")
    process.exit(1)
  }

  // --- Manifest : permissions caméra / images ---
  let manifest = readFileSync(manifestPath, 'utf8')
  const missing = ANDROID_PERMISSIONS.filter((p) => {
    const name = p.match(/android:name="([^"]+)"/)[1]
    return !manifest.includes(`android:name="${name}"`)
  })
  if (missing.length) {
    manifest = manifest.replace(
      /\s*<\/manifest>\s*$/,
      `\n    ${missing.join('\n    ')}\n</manifest>\n`,
    )
    writeFileSync(manifestPath, manifest)
  }
  console.log(`Android : AndroidManifest.xml OK (${missing.length} permission(s) ajoutée(s)).`)

  // --- build.gradle : version + signature release ---
  let gradle = readFileSync(gradlePath, 'utf8')
  gradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${appVersion}"`)

  if (!gradle.includes('signingConfigs')) {
    gradle = gradle.replace(
      /\n\s*buildTypes\s*\{/,
      `
    // Signature release : fournie par l'environnement (CI) — voir STORES_GUIDE.md.
    // Sans ces variables, le build release reste non signé (utilisable pour tester
    // la compilation, pas pour installer sur un téléphone).
    signingConfigs {
        release {
            def ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (ksPath != null && file(ksPath).exists()) {
                storeFile file(ksPath)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
    buildTypes {`,
    )
    gradle = gradle.replace(
      /release\s*\{\s*\n(\s*)minifyEnabled/,
      (m, indent) =>
        `release {\n${indent}if (System.getenv("ANDROID_KEYSTORE_PATH") != null) signingConfig signingConfigs.release\n${indent}minifyEnabled`,
    )
  }
  writeFileSync(gradlePath, gradle)
  console.log(
    `Android : build.gradle OK (versionName ${appVersion}, versionCode ${buildNumber}, signature release conditionnelle).`,
  )
}

if (target === 'ios' || target === 'all') prepareIos()
if (target === 'android' || target === 'all') prepareAndroid()
if (!['ios', 'android', 'all'].includes(target)) {
  console.error('Usage : node scripts/prepare-native.mjs <ios|android|all>')
  process.exit(1)
}
