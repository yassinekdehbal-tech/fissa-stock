<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePublicationsStore } from '@/stores/publications'
import type { MarketplaceOrder } from '@/stores/publications'
import { useAuthStore } from '@/stores/auth'
import { useStockStore } from '@/stores/stock'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import { sanitize } from '@/utils/security'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Commandes en ligne : chaque vente marketplace devient une commande à
 * expédier, avec le suivi du paiement (encaissé par la plateforme) et de
 * l'envoi (transporteur, n° de suivi, transmis à eBay quand c'est possible).
 */
const pub = usePublicationsStore()
const auth = useAuthStore()
const stock = useStockStore()
const { toast } = useToast()

onMounted(() => { if (pub.loading) pub.listen() })

const canAct = computed(() => auth.isAdmin || auth.hasPerm('vendeur'))

type Tab = 'to_ship' | 'shipped' | 'delivered' | 'all'
const tab = ref<Tab>('to_ship')
const search = ref('')
const TABS: { key: Tab; label: string }[] = [
  { key: 'to_ship', label: 'À expédier' },
  { key: 'shipped', label: 'Expédiées' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'all', label: 'Toutes' },
]
function countFor(t: Tab) {
  return t === 'all' ? pub.orders.length : pub.orders.filter((o) => o.shippingStatus === t).length
}

const list = computed(() => {
  const q = search.value.toLowerCase().trim()
  return pub.orders
    .filter((o) => (tab.value === 'all' ? true : o.shippingStatus === tab.value))
    .filter((o) => !q || [o.ref, o.name, o.buyerName, o.externalOrderId, o.trackingNumber].some((v) => (v || '').toLowerCase().includes(q)))
})

const monthStats = computed(() => {
  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
  const month = pub.orders.filter((o) => new Date(o.createdAt) >= start && o.shippingStatus !== 'cancelled')
  const paid = month.filter((o) => o.paymentStatus === 'paid').reduce((a, o) => a + o.amount, 0)
  const pending = month.filter((o) => o.paymentStatus === 'pending').reduce((a, o) => a + o.amount, 0)
  return { count: month.length, paid, pending }
})

const shippingStyle: Record<string, { label: string; cls: string }> = {
  to_ship: { label: 'À expédier', cls: 'badge-orange' },
  shipped: { label: 'Expédiée', cls: 'badge-blue' },
  delivered: { label: 'Livrée', cls: 'badge-green' },
  cancelled: { label: 'Annulée', cls: 'badge-gray' },
}
const paymentStyle: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Paiement en attente', cls: 'badge-amber' },
  paid: { label: 'Payée', cls: 'badge-green' },
  refunded: { label: 'Remboursée', cls: 'badge-red' },
}
const CARRIERS = ['Colissimo', 'Chronopost', 'Mondial Relay', 'Relais Colis', 'UPS', 'DPD', 'GLS', 'DHL', 'Remise en main propre', 'Autre']

function channelLabel(o: MarketplaceOrder) {
  return pub.channelById(o.channelId)?.label || 'Canal inconnu'
}
function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
}
function photoFor(o: MarketplaceOrder) {
  return (o.pieceId ? stock.pieces.find((p) => p._id === o.pieceId)?.photo : '') || ''
}

// --- Expédier ---------------------------------------------------------------
const shipOpen = ref(false)
const shipOrder = ref<MarketplaceOrder | null>(null)
const carrier = ref('Colissimo')
const tracking = ref('')
const shipping = ref(false)
function openShip(o: MarketplaceOrder) {
  shipOrder.value = o
  carrier.value = o.carrier || 'Colissimo'
  tracking.value = o.trackingNumber || ''
  shipOpen.value = true
}
async function confirmShip() {
  if (!shipOrder.value) return
  const handDelivery = carrier.value === 'Remise en main propre'
  if (!handDelivery && !tracking.value.trim()) { toast('Numéro de suivi requis', true); return }
  shipping.value = true
  try {
    const r = await pub.ship(shipOrder.value.id, carrier.value, sanitize(tracking.value.trim()))
    shipOpen.value = false
    if (r.warning) toast('Expédiée, mais suivi non transmis à la marketplace : ' + r.warning, true)
    else toast(r.synced ? '✓ Expédiée, n° de suivi transmis à eBay' : '✓ Commande expédiée')
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    shipping.value = false
  }
}

const busy = ref<string | null>(null)
async function act(o: MarketplaceOrder, fn: () => Promise<unknown>, msg: string) {
  busy.value = o.id
  try { await fn(); toast(msg) } catch (e) { toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true) } finally { busy.value = null }
}
function cancel(o: MarketplaceOrder) {
  if (!confirm(`Annuler la commande ${o.ref} ? Le stock n'est pas remis automatiquement : corrigez la quantité sur la fiche pièce si elle revient en rayon.`)) return
  void act(o, () => pub.cancelOrder(o.id), 'Commande annulée')
}

