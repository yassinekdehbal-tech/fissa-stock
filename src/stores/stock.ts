import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { PieceRow } from '@/lib/supabase'
import type { Piece } from '@/types'
import { normalizeRef } from '@/utils/refMatch'

function rowToPiece(r: PieceRow): Piece {
  return {
    _id: r.id,
    ref: r.ref,
    name: r.name,
    cat: (r.cat ?? '') as Piece['cat'],
    subcat: r.subcat ?? '',
    vehicle: r.vehicle ?? '',
    oem: r.oem ?? '',
    supplierRef: r.supplier_ref ?? '',
    ean: r.ean ?? '',
    altRefs: r.alt_refs ?? [],
    supplier: r.supplier ?? '',
    donor: r.donor ?? '',
    source: (r.source ?? 'autre') as Piece['source'],
    condition: (r.condition === 'neuve' ? 'neuve' : 'occasion'),
    qty: r.qty,
    price: Number(r.price),
    threshold: r.threshold ?? 0,
    zone: r.zone ?? '',
    etat: (r.etat ?? 'Bon état') as Piece['etat'],
    compat: r.compat ?? '',
    photo: (r.photos?.[0]) || r.photo || '',
    photos: r.photos?.length ? r.photos : r.photo ? [r.photo] : [],
    notes: r.notes ?? '',
    fmt: r.fmt,
    added: r.added,
    archived: r.archived,
    publishable: r.publishable ?? false,
  }
}

function pieceToRow(p: Partial<Piece>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (p.ref !== undefined) row.ref = p.ref
  if (p.name !== undefined) row.name = p.name
  if (p.cat !== undefined) row.cat = p.cat ? p.cat : null
  if (p.subcat !== undefined) row.subcat = p.subcat
  if (p.vehicle !== undefined) row.vehicle = p.vehicle
  if (p.oem !== undefined) row.oem = p.oem
  if (p.supplierRef !== undefined) row.supplier_ref = p.supplierRef
  if (p.ean !== undefined) row.ean = p.ean
  if (p.altRefs !== undefined) row.alt_refs = p.altRefs
  if (p.condition !== undefined) row.condition = p.condition
  if (p.supplier !== undefined) row.supplier = p.supplier
  if (p.donor !== undefined) row.donor = p.donor
  if (p.source !== undefined) row.source = p.source
  if (p.qty !== undefined) row.qty = p.qty
  if (p.price !== undefined) row.price = p.price
  if (p.threshold !== undefined) row.threshold = p.threshold
  if (p.zone !== undefined) row.zone = p.zone
  if (p.etat !== undefined) row.etat = p.etat ? p.etat : null
  if (p.compat !== undefined) row.compat = p.compat
  // La galerie fait foi : la photo principale est la première
  if (p.photos !== undefined) {
    const list = p.photos.filter(Boolean)
    row.photos = list
    row.photo = list[0] ?? ''
  } else if (p.photo !== undefined) {
    row.photo = p.photo
  }
  if (p.notes !== undefined) row.notes = p.notes
  if (p.fmt !== undefined) row.fmt = p.fmt
  if (p.archived !== undefined) row.archived = p.archived
  if (p.publishable !== undefined) row.publishable = p.publishable
  return row
}

