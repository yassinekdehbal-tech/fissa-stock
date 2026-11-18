// Fonction Edge `publish-listing` — publie / retire une pièce sur un canal de vente.
// Appelée par l'app (utilisateur authentifié, admin ou vendeur). Écrit le statut
// dans `publications` (source affichée dans l'app, fiche pièce et écran Multidiffusion).
//
// Canaux :
//   - eBay (API) : connecteur réel `_shared/ebay.ts` (inventaire → offre → publication,
//     retrait = withdraw). Sans secrets eBay → statut 'error' « non configuré ».
//   - OVOKO / Allegro / Rakuten / Cdiscount (API) : pas encore de connecteur → 'error'
//     explicite. OVOKO : API fournie après onboarding vendeur (pas de doc publique).
//   - LeBonCoin (connecteur), Facebook, La Centrale, ParuVendu (manuel) : dépôt fait à la
//     main sur la plateforme, l'app enregistre « déposé » avec l'URL / l'identifiant de
//     l'annonce (body.url / body.externalId) pour le suivi et l'anti-survente.
//
// Corps : { action: 'publish' | 'delist', pieceId, channelId, url?, externalId? }
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { publishPiece, withdrawPiece } from '../_shared/ebay.ts'

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

const API_PENDING: Record<string, string> = {
  ovoko: "Connecteur OVOKO à venir : OVOKO n'a pas d'API vendeur publique, demandez l'accès API à votre contact OVOKO (voir MULTIDIFFUSION.md)",
  allegro: 'Connecteur Allegro non disponible (OVOKO rediffuse vers Allegro)',
  rakuten: 'Connecteur Rakuten non disponible',
  cdiscount: 'Connecteur Cdiscount non disponible',
}

async function publishOn(channel: Record<string, unknown>, piece: Record<string, unknown>, body: Record<string, unknown>): Promise<PublishResult> {
  const key = String(channel.key)
  if (key === 'ebay') {
    const r = await publishPiece(piece, channel.config)
    return { configured: true, externalId: r.listingId, url: r.url }
  }
  if (channel.integration === 'api') {
    return { configured: false, message: API_PENDING[key] ?? `Connecteur ${channel.label} non disponible` }
  }
  // Dépôt manuel / connecteur tiers : on trace ce que l'utilisateur a déposé.
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const externalId = typeof body.externalId === 'string' ? body.externalId.trim() : ''
  return { configured: true, url: url || undefined, externalId: externalId || undefined }
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
  const { data: profile } = await admin.from('profiles').select('org_id, role, perm_vendeur').eq('id', userData.user.id).single()
  if (!profile) return json({ error: 'profil introuvable' }, 403)
  if (profile.role !== 'admin' && !profile.perm_vendeur) return json({ error: 'droits insuffisants (vendeur requis)' }, 403)

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

  const { data: channel } = await admin.from('sales_channels').select('*').eq('id', channelId).eq('org_id', profile.org_id).single()
  const { data: piece } = await admin.from('pieces').select('*').eq('id', pieceId).eq('org_id', profile.org_id).single()
  if (!channel || !piece) return json({ error: 'canal ou pièce introuvable' }, 404)

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    await admin
      .from('publications')
      .upsert(
        { piece_id: pieceId, channel_id: channelId, org_id: profile!.org_id, status, updated_at: new Date().toISOString(), ...extra },
        { onConflict: 'piece_id,channel_id' },
      )
  }

  if (action === 'delist') {
    try {
      if (channel.key === 'ebay') await withdrawPiece(piece, channel.config)
      await setStatus('delisted', { error_msg: null })
      return json({ ok: true, status: 'delisted' })
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e)
      await setStatus('error', { error_msg: 'Retrait impossible : ' + msg })
      return json({ ok: false, status: 'error', message: msg }, 200)
    }
  }

  if (!channel.active) return json({ error: 'canal inactif' }, 400)
  if (piece.archived || Number(piece.qty) <= 0) return json({ error: 'pièce archivée ou sans stock' }, 400)

  try {
    const result = await publishOn(channel, piece, body)
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
    return json({ ok: true, status: 'published', externalId: result.externalId, url: result.url })
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e)
    await setStatus('error', { error_msg: msg })
    return json({ ok: false, status: 'error', message: msg }, 200)
  }
})
