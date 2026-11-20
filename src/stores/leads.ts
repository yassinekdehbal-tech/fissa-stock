import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { LeadRow } from '@/lib/supabase'
import type { Lead, LeadStatus } from '@/types'

function rowToLead(r: LeadRow): Lead {
  return {
    id: r.id,
    kind: r.kind as Lead['kind'],
    name: r.name,
    phone: r.phone ?? '',
    email: r.email ?? '',
    vehicle: r.vehicle ?? '',
    message: r.message ?? '',
    pieceId: r.piece_id,
    page: r.page ?? '',
    status: r.status as LeadStatus,
    createdAt: r.created_at,
  }
}

/**
 * Store des demandes entrantes (table `leads`) : formulaires du portail
 * public fissagroupe.fr (devis atelier, dépôt-vente, pièce, contact).
 * Le site insère via le rôle anon ; ici on lit, on change le statut et,
 * pour un administrateur, on supprime (RLS).
 */
export const useLeadsStore = defineStore('leads', () => {
  const leads = ref<Lead[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const newLeads = computed(() => leads.value.filter((l) => l.status === 'nouveau'))
  const newCount = computed(() => newLeads.value.length)

  async function fetchAll() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) leads.value = (data as LeadRow[]).map(rowToLead)
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        void fetchAll()
      })
      .subscribe()
  }

  async function setStatus(id: string, status: LeadStatus) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('leads').update({ status } as any).eq('id', id)
    if (error) throw error
    const l = leads.value.find((x) => x.id === id)
    if (l) l.status = status
    await fetchAll()
  }

  /** Suppression réservée aux administrateurs (politique `leads_org_delete`). */
  async function deleteLead(id: string) {
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) throw error
    leads.value = leads.value.filter((x) => x.id !== id)
    await fetchAll()
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return { leads, loading, newLeads, newCount, listen, fetchAll, setStatus, deleteLead, dispose }
})
