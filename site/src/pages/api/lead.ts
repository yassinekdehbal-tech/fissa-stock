import type { APIRoute } from 'astro'
import { supabase } from '../../lib/supabase'
import { isUuid } from '../../lib/pieces'

export const prerender = false

const KINDS = new Set(['garage', 'auto', 'piece', 'contact'])
const clean = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

function back(page: string, params: string, hash = ''): Response {
  const safe = page.startsWith('/') && !page.startsWith('//') ? page : '/'
  return new Response(null, { status: 303, headers: { Location: `${safe}?${params}${hash}` } })
}

/** Anti-CSRF : l'envoi doit venir d'une page du site lui-même (même hôte). */
function sameSite(request: Request): boolean {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim().toLowerCase()
  const source = request.headers.get('origin') || request.headers.get('referer') || ''
  if (!host || !source) return false
  try {
    return new URL(source).host.toLowerCase() === host
  } catch {
    return false
  }
}

export const POST: APIRoute = async ({ request }) => {
  if (!sameSite(request)) return new Response('Forbidden', { status: 403 })
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  const page = clean(form.get('page'), 300) || '/'

  // Pot de miel : un robot qui remplit « website » est ignoré silencieusement.
  if (clean(form.get('website'), 50)) return back(page, 'sent=1', '#devis')

  const kind = clean(form.get('kind'), 20)
  const name = clean(form.get('name'), 120)
  const phone = clean(form.get('phone'), 40)
  const email = clean(form.get('email'), 160).toLowerCase()
  const vehicle = clean(form.get('vehicle'), 160)
  const message = String(form.get('message') ?? '').trim().slice(0, 2000)
  const pieceRaw = clean(form.get('piece_id'), 40)

  if (!KINDS.has(kind) || name.length < 2) return back(page, 'error=1', '#devis')
  if (!phone && !email) return back(page, 'error=contact', '#devis')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return back(page, 'error=contact', '#devis')

  const { error } = await supabase.from('leads').insert({
    kind,
    name,
    phone,
    email,
    vehicle,
    message,
    piece_id: isUuid(pieceRaw) ? pieceRaw : null,
    page,
  })
  if (error) {
    console.error('[lead] insert', error.message)
    return back(page, 'error=1', '#devis')
  }
  return back(page, 'sent=1', '#devis')
}

export const GET: APIRoute = () => new Response(null, { status: 405 })
