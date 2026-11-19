<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePublicationsStore } from '@/stores/publications'
import type { Channel } from '@/stores/publications'
import { useAuthStore } from '@/stores/auth'
import { useStockStore } from '@/stores/stock'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import { sanitize } from '@/utils/security'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Piece } from '@/types'

/**
 * Mise en ligne d'une pièce, canal par canal : publier / retirer, suivi du
 * dépôt manuel (LeBonCoin, Facebook…), vente constatée sur un canal.
 * Utilisé en fin de référencement, sur la fiche pièce et dans l'écran
 * Multidiffusion (`compact`).
 */
const props = defineProps<{ piece: Piece; compact?: boolean }>()

const pub = usePublicationsStore()
const auth = useAuthStore()
const stock = useStockStore()
const { toast } = useToast()

const canPublish = computed(() => auth.isAdmin || auth.hasPerm('vendeur'))
const pieceId = computed(() => props.piece._id ?? '')
const sellable = computed(() => !props.piece.archived && props.piece.qty > 0)
const busy = ref<string | null>(null)

const integrationBadge: Record<string, { label: string; cls: string }> = {
  api: { label: 'API', cls: 'badge-green' },
  connector: { label: 'Dépôt manuel', cls: 'badge-blue' },
  manual: { label: 'Dépôt manuel', cls: 'badge-gray' },
}
const statusStyle: Record<string, { label: string; cls: string }> = {
  published: { label: 'En ligne', cls: 'badge-green' },
  draft: { label: 'En file', cls: 'badge-amber' },
  sold: { label: 'Vendu', cls: 'badge-violet' },
  error: { label: 'Erreur', cls: 'badge-red' },
  delisted: { label: 'Retiré', cls: 'badge-gray' },
}

function status(c: Channel) {
  return pub.pubFor(pieceId.value, c.id)
}
function isManual(c: Channel) {
  return c.integration !== 'api'
}

// --- Publier -----------------------------------------------------------
const depositOpen = ref(false)
const depositChannel = ref<Channel | null>(null)
const depositUrl = ref('')
const depositId = ref('')

function startPublish(c: Channel) {
  if (isManual(c)) {
    depositChannel.value = c
    depositUrl.value = status(c)?.url ?? ''
    depositId.value = status(c)?.externalId ?? ''
    depositOpen.value = true
    return
  }
  void doPublish(c)
}

