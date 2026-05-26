<script setup lang="ts">
import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useStockStore } from '@/stores/stock'
import StatCard from '@/components/ui/StatCard.vue'
import { formatPrice } from '@/utils/format'

const history = useHistoryStore()
const stock = useStockStore()

const stats = computed(() => {
  const now = Date.now()
  const month = now - 30 * 86400000
  const prevMonth = now - 60 * 86400000
  const sales = history.sales

  const caMonth = sales.filter(s => s.ts >= month).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const caPrev = sales.filter(s => s.ts >= prevMonth && s.ts < month).reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const trend = caPrev > 0 ? Math.round((caMonth - caPrev) / caPrev * 100) : null
  const qteMonth = sales.filter(s => s.ts >= month).reduce((a, s) => a + (s.qty || 0), 0)

  return { caMonth, caPrev, trend, qteMonth }
})

const topPieces = computed(() => {
  const map: Record<string, { ref: string; name: string; qty: number; ca: number }> = {}
  history.sales.forEach(v => {
    if (!map[v.ref]) map[v.ref] = { ref: v.ref, name: v.name, qty: 0, ca: 0 }
    map[v.ref].qty += v.qty || 0
    map[v.ref].ca += (v.prixVente || 0) * (v.qty || 0)
  })
  return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10)
})

const months = computed(() => {
  const sales = history.sales
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5 + i)
    const ca = sales.filter(x => {
      const xd = new Date(x.ts)
      return xd.getMonth() === d.getMonth() && xd.getFullYear() === d.getFullYear()
    }).reduce((a, x) => a + (x.prixVente || 0) * (x.qty || 0), 0)
    return { label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), ca }
  })
})

const chartMax = computed(() => Math.max(...months.value.map(m => m.ca), 1))
</script>

<template>
  <div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
      <StatCard :value="formatPrice(stats.caMonth)" label="CA ce mois" color="text-[#3fb950]" />
      <StatCard :value="stats.qteMonth" label="Pièces vendues (30j)" color="text-[#58a6ff]" />
      <StatCard :value="formatPrice(stats.caPrev)" label="CA mois précédent" color="text-[#f0883e]" />
      <StatCard v-if="stats.trend !== null" :value="`${stats.trend >= 0 ? '+' : ''}${stats.trend}%`" label="Tendance" :color="stats.trend >= 0 ? 'text-[#3fb950]' : 'text-red-400'" />
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- Top pièces -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">🏆 Top 10 pièces vendues</div>
        <div v-if="!topPieces.length" class="text-[#8b949e] text-xs py-3">Aucune vente</div>
        <div v-for="(p, i) in topPieces" :key="p.ref" class="flex items-center gap-2 py-1.5 border-b border-[#30363d] text-xs">
          <span class="font-mono font-bold text-sm text-[#e6a817] min-w-[22px]">#{{ i + 1 }}</span>
          <div class="flex-1">
            <div class="font-semibold">{{ p.name }}</div>
            <div class="font-mono text-[10px] text-[#e6a817]">{{ p.ref }}</div>
          </div>
          <span class="text-[#8b949e] text-[11px]">{{ p.qty }} vendu(s)</span>
          <span class="font-mono text-[#3fb950] font-semibold ml-2">{{ p.ca.toFixed(2) }} €</span>
        </div>
      </div>

      <!-- Graphique mois -->
      <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">📅 CA mois sur mois</div>
        <div class="flex items-end gap-1 h-20">
          <div v-for="(m, i) in months" :key="m.label" class="flex-1 flex flex-col items-center gap-0.5">
            <span class="text-[8px] text-[#e6a817] font-mono">{{ m.ca > 0 ? m.ca.toFixed(0) + '€' : '' }}</span>
            <div
              class="w-full rounded-t min-h-[2px]"
              :class="i === months.length - 1 ? 'bg-[#3fb950]' : 'bg-[#e6a817]'"
              :style="{ height: Math.max((m.ca / chartMax) * 65, 2) + 'px' }"
            ></div>
            <span class="text-[9px] text-[#8b949e] font-mono">{{ m.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
