import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/supabase'
import type { Supplier } from '@/types'
import { normalizeLabel } from '@/stores/subcategories'
import { useStockStore } from '@/stores/stock'

type SupplierRow = Tables['suppliers']['Row']

function rowToSupplier(r: SupplierRow): Supplier {
  return { id: r.id, name: r.name, website: r.website, phone: r.phone, notes: r.notes, sort: r.sort, archived: r.archived }
}

/**
 * Fournisseurs de pièces neuves (table `suppliers`, par organisation) :
 * grossistes et sites chez qui le magasin achète. Liste gérée par l'admin
 * (Paramètres → Fournisseurs) et complétée à la volée par un magasinier
 * depuis le formulaire de référencement.
 */
export const useSuppliersStore = defineStore('suppliers', () => {
  const items = ref<Supplier[]>([])
  const loaded = ref(false)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const active = computed(() => items.value.filter((s) => !s.archived))

  function byName(name: string | null | undefined): Supplier | undefined {
    if (!name) return undefined
    const k = normalizeLabel(name)
    return items.value.find((s) => normalizeLabel(s.name) === k)
  }

  /** Nombre de pièces (non archivées) rattachées au fournisseur. */
  function usage(name: string): number {
    const stock = useStockStore()
    const k = normalizeLabel(name)
    return stock.pieces.filter((p) => !p.archived && normalizeLabel(p.supplier || '') === k).length
  }

  async function fetchAll() {
    const { data, error } = await supabase.from('suppliers').select('*').order('sort').order('name')
    if (!error && data) items.value = (data as SupplierRow[]).map(rowToSupplier)
    loaded.value = true
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('suppliers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => void fetchAll())
      .subscribe()
  }

  /** Ajoute un fournisseur ; s'il existe déjà (même nom), le renvoie. */
  async function add(name: string, extra: Partial<Pick<Supplier, 'website' | 'phone' | 'notes'>> = {}): Promise<Supplier> {
    const clean = name.replace(/\s+/g, ' ').trim()
    const existing = byName(clean)
    if (existing) {
      if (existing.archived) await update(existing.id, { archived: false })
      return existing
    }
    const sort = items.value.reduce((m, s) => Math.max(m, s.sort), 0) + 1
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: clean, sort, website: extra.website ?? '', phone: extra.phone ?? '', notes: extra.notes ?? '' })
      .select('*')
      .single()
    if (error) throw translate(error)
    await fetchAll()
    return rowToSupplier(data as SupplierRow)
  }

  async function update(id: string, patch: Partial<Pick<Supplier, 'name' | 'website' | 'phone' | 'notes' | 'sort' | 'archived'>>) {
    const row: Tables['suppliers']['Update'] = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.website !== undefined) row.website = patch.website.trim()
    if (patch.phone !== undefined) row.phone = patch.phone.trim()
    if (patch.notes !== undefined) row.notes = patch.notes.trim()
    if (patch.sort !== undefined) row.sort = patch.sort
    if (patch.archived !== undefined) row.archived = patch.archived
    const { error } = await supabase.from('suppliers').update(row).eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) throw translate(error)
    await fetchAll()
  }

  function translate(e: { message?: string; code?: string }): Error {
    const m = e.message || ''
    if (m.includes('suppliers_org_name_key')) return new Error('Ce fournisseur existe déjà')
    if (m.includes('suppliers_name_check')) return new Error('Nom de 1 à 80 caractères')
    if (e.code === '42501' || m.includes('row-level security')) return new Error("Action réservée à l'administrateur ou au magasinier")
    return new Error(m || 'Erreur inconnue')
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { items, loaded, active, byName, usage, fetchAll, listen, add, update, remove, dispose }
})
