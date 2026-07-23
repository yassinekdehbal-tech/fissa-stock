import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { HistoryEntry } from '@/types'

/**
 * Historique / mouvements — Supabase.
 * Reconstruit `entries` (API inchangée) à partir de deux sources :
 *  - `stock_movements` (ajout, sortie/retour chantier, vente marketplace, ajustements)
 *  - `sale_items` (+ `sales`) pour les ventes au comptoir (avec mode de paiement)
 * Les mouvements `vente-comptoir` sont ignorés côté lecture pour éviter le double
 * comptage avec les `sale_items`.
 */
export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const sales = computed(() => entries.value.filter((e) => e.type === 'vente'))

  function mvType(t: string): HistoryEntry['type'] {
    if (t === 'ajout') return 'ajout'
    if (t === 'sortie-chantier' || t === 'vente-marketplace') return 'vente'
    return 'modif'
  }

  async function fetchAll() {
    const [{ data: moves }, { data: items }, { data: profs }] = await Promise.all([
      supabase.from('stock_movements').select('*'),
      supabase.from('sale_items').select('*, sales(created_at, payment, client, user_id)'),
      supabase.from('profiles').select('id, name'),
    ])
    const nameById: Record<string, string> = {}
    ;((profs as { id: string; name: string | null }[]) ?? []).forEach((p) => {
      nameById[p.id] = p.name ?? ''
    })

    const out: HistoryEntry[] = []

    // Mouvements de stock (hors ventes comptoir, gérées via sale_items)
    for (const m of (moves as Record<string, unknown>[]) ?? []) {
      if (m.type === 'vente-comptoir') continue
      const ts = new Date(m.created_at as string).getTime()
      out.push({
        _id: m.id as string,
        type: mvType(m.type as string),
        ref: (m.ref as string) ?? '',
        name: (m.name as string) ?? '',
        qty: Math.abs((m.qty_delta as number) ?? 0),
        prixVente: (m.prix as number) ?? undefined,
        user: nameById[m.user_id as string] ?? '',
        ts,
        date: new Date(ts).toLocaleString('fr-FR'),
      })
    }

    // Ventes au comptoir (une entrée par ligne de vente)
    for (const it of (items as Record<string, unknown>[]) ?? []) {
      const s = (it.sales as Record<string, unknown>) ?? {}
      const ts = s.created_at ? new Date(s.created_at as string).getTime() : 0
      out.push({
        _id: it.id as string,
        type: 'vente',
        ref: (it.ref as string) ?? '',
        name: (it.name as string) ?? '',
        qty: (it.qty as number) ?? 0,
        prixVente: (it.prix_unitaire as number) ?? 0,
        payment: (s.payment as string) ?? undefined,
        client: (s.client as string) ?? undefined,
        user: nameById[s.user_id as string] ?? '',
        ts,
        date: new Date(ts).toLocaleString('fr-FR'),
      })
    }

    entries.value = out.sort((a, b) => b.ts - a.ts)
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_movements' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_items' }, () => void fetchAll())
      .subscribe()
  }

  /** Journalise un mouvement (ex. ajout de pièce). Écrit dans `stock_movements`. */
  async function addEntry(entry: Omit<HistoryEntry, '_id'>) {
    const { data: u } = await supabase.auth.getUser()
    const type =
      entry.type === 'ajout' ? 'ajout' : entry.type === 'vente' ? 'vente-comptoir' : 'ajustement'
    const qtyDelta = entry.type === 'ajout' ? entry.qty ?? 0 : -(entry.qty ?? 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('stock_movements').insert({
      type,
      ref: entry.ref,
      name: entry.name,
      qty_delta: qtyDelta,
      prix: entry.prixVente ?? entry.prixCatalogue ?? null,
      user_id: u.user?.id ?? null,
    } as any)
  }

  function caSince(sinceTs: number): number {
    return sales.value.filter((s) => s.ts >= sinceTs).reduce((acc, s) => acc + (s.prixVente || 0) * (s.qty || 0), 0)
  }
  function getCAToday(): number {
    const today = new Date().toDateString()
    return sales.value
      .filter((s) => new Date(s.ts).toDateString() === today)
      .reduce((acc, s) => acc + (s.prixVente || 0) * (s.qty || 0), 0)
  }
  function getCAWeek(): number {
    return caSince(Date.now() - 7 * 86400000)
  }
  function getCAMonth(): number {
    return caSince(Date.now() - 30 * 86400000)
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return {
    entries,
    loading,
    sales,
    listen,
    fetchAll,
    addEntry,
    getCAToday,
    getCAWeek,
    getCAMonth,
    dispose,
  }
})
