#!/usr/bin/env node
/**
 * Vérifie, AVANT de lancer un build iOS de 15 minutes, que le compte Apple est
 * prêt : clé API App Store Connect valide, App ID enregistré, fiche app créée,
 * certificat de distribution disponible. Chaque problème est expliqué en clair
 * avec l'action à faire (voir STORES_GUIDE.md).
 *
 * Zéro dépendance : JWT ES256 signé avec le module crypto de Node ≥ 18.
 *
 * Variables d'environnement :
 *   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (fichier .p8)
 *   APP_BUNDLE_ID (défaut : com.fissa.pieceauto)
 */
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const keyId = process.env.ASC_KEY_ID
const issuerId = process.env.ASC_ISSUER_ID
const keyPath = process.env.ASC_KEY_PATH
const bundleId = process.env.APP_BUNDLE_ID || 'com.fissa.pieceauto'
const API = 'https://api.appstoreconnect.apple.com'

const problems = []
const fail = (msg) => problems.push(msg)

if (!keyId || !issuerId || !keyPath) {
  console.error(
    'Secrets manquants : ASC_KEY_ID, ASC_ISSUER_ID et ASC_KEY_CONTENT doivent être définis dans GitHub → Settings → Secrets.',
  )
  process.exit(1)
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function makeJwt() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1' }),
  )
  const key = createPrivateKey(readFileSync(keyPath, 'utf8'))
  const sig = sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${b64url(sig)}`
}

let jwt
try {
  jwt = makeJwt()
} catch (e) {
  console.error(`Clé privée .p8 illisible (${e.message}).`)
  console.error('→ Re-coller le contenu complet du fichier AuthKey_XXXX.p8 dans le secret ASC_KEY_CONTENT.')
  process.exit(1)
}

async function get(path) {
  let res
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${jwt}` } })
  } catch (e) {
    console.error(`❌ Impossible de joindre ${API} (${e.cause?.code || e.message}). Vérifier l'accès réseau du runner.`)
    process.exit(1)
  }
  const body = await res.json().catch(() => ({}))
  const err = body?.errors?.[0]
  const code = err ? `${err.code}${err.detail ? ' — ' + err.detail : ''}` : ''
  return { status: res.status, body, code }
}

function explain403(what, r) {
  if ((r.code || '').includes('REQUIRED_AGREEMENTS')) {
    return `${what} : Apple répond "contrat requis manquant ou expiré" (${r.code}). Le contrat accepté sur developer.apple.com n'est pas encore propagé à App Store Connect → attendre, puis relancer.`
  }
  return `${what} : accès refusé (403, ${r.code || 'sans code'}) → la clé API n'a pas le rôle Admin. Générer une clé Admin et mettre à jour ASC_KEY_ID / ASC_KEY_CONTENT.`
}

// 1. Authentification
const auth = await get('/v1/apps?limit=1')
if (auth.status === 401) {
  console.error('❌ Clé API App Store Connect refusée (401).')
  console.error('→ Vérifier ASC_KEY_ID (Key ID), ASC_ISSUER_ID (Issuer ID) et ASC_KEY_CONTENT (.p8) ;')
  console.error('  la clé a peut-être été révoquée : en générer une nouvelle avec le rôle Admin.')
  process.exit(1)
}
const authCode = auth.body?.errors?.[0]?.code || ''
if (auth.status === 403 && authCode.includes('REQUIRED_AGREEMENTS')) {
  console.error('❌ Apple refuse toute opération : un contrat requis n\'est pas signé ou a expiré')
  console.error(`   (${authCode}).`)
  console.error('→ Se connecter avec le compte TITULAIRE (Account Holder) sur')
  console.error('  https://appstoreconnect.apple.com/business  (Business → Accords, taxes et services bancaires)')
  console.error('  et accepter le contrat "Apple Developer Program License Agreement" / "Free Apps" ;')
  console.error('  le bandeau jaune « Le contrat de licence … a été mis à jour » disparaît ensuite de la page Apps.')
  console.error('  Si aucun bouton n\'apparaît, vérifier aussi https://developer.apple.com/account (encadré en haut de page).')
  process.exit(1)
}
if (auth.status === 403) {
  console.error(`❌ Accès refusé par Apple (403, ${authCode || 'sans code'}) : la clé API n'a pas le rôle requis.`)
  console.error('→ Générer une nouvelle clé API avec le rôle Admin et mettre à jour ASC_KEY_ID / ASC_KEY_CONTENT.')
  process.exit(1)
}
if (auth.status !== 200) {
  console.error(`❌ Réponse inattendue de l'API Apple (${auth.status}) : ${JSON.stringify(auth.body).slice(0, 300)}`)
  process.exit(1)
}
console.log('✅ Clé API App Store Connect valide.')

// 2. App ID (bundle identifier) enregistré sur le portail développeur
const bundles = await get(`/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundleId)}&filter[platform]=IOS`)
if (bundles.status === 403) {
  fail(explain403('Lecture des App IDs', bundles))
} else if (!(bundles.body.data || []).length) {
  fail(
    `App ID "${bundleId}" absent du portail développeur → Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App → Bundle ID explicite "${bundleId}".`,
  )
} else {
  console.log(`✅ App ID ${bundleId} enregistré.`)
}

// 3. Fiche app créée dans App Store Connect (indispensable pour l'upload TestFlight)
const apps = await get(`/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}`)
if (apps.status === 403) {
  fail(explain403('Lecture des fiches app', apps))
} else if (!(apps.body.data || []).length) {
  const all = await get('/v1/apps?limit=50&fields[apps]=name,bundleId,sku')
  const list = (all.body.data || []).map((a) => `"${a.attributes.name}" → ${a.attributes.bundleId} (SKU ${a.attributes.sku})`)
  fail(
    `Aucune fiche app avec le bundle "${bundleId}" dans App Store Connect.` +
      (list.length
        ? ` Fiches trouvées sur le compte :\n      ${list.join('\n      ')}\n    → si "FISSA PIÈCE AUTO" est liée à un autre bundle ID, soit changer le bundle ID de la fiche (impossible après un 1er build), soit créer une nouvelle fiche avec ${bundleId}.`
        : ` → Mes apps → + → Nouvelle app (plateforme iOS, nom "FISSA PIECE AUTO", bundle ID ${bundleId}, SKU libre).`),
  )
} else {
  const a = apps.body.data[0].attributes
  console.log(`✅ Fiche App Store Connect trouvée : "${a.name}" (${a.sku}).`)
}

// 4. Certificat de distribution (le cloud signing en crée un si la clé est Admin)
const certs = await get('/v1/certificates?filter[certificateType]=DISTRIBUTION,IOS_DISTRIBUTION&limit=10')
if (certs.status === 403) {
  fail(explain403('Lecture des certificats', certs))
} else if (!(certs.body.data || []).length) {
  console.log(
    'ℹ️  Aucun certificat de distribution existant : Xcode en créera un automatiquement (cloud signing) si la clé est Admin.',
  )
} else {
  console.log(`✅ ${certs.body.data.length} certificat(s) de distribution disponible(s).`)
}

if (problems.length) {
  console.error('\n❌ Le compte Apple n\'est pas prêt pour la publication :')
  for (const p of problems) console.error(`  • ${p}`)
  console.error('\nDétail pas à pas : STORES_GUIDE.md (section App Store).')
  process.exit(1)
}
console.log('\n✅ Compte Apple prêt : lancement du build.')
