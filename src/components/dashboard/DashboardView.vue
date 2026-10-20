<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import StatCard from '@/components/ui/StatCard.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { formatPrice } from '@/utils/format'
import { useCategoriesStore } from '@/stores/categories'

const router = useRouter()
const stock = useStockStore()
const cats = useCategoriesStore()
const history = useHistoryStore()
const auth = useAuthStore()
const cart = useCartStore()

const firstName = computed(() => (auth.currentUser?.name || '').split(' ')[0] || '')
const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// Recherche (mobile : la barre du haut desktop n'est pas affichée)
const query = ref('')
function submitSearch() {
  const q = query.value.trim()
  void router.push({ path: '/stock', query: q ? { q } : {} })
}

const stats = computed(() => {
  const now = Date.now()
  const todayStr = new Date().toDateString()
  const week = now - 7 * 86400000
  const month = now - 30 * 86400000
  const prevMonth = now - 60 * 86400000
  const sales = history.sales
  const sum = (list: typeof sales) => list.reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
  const caToday = sum(sales.filter(s => new Date(s.ts).toDateString() === todayStr))
  const caWeek = sum(sales.filter(s => s.ts >= week))
  const caMonth = sum(sales.filter(s => s.ts >= month))
  const caPrev = sum(sales.filter(s => s.ts >= prevMonth && s.ts < month))
  const trend = caPrev > 0 ? Math.round((caMonth - caPrev) / caPrev * 100) : null
  return { caToday, caWeek, caMonth, trend }
})

const recentSales = computed(() => history.sales.slice(0, 6))
const recentPieces = computed(() => [...stock.activePieces].sort((a, b) => (b.added || '').localeCompare(a.added || '')).slice(0, 6))

function photoFor(ref: string) {
  return stock.findByRef(ref)?.photo || ''
}

const chartDays = computed(() => {
  const now = Date.now()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86400000)
    const ca = history.sales
      .filter(s => new Date(s.ts).toDateString() === d.toDateString())
      .reduce((a, s) => a + (s.prixVente || 0) * (s.qty || 0), 0)
    return { label: d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), ca }
  })
})
const chartMax = computed(() => {
  const max = Math.max(...chartDays.value.map(d => d.ca), 0)
  if (max <= 0) return 1500
  const step = Math.pow(10, Math.floor(Math.log10(max)))
  return Math.ceil(max / step) * step
})
const yTicks = computed(() => [chartMax.value, chartMax.value * 2 / 3, chartMax.value / 3, 0])

function fmtShort(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtDay(iso: string) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : ''
}

const canAdd = computed(() => auth.isAdmin || auth.hasPerm('magasinier'))
const canSell = computed(() => auth.isAdmin || auth.hasPerm('vendeur'))
</script>