// --- Synchro eBay -----------------------------------------------------------
const syncing = ref(false)
const hasEbay = computed(() => pub.activeChannels.some((c) => c.key === 'ebay'))
async function sync() {
  syncing.value = true
  try {
    const r = await pub.syncOrders()
    if (!r.ok) toast(r.message || 'Synchronisation impossible', true)
    else toast(`eBay : ${r.imported} commande(s) importée(s)` + (r.skipped ? `, ${r.skipped} ignorée(s)` : '') + (r.message ? ' — ' + r.message : ''))
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="max-w-[960px] mx-auto space-y-4">
    <div class="hidden lg:flex items-center gap-3">
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Commandes en ligne</h1>
        <p class="page-subtitle">Ventes sur les marketplaces : expéditions et encaissements</p>
      </div>
      <button v-if="hasEbay && canAct" class="btn btn-secondary" :disabled="syncing" @click="sync"><AppIcon name="refresh" class="w-4 h-4" /> {{ syncing ? 'Synchronisation…' : 'Synchroniser eBay' }}</button>
    </div>

    <!-- Indicateurs du mois -->
    <div class="grid grid-cols-3 gap-2">
      <div class="card p-3"><div class="text-[11px] text-gray-500">À expédier</div><div class="text-xl font-bold" :class="pub.ordersToShip.length ? 'text-orange-600' : 'text-gray-900'">{{ pub.ordersToShip.length }}</div></div>
      <div class="card p-3"><div class="text-[11px] text-gray-500">Encaissé ce mois</div><div class="text-xl font-bold text-green-600">{{ formatPrice(monthStats.paid) }}</div></div>
      <div class="card p-3"><div class="text-[11px] text-gray-500">En attente de paiement</div><div class="text-xl font-bold text-amber-600">{{ formatPrice(monthStats.pending) }}</div></div>
    </div>

    <div class="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[12px] text-gray-700 leading-relaxed">
      L'encaissement est réalisé par la marketplace (eBay, OVOKO…) qui reverse ensuite le montant : FISSA STOCK suit l'état
      du paiement et de l'envoi. Pour eBay, le n° de suivi saisi ici est transmis automatiquement à l'acheteur.
    </div>

    <!-- Onglets + recherche -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
      <div class="flex gap-1 overflow-x-auto">
        <button v-for="t in TABS" :key="t.key" class="btn btn-sm whitespace-nowrap" :class="tab === t.key ? 'btn-primary' : 'btn-secondary'" @click="tab = t.key">
          {{ t.label }} <span class="opacity-70">({{ countFor(t.key) }})</span>
        </button>
      </div>
      <div class="flex gap-2">
        <input v-model="search" type="search" placeholder="Réf., acheteur, n° commande…" class="input sm:w-64">
        <button v-if="hasEbay && canAct" class="btn btn-secondary lg:hidden" :disabled="syncing" @click="sync" aria-label="Synchroniser eBay"><AppIcon name="refresh" class="w-4 h-4" /></button>
      </div>
    </div>

    <div v-if="pub.loading" class="text-center py-12 text-gray-500 text-sm">Chargement…</div>
    <div v-else-if="!list.length" class="card text-center py-12 text-gray-500 text-sm">
      <AppIcon name="truck" class="w-8 h-8 mx-auto text-gray-300 mb-2" />
      Aucune commande {{ tab === 'to_ship' ? 'à expédier' : '' }}.
      <div class="text-[12px] text-gray-400 mt-1">Les ventes eBay arrivent par synchronisation ; les ventes LeBonCoin / Facebook se saisissent depuis la fiche pièce (« Vendue ici »).</div>
    </div>

    <div v-else class="space-y-2">
      <div v-for="o in list" :key="o.id" class="card p-3 lg:p-4">
        <div class="flex items-start gap-3">
          <span class="w-14 h-14 thumb"><img v-if="photoFor(o)" :src="photoFor(o)" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-5 h-5" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="badge-ref">{{ o.ref }}</span>
              <span class="badge badge-violet">{{ channelLabel(o) }}</span>
              <span class="badge" :class="shippingStyle[o.shippingStatus]?.cls">{{ shippingStyle[o.shippingStatus]?.label }}</span>
              <span class="badge" :class="paymentStyle[o.paymentStatus]?.cls">{{ paymentStyle[o.paymentStatus]?.label }}</span>
            </div>
            <router-link v-if="o.pieceId" :to="`/piece/${o.pieceId}`" class="block text-[14px] font-semibold text-gray-900 truncate mt-1 hover:underline">{{ o.name }}</router-link>
            <div v-else class="text-[14px] font-semibold text-gray-900 truncate mt-1">{{ o.name }}</div>
            <div class="text-[12px] text-gray-500 mt-0.5">
              {{ fmt(o.createdAt) }}<template v-if="o.externalOrderId"> · Cde {{ o.externalOrderId }}</template><template v-if="o.qty > 1"> · {{ o.qty }} pcs</template>
            </div>
            <div class="mt-2 text-[12px] text-gray-700 space-y-0.5">
              <div><span class="text-gray-500">Acheteur :</span> {{ o.buyerName || '—' }}<template v-if="o.buyerContact"> · {{ o.buyerContact }}</template></div>
              <div v-if="o.buyerAddress"><span class="text-gray-500">Livraison :</span> {{ o.buyerAddress }}</div>
              <div v-if="o.trackingNumber || o.carrier"><span class="text-gray-500">Envoi :</span> {{ o.carrier }} <span class="font-mono">{{ o.trackingNumber }}</span>
                <span v-if="o.shippedAt" class="text-gray-400"> · {{ fmt(o.shippedAt) }}</span>
                <span v-if="o.trackingSynced" class="badge badge-green ml-1">Suivi transmis</span>
              </div>
              <div v-if="o.notes" class="text-gray-500 whitespace-pre-line">{{ o.notes }}</div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[16px] font-bold text-gray-900">{{ formatPrice(o.amount) }}</div>
            <div v-if="o.paidAt" class="text-[11px] text-gray-400">payée {{ fmt(o.paidAt) }}</div>
          </div>
        </div>
        <div v-if="canAct && o.shippingStatus !== 'cancelled'" class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          <button v-if="o.shippingStatus === 'to_ship'" class="btn btn-primary btn-sm" @click="openShip(o)"><AppIcon name="truck" class="w-4 h-4" /> Expédier</button>
          <button v-else-if="o.shippingStatus === 'shipped'" class="btn btn-secondary btn-sm" :disabled="busy === o.id" @click="act(o, () => pub.setDelivered(o.id), 'Commande livrée')"><AppIcon name="check" class="w-4 h-4" /> Marquer livrée</button>
          <button v-if="o.shippingStatus === 'shipped'" class="btn btn-ghost btn-sm" @click="openShip(o)">Modifier le suivi</button>
          <button v-if="o.paymentStatus === 'pending'" class="btn btn-secondary btn-sm" :disabled="busy === o.id" @click="act(o, () => pub.setPaid(o.id), 'Paiement encaissé')"><AppIcon name="euro" class="w-4 h-4" /> Paiement reçu</button>
          <button v-else-if="o.paymentStatus === 'paid' && auth.isAdmin" class="btn btn-ghost btn-sm text-gray-500" :disabled="busy === o.id" @click="act(o, () => pub.setRefunded(o.id), 'Commande remboursée')">Rembourser</button>
          <span class="flex-1"></span>
          <button v-if="o.shippingStatus === 'to_ship'" class="btn btn-ghost btn-sm text-red-600" :disabled="busy === o.id" @click="cancel(o)">Annuler</button>
        </div>
      </div>
    </div>

    <BaseModal :title="shipOrder ? 'Expédier ' + shipOrder.ref : 'Expédier'" :open="shipOpen" @close="shipOpen = false" max-width="420px">
      <div v-if="shipOrder" class="text-[12px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
        <div class="font-semibold text-gray-900">{{ shipOrder.buyerName || 'Acheteur' }}</div>
        <div v-if="shipOrder.buyerAddress">{{ shipOrder.buyerAddress }}</div>
        <div v-else class="text-gray-400">Adresse non renseignée</div>
      </div>
      <div class="space-y-2">
        <div class="flex flex-col gap-1"><label class="label">Transporteur</label><select v-model="carrier" class="input"><option v-for="c in CARRIERS" :key="c">{{ c }}</option></select></div>
        <div v-if="carrier !== 'Remise en main propre'" class="flex flex-col gap-1"><label class="label">N° de suivi</label><input v-model="tracking" class="input font-mono" placeholder="6A12345678901" autocapitalize="characters"></div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-secondary" @click="shipOpen = false">Annuler</button>
        <button class="btn btn-primary" :disabled="shipping" @click="confirmShip"><AppIcon name="truck" class="w-4 h-4" /> {{ shipping ? 'Envoi…' : 'Confirmer l\'expédition' }}</button>
      </div>
    </BaseModal>
  </div>
</template>
