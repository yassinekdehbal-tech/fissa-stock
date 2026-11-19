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
  datePublished: string | null
}

export type OrderPaymentStatus = 'pending' | 'paid' | 'refunded'
export type OrderShippingStatus = 'to_ship' | 'shipped' | 'delivered' | 'cancelled'

/** Commande en ligne (vente sur une marketplace) suivie depuis FISSA STOCK. */
export interface MarketplaceOrder {
  id: string
  pieceId: string | null
  channelId: string | null
  externalOrderId: string | null
  externalListingId: string | null
  ref: string
  name: string
  qty: number
  amount: number
  buyerName: string
  buyerAddress: string
  buyerContact: string
  paymentStatus: OrderPaymentStatus
  paidAt: string | null
  shippingStatus: OrderShippingStatus
  carrier: string
  trackingNumber: string
  shippedAt: string | null
  deliveredAt: string | null
  trackingSynced: boolean
  notes: string
  createdAt: string
}

export interface ManualSale {
  prix: number
  buyerName?: string
  buyerAddress?: string
  buyerContact?: string
  paid?: boolean
  externalOrderId?: string
  qty?: number
}

/**
 * Centre de contrôle multidiffusion + commandes en ligne.
 * - `channels` : les canaux de vente (LeBonCoin, eBay, OVOKO, Allegro, …).
 * - `publications` : l'état de chaque pièce sur chaque canal.
 * - `orders` : les ventes en ligne (acheteur, paiement, expédition).
 * La publication réelle passe par la fonction Edge `publish-listing` (connecteur
 * eBay ; dépôt manuel tracé pour les autres). L'anti-survente est gérée en base
 * (`record_marketplace_sale` → `mark_piece_sold`), déclenchée par le webhook, la
 * synchro eBay (`marketplace-orders`) ou une vente saisie à la main.
 */