export const useStockStore = defineStore('stock', () => {
  const pieces = ref<Piece[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const activePieces = computed(() => pieces.value.filter((p) => !p.archived))
  const archivedPieces = computed(() => pieces.value.filter((p) => p.archived))
  const totalValue = computed(() =>
    activePieces.value.reduce((acc, p) => acc + (p.price || 0) * (p.qty || 0), 0),
  )
  const totalQty = computed(() => activePieces.value.reduce((acc, p) => acc + (p.qty || 0), 0))
  const lowStockPieces = computed(() =>
    activePieces.value.filter((p) => p.qty <= (p.threshold ?? 0)),
  )

  async function fetchAll() {
    const { data, error } = await supabase
      .from('pieces')
      .select('*')
      .order('added', { ascending: false })
    if (!error && data) pieces.value = (data as PieceRow[]).map(rowToPiece)
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('pieces-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pieces' }, () => {
        void fetchAll()
      })
      .subscribe()
  }

  /**
   * Crée une pièce et renvoie la ligne enregistrée : si `ref` est vide, la
   * base attribue la référence (code catégorie + numéro, trigger
   * `pieces_assign_ref`), d'où l'importance de relire le résultat.
   */
  async function addPiece(piece: Omit<Piece, '_id'>): Promise<Piece> {
    const { data, error } = await supabase
      .from('pieces')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(pieceToRow(piece) as any)
      .select('*')
      .single()
    if (error) throw error
    await fetchAll()
    return rowToPiece(data as PieceRow)
  }

  async function updatePiece(id: string, patch: Partial<Piece>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('pieces').update(pieceToRow(patch) as any).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function deletePiece(id: string) {
    const { error } = await supabase.from('pieces').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function toggleArchive(id: string) {
    const piece = pieces.value.find((p) => p._id === id)
    if (!piece) return
    const archived = !piece.archived
    await updatePiece(id, { archived, qty: archived ? 0 : piece.qty })
  }

  /**
   * Pièce correspondant à un code lu ou saisi : référence interne, puis
   * code-barres fournisseur (EAN), référence article fournisseur ou n° OEM,
   * séparateurs et casse ignorés (« 5702.E2 » = « 5702E2 »).
   */
  function findByRef(refCode: string): Piece | undefined {
    const exact = activePieces.value.find((p) => p.ref === refCode)
    if (exact) return exact
    const n = normalizeRef(refCode)
    if (!n) return undefined
    return (
      activePieces.value.find((p) => normalizeRef(p.ref) === n) ||
      activePieces.value.find((p) => p.ean && normalizeRef(p.ean) === n) ||
      activePieces.value.find((p) => p.supplierRef && normalizeRef(p.supplierRef) === n) ||
      activePieces.value.find((p) => p.oem && normalizeRef(p.oem) === n) ||
      activePieces.value.find((p) => p.altRefs.some((a) => normalizeRef(a) === n))
    )
  }

  /** Associe une référence supplémentaire à une pièce (apprentissage au comptoir). */
  async function addAltRef(id: string, ref: string) {
    const piece = pieces.value.find((p) => p._id === id)
    const clean = ref.trim()
    if (!piece || !clean) return
    const n = normalizeRef(clean)
    if (!n || piece.altRefs.some((a) => normalizeRef(a) === n) || normalizeRef(piece.ref) === n || normalizeRef(piece.oem) === n || normalizeRef(piece.supplierRef) === n || normalizeRef(piece.ean) === n) return
    await updatePiece(id, { altRefs: [...piece.altRefs, clean] })
  }
  async function removeAltRef(id: string, ref: string) {
    const piece = pieces.value.find((p) => p._id === id)
    if (!piece) return
    await updatePiece(id, { altRefs: piece.altRefs.filter((a) => a !== ref) })
  }

  /**
   * Recherche comptoir : mots-clés (désignation, sous-catégorie, véhicule,
   * fournisseur, zone) et références (interne, OEM, fournisseur, EAN) avec
   * séparateurs ignorés. Tous les mots saisis doivent correspondre.
   */
  function matchesQuery(p: Piece, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const text = [p.ref, p.name, p.subcat, p.vehicle, p.oem, p.supplierRef, p.ean, ...p.altRefs, p.supplier, p.donor, p.zone, p.compat, p.notes]
      .filter(Boolean).join(' ').toLowerCase()
    const refs = [p.ref, p.oem, p.supplierRef, p.ean, ...p.altRefs].filter(Boolean).map((v) => normalizeRef(v))
    return q.split(/\s+/).every((word) => {
      if (text.includes(word)) return true
      const n = normalizeRef(word)
      return n.length >= 3 && refs.some((r) => r.includes(n))
    })
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return {
    pieces,
    loading,
    activePieces,
    archivedPieces,
    totalValue,
    totalQty,
    lowStockPieces,
    listen,
    fetchAll,
    addPiece,
    updatePiece,
    deletePiece,
    toggleArchive,
    findByRef,
    matchesQuery,
    addAltRef,
    removeAltRef,
    dispose,
  }
})
