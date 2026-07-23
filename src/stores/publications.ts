import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface Channel {
  id: string
  key: string
  label: string
  integration: 'api' | 'connector' | 'manual'
  active: boolean
}

export type PublicationStatus = 'draft' | 'published' | 'sold' | 'error' | 'delisted'

export interface Publication {
  id: string
  pieceId: string
  channelId: string
  status: PublicationStatus
  externalId: string | null
  url: string | null
  errorMsg: string | null
}

/**
 * Centre de contrôle multidiffusion.
 * - `channels` : les canaux de vente (LeBonCoin, eBay, OVOKO, Allegro, …).
 * - `publications` : l'état de chaque pièce sur chaque canal.
 * La publication réelle passe par la fonction Edge `publish-listing` (connecteurs
 * eBay/OVOKO à activer avec les clés API). L'anti-survente est gérée en base
 * (`mark_piece_sold`, déclenchée par le webhook marketplace).
 */
export const usePublicationsStore = defineStore('publications', () => {
  const channels = ref<Channel[]>([])
  const publications = ref<Publication[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const activeChannels = computed(() => channels.value.filter((c) => c.active))

  function pubFor(pieceId: string, channelId: string): Publication | undefined {
    return publications.value.find((p) => p.pieceId === pieceId && p.channelId === channelId)
  }

  async function fetchAll() {
    const [{ data: ch }, { data: pub }] = await Promise.all([
      supabase.from('sales_channels').select('*').order('label'),
      supabase.from('publications').select('*'),
    ])
    channels.value = ((ch as Record<string, unknown>[]) ?? []).map((c) => ({
      id: c.id as string,
      key: c.key as string,
      label: c.label as string,
      integration: c.integration as Channel['integration'],
      active: c.active as boolean,
    }))
    publications.value = ((pub as Record<string, unknown>[]) ?? []).map((p) => ({
      id: p.id as string,
      pieceId: p.piece_id as string,
      channelId: p.channel_id as string,
      status: p.status as PublicationStatus,
      externalId: (p.external_id as string) ?? null,
      url: (p.url as string) ?? null,
      errorMsg: (p.error_msg as string) ?? null,
    }))
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('multidiff-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_channels' }, () => void fetchAll())
      .subscribe()
  }

  async function setChannelActive(channelId: string, active: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('sales_channels').update({ active } as any).eq('id', channelId)
    await fetchAll()
  }

  /** Rend une pièce diffusable (vitrine + catalogue public). */
  async function setPublishable(pieceId: string, value: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('pieces').update({ publishable: value } as any).eq('id', pieceId)
  }

  /** Publie une pièce sur un canal (via la fonction Edge → API marketplace). */
  async function publish(pieceId: string, channelId: string) {
    const { error } = await supabase.functions.invoke('publish-listing', {
      body: { action: 'publish', pieceId, channelId },
    })
    if (error) throw error
    await fetchAll()
  }

  /** Retire une pièce d'un canal. */
  async function delist(pieceId: string, channelId: string) {
    const { error } = await supabase.functions.invoke('publish-listing', {
      body: { action: 'delist', pieceId, channelId },
    })
    if (error) throw error
    await fetchAll()
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return {
    channels,
    publications,
    loading,
    activeChannels,
    pubFor,
    fetchAll,
    listen,
    setChannelActive,
    setPublishable,
    publish,
    delist,
    dispose,
  }
})
