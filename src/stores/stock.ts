import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFirebase } from '@/composables/useFirebase'
import type { Piece } from '@/types'

export const useStockStore = defineStore('stock', () => {
  const pieces = ref<Piece[]>([])
  const loading = ref(true)
  let unsubscribe: (() => void) | null = null

  const activePieces = computed(() => pieces.value.filter(p => !p.archived))
  const archivedPieces = computed(() => pieces.value.filter(p => p.archived))
  const totalValue = computed(() => activePieces.value.reduce((acc, p) => acc + (p.price || 0) * (p.qty || 0), 0))
  const totalQty = computed(() => activePieces.value.reduce((acc, p) => acc + (p.qty || 0), 0))
  const lowStockPieces = computed(() => activePieces.value.filter(p => p.qty <= (p.threshold || 1)))

  function listen() {
    const { dbRef, onValue: fbOnValue } = useFirebase()
    unsubscribe?.()
    const stockRef = dbRef('stock')
    unsubscribe = fbOnValue(stockRef, (snap) => {
      const val = snap.val() || {}
      pieces.value = Object.entries(val).map(([id, v]) => ({ _id: id, ...(v as object) } as Piece))
      loading.value = false
    }) as unknown as () => void
  }

  async function addPiece(piece: Omit<Piece, '_id'>): Promise<string> {
    const { dbRef, push: fbPush, set: fbSet } = useFirebase()
    const r = fbPush(dbRef('stock'))
    await fbSet(r, piece)
    return r.key || ''
  }

  async function updatePiece(id: string, data: Partial<Piece>) {
    const { dbRef, update: fbUpdate } = useFirebase()
    await fbUpdate(dbRef('stock/' + id), data)
  }

  async function deletePiece(id: string) {
    const { dbRef, remove: fbRemove } = useFirebase()
    await fbRemove(dbRef('stock/' + id))
  }

  async function toggleArchive(id: string) {
    const piece = pieces.value.find(p => p._id === id)
    if (!piece) return
    const newState = !piece.archived
    await updatePiece(id, { archived: newState, qty: newState ? 0 : piece.qty })
  }

  function findByRef(refCode: string): Piece | undefined {
    return activePieces.value.find(p => p.ref === refCode)
  }

  function dispose() {
    unsubscribe?.()
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
    addPiece,
    updatePiece,
    deletePiece,
    toggleArchive,
    findByRef,
    dispose
  }
})
