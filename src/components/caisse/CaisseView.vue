<script setup lang="ts">
import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { formatPrice } from '@/utils/format'

const history = useHistoryStore()
const auth = useAuthStore()

const todaySales = computed(() => {
  const today = new Date().toDateString()
  return history.sales.filter(s => new Date(s.ts).toDateString() === today)
})

const total = computed(() => todaySales.value.reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0))

const byPayment = computed(() => {
  const map: Record<string, number> = {}
  todaySales.value.forEach(v => {
    const p = v.payment || 'N/A'
    map[p] = (map[p] || 0) + (v.prixVente || 0) * (v.qty || 0)
  })
  return Object.entries(map)
})

const todayFormatted = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <div class="card p-5">
    <div class="card-title">
      Clôture de caisse — {{ todayFormatted }}
    </div>

    <!-- Total -->
    <div class="text-center py-4">
      <div class="text-3xl font-bold text-green-600">{{ formatPrice(total) }}</div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- Par paiement -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
        <div class="card-title mb-2">Par mode de paiement</div>
        <div v-if="!byPayment.length" class="text-gray-500 text-xs">Aucune vente</div>
        <div v-for="[method, amount] in byPayment" :key="method" class="flex items-center gap-2 py-1.5 text-xs">
          <span class="text-[10px] text-gray-500 min-w-[90px]">{{ method }}</span>
          <span class="text-sm text-amber-600 ml-auto">{{ formatPrice(amount) }}</span>
        </div>
      </div>

      <!-- Ventes du jour -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
        <div class="card-title mb-2">Ventes du jour</div>
        <div v-if="!todaySales.length" class="text-gray-500 text-xs py-2">Aucune vente aujourd'hui</div>
        <div v-for="v in todaySales.slice(0, 20)" :key="v._id" class="flex items-center gap-1.5 py-1 border-b border-gray-200 text-[11px]">
          <span class="badge-ref">{{ v.ref }}</span>
          <span class="flex-1 truncate">{{ v.name }}{{ v.client ? ' · ' + v.client : '' }}</span>
          <span class="text-gray-500">{{ v.user }}</span>
          <span class="text-green-600 font-semibold">{{ ((v.prixVente || 0) * (v.qty || 0)).toFixed(2) }} €</span>
        </div>
      </div>
    </div>
  </div>
</template>
