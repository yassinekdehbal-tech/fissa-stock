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
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px]">
          🛒 Panier
        </div>
        <div class="text-[#8b949e] text-xs mt-1">{{ cart.count }} article(s)</div>
      </div>
      <button
        @click="$router.push('/scanner')"
        class="text-xs font-mono text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg border border-[#30363d] hover:border-[#484f58] transition-colors bg-transparent cursor-pointer"
      >
        + Scanner une pièce
      </button>
    </div>

    <!-- Empty -->
    <div
      v-if="!cart.items.length"
      class="bg-[#161b22] border border-[#30363d] rounded-xl p-10 text-center text-[#8b949e] text-sm"
    >
      Le panier est vide. Scannez ou ouvrez une pièce du stock pour l'ajouter.
    </div>

    <template v-else>
      <!-- Items -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-3 space-y-1.5">
        <div
          v-for="(item, idx) in cart.items"
          :key="item.piece._id"
          class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 flex items-center gap-2"
        >
          <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded shrink-0">
            {{ item.piece.ref }}
          </span>
          <span class="text-[#e6edf3] text-xs truncate flex-1">{{ item.piece.name }}</span>
          <!-- Qty -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              @click="setQty(idx, item.qty - 1)"
              class="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] rounded text-xs cursor-pointer border-none transition-colors"
            >-</button>
            <span class="font-mono text-xs text-[#e6edf3] w-6 text-center">{{ item.qty }}</span>
            <button
              @click="setQty(idx, item.qty + 1)"
              class="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] rounded text-xs cursor-pointer border-none transition-colors"
            >+</button>
          </div>
          <span class="font-mono text-[10px] text-[#8b949e] shrink-0">{{ formatPrice(item.prixUnitaire) }}/u</span>
          <span class="font-mono text-xs text-[#3fb950] font-semibold shrink-0 min-w-[65px] text-right">
            {{ formatPrice(item.qty * item.prixUnitaire) }}
          </span>
          <button
            @click="cart.remove(idx)"
            class="text-[#f85149] hover:text-[#ff6e67] text-sm cursor-pointer bg-transparent border-none transition-colors ml-1"
            title="Retirer"
          >✕</button>
        </div>
      </div>

      <!-- Payment + client + discount -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1 block">Mode de paiement</label>
            <select
              v-model="payment"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono focus:outline-none focus:border-[#e6a817] transition-colors"
            >
              <option v-for="opt in paymentOptions" :key="opt.v" :value="opt.v">{{ opt.l }}</option>
            </select>
          </div>
          <div>
            <label class="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1 block">Remise (%)</label>
            <input
              :value="cart.discount"
              @input="cart.setDiscount(Number(($event.target as HTMLInputElement).value))"
              type="number"
              min="0"
              max="100"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono focus:outline-none focus:border-[#e6a817] transition-colors"
            >
          </div>
        </div>
        <div>
          <label class="text-[10px] text-[#8b949e] uppercase tracking-wider mb-1 block">Client (optionnel)</label>
          <input
            v-model="client"
            type="text"
            placeholder="Nom du client"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors"
          >
        </div>
      </div>

      <!-- Totals -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
        <div class="flex items-center justify-between text-xs text-[#8b949e] mb-1">
          <span>Sous-total</span>
          <span class="font-mono">{{ formatPrice(cart.subtotal) }}</span>
        </div>
        <div v-if="cart.discount > 0" class="flex items-center justify-between text-xs text-[#8b949e] mb-1">
          <span>Remise ({{ cart.discount }}%)</span>
          <span class="font-mono">- {{ formatPrice(cart.subtotal - cart.total) }}</span>
        </div>
        <div class="flex items-center justify-between pt-2 mt-2 border-t border-[#30363d]">
          <span class="font-mono text-xs text-[#8b949e] uppercase tracking-wider">Total à payer</span>
          <span class="font-mono text-lg font-bold text-[#3fb950]">{{ formatPrice(cart.total) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-2">
        <button
          @click="cart.clear()"
          class="text-xs font-mono text-[#8b949e] hover:text-[#f85149] px-4 py-2.5 rounded-lg border border-[#30363d] hover:border-[#f85149]/40 transition-colors bg-transparent cursor-pointer"
        >
          Vider le panier
        </button>
        <button
          @click="validate"
          :disabled="processing"
          class="flex-1 sm:flex-none text-xs font-mono font-bold text-[#0d1117] bg-[#3fb950] hover:brightness-110 disabled:opacity-50 px-6 py-2.5 rounded-lg transition cursor-pointer uppercase tracking-wider"
        >
          {{ processing ? 'Validation...' : `Valider la vente — ${formatPrice(cart.total)}` }}
        </button>
      </div>
    </template>
  </div>
</template>
