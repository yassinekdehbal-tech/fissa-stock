import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFirebase } from '@/composables/useFirebase'
import type { Intervention, InterventionStatus } from '@/types'

export const usePlanningStore = defineStore('planning', () => {
  const interventions = ref<Intervention[]>([])
  const loading = ref(true)
  let unsubscribe: (() => void) | null = null

  const todo = computed(() => interventions.value.filter(i => i.status === 'todo').sort((a, b) => new Date(a.dateScheduled).getTime() - new Date(b.dateScheduled).getTime()))
  const inProgress = computed(() => interventions.value.filter(i => i.status === 'in_progress').sort((a, b) => new Date(a.dateUpdated).getTime() - new Date(b.dateUpdated).getTime()))
  const done = computed(() => interventions.value.filter(i => i.status === 'done').sort((a, b) => new Date(b.dateDone || b.dateUpdated).getTime() - new Date(a.dateDone || a.dateUpdated).getTime()))

  function listen() {
    const { dbRef, onValue: fbOnValue } = useFirebase()
    unsubscribe?.()
    const planRef = dbRef('interventions')
    unsubscribe = fbOnValue(planRef, (snap) => {
      const val = snap.val() || {}
      interventions.value = Object.entries(val).map(([id, v]) => ({ _id: id, ...(v as object) } as Intervention))
      loading.value = false
    }) as unknown as () => void
  }

  async function addIntervention(intervention: Omit<Intervention, '_id'>): Promise<string> {
    const { dbRef, push: fbPush, set: fbSet } = useFirebase()
    const r = fbPush(dbRef('interventions'))
    await fbSet(r, intervention)
    return r.key || ''
  }

  async function updateIntervention(id: string, data: Partial<Intervention>) {
    const { dbRef, update: fbUpdate } = useFirebase()
    await fbUpdate(dbRef('interventions/' + id), { ...data, dateUpdated: new Date().toISOString() })
  }

  async function moveStatus(id: string, newStatus: InterventionStatus) {
    const extra: Partial<Intervention> = { status: newStatus }
    if (newStatus === 'done') extra.dateDone = new Date().toISOString()
    await updateIntervention(id, extra)
  }

  async function deleteIntervention(id: string) {
    const { dbRef, remove: fbRemove } = useFirebase()
    await fbRemove(dbRef('interventions/' + id))
  }

  function getClientHistory(clientPhone: string): Intervention[] {
    return interventions.value
      .filter(i => i.clientPhone === clientPhone && i.status === 'done')
      .sort((a, b) => new Date(b.dateDone || b.dateUpdated).getTime() - new Date(a.dateDone || a.dateUpdated).getTime())
  }

  function dispose() {
    unsubscribe?.()
  }

  return {
    interventions,
    loading,
    todo,
    inProgress,
    done,
    listen,
    addIntervention,
    updateIntervention,
    moveStatus,
    deleteIntervention,
    getClientHistory,
    dispose
  }
})
