import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFirebase } from '@/composables/useFirebase'
import type { HistoryEntry } from '@/types'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const loading = ref(true)
  let unsubscribe: (() => void) | null = null

  const sales = computed(() => entries.value.filter(e => e.type === 'vente'))

  function listen() {
    const { dbRef, onValue: fbOnValue } = useFirebase()
    unsubscribe?.()
    const histoRef = dbRef('historique')
    unsubscribe = fbOnValue(histoRef, (snap) => {
      const val = snap.val() || {}
      entries.value = Object.entries(val)
        .map(([id, v]) => ({ _id: id, ...(v as object) } as HistoryEntry))
        .sort((a, b) => b.ts - a.ts)
      loading.value = false
    }) as unknown as () => void
  }

  async function addEntry(entry: Omit<HistoryEntry, '_id'>) {
    const { dbRef, push: fbPush, set: fbSet } = useFirebase()
    const r = fbPush(dbRef('historique'))
    await fbSet(r, entry)
  }

  function getCAToday(): number {
    const today = new Date().toDateString()
    return sales.value
      .filter(s => new Date(s.ts).toDateString() === today)
      .reduce((acc, s) => acc + (s.prixVente || 0) * (s.qty || 0), 0)
  }

  function getCAWeek(): number {
    const week = Date.now() - 7 * 86400000
    return sales.value
      .filter(s => s.ts >= week)
      .reduce((acc, s) => acc + (s.prixVente || 0) * (s.qty || 0), 0)
  }

  function getCAMonth(): number {
    const month = Date.now() - 30 * 86400000
    return sales.value
      .filter(s => s.ts >= month)
      .reduce((acc, s) => acc + (s.prixVente || 0) * (s.qty || 0), 0)
  }

  function dispose() {
    unsubscribe?.()
  }

  return {
    entries,
    loading,
    sales,
    listen,
    addEntry,
    getCAToday,
    getCAWeek,
    getCAMonth,
    dispose
  }
})
