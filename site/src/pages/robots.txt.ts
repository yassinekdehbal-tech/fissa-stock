import type { APIRoute } from 'astro'
import { SITE } from '../config'

export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE.url}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=86400' },
  })
