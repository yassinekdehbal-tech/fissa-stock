<script setup lang="ts">
import { computed } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import StatCard from '@/components/ui/StatCard.vue'
import { formatPrice } from '@/utils/format'

const stock = useStockStore()
const history = useHistoryStore()

const stats = computed(() => {
  const now = Date.now()
  const today = new Date().toDateString()
  const week = now - 7 * 86400000
  const month = now - 30 * 86400000
  const prevMonth = now - 60 * 86400000
  const sales = history.sales

  const caToday = sales.filter(s => new Date(s.ts).toDateString() === today).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const caWeek = sales.filter(s => s.ts >= week).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const caMonth = sales.filter(s => s.ts >= month).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const caPrev = sales.filter(s => s.ts >= prevMonth && s.ts < month).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const trend = caPrev > 0 ? Math.round((caMonth - caPrev) / caPrev * 100) : null
  const salesToday = sales.filter(s => new Date(s.ts).toDateString() === today).length

  return { caToday, caWeek, caMonth, trend, salesToday }
})

const recentSales = computed(() => history.sales.slice(0, 8))

const chartDays = computed(() => {
  const now = Date.now()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000)
    const ca = history.sales
      .filter(s => new Date(s.ts).toDateString() === d.toDateString())
      .reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
    return { label: d.toLocaleDateString('fr-FR', { weekday: 'short' }), ca }
  })
})

const chartMax = computed(() => Math.max(...chartDays.value.map(d => d.ca), 1))
</script>

<template>
  <div>
    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-4">
      <StatCard :value="stock.activePieces.length" label="Références actives" color="text-[#e6a817]" />
      <StatCard :value="formatPrice(stats.caToday)" label="CA aujourd'hui" color="text-[#3fb950]" />
      <StatCard :value="formatPrice(stats.caWeek)" label="CA cette semaine" color="text-[#58a6ff]" />
      <StatCard :value="formatPrice(stats.caMonth)" label="CA ce mois" color="text-[#bc8cff]" />
      <StatCard :value="`${stock.totalValue.toFixed(0)} €`" label="Valeur stock" />
    </div>

    <div v-if="stock.lowStockPieces.length" class="grid grid-cols-1 gap-2.5 mb-4">
      <StatCard :value="stock.lowStockPieces.length" label="⚠ Alertes stock" color="text-red-400" />
    </div>

    <!-- Chart + Recent sales -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- CA 7 jours -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">
          CA 7 jours
          <span v-if="stats.trend !== null" :class="stats.trend >= 0 ? 'text-green-400' : 'text-red-400'" class="text-[11px] font-mono ml-2">
            {{ stats.trend >= 0 ? '▲' : '▼' }} {{ Math.abs(stats.trend) }}%
          </span>
        </div>
        <div class="flex items-end gap-1 h-16">
          <div v-for="day in chartDays" :key="day.label" class="flex-1 flex flex-col items-center gap-0.5">
            <span class="text-[8px] text-[#e6a817] font-mono">{{ day.ca > 0 ? day.ca.toFixed(0) + '€' : '' }}</span>
            <div
              class="w-full bg-[#e6a817] rounded-t min-h-[2px]"
              :style="{ height: Math.max((day.ca / chartMax) * 58, 2) + 'px' }"
            ></div>
            <span class="text-[9px] text-[#8b949e] font-mono">{{ day.label }}</span>
          </div>
        </div>
      </div>

      <!-- Dernières ventes -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">
          Dernières ventes
        </div>
        <div v-if="recentSales.length" class="flex flex-col gap-1">
          <div
            v-for="sale in recentSales"
            :key="sale._id"
            class="flex items-center gap-2 py-1.5 border-b border-[#30363d] text-[11px]"
          >
            <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded border border-[#e6a817]/30">{{ sale.ref }}</span>
            <span class="flex-1 truncate">{{ sale.name }}</span>
            <span class="text-[#3fb950] font-mono font-semibold">{{ ((sale.prixVente || 0) * (sale.qty || 0)).toFixed(2) }} €</span>
          </div>
        </div>
        <div v-else class="text-[#8b949e] text-xs text-center py-4">Aucune vente</div>
      </div>
    </div>

    <!-- Alertes stock -->
    <div v-if="stock.lowStockPieces.length" class="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mt-3.5">
      <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">
        ⚠ Alertes stock
      </div>
      <div v-for="p in stock.lowStockPieces" :key="p._id" class="flex items-center gap-2 py-1.5 border-b border-[#30363d] text-xs">
        <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded border border-[#e6a817]/30">{{ p.ref }}</span>
        <span class="flex-1">{{ p.name }}</span>
        <span v-if="p.zone" class="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded">{{ p.zone }}</span>
        <span class="text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-mono">Stock : {{ p.qty }}</span>
      </div>
    </div>
  </div>
</template>