async function doPublish(c: Channel, extra: { url?: string; externalId?: string } = {}) {
  busy.value = c.id
  try {
    const r = await pub.publish(pieceId.value, c.id, extra)
    if (r.ok) toast(isManual(c) ? `Dépôt sur ${c.label} enregistré` : `✓ Publié sur ${c.label}`)
    else toast(r.message || `${c.label} non configuré`, true)
  } catch (e) {
    toast('Erreur de publication : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    busy.value = null
  }
}
async function confirmDeposit() {
  if (!depositChannel.value) return
  const c = depositChannel.value
  depositOpen.value = false
  await doPublish(c, { url: sanitize(depositUrl.value.trim()), externalId: sanitize(depositId.value.trim()) })
}

async function doDelist(c: Channel) {
  busy.value = c.id
  try {
    const r = await pub.delist(pieceId.value, c.id)
    if (r.ok) toast(`Retiré de ${c.label}`)
    else toast(r.message || 'Retrait impossible', true)
  } catch (e) {
    toast('Erreur de retrait : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    busy.value = null
  }
}

// --- Vendu sur un canal ---------------------------------------------------
const soldOpen = ref(false)
const soldChannel = ref<Channel | null>(null)
const sale = ref({ prix: 0, buyerName: '', buyerAddress: '', buyerContact: '', paid: true, externalOrderId: '' })
const selling = ref(false)

function startSold(c: Channel) {
  soldChannel.value = c
  sale.value = { prix: props.piece.price || 0, buyerName: '', buyerAddress: '', buyerContact: '', paid: true, externalOrderId: '' }
  soldOpen.value = true
}
async function confirmSold() {
  if (!soldChannel.value) return
  if (!(sale.value.prix > 0)) { toast('Prix de vente requis', true); return }
  selling.value = true
  try {
    await pub.recordSale(pieceId.value, soldChannel.value.key, {
      prix: sale.value.prix,
      buyerName: sanitize(sale.value.buyerName.trim()),
      buyerAddress: sanitize(sale.value.buyerAddress.trim()),
      buyerContact: sanitize(sale.value.buyerContact.trim()),
      paid: sale.value.paid,
      externalOrderId: sanitize(sale.value.externalOrderId.trim()) || undefined,
    })
    await stock.fetchAll()
    soldOpen.value = false
    toast(`✓ Vente ${soldChannel.value.label} enregistrée : stock à 0, autres canaux retirés`)
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    selling.value = false
  }
}

// --- Boutique en ligne (catalogue public) ---------------------------------
const togglingShop = ref(false)
async function toggleShop() {
  togglingShop.value = true
  try {
    await pub.setPublishable(pieceId.value, !props.piece.publishable)
    await stock.fetchAll()
  } finally {
    togglingShop.value = false
  }
}

const pieceOrders = computed(() => pub.ordersForPiece(pieceId.value))
const shippingLabel: Record<string, string> = { to_ship: 'À expédier', shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée' }
const paymentLabel: Record<string, string> = { pending: 'Paiement en attente', paid: 'Payée', refunded: 'Remboursée' }
</script>

<template>
  <div :class="compact ? 'space-y-1.5' : 'space-y-3'">
    <!-- Boutique directe (sans commission) -->
    <label v-if="!compact && canPublish" class="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" class="toggle" :data-on="!!piece.publishable" :disabled="togglingShop" @click="toggleShop" aria-label="Visible sur la boutique en ligne"><span></span></button>
      <span class="text-[13px] text-gray-700 leading-snug">Boutique en ligne FISSA <span class="text-gray-400">(catalogue public, sans commission)</span></span>
    </label>

    <div v-if="!pub.activeChannels.length" class="text-[12px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
      Aucun canal de vente actif.
      <router-link v-if="auth.isAdmin" to="/multidiffusion" class="text-blue-600 font-medium hover:underline">Activer des canaux</router-link>
      <span v-else>Demandez à un administrateur d'activer un canal (Multidiffusion).</span>
    </div>

    <div v-else :class="compact ? 'flex flex-wrap gap-1.5' : 'divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden'">
      <div
        v-for="c in pub.activeChannels"
        :key="c.id"
        class="flex items-center gap-2 flex-wrap"
        :class="compact ? 'bg-white border border-gray-200 rounded-lg px-2 py-1' : 'px-3 py-2.5 bg-white'"
      >
        <div class="flex items-center gap-1.5 min-w-0" :class="compact ? '' : 'flex-1'">
          <span class="font-semibold text-gray-900 truncate" :class="compact ? 'text-[11px]' : 'text-[13px]'">{{ c.label }}</span>
          <span v-if="!compact" class="badge" :class="integrationBadge[c.integration]?.cls">{{ integrationBadge[c.integration]?.label }}</span>
          <span v-if="status(c)" class="badge" :class="statusStyle[status(c)!.status]?.cls" :title="status(c)!.errorMsg || ''">{{ statusStyle[status(c)!.status]?.label }}</span>
          <a v-if="status(c)?.url" :href="status(c)!.url!" target="_blank" rel="noopener" class="icon-btn" title="Voir l'annonce"><AppIcon name="arrow-up-right" class="w-3.5 h-3.5" /></a>
        </div>
        <div v-if="canPublish" class="flex items-center gap-1 shrink-0">
          <template v-if="status(c)?.status === 'published'">
            <button class="btn btn-secondary btn-sm" :disabled="busy === c.id || !sellable" @click="startSold(c)" title="La pièce a été vendue sur ce canal">Vendue ici</button>
            <button class="btn btn-ghost btn-sm text-red-600" :disabled="busy === c.id" @click="doDelist(c)">{{ busy === c.id ? '…' : 'Retirer' }}</button>
          </template>
          <template v-else-if="status(c)?.status === 'sold'">
            <span class="text-[11px] text-gray-500">Vendue sur ce canal</span>
          </template>
          <template v-else>
            <button class="btn btn-sm" :class="status(c)?.status === 'error' ? 'btn-secondary text-amber-700' : 'btn-primary'" :disabled="busy === c.id || !sellable" @click="startPublish(c)">
              {{ busy === c.id ? '…' : status(c)?.status === 'error' ? 'Réessayer' : isManual(c) ? 'Marquer déposée' : 'Publier' }}
            </button>
          </template>
        </div>
        <div v-if="!compact && status(c)?.status === 'error' && status(c)?.errorMsg" class="basis-full text-[11px] text-red-600 leading-snug">{{ status(c)!.errorMsg }}</div>
      </div>
    </div>
    <p v-if="!compact && !sellable && pub.activeChannels.length" class="text-[11px] text-gray-500">Pièce archivée ou sans stock : publication impossible.</p>

    <!-- Commandes liées à la pièce -->
    <div v-if="!compact && pieceOrders.length" class="space-y-1.5">
      <div class="text-[12px] font-semibold text-gray-700">Commandes en ligne</div>
      <router-link v-for="o in pieceOrders" :key="o.id" to="/commandes" class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] hover:bg-gray-100">
        <span class="font-semibold text-gray-900">{{ pub.channelById(o.channelId)?.label || 'Canal ?' }}</span>
        <span class="text-gray-500 truncate flex-1">{{ o.buyerName || 'Acheteur inconnu' }} · {{ new Date(o.createdAt).toLocaleDateString('fr-FR') }}</span>
        <span class="badge" :class="o.paymentStatus === 'paid' ? 'badge-green' : o.paymentStatus === 'refunded' ? 'badge-red' : 'badge-amber'">{{ paymentLabel[o.paymentStatus] }}</span>
        <span class="badge" :class="o.shippingStatus === 'to_ship' ? 'badge-orange' : o.shippingStatus === 'cancelled' ? 'badge-gray' : 'badge-blue'">{{ shippingLabel[o.shippingStatus] }}</span>
        <span class="font-semibold text-gray-900">{{ formatPrice(o.amount) }}</span>
      </router-link>
    </div>

    <!-- Dépôt manuel : URL / identifiant de l'annonce -->
    <BaseModal :title="depositChannel ? 'Annonce déposée sur ' + depositChannel.label : 'Annonce déposée'" :open="depositOpen" @close="depositOpen = false" max-width="440px">
      <p class="text-[12px] text-gray-500 mb-3 leading-snug">
        {{ depositChannel?.label }} n'a pas d'API de dépôt : publiez l'annonce sur la plateforme, puis collez ici son lien
        pour la suivre depuis FISSA STOCK (retrait automatique dès que la pièce est vendue ailleurs).
      </p>
      <div class="space-y-2">
        <div class="flex flex-col gap-1"><label class="label">Lien de l'annonce</label><input v-model="depositUrl" type="url" placeholder="https://www.leboncoin.fr/…" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">N° d'annonce (facultatif)</label><input v-model="depositId" class="input font-mono"></div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-secondary" @click="depositOpen = false">Annuler</button>
        <button class="btn btn-primary" @click="confirmDeposit"><AppIcon name="check" class="w-4 h-4" /> Marquer déposée</button>
      </div>
    </BaseModal>

    <!-- Vente constatée sur un canal -->
    <BaseModal :title="soldChannel ? 'Vendue sur ' + soldChannel.label : 'Vendue'" :open="soldOpen" @close="soldOpen = false" max-width="460px">
      <p class="text-[12px] text-gray-500 mb-3 leading-snug">
        Le stock de <span class="font-mono font-semibold text-gray-800">{{ piece.ref }}</span> passe à 0, l'annonce est retirée des autres canaux
        et une commande à expédier est créée.
      </p>
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1"><label class="label">Prix de vente (€)</label><input v-model.number="sale.prix" type="number" step="0.01" min="0" inputmode="decimal" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">N° de commande (facultatif)</label><input v-model="sale.externalOrderId" class="input font-mono"></div>
        <div class="flex flex-col gap-1 col-span-2"><label class="label">Acheteur</label><input v-model="sale.buyerName" class="input" placeholder="Nom / pseudo"></div>
        <div class="flex flex-col gap-1 col-span-2"><label class="label">Adresse de livraison</label><textarea v-model="sale.buyerAddress" rows="2" class="input" placeholder="Vide si remise en main propre"></textarea></div>
        <div class="flex flex-col gap-1 col-span-2"><label class="label">Contact (téléphone, e-mail)</label><input v-model="sale.buyerContact" class="input"></div>
        <label class="col-span-2 flex items-center gap-3 cursor-pointer select-none">
          <button type="button" class="toggle" :data-on="sale.paid" @click="sale.paid = !sale.paid" aria-label="Paiement reçu"><span></span></button>
          <span class="text-[13px] text-gray-700">Paiement déjà encaissé</span>
        </label>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-secondary" @click="soldOpen = false">Annuler</button>
        <button class="btn btn-primary" :disabled="selling" @click="confirmSold"><AppIcon name="check" class="w-4 h-4" /> {{ selling ? 'Enregistrement…' : 'Enregistrer la vente' }}</button>
      </div>
    </BaseModal>
  </div>
</template>
