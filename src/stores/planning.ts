import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { InterventionRow, InterventionPartRow } from '@/lib/supabase'
import type { Intervention, InterventionPart, InterventionStatus } from '@/types'

function rowToPart(r: InterventionPartRow): InterventionPart {
  return {
    id: r.id,
    pieceId: r.piece_id ?? '',
    ref: r.ref ?? '',
    name: r.name ?? '',
    qty: r.qty,
    prixUnitaire: Number(r.prix_unitaire),
  }
}

function rowToInterv(r: InterventionRow, parts: InterventionPartRow[]): Intervention {
  return {
    _id: r.id,
    clientName: r.client_name ?? '',
    clientPhone: r.client_phone ?? '',
    clientEmail: r.client_email ?? '',
    vehicleMake: r.vehicle_make ?? '',
    vehicleModel: r.vehicle_model ?? '',
    vehiclePlate: r.vehicle_plate ?? '',
    description: r.description ?? '',
    notes: r.notes ?? '',
    status: r.status,
    parts: parts.map(rowToPart),
    estimatedTotal: Number(r.estimated_total),
    dateScheduled: r.date_scheduled ?? '',
    dateCreated: r.date_created,
    dateUpdated: r.updated_at,
    dateDone: r.date_done ?? undefined,
  }
}

function intervToRow(i: Partial<Intervention>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (i.clientName !== undefined) row.client_name = i.clientName
  if (i.clientPhone !== undefined) row.client_phone = i.clientPhone
  if (i.clientEmail !== undefined) row.client_email = i.clientEmail
  if (i.vehicleMake !== undefined) row.vehicle_make = i.vehicleMake
  if (i.vehicleModel !== undefined) row.vehicle_model = i.vehicleModel
  if (i.vehiclePlate !== undefined) row.vehicle_plate = i.vehiclePlate
  if (i.description !== undefined) row.description = i.description
  if (i.notes !== undefined) row.notes = i.notes
  if (i.status !== undefined) row.status = i.status
  if (i.estimatedTotal !== undefined) row.estimated_total = i.estimatedTotal
  if (i.dateScheduled !== undefined) row.date_scheduled = i.dateScheduled || null
  if (i.dateDone !== undefined) row.date_done = i.dateDone || null
  return row
}

/**
 * Store atelier / chantiers — Supabase.
 * Décision métier : ajouter une pièce décompte le stock immédiatement (RPC
 * `add_intervention_part`) ; un retrait (désistement) la retourne au stock
 * (RPC `remove_intervention_part`).
 */
export const usePlanningStore = defineStore('planning', () => {
  const interventions = ref<Intervention[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  function byScheduled(a: Intervention, b: Intervention) {
    return new Date(a.dateScheduled).getTime() - new Date(b.dateScheduled).getTime()
  }
  function byUpdated(a: Intervention, b: Intervention) {
    return new Date(a.dateUpdated).getTime() - new Date(b.dateUpdated).getTime()
  }
  function byDoneDesc(a: Intervention, b: Intervention) {
    return (
      new Date(b.dateDone || b.dateUpdated).getTime() - new Date(a.dateDone || a.dateUpdated).getTime()
    )
  }

  const todo = computed(() => interventions.value.filter((i) => i.status === 'todo').sort(byScheduled))
  const inProgress = computed(() =>
    interventions.value.filter((i) => i.status === 'in_progress').sort(byUpdated),
  )
  const done = computed(() => interventions.value.filter((i) => i.status === 'done').sort(byDoneDesc))

  async function fetchAll() {
    const [{ data: iv }, { data: pr }] = await Promise.all([
      supabase.from('interventions').select('*'),
      supabase.from('intervention_parts').select('*'),
    ])
    const partsByIv: Record<string, InterventionPartRow[]> = {}
    ;((pr as InterventionPartRow[]) ?? []).forEach((p) => {
      ;(partsByIv[p.intervention_id] ||= []).push(p)
    })
    interventions.value = ((iv as InterventionRow[]) ?? []).map((r) =>
      rowToInterv(r, partsByIv[r.id] ?? []),
    )
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('interventions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interventions' }, () => {
        void fetchAll()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intervention_parts' }, () => {
        void fetchAll()
      })
      .subscribe()
  }

  async function addIntervention(intervention: Omit<Intervention, '_id'>): Promise<string> {
    const { data, error } = await supabase
      .from('interventions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(intervToRow(intervention) as any)
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    for (const part of intervention.parts ?? []) {
      if (part.pieceId) await addPart(id, part)
    }
    await fetchAll()
    return id
  }

  async function updateIntervention(id: string, patch: Partial<Intervention>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('interventions').update(intervToRow(patch) as any).eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function moveStatus(id: string, status: InterventionStatus) {
    const patch: Partial<Intervention> = { status }
    if (status === 'done') patch.dateDone = new Date().toISOString()
    await updateIntervention(id, patch)
  }

  /** Ajoute une pièce au chantier ET décompte le stock (RPC atomique). */
  async function addPart(interventionId: string, part: InterventionPart) {
    const { error } = await supabase.rpc('add_intervention_part', {
      p_intervention: interventionId,
      p_piece: part.pieceId,
      p_qty: part.qty,
      p_prix: part.prixUnitaire,
    })
    if (error) throw error
    await fetchAll()
  }

  /** Désistement : retire la pièce (id de ligne) ET la retourne au stock. */
  async function removePart(partId: string) {
    const { error } = await supabase.rpc('remove_intervention_part', { p_part: partId })
    if (error) throw error
    await fetchAll()
  }

  async function deleteIntervention(id: string) {
    const { error } = await supabase.from('interventions').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  function getClientHistory(clientPhone: string): Intervention[] {
    return interventions.value
      .filter((i) => i.clientPhone === clientPhone && i.status === 'done')
      .sort(byDoneDesc)
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return {
    interventions,
    loading,
    todo,
    inProgress,
    done,
    listen,
    fetchAll,
    addIntervention,
    updateIntervention,
    moveStatus,
    addPart,
    removePart,
    deleteIntervention,
    getClientHistory,
    dispose,
  }
})
