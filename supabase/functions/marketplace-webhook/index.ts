// Fonction Edge `marketplace-webhook` — reçoit les notifications de vente des
// marketplaces (eBay, OVOKO…) et applique l'ANTI-SURVENTE : la pièce vendue passe
// à 0 en stock et est délistée automatiquement des AUTRES canaux (via mark_piece_sold).
//
// Sécurité : non protégée par JWT (appelée par des serveurs externes) → contrôle par
// un secret partagé `MARKETPLACE_WEBHOOK_SECRET` (Dashboard Supabase → Secrets).
//
// Payload attendu (POST JSON) :
//   { secret, channel: 'ebay'|'ovoko'|'leboncoin', external_id?, ref?, prix? }
//   - external_id : identifiant de l'annonce sur la plateforme (recommandé)
//   - ref         : à défaut, la référence interne de la pièce
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
  let pieceId: string | null = null

  // 1) Résolution par external_id (annonce plateforme) via publications
  if (body.external_id && channelKey) {
    const { data: ch } = await admin.from('sales_channels').select('id').eq('key', channelKey).maybeSingle()
    if (ch) {
      const { data: pub } = await admin
        .from('publications')
        .select('piece_id')
        .eq('channel_id', ch.id)
        .eq('external_id', body.external_id as string)
        .maybeSingle()
      pieceId = pub?.piece_id ?? null
    }
  }
  // 2) Repli : résolution par référence interne
  if (!pieceId && body.ref) {
    const { data: p } = await admin.from('pieces').select('id').eq('ref', body.ref as string).maybeSingle()
    pieceId = p?.id ?? null
  }
  if (!pieceId) return json({ error: 'pièce introuvable (external_id ou ref)' }, 404)

  const { error } = await admin.rpc('mark_piece_sold', {
    p_piece: pieceId,
    p_channel: channelKey,
    p_prix: (body.prix as number) ?? null,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true, piece_id: pieceId })
})
