// Fonction Edge `marketplace-webhook` — reçoit les notifications de vente des
// marketplaces / connecteurs tiers et enregistre la COMMANDE dans FISSA STOCK :
//   - anti-survente (record_marketplace_sale → mark_piece_sold) : stock à 0,
//     mouvement `vente-marketplace`, délistage des autres canaux ;
//   - ligne dans `marketplace_orders` (acheteur, montant, paiement, à expédier)
//     pour le suivi des envois et de l'encaissement depuis l'app.
//
// Sécurité : non protégée par JWT (appelée par des serveurs externes) → contrôle par
// un secret partagé `MARKETPLACE_WEBHOOK_SECRET` (Dashboard Supabase → Secrets).
//
// Payload (POST JSON) :
//   { secret, channel: 'ebay'|'ovoko'|'leboncoin'|…, external_id?, ref?, prix?, qty?,
//     order_id?, line_item_id?, buyer_name?, buyer_address?, buyer_contact?, paid? }
//   - external_id : identifiant de l'annonce sur la plateforme (recommandé)
//   - ref         : à défaut, la référence interne de la pièce
//   - order_id    : n° de commande plateforme (idempotence : un même n° n'est traité qu'une fois)
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'méthode non autorisée' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const secret = Deno.env.get('MARKETPLACE_WEBHOOK_SECRET')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }

  // Sans secret configuré, on refuse par défaut (sécurité).
  if (!secret || body.secret !== secret) return json({ error: 'non autorisé' }, 401)

  const admin = createClient(url, service)
  const channelKey = (body.channel as string) ?? null
  if (!channelKey) return json({ error: 'channel requis' }, 400)
  let pieceId: string | null = null

  // 1) Résolution par external_id (annonce plateforme) via publications
  if (body.external_id) {
    const { data: ch } = await admin.from('sales_channels').select('id').eq('key', channelKey)
    const ids = (ch ?? []).map((c: { id: string }) => c.id)
    if (ids.length) {
      const { data: pub } = await admin
        .from('publications')
        .select('piece_id')
        .in('channel_id', ids)
        .eq('external_id', String(body.external_id))
        .maybeSingle()
      pieceId = pub?.piece_id ?? null
    }
  }
  // 2) Repli : résolution par référence interne
  if (!pieceId && body.ref) {
    const { data: p } = await admin.from('pieces').select('id').eq('ref', String(body.ref)).maybeSingle()
    pieceId = p?.id ?? null
  }
  if (!pieceId) return json({ error: 'pièce introuvable (external_id ou ref)' }, 404)

  const { data: orderId, error } = await admin.rpc('record_marketplace_sale', {
    p_piece: pieceId,
    p_channel: channelKey,
    p_prix: body.prix != null ? Number(body.prix) : null,
    p_external_order_id: body.order_id != null ? String(body.order_id) : null,
    p_external_line_item_id: body.line_item_id != null ? String(body.line_item_id) : null,
    p_buyer_name: String(body.buyer_name ?? ''),
    p_buyer_address: String(body.buyer_address ?? ''),
    p_buyer_contact: String(body.buyer_contact ?? ''),
    p_qty: Number(body.qty) || 1,
    p_paid: body.paid === true || body.paid === 'true',
    p_notes: 'Reçue par webhook ' + channelKey,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true, piece_id: pieceId, order_id: orderId })
})
