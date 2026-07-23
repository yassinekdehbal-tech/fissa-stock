import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { PieceRow } from '@/lib/supabase'
import type { Piece } from '@/types'

function rowToPiece(r: PieceRow): Piece {
  return {
    _id: r.id,
    ref: r.ref,
    name: r.name,
    cat: (r.cat ?? '') as Piece['cat'],
    vehicle: r.vehicle ?? '',
    oem: r.oem ?? '',
    supplier: r.supplier ?? '',
    donor: r.donor ?? '',
    qty: r.qty,
    price: Number(r.price),
    threshold: r.threshold ?? 1,
    zone: r.zone ?? '',
    etat: (r.etat ?? 'Bon état') as Piece['etat'],
    compat: r.compat ?? '',
    photo: r.photo ?? '',
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
  if (p.vehicle !== undefined) row.vehicle = p.vehicle
  if (p.oem !== undefined) row.oem = p.oem
  if (p.supplier !== undefined) row.supplier = p.supplier
  if (p.donor !== undefined) row.donor = p.donor
  if (p.qty !== undefined) row.qty = p.qty
  if (p.price !== undefined) row.price = p.price
  if (p.threshold !== undefined) row.threshold = p.threshold
  if (p.zone !== undefined) row.zone = p.zone
  if (p.etat !== undefined) row.etat = p.etat ? p.etat : null
  if (p.compat !== undefined) row.compat = p.compat
  if (p.photo !== undefined) row.photo = p.photo
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
    activePieces.value.filter((p) => p.qty <= (p.threshold || 1)),
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

  async function addPiece(piece: Omit<Piece, '_id'>): Promise<string> {
    const { data, error } = await supabase
      .from('pieces')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(pieceToRow(piece) as any)
      .select('id')
      .single()
    if (error) throw error
    await fetchAll()
    return (data as { id: string } | null)?.id ?? ''
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

  function findByRef(refCode: string): Piece | undefined {
    return activePieces.value.find((p) => p.ref === refCode)
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
    dispose,
  }
})
