// Fonction Edge `ebay-account-deletion` — point de terminaison exigé par eBay pour
// toute clé Production : « Marketplace account deletion/closure notifications ».
// Sans lui, le jeu de clés est marqué « Non conforme » et les jetons utilisateur
// ne peuvent pas être générés.
//
// Deux échanges, décrits dans
// https://developer.ebay.com/develop/guides/marketplace-user-account-deletion :
//   - GET  ?challenge_code=…  → eBay vérifie que l'URL nous appartient. Réponse :
//          { challengeResponse: sha256(challenge_code + jeton de vérification + URL) }
//   - POST { metadata, notification }  → un membre eBay a demandé l'effacement de ses
//          données ; on accuse réception (200) puis on anonymise ce qui le concerne.
//
// Secrets : EBAY_VERIFICATION_TOKEN (32 à 80 caractères, le même que celui saisi sur
// developer.ebay.com → Alertes et notifications) et, facultatif, EBAY_DELETION_ENDPOINT
// si l'URL publique diffère de celle du projet Supabase.
//
// Sécurité : non protégée par JWT (appelée par eBay) ; le GET exige le challenge_code,
// le POST n'expose rien et ne fait qu'anonymiser des champs acheteur.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PROJECT_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '')
const ENDPOINT =
  (Deno.env.get('EBAY_DELETION_ENDPOINT') ?? '').trim() || `${PROJECT_URL}/functions/v1/ebay-account-deletion`

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  const token = (Deno.env.get('EBAY_VERIFICATION_TOKEN') ?? '').trim()
  if (!token) return json({ error: 'EBAY_VERIFICATION_TOKEN manquant' }, 500)

  if (req.method === 'GET') {
    const code = new URL(req.url).searchParams.get('challenge_code')
    if (!code) return json({ error: 'challenge_code requis' }, 400)
    return json({ challengeResponse: await sha256Hex(code + token + ENDPOINT) })
  }

  if (req.method !== 'POST') return json({ error: 'méthode non autorisée' }, 405)

  // Accusé de réception d'abord : eBay réessaie puis désactive l'endpoint s'il ne
  // reçoit pas de 200 rapidement. Le corps est traité en meilleur effort.
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* corps vide ou invalide : on accuse quand même réception */
  }
  const notif = (body.notification ?? {}) as Record<string, unknown>
  const data = (notif.data ?? {}) as Record<string, unknown>
  const username = typeof data.username === 'string' ? data.username.trim() : ''

  if (username && PROJECT_URL) {
    try {
      const sb = createClient(PROJECT_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      // Anonymise les commandes dont le contact acheteur mentionne ce pseudo eBay.
      await sb
        .from('marketplace_orders')
        .update({ buyer_name: 'compte eBay supprimé', buyer_address: '', buyer_contact: '' })
        .ilike('buyer_contact', `%${username}%`)
    } catch (e) {
      console.error('ebay-account-deletion: anonymisation impossible', e)
    }
  }
  return json({ ok: true })
})
