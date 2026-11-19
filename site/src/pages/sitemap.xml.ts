import type { APIRoute } from 'astro'
import { listPieces, piecePath } from '../lib/pieces'
import { SITE } from '../config'

export const GET: APIRoute = async () => {
  const pieces = await listPieces({ limit: 1000 })
  const statics = ['/', '/pieces', '/autos', '/garage']
  const urls = [
    ...statics.map((p) => `<url><loc>${SITE.url}${p}</loc><changefreq>daily</changefreq></url>`),
    ...pieces.map((p) => `<url><loc>${SITE.url}${piecePath(p)}</loc>${p.added ? `<lastmod>${new Date(p.added).toISOString().slice(0, 10)}</lastmod>` : ''}<changefreq>weekly</changefreq></url>`),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
}
