import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/supabase'
import type { Category, CategoryColor, CategoryInfo } from '@/types'
import { CATEGORY_COLORS, UNKNOWN_CATEGORY } from '@/types'

type CategoryRow = Tables['categories']['Row']

/** Lettres autorisées dans un code de catégorie : sans I, O ni Q (confusion 1/0). */
export const SAFE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'
/** Lettres acceptées mais déconseillées (B/8, S/5, Z/2, G/6). */
export const RISKY_LETTERS = 'BSZG'
export const CODE_RE = /^[A-HJ-NPR-Z]{2}$/

function rowToCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    code: r.code,
    color: (r.color in CATEGORY_COLORS ? r.color : 'gray') as CategoryColor,
    sort: r.sort,
    archived: r.archived,
  }
}

/** Clé technique dérivée d'un libellé : « Train arrière » → train-arriere. */
export function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Code à 2 lettres proposé pour un libellé : initiales des deux premiers
 * mots, sinon les deux premières lettres sûres ; en cas de collision, on
 * combine la première lettre avec les suivantes du libellé, puis avec
 * l'alphabet sûr.
 */
export function proposeCode(label: string, taken: Set<string>): string {
  const clean = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]+/g, ' ').trim()
  const safe = (s: string) => s.split('').filter((c) => SAFE_LETTERS.includes(c)).join('')
  const words = clean.split(/\s+/).map(safe).filter(Boolean)
  const letters = safe(clean.replace(/\s+/g, ''))
  const candidates: string[] = []
  if (words.length >= 2) candidates.push(words[0]![0]! + words[1]![0]!)
  if (letters.length >= 2) candidates.push(letters.slice(0, 2))
  for (let i = 1; i < letters.length; i++) candidates.push(letters[0]! + letters[i]!)
  for (const c of SAFE_LETTERS) candidates.push((letters[0] || 'A') + c)
  for (const a of SAFE_LETTERS) for (const b of SAFE_LETTERS) candidates.push(a + b)
  return candidates.find((c) => CODE_RE.test(c) && !taken.has(c)) || ''
}

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])
  const loaded = ref(false)
  let channel: ReturnType<typeof supabase.channel> | null = null

  /** Catégories utilisables dans les formulaires (non archivées), dans l'ordre. */
  const active = computed(() => categories.value.filter((c) => !c.archived))
  const byKey = computed(() => new Map(categories.value.map((c) => [c.key, c])))

  /** Apparence d'une catégorie (libellé + couleurs), avec repli si inconnue. */
  function info(key: string | null | undefined): CategoryInfo {
    if (!key) return UNKNOWN_CATEGORY
    const c = byKey.value.get(key)
    if (!c) return { ...UNKNOWN_CATEGORY, label: key }
    return { label: c.label, icon: '', ...CATEGORY_COLORS[c.color] }
  }
  function label(key: string | null | undefined): string {
    return key ? info(key).label : ''
  }
  function get(key: string): Category | undefined {
    return byKey.value.get(key)
  }

  async function fetchAll() {
    const { data, error } = await supabase.from('categories').select('*').order('sort').order('label')
    if (!error && data) categories.value = (data as CategoryRow[]).map(rowToCategory)
    loaded.value = true
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => void fetchAll())
      .subscribe()
  }

  async function add(input: { label: string; code: string; color: CategoryColor }): Promise<Category> {
    const key = uniqueKey(slugify(input.label))
    const sort = categories.value.reduce((m, c) => Math.max(m, c.sort), 0) + 1
    const { data, error } = await supabase
      .from('categories')
      .insert({ key, label: input.label.trim(), code: input.code.toUpperCase(), color: input.color, sort })
      .select('*')
      .single()
    if (error) throw translate(error)
    await fetchAll()
    return rowToCategory(data as CategoryRow)
  }

  async function update(id: string, patch: Partial<Pick<Category, 'label' | 'code' | 'color' | 'sort' | 'archived'>>) {
    const row: Tables['categories']['Update'] = {}
    if (patch.label !== undefined) row.label = patch.label.trim()
    if (patch.code !== undefined) row.code = patch.code.toUpperCase()
    if (patch.color !== undefined) row.color = patch.color
    if (patch.sort !== undefined) row.sort = patch.sort
    if (patch.archived !== undefined) row.archived = patch.archived
    const { error } = await supabase.from('categories').update(row).eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  /** Suppression définitive : refusée par la base si des pièces l'utilisent. */
  async function remove(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  /** Prochaine référence qui serait attribuée pour une catégorie (aperçu). */
  async function peekRef(key: string): Promise<string> {
    const { data, error } = await supabase.rpc('peek_piece_ref', { p_cat: key })
    if (error) throw translate(error)
    return (data as string | null) || ''
  }

  function uniqueKey(base: string): string {
    const b = base || 'categorie'
    if (!byKey.value.has(b)) return b
    let i = 2
    while (byKey.value.has(`${b}-${i}`)) i++
    return `${b}-${i}`
  }

  function translate(e: { message?: string; code?: string }): Error {
    const m = e.message || ''
    if (m.includes('categories_org_code_key')) return new Error('Ce code est déjà utilisé par une autre catégorie')
    if (m.includes('categories_code_check')) return new Error('Le code doit faire 2 lettres majuscules, sans I, O ni Q')
    if (m.includes('categories_org_key_key')) return new Error('Une catégorie porte déjà ce nom')
    if (m.includes('pieces_org_cat_fkey')) return new Error('Des pièces utilisent cette catégorie : archivez-la plutôt')
    if (e.code === '42501' || m.includes('row-level security')) return new Error('Action réservée à l\'administrateur')
    return new Error(m || 'Erreur inconnue')
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { categories, active, loaded, info, label, get, fetchAll, listen, add, update, remove, peekRef, dispose }
})
