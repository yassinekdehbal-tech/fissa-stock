import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/supabase'
import type { Subcategory } from '@/types'
import { useStockStore } from '@/stores/stock'

type SubcategoryRow = Tables['subcategories']['Row']

function rowToSubcategory(r: SubcategoryRow): Subcategory {
  return { id: r.id, cat: r.cat, label: r.label, sort: r.sort, archived: r.archived }
}

/** Comparaison de libellés : minuscules, sans accents ni espaces superflus. */
export function normalizeLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface SubcategorySuggestion {
  label: string
  /** Nombre de pièces déjà saisies avec cette désignation / sous-catégorie. */
  count: number
}

/**
 * Sous-catégories de pièces (table `subcategories`, par organisation et par
 * catégorie) : familles classiques pré-enregistrées + celles ajoutées par
 * l'admin ou à la volée par un magasinier. `suggestions(cat)` complète la
 * liste avec les désignations les plus saisies dans la catégorie.
 */
export const useSubcategoriesStore = defineStore('subcategories', () => {
  const items = ref<Subcategory[]>([])
  const loaded = ref(false)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const byCat = computed(() => {
    const m = new Map<string, Subcategory[]>()
    for (const s of items.value) {
      if (!m.has(s.cat)) m.set(s.cat, [])
      m.get(s.cat)!.push(s)
    }
    return m
  })

  /** Sous-catégories actives d'une catégorie, dans l'ordre. */
  function forCat(cat: string | null | undefined): Subcategory[] {
    if (!cat) return []
    return (byCat.value.get(cat) ?? []).filter((s) => !s.archived)
  }
  function all(cat: string | null | undefined): Subcategory[] {
    return cat ? byCat.value.get(cat) ?? [] : []
  }

  /**
   * Sous-catégories les plus utilisées d'une catégorie d'après les pièces déjà
   * saisies (sous-catégorie, sinon désignation), hors celles déjà dans la liste.
   */
  function suggestions(cat: string | null | undefined, limit = 8): SubcategorySuggestion[] {
    if (!cat) return []
    const stock = useStockStore()
    const known = new Set(all(cat).map((s) => normalizeLabel(s.label)))
    const counts = new Map<string, SubcategorySuggestion>()
    for (const p of stock.pieces) {
      if (p.cat !== cat) continue
      const label = (p.subcat || p.name || '').trim()
      if (!label) continue
      const key = normalizeLabel(label)
      if (known.has(key)) continue
      const cur = counts.get(key)
      if (cur) cur.count++
      else counts.set(key, { label, count: 1 })
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit)
  }

  /** Nombre de pièces (non archivées) d'une sous-catégorie. */
  function usage(cat: string, label: string): number {
    const stock = useStockStore()
    const key = normalizeLabel(label)
    return stock.pieces.filter((p) => !p.archived && p.cat === cat && normalizeLabel(p.subcat || '') === key).length
  }

  async function fetchAll() {
    const { data, error } = await supabase.from('subcategories').select('*').order('sort').order('label')
    if (!error && data) items.value = (data as SubcategoryRow[]).map(rowToSubcategory)
    loaded.value = true
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('subcategories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcategories' }, () => void fetchAll())
      .subscribe()
  }

  /** Ajoute une sous-catégorie ; si elle existe déjà (même libellé), la renvoie. */
  async function add(cat: string, label: string): Promise<Subcategory> {
    const clean = label.replace(/\s+/g, ' ').trim()
    const existing = all(cat).find((s) => normalizeLabel(s.label) === normalizeLabel(clean))
    if (existing) {
      if (existing.archived) await update(existing.id, { archived: false })
      return existing
    }
    const sort = all(cat).reduce((m, s) => Math.max(m, s.sort), 0) + 1
    const { data, error } = await supabase
      .from('subcategories')
      .insert({ cat, label: clean, sort })
      .select('*')
      .single()
    if (error) throw translate(error)
    await fetchAll()
    return rowToSubcategory(data as SubcategoryRow)
  }

  async function update(id: string, patch: Partial<Pick<Subcategory, 'label' | 'sort' | 'archived'>>) {
    const row: Tables['subcategories']['Update'] = {}
    if (patch.label !== undefined) row.label = patch.label.trim()
    if (patch.sort !== undefined) row.sort = patch.sort
    if (patch.archived !== undefined) row.archived = patch.archived
    const { error } = await supabase.from('subcategories').update(row).eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('subcategories').delete().eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  function translate(e: { message?: string; code?: string }): Error {
    const m = e.message || ''
    if (m.includes('subcategories_org_cat_label_key')) return new Error('Cette sous-catégorie existe déjà')
    if (m.includes('subcategories_label_check')) return new Error('Libellé de 1 à 60 caractères')
    if (e.code === '42501' || m.includes('row-level security')) return new Error("Action réservée à l'administrateur ou au magasinier")
    return new Error(m || 'Erreur inconnue')
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { items, loaded, forCat, all, suggestions, usage, fetchAll, listen, add, update, remove, dispose }
})
