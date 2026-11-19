import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/supabase'
import type { Supplier, SupplierCatalogHit } from '@/types'
import { normalizeLabel } from '@/stores/subcategories'
import { useStockStore } from '@/stores/stock'

type SupplierRow = Tables['suppliers']['Row']

function rowToSupplier(r: SupplierRow): Supplier {
  return {
    id: r.id, name: r.name, website: r.website, phone: r.phone, notes: r.notes, sort: r.sort, archived: r.archived,
    searchUrl: r.search_url ?? '',
    importMapping: (r.import_mapping && typeof r.import_mapping === 'object' && !Array.isArray(r.import_mapping) ? r.import_mapping : {}) as Record<string, string>,
    catalogImportedAt: r.catalog_imported_at ?? null,
  }
}

/** Ligne prête à l'insertion dans `supplier_catalog`. */
export interface CatalogRow {
  ref: string
  ean?: string
  label?: string
  family?: string
  pricePublic?: number | null
  priceNet?: number | null
  discount?: number | null
}

/** Lien de recherche sur le site du fournisseur pour une référence. */
export function supplierSearchLink(s: { searchUrl: string; website: string }, ref: string): string {
  const r = encodeURIComponent(ref.trim())
  if (s.searchUrl) return s.searchUrl.includes('{ref}') ? s.searchUrl.replace('{ref}', r) : s.searchUrl + r
  if (s.website) return /^https?:\/\//i.test(s.website) ? s.website : 'https://' + s.website
  return ''
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
  /** Nombre de lignes de catalogue importées, par fournisseur. */
  const catalogCounts = ref<Record<string, number>>({})

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
    const [{ data, error }, { data: counts }] = await Promise.all([
      supabase.from('suppliers').select('*').order('sort').order('name'),
      supabase.rpc('supplier_catalog_counts'),
    ])
    if (!error && data) items.value = (data as SupplierRow[]).map(rowToSupplier)
    const m: Record<string, number> = {}
    for (const c of (counts as { supplier_id: string; n: number }[] | null) ?? []) m[c.supplier_id] = Number(c.n)
    catalogCounts.value = m
    loaded.value = true
  }

  /**
   * Remplace le catalogue d'un fournisseur par les lignes du fichier tarif
   * (insertion par paquets, progression renvoyée en nombre de lignes).
   */
  async function replaceCatalog(supplierId: string, rows: CatalogRow[], mapping: Record<string, string>, onProgress?: (done: number, total: number) => void): Promise<number> {
    // Dédoublonnage sur la référence (dernière occurrence conservée)
    const byRef = new Map<string, CatalogRow>()
    for (const r of rows) {
      const ref = String(r.ref ?? '').trim()
      if (ref && ref.length <= 60) byRef.set(ref, { ...r, ref })
    }
    const clean = [...byRef.values()]
    const { error: delErr } = await supabase.from('supplier_catalog').delete().eq('supplier_id', supplierId)
    if (delErr) throw translate(delErr)
    const CHUNK = 500
    let done = 0
    for (let i = 0; i < clean.length; i += CHUNK) {
      const chunk = clean.slice(i, i + CHUNK).map((r) => ({
        supplier_id: supplierId,
        ref: r.ref,
        ean: (r.ean ?? '').replace(/\D/g, ''),
        label: (r.label ?? '').trim().slice(0, 200),
        family: (r.family ?? '').trim().slice(0, 80),
        price_public: r.pricePublic ?? null,
        price_net: r.priceNet ?? null,
        discount: r.discount ?? null,
      }))
      const { error } = await supabase.from('supplier_catalog').insert(chunk)
      if (error) throw translate(error)
      done += chunk.length
      onProgress?.(done, clean.length)
    }
    const { error: upErr } = await supabase.from('suppliers').update({ import_mapping: mapping, catalog_imported_at: new Date().toISOString() }).eq('id', supplierId)
    if (upErr) throw translate(upErr)
    await fetchAll()
    return clean.length
  }

  /** Recherche comptoir dans les catalogues fournisseurs (RPC). */
  async function searchCatalog(q: string, limit = 40): Promise<SupplierCatalogHit[]> {
    const query = q.trim()
    if (query.length < 2) return []
    const { data, error } = await supabase.rpc('search_supplier_catalog', { p_q: query, p_limit: limit })
    if (error) throw translate(error)
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      supplierId: r.supplier_id as string,
      supplierName: r.supplier_name as string,
      searchUrl: (r.search_url as string) ?? '',
      ref: r.ref as string,
      ean: (r.ean as string) ?? '',
      label: (r.label as string) ?? '',
      family: (r.family as string) ?? '',
      pricePublic: r.price_public == null ? null : Number(r.price_public),
      priceNet: r.price_net == null ? null : Number(r.price_net),
      discount: r.discount == null ? null : Number(r.discount),
      match: r.match as SupplierCatalogHit['match'],
    }))
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

  async function update(id: string, patch: Partial<Pick<Supplier, 'name' | 'website' | 'phone' | 'notes' | 'sort' | 'archived' | 'searchUrl'>>) {
    const row: Tables['suppliers']['Update'] = {}
    if (patch.name !== undefined) row.name = patch.name.trim()
    if (patch.website !== undefined) row.website = patch.website.trim()
    if (patch.searchUrl !== undefined) row.search_url = patch.searchUrl.trim()
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

  return { items, loaded, active, catalogCounts, byName, usage, fetchAll, listen, add, update, remove, replaceCatalog, searchCatalog, dispose }
})
