// Fonction Edge `product-feed` — expose un FLUX PRODUIT public des pièces
// « publiables », à brancher sur les agrégateurs (Iziflux, Lengow, BeezUP…) et
// les outils partenaires (LeBonCoin Pro, La Centrale…).
//
// Formats :
//   /product-feed            → XML Google Shopping (RSS 2.0, namespace g:)
//   /product-feed?format=csv → CSV
//
// Public (pas de JWT). N'expose que les pièces publiables, non archivées, en stock.
// L'URL des fiches est construite depuis `PUBLIC_SITE_URL` (Secret Supabase).
import { createClient } from 'jsr:@supabase/supabase-js@2'

function xmlEscape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
function csvCell(s: unknown): string {
  const v = String(s ?? '')
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

Deno.serve(async (req: Request) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const site = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://yassinekdehbal-tech.github.io/fissa-stock').replace(/\/$/, '')

  const admin = createClient(url, service)

  // Multi-tenant : le flux est celui d'UN exploitant (slug en parametre,
  // FISSA PIECE AUTO par defaut).
  const slug = new URL(req.url).searchParams.get('org') ?? 'fissa-piece-auto'
  const { data: org } = await admin.from('organizations').select('id, name').eq('slug', slug).single()
  if (!org) return new Response(JSON.stringify({ error: 'organisation inconnue' }), { status: 404 })

  const { data, error } = await admin
    .from('pieces')
    .select('id, ref, name, cat, vehicle, oem, supplier, price, photo, etat, compat, qty, publishable, archived')
    .eq('org_id', org.id)
    .eq('publishable', true)
    .eq('archived', false)
    .gt('qty', 0)
    .order('added', { ascending: false })

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const pieces = (data as Record<string, unknown>[]) ?? []

  const format = new URL(req.url).searchParams.get('format') ?? 'xml'

  if (format === 'csv') {
    const header = ['id', 'title', 'description', 'link', 'image_link', 'price', 'condition', 'availability', 'mpn', 'brand']
    const lines = [header.join(',')]
    for (const p of pieces) {
      const desc = [p.name, p.vehicle, p.etat, p.compat].filter(Boolean).join(' — ')
      lines.push(
        [
          p.ref,
          p.name,
          desc,
          `${site}/boutique/${p.id}`,
          p.photo ?? '',
          `${Number(p.price).toFixed(2)} EUR`,
          'used',
          'in_stock',
          p.oem ?? '',
          p.supplier ?? 'FISSA PIECE AUTO',
        ]
          .map(csvCell)
          .join(','),
      )
    }
    return new Response(lines.join('\n'), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
    })
  }

  // XML Google Shopping (RSS 2.0)
  const items = pieces
    .map((p) => {
      const desc = [p.name, p.vehicle, p.etat, p.compat].filter(Boolean).join(' — ')
      return `    <item>
      <g:id>${xmlEscape(p.ref)}</g:id>
      <title>${xmlEscape(p.name)}</title>
      <description>${xmlEscape(desc)}</description>
      <link>${xmlEscape(`${site}/boutique/${p.id}`)}</link>
      ${p.photo ? `<g:image_link>${xmlEscape(p.photo)}</g:image_link>` : ''}
      <g:price>${Number(p.price).toFixed(2)} EUR</g:price>
      <g:condition>used</g:condition>
      <g:availability>in_stock</g:availability>
      ${p.oem ? `<g:mpn>${xmlEscape(p.oem)}</g:mpn>` : ''}
      <g:brand>${xmlEscape(p.supplier || 'FISSA PIECE AUTO')}</g:brand>
      <g:google_product_category>888</g:google_product_category>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>FISSA PIECE AUTO — Pièces détachées</title>
    <link>${xmlEscape(site)}</link>
    <description>Pièces automobiles d'occasion et neuves</description>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  })
})
