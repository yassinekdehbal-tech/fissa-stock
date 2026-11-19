// Fonction Edge `marketplace-orders` — suivi des commandes en ligne depuis FISSA STOCK.
//
// Actions (utilisateur authentifié, admin ou vendeur) :
//   - { action: 'sync' }
//       Récupère les commandes eBay (Fulfillment API) des 30 derniers jours et les
//       enregistre via `record_marketplace_sale` (idempotent) : stock à 0, délistage
//       des autres canaux, ligne `marketplace_orders` avec acheteur / montant /
//       statut de paiement eBay. À lancer depuis l'écran « Commandes » (bouton
//       Synchroniser) ; un cron Supabase peut l'appeler toutes les heures.
//   - { action: 'ship', orderId, carrier, trackingNumber }
//       Marque la commande expédiée et, pour eBay, déclare le n° de suivi à
//       l'acheteur (createShippingFulfillment).
//   - { action: 'ebay_setup' } (admin)
//       Vérifie le jeton eBay, lit les politiques de vente et les lieux
//       d'expédition du compte vendeur, crée le lieu « magasin » s'il manque
//       (adresse de l'organisation) et enregistre le tout dans
//       sales_channels.config du canal eBay. Renvoie ce qui reste à faire.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ebayConfigured, fetchOrders, shipToText, createShippingFulfillment, readSellerSetup, optInBusinessPolicies, createLocation, readConfig, missingForPublish } from '../_shared/ebay.ts'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })
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
  const orgId = profile.org_id as string

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }

  // ---------------------------------------------------------------- ebay_setup
  if (body.action === 'ebay_setup') {
    if (profile.role !== 'admin') return json({ error: 'réservé à l\'administrateur' }, 403)
    const { data: ch } = await admin.from('sales_channels').select('id, config').eq('org_id', orgId).eq('key', 'ebay').maybeSingle()
    if (!ch) return json({ error: 'canal eBay introuvable' }, 404)
    if (!ebayConfigured()) {
      return json({ ok: false, step: 'token', message: 'Secrets eBay absents : EBAY_CLIENT_ID, EBAY_CLIENT_SECRET et EBAY_REFRESH_TOKEN (Supabase → Edge Functions → Secrets)' })
    }
    const config = (ch.config && typeof ch.config === 'object' ? ch.config : {}) as Record<string, unknown>
    const marketplaceId = (typeof config.marketplaceId === 'string' && config.marketplaceId) || Deno.env.get('EBAY_MARKETPLACE_ID') || 'EBAY_FR'
    const notes: string[] = []
    try {
      await optInBusinessPolicies()
      let setup = await readSellerSetup(marketplaceId)
      if (!setup.locations.length) {
        const { data: org } = await admin.from('organizations').select('name, address, phone').eq('id', orgId).single()
        const addr = String(org?.address ?? '').trim()
        // Adresse attendue sous la forme « 12 rue X, 75001 Paris » ; sinon on laisse l'utilisateur la créer sur eBay
        const m = addr.match(/^(.*?),?\s*(\d{5})\s+(.+)$/)
        if (m) {
          await createLocation('FISSA', { name: String(org?.name ?? 'FISSA PIÈCE AUTO'), addressLine1: m[1].trim(), postalCode: m[2], city: m[3].trim(), phone: String(org?.phone ?? '') || undefined })
          notes.push("Lieu d'expédition « FISSA » créé sur eBay à partir de l'adresse de l'organisation")
          setup = await readSellerSetup(marketplaceId)
        } else {
          notes.push("Aucun lieu d'expédition sur eBay et adresse de l'organisation non exploitable : renseignez l'adresse (Paramètres) ou créez le lieu dans le compte vendeur eBay")
        }
      }
      const pick = (list: { id: string; name: string }[], current: unknown) =>
        (typeof current === 'string' && list.some((p) => p.id === current)) ? current : (list[0]?.id ?? '')
      const next: Record<string, unknown> = {
        ...config,
        marketplaceId,
        fulfillmentPolicyId: pick(setup.fulfillment, config.fulfillmentPolicyId),
        paymentPolicyId: pick(setup.payment, config.paymentPolicyId),
        returnPolicyId: pick(setup.returns, config.returnPolicyId),
        merchantLocationKey: (typeof config.merchantLocationKey === 'string' && setup.locations.some((l) => l.key === config.merchantLocationKey)) ? config.merchantLocationKey : (setup.locations[0]?.key ?? ''),
      }
      await admin.from('sales_channels').update({ config: next }).eq('id', ch.id)
      const missing = missingForPublish(readConfig(next))
      if (!setup.fulfillment.length) notes.push('Aucune politique de livraison : créez-en une dans le compte vendeur eBay (Préférences de vente → Politiques)')
      if (!setup.payment.length) notes.push('Aucune politique de paiement sur eBay')
      if (!setup.returns.length) notes.push('Aucune politique de retours sur eBay')
      return json({ ok: missing.length === 0, step: missing.length ? 'policies' : 'ready', setup, config: next, missing, notes, message: missing.length ? 'Reste à faire : ' + missing.join(', ') : 'eBay prêt : vous pouvez publier une pièce de test' })
    } catch (e) {
      return json({ ok: false, step: 'api', message: (e as Error).message, notes })
    }
  }

  // ---------------------------------------------------------------- sync
  if (body.action === 'sync') {
    const { data: ebayChannel } = await admin.from('sales_channels').select('id, active').eq('org_id', orgId).eq('key', 'ebay').maybeSingle()
    if (!ebayChannel?.active) return json({ ok: true, imported: 0, skipped: 0, message: 'Canal eBay inactif' })
    if (!ebayConfigured()) return json({ ok: false, imported: 0, skipped: 0, message: 'eBay non configuré (jeton manquant)' }, 200)

    const since = new Date(Date.now() - 30 * 86400000)
    let orders
    try {
      orders = await fetchOrders(since)
    } catch (e) {
      return json({ ok: false, imported: 0, skipped: 0, message: (e as Error).message }, 200)
    }

    const { data: pubs } = await admin.from('publications').select('piece_id, external_id').eq('channel_id', ebayChannel.id).not('external_id', 'is', null)
    const byListing = new Map<string, string>()
    for (const p of pubs ?? []) byListing.set(String(p.external_id), p.piece_id as string)

    let imported = 0
    let skipped = 0
    const unknown: string[] = []
    for (const o of orders) {
      const ship = shipToText(o)
      for (const li of o.lineItems ?? []) {
        let pieceId = li.legacyItemId ? byListing.get(li.legacyItemId) : undefined
        if (!pieceId && li.sku) {
          const { data: p } = await admin.from('pieces').select('id').eq('org_id', orgId).eq('ref', li.sku).maybeSingle()
          pieceId = p?.id
        }
        if (!pieceId) { unknown.push(`${o.orderId} / ${li.sku ?? li.legacyItemId ?? li.title ?? '?'}`); skipped++; continue }
        const qty = Math.max(1, Number(li.quantity) || 1)
        const cost = Number(li.lineItemCost?.value ?? li.total?.value ?? 0)
        const { error } = await admin.rpc('record_marketplace_sale', {
          p_piece: pieceId,
          p_channel: 'ebay',
          p_prix: cost > 0 ? Math.round((cost / qty) * 100) / 100 : null,
          p_external_order_id: o.orderId,
          p_external_line_item_id: li.lineItemId,
          p_buyer_name: ship.name,
          p_buyer_address: ship.address,
          p_buyer_contact: ship.contact,
          p_qty: qty,
          p_paid: o.orderPaymentStatus === 'PAID',
          p_notes: `Commande eBay ${o.orderId}`,
        })
        if (error) { skipped++; unknown.push(`${o.orderId} : ${error.message}`) } else imported++
      }
    }
    return json({ ok: true, imported, skipped, unknown, total: orders.length })
  }

  // ---------------------------------------------------------------- ship
  if (body.action === 'ship') {
    const orderId = String(body.orderId ?? '')
    const carrier = String(body.carrier ?? '').trim()
    const tracking = String(body.trackingNumber ?? '').trim()
    if (!orderId) return json({ error: 'orderId requis' }, 400)

    const { data: order } = await admin.from('marketplace_orders').select('*, sales_channels(key)').eq('id', orderId).eq('org_id', orgId).maybeSingle()
    if (!order) return json({ error: 'commande introuvable' }, 404)

    let synced = false
    let warning = ''
    const channelKey = (order.sales_channels as { key?: string } | null)?.key
    if (channelKey === 'ebay' && order.external_order_id && order.external_line_item_id && tracking) {
      try {
        await createShippingFulfillment(order.external_order_id, order.external_line_item_id, order.qty, carrier, tracking)
        synced = true
      } catch (e) {
        warning = (e as Error).message
      }
    }
    const { error } = await admin.from('marketplace_orders').update({
      shipping_status: 'shipped',
      carrier,
      tracking_number: tracking,
      shipped_at: new Date().toISOString(),
      tracking_synced: synced,
      notes: warning ? [order.notes, 'Suivi non transmis à eBay : ' + warning].filter(Boolean).join('\n') : order.notes,
    }).eq('id', orderId)
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true, synced, warning: warning || undefined })
  }

  return json({ error: 'action inconnue' }, 400)
})
