<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'

const router = useRouter()
const cart = useCartStore()
const { toast } = useToast()

const payment = ref<string>('especes')
const client = ref('')
const processing = ref(false)

const paymentOptions = [
  { v: 'especes', l: 'Espèces' },
  { v: 'carte', l: 'Carte' },
  { v: 'virement', l: 'Virement' },
  { v: 'cheque', l: 'Chèque' },
]

function setQty(index: number, qty: number) {
  const item = cart.items[index]
  if (!item) return
  if (qty < 1) {
    cart.remove(index)
    return
  }
  if (qty > item.piece.qty) {
    toast(`Stock insuffisant (max ${item.piece.qty})`, true)
    return
  }
  cart.updateQty(index, qty)
}

async function validate() {
  if (!cart.items.length) return
  processing.value = true
  try {
    await cart.checkout(payment.value, client.value.trim())
    toast('Vente enregistrée — stock mis à jour')
    client.value = ''
    router.push('/scanner')
  } catch (e) {
    const m = (e as { message?: string })?.message || ''
    toast(/stock insuffisant/i.test(m) ? m : 'Erreur lors de la validation', true)
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="max-w-[720px] mx-auto space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="page-title text-xl">
          Panier
        </div>
        <div class="text-gray-500 text-xs mt-1">{{ cart.count }} article(s)</div>
      </div>
      <button
        @click="$router.push('/scanner')"
        class="btn btn-secondary btn-sm"
      >
        + Scanner une pièce
      </button>
    </div>

    <!-- Empty -->
    <div
      v-if="!cart.items.length"
      class="card p-10 text-center text-gray-500 text-sm"
    >
      Le panier est vide. Scannez ou ouvrez une pièce du stock pour l'ajouter.
    </div>

    <template v-else>
      <!-- Items -->
      <div class="card p-3 space-y-1.5">
        <div
          v-for="(item, idx) in cart.items"
          :key="item.piece._id"
          class="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2"
        >
          <span class="badge-ref shrink-0">
            {{ item.piece.ref }}
          </span>
          <span class="text-gray-900 text-xs truncate flex-1">{{ item.piece.name }}</span>
          <!-- Qty -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="setQty(idx, item.qty - 1)"
              class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded text-xs cursor-pointer border-none transition-colors"
            >-</button>
            <span class="text-xs text-gray-900 w-6 text-center">{{ item.qty }}</span>
            <button
              @click="setQty(idx, item.qty + 1)"
              class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded text-xs cursor-pointer border-none transition-colors"
            >+</button>
          </div>
          <span class="text-[10px] text-gray-500 shrink-0">{{ formatPrice(item.prixUnitaire) }}/u</span>
          <span class="text-xs text-green-600 font-semibold shrink-0 min-w-[65px] text-right">
            {{ formatPrice(item.qty * item.prixUnitaire) }}
          </span>
          <button
            @click="cart.remove(idx)"
            class="text-red-600 hover:text-red-700 text-sm cursor-pointer bg-transparent border-none transition-colors ml-1"
            title="Retirer"
          >✕</button>
        </div>
      </div>

      <!-- Payment + client + discount -->
      <div class="card p-4 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="label mb-1 block">Mode de paiement</label>
            <select
              v-model="payment"
              class="input focus:outline-none focus:border-brand transition-colors"
            >
              <option v-for="opt in paymentOptions" :key="opt.v" :value="opt.v">{{ opt.l }}</option>
            </select>
          </div>
          <div>
            <label class="label mb-1 block">Remise (%)</label>
            <input
              :value="cart.discount"
              @input="cart.setDiscount(Number(($event.target as HTMLInputElement).value))"
              type="number"
              min="0"
              max="100"
              class="input focus:outline-none focus:border-brand transition-colors"
            >
          </div>
        </div>
        <div>
          <label class="label mb-1 block">Client (optionnel)</label>
          <input
            v-model="client"
            type="text"
            placeholder="Nom du client"
            class="input"
          >
        </div>
      </div>

      <!-- Totals -->
      <div class="card p-4">
        <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Sous-total</span>
          <span class="">{{ formatPrice(cart.subtotal) }}</span>
        </div>
        <div v-if="cart.discount > 0" class="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Remise ({{ cart.discount }}%)</span>
          <span class="">- {{ formatPrice(cart.subtotal - cart.total) }}</span>
        </div>
        <div class="flex items-center justify-between pt-2 mt-2 border-t border-gray-200">
          <span class="text-xs text-gray-500 uppercase tracking-wider">Total à payer</span>
          <span class="text-lg font-bold text-green-600">{{ formatPrice(cart.total) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-2">
        <button
          @click="cart.clear()"
          class="btn btn-secondary"
        >
          Vider le panier
        </button>
        <button
          @click="validate"
          :disabled="processing"
          class="btn btn-success flex-1 sm:flex-none"
        >
          {{ processing ? 'Validation...' : `Valider la vente — ${formatPrice(cart.total)}` }}
        </button>
      </div>
    </template>
  </div>
</template>