export const usePublicationsStore = defineStore('publications', () => {
  const channels = ref<Channel[]>([])
  const publications = ref<Publication[]>([])
  const orders = ref<MarketplaceOrder[]>([])
  const loading = ref(true)
  let channel: ReturnType<typeof supabase.channel> | null = null

  const activeChannels = computed(() => channels.value.filter((c) => c.active))
  const ordersToShip = computed(() => orders.value.filter((o) => o.shippingStatus === 'to_ship'))

  function pubFor(pieceId: string, channelId: string): Publication | undefined {
    return publications.value.find((p) => p.pieceId === pieceId && p.channelId === channelId)
  }
  function channelById(id: string | null): Channel | undefined {
    return id ? channels.value.find((c) => c.id === id) : undefined
  }
  function ordersForPiece(pieceId: string): MarketplaceOrder[] {
    return orders.value.filter((o) => o.pieceId === pieceId)
  }
  /** Canaux sur lesquels la pièce est en ligne. */
  function liveChannels(pieceId: string): Channel[] {
    return publications.value
      .filter((p) => p.pieceId === pieceId && p.status === 'published')
      .map((p) => channelById(p.channelId))
      .filter((c): c is Channel => !!c)
  }

  function rowToOrder(o: Record<string, unknown>): MarketplaceOrder {
    return {
      id: o.id as string,
      pieceId: (o.piece_id as string) ?? null,
      channelId: (o.channel_id as string) ?? null,
      externalOrderId: (o.external_order_id as string) ?? null,
      externalListingId: (o.external_listing_id as string) ?? null,
      ref: (o.ref as string) ?? '',
      name: (o.name as string) ?? '',
      qty: Number(o.qty ?? 1),
      amount: Number(o.amount ?? 0),
      buyerName: (o.buyer_name as string) ?? '',
      buyerAddress: (o.buyer_address as string) ?? '',
      buyerContact: (o.buyer_contact as string) ?? '',
      paymentStatus: o.payment_status as OrderPaymentStatus,
      paidAt: (o.paid_at as string) ?? null,
      shippingStatus: o.shipping_status as OrderShippingStatus,
      carrier: (o.carrier as string) ?? '',
      trackingNumber: (o.tracking_number as string) ?? '',
      shippedAt: (o.shipped_at as string) ?? null,
      deliveredAt: (o.delivered_at as string) ?? null,
      trackingSynced: !!o.tracking_synced,
      notes: (o.notes as string) ?? '',
      createdAt: o.created_at as string,
    }
  }

  async function fetchAll() {
    const [{ data: ch }, { data: pub }, { data: ord }] = await Promise.all([
      supabase.from('sales_channels').select('*').order('label'),
      supabase.from('publications').select('*'),
      supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }),
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
      datePublished: (p.date_published as string) ?? null,
    }))
    orders.value = ((ord as Record<string, unknown>[]) ?? []).map(rowToOrder)
    loading.value = false
  }

  function listen() {
    void fetchAll()
    channel?.unsubscribe()
    channel = supabase
      .channel('multidiff-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'publications' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_channels' }, () => void fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_orders' }, () => void fetchAll())
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

  /**
   * Publie une pièce sur un canal (fonction Edge → API marketplace).
   * Pour un canal manuel / connecteur, `extra` porte l'URL ou l'identifiant de
   * l'annonce déposée à la main. Renvoie le message d'erreur éventuel.
   */
  async function publish(pieceId: string, channelId: string, extra: { url?: string; externalId?: string } = {}): Promise<{ ok: boolean; message?: string }> {
    const { data, error } = await supabase.functions.invoke('publish-listing', {
      body: { action: 'publish', pieceId, channelId, ...extra },
    })
    if (error) throw error
    await fetchAll()
    const r = (data ?? {}) as { ok?: boolean; message?: string; error?: string }
    return { ok: !!r.ok, message: r.message ?? r.error }
  }

  /** Retire une pièce d'un canal. */
  async function delist(pieceId: string, channelId: string) {
    const { data, error } = await supabase.functions.invoke('publish-listing', {
      body: { action: 'delist', pieceId, channelId },
    })
    if (error) throw error
    await fetchAll()
    const r = (data ?? {}) as { ok?: boolean; message?: string; error?: string }
    return { ok: !!r.ok, message: r.message ?? r.error }
  }

  /**
   * Vente saisie à la main (LeBonCoin, Facebook… ou webhook manqué) :
   * stock à 0, délistage des autres canaux, commande à expédier.
   */
  async function recordSale(pieceId: string, channelKey: string, sale: ManualSale): Promise<string> {
    const { data, error } = await supabase.rpc('record_marketplace_sale', {
      p_piece: pieceId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_channel: channelKey as any,
      p_prix: sale.prix,
      p_external_order_id: sale.externalOrderId || null,
      p_external_line_item_id: null,
      p_buyer_name: sale.buyerName ?? '',
      p_buyer_address: sale.buyerAddress ?? '',
      p_buyer_contact: sale.buyerContact ?? '',
      p_qty: sale.qty ?? 1,
      p_paid: !!sale.paid,
      p_notes: 'Vente saisie dans FISSA STOCK',
    })
    if (error) throw error
    await fetchAll()
    return data as string
  }

  /** Expédie une commande : statut + n° de suivi (transmis à eBay si possible). */
  async function ship(orderId: string, carrier: string, trackingNumber: string): Promise<{ synced: boolean; warning?: string }> {
    const { data, error } = await supabase.functions.invoke('marketplace-orders', {
      body: { action: 'ship', orderId, carrier, trackingNumber },
    })
    if (error) throw error
    const r = (data ?? {}) as { ok?: boolean; synced?: boolean; warning?: string; error?: string }
    if (!r.ok) throw new Error(r.error ?? 'expédition refusée')
    await fetchAll()
    return { synced: !!r.synced, warning: r.warning }
  }

  async function updateOrder(orderId: string, patch: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from('marketplace_orders').update(patch as any).eq('id', orderId)
    if (error) throw error
    await fetchAll()
  }
  const setDelivered = (id: string) => updateOrder(id, { shipping_status: 'delivered', delivered_at: new Date().toISOString() })
  const setPaid = (id: string) => updateOrder(id, { payment_status: 'paid', paid_at: new Date().toISOString() })
  const setRefunded = (id: string) => updateOrder(id, { payment_status: 'refunded' })
  const cancelOrder = (id: string) => updateOrder(id, { shipping_status: 'cancelled' })

  /** Importe les commandes eBay récentes (Fulfillment API). */
  async function syncOrders(): Promise<{ ok: boolean; imported: number; skipped: number; message?: string }> {
    const { data, error } = await supabase.functions.invoke('marketplace-orders', { body: { action: 'sync' } })
    if (error) throw error
    await fetchAll()
    const r = (data ?? {}) as { ok?: boolean; imported?: number; skipped?: number; message?: string; error?: string }
    return { ok: !!r.ok, imported: r.imported ?? 0, skipped: r.skipped ?? 0, message: r.message ?? r.error }
  }

  /** Configuration eBay en un clic (admin) : jeton, politiques, lieu d'expédition → config du canal. */
  async function setupEbay(): Promise<{ ok: boolean; step: string; message: string; notes: string[]; missing: string[] }> {
    const { data, error } = await supabase.functions.invoke('marketplace-orders', { body: { action: 'ebay_setup' } })
    if (error) throw error
    await fetchAll()
    const r = (data ?? {}) as { ok?: boolean; step?: string; message?: string; notes?: string[]; missing?: string[]; error?: string }
    return { ok: !!r.ok, step: r.step ?? 'error', message: r.message ?? r.error ?? '', notes: r.notes ?? [], missing: r.missing ?? [] }
  }

  function dispose() {
    channel?.unsubscribe()
    channel = null
  }

  return {
    channels,
    publications,
    orders,
    loading,
    activeChannels,
    ordersToShip,
    pubFor,
    channelById,
    ordersForPiece,
    liveChannels,
    fetchAll,
    listen,
    setChannelActive,
    setPublishable,
    publish,
    delist,
    recordSale,
    ship,
    setDelivered,
    setPaid,
    setRefunded,
    cancelOrder,
    syncOrders,
    setupEbay,
    dispose,
  }
})
