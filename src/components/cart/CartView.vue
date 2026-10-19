<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import AppIcon from '@/components/ui/AppIcon.vue'

const cart = useCartStore()
const auth = useAuthStore()
const { toast } = useToast()

const payment = ref<string>('especes')
const client = ref('')
const processing = ref(false)
const showDetails = ref(false)

const paymentOptions = [
  { v: 'especes', l: 'Espèces' },
  { v: 'carte', l: 'Carte' },
  { v: 'virement', l: 'Virement' },
  { v: 'cheque', l: 'Chèque' },
]

const totalQty = computed(() => cart.items.reduce((a, i) => a + i.qty, 0))

function setQty(index: number, qty: number) {
  const item = cart.items[index]
  if (!item) return
  if (qty < 1) { cart.remove(index); return }
  if (qty > item.piece.qty) { toast(`Stock insuffisant (max ${item.piece.qty})`, true); return }
  cart.updateQty(index, qty)
}

// Confirmation de sortie
interface Done { date: string; qty: number; lines: { ref: string; name: string; qty: number }[]; user: string; client: string; total: number }
const done = ref<Done | null>(null)

async function validate() {
  if (!cart.items.length) return
  processing.value = true
  const snapshot: Done = {
    date: new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    qty: totalQty.value,
    lines: cart.items.map(i => ({ ref: i.piece.ref, name: i.piece.name, qty: i.qty })),
    user: auth.currentUser?.name || '',
    client: client.value.trim(),
    total: cart.total,
  }
  try {
    await cart.checkout(payment.value, client.value.trim())
    done.value = snapshot
    client.value = ''
    toast('Sortie enregistrée — stock mis à jour')
  } catch (e) {
    const m = (e as { message?: string })?.message || ''
    toast(/stock insuffisant/i.test(m) ? m : 'Erreur lors de la validation', true)
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="max-w-[720px] mx-auto space-y-3">
    <!-- Confirmation -->
    <template v-if="done">
      <div class="card p-6 text-center">
        <span class="mx-auto w-20 h-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><AppIcon name="check" class="w-10 h-10" :stroke-width="3" /></span>
        <h2 class="text-xl font-bold text-gray-900 mt-4">Sortie validée !</h2>
        <p class="text-[13px] text-gray-500 mt-1">{{ done.qty > 1 ? `${done.qty} pièces ont été sorties du stock.` : '1 pièce a été sortie du stock.' }}</p>
      </div>
      <div class="card p-4">
        <div class="card-title mb-2">Détail de la sortie</div>
        <dl class="grid grid-cols-[120px_1fr] gap-y-1.5 text-[13px]">
          <dt class="text-gray-500">Date</dt><dd class="text-gray-900">{{ done.date }}</dd>
          <dt class="text-gray-500">Pièces</dt><dd class="text-gray-900">{{ done.qty }}</dd>
          <dt class="text-gray-500">Montant</dt><dd class="text-gray-900 font-semibold">{{ formatPrice(done.total) }}</dd>
          <dt class="text-gray-500">Utilisateur</dt><dd class="text-gray-900">{{ done.user || '—' }}</dd>
          <dt class="text-gray-500">Réf. commande</dt><dd class="text-gray-900">{{ done.client || '—' }}</dd>
        </dl>
        <div class="divide-y divide-gray-100 mt-3 border-t border-gray-100">
          <div v-for="l in done.lines" :key="l.ref" class="flex items-center gap-2 py-2 text-[13px]"><span class="badge-ref">{{ l.ref }}</span><span class="flex-1 truncate text-gray-800">{{ l.name }}</span><span class="font-semibold text-gray-900">× {{ l.qty }}</span></div>
        </div>
      </div>
      <router-link to="/scanner" class="btn btn-primary w-full py-3" @click="done = null"><AppIcon name="scan" class="w-4 h-4" /> Scanner une autre commande</router-link>
      <router-link to="/history" class="btn btn-secondary w-full py-3">Voir l'historique</router-link>
    </template>

    <template v-else>
      <!-- En-tête (desktop) -->
      <div class="hidden lg:flex items-center justify-between gap-3">
        <div>
          <h1 class="page-title">Panier de sortie</h1>
          <p class="page-subtitle">{{ totalQty }} pièce{{ totalQty > 1 ? 's' : '' }} à sortir du stock</p>
        </div>
        <router-link to="/scanner" class="btn btn-secondary"><AppIcon name="scan" class="w-4 h-4" /> Scanner une pièce</router-link>
      </div>

      <div v-if="!cart.items.length" class="card p-10 text-center text-gray-500 text-sm">
        <AppIcon name="cart" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
        Le panier est vide. Scannez ou ouvrez une pièce du stock pour l'ajouter.
        <div class="mt-4"><router-link to="/scanner" class="btn btn-primary"><AppIcon name="scan" class="w-4 h-4" /> Scanner une pièce</router-link></div>
      </div>

      <template v-else>
        <!-- Lignes -->
        <div class="card divide-y divide-gray-100">
          <div v-for="(item, idx) in cart.items" :key="item.piece._id" class="flex items-center gap-3 p-3">
            <span class="w-12 h-12 thumb"><img v-if="item.piece.photo" :src="item.piece.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
            <div class="min-w-0 flex-1">
              <span class="badge-ref">{{ item.piece.ref }}</span>
              <div class="text-[13px] text-gray-800 truncate mt-0.5">{{ item.piece.name }}</div>
              <div class="text-[11px] text-gray-500">{{ formatPrice(item.prixUnitaire) }} / u · <span class="text-gray-900 font-semibold">{{ formatPrice(item.qty * item.prixUnitaire) }}</span></div>
            </div>
            <div class="qty-stepper">
              <button @click="setQty(idx, item.qty - 1)" aria-label="Moins"><AppIcon name="minus" class="w-4 h-4" /></button>
              <span>{{ item.qty }}</span>
              <button @click="setQty(idx, item.qty + 1)" aria-label="Plus"><AppIcon name="plus" class="w-4 h-4" /></button>
            </div>
            <button @click="cart.remove(idx)" class="icon-btn icon-btn-danger" title="Retirer"><AppIcon name="trash" class="w-4 h-4" /></button>
          </div>
        </div>

        <!-- Client / commande + paiement -->
        <div class="card p-4 space-y-3">
          <div>
            <label class="label">Client / Commande (optionnel)</label>
            <input v-model="client" type="text" placeholder="Nom ou n° de commande…" class="input mt-1">
          </div>
          <div>
            <label class="label">Mode de paiement</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <button v-for="opt in paymentOptions" :key="opt.v" type="button" class="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors" :class="payment === opt.v ? 'bg-brand border-brand text-gray-900' : 'bg-white border-gray-200 text-gray-600'" @click="payment = opt.v">{{ opt.l }}</button>
            </div>
          </div>
          <button type="button" class="text-[12px] text-gray-500 hover:text-gray-900" @click="showDetails = !showDetails">{{ showDetails ? 'Masquer la remise' : 'Appliquer une remise' }}</button>
          <div v-if="showDetails" class="flex items-center gap-3">
            <label class="label">Remise (%)</label>
            <input :value="cart.discount" @input="cart.setDiscount(Number(($event.target as HTMLInputElement).value))" type="number" min="0" max="100" class="input w-24">
          </div>
        </div>

        <!-- Total -->
        <div class="card p-4">
          <div class="flex items-center justify-between text-[13px] text-gray-500"><span>Sous-total</span><span>{{ formatPrice(cart.subtotal) }}</span></div>
          <div v-if="cart.discount > 0" class="flex items-center justify-between text-[13px] text-gray-500 mt-1"><span>Remise ({{ cart.discount }}%)</span><span>- {{ formatPrice(cart.subtotal - cart.total) }}</span></div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
            <span class="text-[15px] font-semibold text-gray-900">Total :</span>
            <span class="text-right"><span class="text-lg font-bold text-gray-900">{{ totalQty }} pièce{{ totalQty > 1 ? 's' : '' }}</span><span class="block text-[12px] text-gray-500">{{ formatPrice(cart.total) }}</span></span>
          </div>
        </div>

        <button @click="validate" :disabled="processing" class="btn btn-success w-full py-3 text-[15px]">
          {{ processing ? 'Validation…' : 'Valider la sortie du stock' }} <AppIcon name="arrow-right" class="w-4 h-4" />
        </button>
        <button @click="cart.clear()" class="btn btn-ghost w-full text-red-600 hover:bg-red-50">Vider le panier</button>
      </template>
    </template>
  </div>
</template>
