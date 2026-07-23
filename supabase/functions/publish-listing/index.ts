// Fonction Edge `publish-listing` — publie / retire une pièce sur un canal marketplace.
// Appelée par l'app (admin/vendeur authentifié). Écrit le statut dans `publications`.
// Les connecteurs eBay / OVOKO lisent leurs secrets dans l'environnement de la fonction
// (Dashboard Supabase → Edge Functions → Secrets). Sans secret : statut 'error'
// (« canal non configuré »), à activer quand les accès API seront fournis.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

interface PublishResult {
  configured: boolean
  externalId?: string
  url?: string
  message?: string
}

// --- Connecteurs marketplace (à finaliser avec les accès API) -------------
async function publishEbay(_piece: Record<string, unknown>): Promise<PublishResult> {
  const token = Deno.env.get('EBAY_OAUTH_TOKEN')
  if (!token) return { configured: false, message: 'eBay non configuré (secret EBAY_OAUTH_TOKEN manquant)' }
  // TODO : eBay Sell API — createOrReplaceInventoryItem → createOffer → publishOffer.
  // Retourner { configured: true, externalId, url } une fois l'annonce publiée.
  return { configured: false, message: 'Connecteur eBay à finaliser (createOffer / publishOffer)' }
}
async function publishOvoko(_piece: Record<string, unknown>): Promise<PublishResult> {
  const key = Deno.env.get('OVOKO_API_KEY')
  if (!key) return { configured: false, message: 'OVOKO non configuré (secret OVOKO_API_KEY manquant)' }
  // TODO : OVOKO supplier API — upload de la pièce (réf, désignation, prix, photos, véhicule).
  return { configured: false, message: 'Connecteur OVOKO à finaliser (upload stock)' }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''

  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData } = await caller.auth.getUser()
  if (!userData?.user) return json({ error: 'non authentifié' }, 401)

  const admin = createClient(url, service)
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }
  const action = (body.action as string) ?? 'publish'
  const pieceId = body.pieceId as string
  const channelId = body.channelId as string
  if (!pieceId || !channelId) return json({ error: 'pieceId et channelId requis' }, 400)

  const { data: channel } = await admin.from('sales_channels').select('*').eq('id', channelId).single()
  const { data: piece } = await admin.from('pieces').select('*').eq('id', pieceId).single()
  if (!channel || !piece) return json({ error: 'canal ou pièce introuvable' }, 404)

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    await admin
      .from('publications')
      .upsert({ piece_id: pieceId, channel_id: channelId, status, ...extra }, { onConflict: 'piece_id,channel_id' })
  }

  if (action === 'delist') {
    // TODO : appel API de retrait selon channel.key (ended/delete offer, etc.)
    await setStatus('delisted', { updated_at: new Date().toISOString() })
    return json({ ok: true, status: 'delisted' })
  }

  try {
    let result: PublishResult
    if (channel.key === 'ebay') result = await publishEbay(piece)
    else if (channel.key === 'ovoko') result = await publishOvoko(piece)
    else result = { configured: false, message: 'Dépôt manuel / connecteur tiers requis (ex. LeBonCoin)' }

    if (!result.configured) {
      await setStatus('error', { error_msg: result.message ?? 'canal non configuré', date_published: null })
      return json({ ok: false, status: 'error', message: result.message }, 200)
    }
    await setStatus('published', {
      external_id: result.externalId ?? null,
      url: result.url ?? null,
      error_msg: null,
      date_published: new Date().toISOString(),
    })
    return json({ ok: true, status: 'published', externalId: result.externalId })
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e)
    await setStatus('error', { error_msg: msg })
    return json({ ok: false, status: 'error', message: msg }, 200)
  }
})