<template>
  <div class="space-y-4 lg:space-y-5">
    <!-- Recherche (mobile) -->
    <form class="lg:hidden flex gap-2" @submit.prevent="submitSearch">
      <div class="relative flex-1">
        <AppIcon name="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input v-model="query" type="search" placeholder="Rechercher une référence, un véhicule…" class="input pl-9 h-11 bg-white">
      </div>
      <router-link v-if="canSell" to="/scanner" class="w-11 h-11 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-50" aria-label="Scanner">
        <AppIcon name="scan" class="w-5 h-5" />
      </router-link>
    </form>

    <!-- En-tête (desktop) -->
    <div class="hidden lg:flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">Bonjour{{ firstName ? ', ' + firstName : '' }}</h1>
        <p class="page-subtitle">Voici un aperçu de votre stock aujourd'hui.</p>
      </div>
      <div class="card px-3 py-2 text-[13px] text-gray-700 flex items-center gap-2 capitalize">
        <AppIcon name="calendar" class="w-4 h-4 text-gray-400" />
        {{ today }}
      </div>
    </div>

    <!-- Indicateurs (desktop) -->
    <div class="hidden lg:grid grid-cols-5 gap-3">
      <StatCard :value="stock.activePieces.length" label="Références actives" icon="package" tone="red" />
      <StatCard :value="formatPrice(stats.caToday)" label="CA aujourd'hui" icon="trending-up" tone="green" />
      <StatCard :value="formatPrice(stats.caWeek)" label="CA cette semaine" icon="euro" tone="blue" />
      <StatCard :value="formatPrice(stats.caMonth)" label="CA ce mois" icon="chart" tone="violet" />
      <StatCard :value="`${stock.totalValue.toFixed(0)} €`" label="Valeur stock" icon="layers" tone="amber" />
    </div>

    <!-- Actions rapides -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <router-link v-if="canAdd" to="/add" class="tile bg-brand border-brand hover:bg-brand-dark">
        <span class="w-10 h-10 rounded-lg bg-gray-900 text-brand flex items-center justify-center"><AppIcon name="plus" class="w-5 h-5" :stroke-width="2.5" /></span>
        <span><span class="block text-[14px] font-bold text-gray-900 leading-snug">Ajouter une pièce</span><span class="block text-[11px] text-gray-800">Référencer un nouvel article</span></span>
      </router-link>
      <router-link v-if="canSell" to="/scanner" class="tile bg-sidebar border-sidebar text-white hover:bg-sidebar-2">
        <span class="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center"><AppIcon name="scan" class="w-5 h-5" /></span>
        <span><span class="block text-[14px] font-bold leading-snug">Scanner une commande</span><span class="block text-[11px] text-gray-300">Sortir une pièce du stock</span></span>
      </router-link>
      <router-link to="/stock" class="tile card hover:border-gray-300">
        <span class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><AppIcon name="box" class="w-5 h-5" /></span>
        <span><span class="block text-[14px] font-bold text-gray-900 leading-snug">Voir le stock</span><span class="block text-[11px] text-gray-500">Rechercher une pièce</span></span>
      </router-link>
      <router-link v-if="canSell" to="/panier" class="tile card hover:border-gray-300 relative">
        <span v-if="cart.count" class="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full bg-brand text-gray-900 text-[12px] font-bold flex items-center justify-center">{{ cart.count }}</span>
        <span class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><AppIcon name="cart" class="w-5 h-5" /></span>
        <span><span class="block text-[14px] font-bold text-gray-900 leading-snug">Panier de sortie</span><span class="block text-[11px] text-gray-500">Voir les pièces scannées</span></span>
      </router-link>
    </div>

    <!-- Alertes stock -->
    <div class="card p-4">
      <div class="card-title justify-between mb-3">
        <span class="inline-flex items-center gap-2" :class="stock.lowStockPieces.length ? 'text-red-600' : ''">
          <AppIcon name="alert" class="w-4 h-4" /> Alertes stock ({{ stock.lowStockPieces.length }})
        </span>
        <router-link :to="{ path: '/stock', query: { stock: 'alerte' } }" class="text-[12px] font-medium text-blue-600 hover:underline">Voir tout</router-link>
      </div>
      <div v-if="!stock.lowStockPieces.length" class="text-[13px] text-gray-500 py-2">Aucune référence sous son seuil d'alerte.</div>
      <div v-else class="divide-y divide-gray-100">
        <router-link v-for="p in stock.lowStockPieces.slice(0, 5)" :key="p._id" :to="`/piece/${p._id}`" class="flex items-center gap-3 py-2.5">
          <span class="w-11 h-11 thumb"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
          <div class="min-w-0 flex-1">
            <span class="badge-ref">{{ p.ref }}</span>
            <div class="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{{ p.name }}</div>
            <div class="text-[11px] text-gray-500 truncate">{{ p.vehicle || p.compat || '—' }}</div>
          </div>
          <span class="badge badge-red">Stock : {{ p.qty }}</span>
        </router-link>
      </div>
    </div>

    <!-- Dernières pièces ajoutées -->
    <div class="card p-4">
      <div class="card-title justify-between mb-3">
        <span>Dernières pièces ajoutées</span>
        <router-link to="/stock" class="text-[12px] font-medium text-blue-600 hover:underline">Voir le stock</router-link>
      </div>
      <div v-if="!recentPieces.length" class="text-[13px] text-gray-500 py-2">Aucune pièce référencée pour le moment.</div>
      <div v-else class="divide-y divide-gray-100">
        <router-link v-for="p in recentPieces" :key="p._id" :to="`/piece/${p._id}`" class="flex items-center gap-3 py-2.5">
          <span class="w-11 h-11 thumb"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2"><span class="badge-ref">{{ p.ref }}</span><span v-if="p.cat" class="badge hidden sm:inline-flex" :class="[cats.info(p.cat).bgClass, cats.info(p.cat).textClass]">{{ cats.info(p.cat).label }}</span></div>
            <div class="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{{ p.name }}</div>
            <div class="text-[11px] text-gray-500">{{ p.qty }} en stock · {{ fmtDay(p.added) }}</div>
          </div>
          <span class="text-[13px] font-semibold text-gray-900 whitespace-nowrap">{{ formatPrice(p.price || 0) }}</span>
          <AppIcon name="chevron-right" class="w-4 h-4 text-gray-400" />
        </router-link>
      </div>
    </div>

    <!-- Graphique + dernières ventes (desktop) -->
    <div class="hidden lg:grid grid-cols-2 gap-4">
      <div class="card p-5">
        <div class="card-title justify-between">
          <span>Évolution du CA (7 derniers jours)</span>
          <span v-if="stats.trend !== null" class="badge" :class="stats.trend >= 0 ? 'badge-green' : 'badge-red'">{{ stats.trend >= 0 ? '▲' : '▼' }} {{ Math.abs(stats.trend) }}% vs mois préc.</span>
        </div>
        <div class="flex gap-2">
          <div class="flex flex-col justify-between text-[10px] text-gray-400 h-40 py-0.5 text-right shrink-0 w-12">
            <span v-for="t in yTicks" :key="t">{{ t.toFixed(0) }} €</span>
          </div>
          <div class="flex-1 relative h-40">
            <div class="absolute inset-0 flex flex-col justify-between"><div v-for="t in yTicks" :key="t" class="border-t border-dashed border-gray-200"></div></div>
            <div class="absolute inset-0 flex items-end gap-2 px-1">
              <div v-for="day in chartDays" :key="day.label" class="flex-1 flex flex-col items-center justify-end h-full group">
                <span class="text-[10px] text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{{ day.ca > 0 ? day.ca.toFixed(0) + ' €' : '' }}</span>
                <div class="w-full max-w-[34px] rounded-t-md bg-brand" :class="{ 'bg-gray-200': day.ca === 0 }" :style="{ height: Math.max((day.ca / chartMax) * 100, 2) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-1.5 pl-14"><span v-for="day in chartDays" :key="day.label" class="flex-1 text-center text-[11px] text-gray-500 capitalize">{{ day.label }}</span></div>
      </div>
      <div class="card p-5">
        <div class="card-title justify-between">
          <span>Dernières ventes</span>
          <router-link to="/history" class="text-[12px] font-medium text-blue-600 hover:underline inline-flex items-center gap-1">Voir tout <AppIcon name="arrow-right" class="w-3.5 h-3.5" /></router-link>
        </div>
        <div v-if="recentSales.length" class="divide-y divide-gray-100">
          <div v-for="sale in recentSales" :key="sale._id" class="flex items-center gap-3 py-2">
            <span class="w-9 h-9 thumb"><img v-if="photoFor(sale.ref)" :src="photoFor(sale.ref)" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2"><span class="badge-ref">{{ sale.ref }}</span><span class="text-[13px] text-gray-800 truncate">{{ sale.name }}</span></div>
              <div class="text-[11px] text-gray-500 mt-0.5">{{ sale.qty }} pce{{ (sale.qty || 0) > 1 ? 's' : '' }} · {{ fmtShort(sale.ts) }}</div>
            </div>
            <span class="text-[13px] font-semibold text-green-600 whitespace-nowrap">{{ formatPrice((sale.prixVente || 0) * (sale.qty || 0)) }}</span>
          </div>
        </div>
        <div v-else class="text-gray-500 text-sm text-center py-8">Aucune vente enregistrée pour le moment.</div>
      </div>
    </div>
  </div>
</template>
