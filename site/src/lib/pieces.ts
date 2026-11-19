import { supabase } from './supabase'

export interface PublicPiece {
  id: string
  ref: string
  name: string
  cat: string
  subcat: string
  vehicle: string
  oem: string
  price: number
  photo: string
  photos: string[]
  etat: string
  compat: string
  condition: 'neuve' | 'occasion' | string
  added: string
}

export interface Category { key: string; label: string }

const COLUMNS = 'id, ref, name, cat, subcat, vehicle, oem, price, photo, photos, etat, compat, condition, added'

function normalize(p: Record<string, unknown>): PublicPiece {
  const photos = Array.isArray(p.photos) ? (p.photos as string[]).filter(Boolean) : []
  const photo = (p.photo as string) || photos[0] || ''
  return {
    id: String(p.id),
    ref: String(p.ref ?? ''),
    name: String(p.name ?? ''),
    cat: String(p.cat ?? ''),
    subcat: String(p.subcat ?? ''),
    vehicle: String(p.vehicle ?? ''),
    oem: String(p.oem ?? ''),
    price: Number(p.price ?? 0),
    photo,
    photos: photos.length ? photos : photo ? [photo] : [],
    etat: String(p.etat ?? ''),
    compat: String(p.compat ?? ''),
    condition: String(p.condition ?? 'occasion'),
    added: String(p.added ?? ''),
  }
}

/** Pièces visibles publiquement (règle RLS `pieces_read_public` : publiable, non archivée, en stock). */
export async function listPieces(opts: { q?: string; cat?: string; limit?: number } = {}): Promise<PublicPiece[]> {
  let query = supabase
    .from('pieces')
    .select(COLUMNS)
    .eq('publishable', true)
    .eq('archived', false)
    .gt('qty', 0)
    .order('added', { ascending: false })
    .limit(opts.limit ?? 200)
  if (opts.cat) query = query.eq('cat', opts.cat)
  const q = (opts.q ?? '').trim()
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, ' ').trim()}%`
    query = query.or(`ref.ilike.${like},name.ilike.${like},vehicle.ilike.${like},oem.ilike.${like},compat.ilike.${like}`)
  }
  const { data, error } = await query
  if (error) {
    console.error('[pieces] listPieces', error.message)
    return []
  }
  return ((data as Record<string, unknown>[]) ?? []).map(normalize)
}

export async function getPiece(id: string): Promise<PublicPiece | null> {
  if (!isUuid(id)) return null
  const { data, error } = await supabase
    .from('pieces')
    .select(COLUMNS)
    .eq('id', id)
    .eq('publishable', true)
    .eq('archived', false)
    .gt('qty', 0)
    .maybeSingle()
  if (error) {
    console.error('[pieces] getPiece', error.message)
    return null
  }
  return data ? normalize(data as Record<string, unknown>) : null
}

export async function listCategories(): Promise<Category[]> {
  const { data } = await supabase.from('categories').select('key, label').order('label')
  return ((data as Category[]) ?? []).filter((c) => c.key)
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** URL canonique d'une fiche : /pieces/pompe-d-injection-citroen-c3-<uuid> */
export function piecePath(p: Pick<PublicPiece, 'id' | 'name' | 'vehicle'>): string {
  const slug = slugify([p.name, p.vehicle].filter(Boolean).join(' '))
  return `/pieces/${slug ? slug + '-' : ''}${p.id}`
}

/** Extrait l'uuid en fin de slug (`...-<uuid>`) ou le slug entier s'il est déjà un uuid. */
export function idFromSlug(slug: string): string | null {
  const m = slug.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)
  return m ? m[1].toLowerCase() : null
}

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
}

export function conditionLabel(c: string): string {
  return c === 'neuve' ? 'Neuve' : "D'occasion"
}
