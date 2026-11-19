<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePublicationsStore } from '@/stores/publications'
import { useStockStore } from '@/stores/stock'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import type { Channel } from '@/stores/publications'
import type { Piece } from '@/types'
import PiecePublishPanel from '@/components/multidiffusion/PiecePublishPanel.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const pub = usePublicationsStore()
const stock = useStockStore()
const auth = useAuthStore()
const { toast } = useToast()

const search = ref('')
const filter = ref<'all' | 'online' | 'offline'>('all')

onMounted(() => { if (pub.loading) pub.listen() })

const integrationBadge: Record<string, { label: string; cls: string; hint: string }> = {
  api: { label: 'API', cls: 'badge-green', hint: 'Publication automatique une fois les accès configurés' },
  connector: { label: 'Dépôt manuel', cls: 'badge-blue', hint: "Pas d'API publique : annonce déposée à la main, suivie ici" },
  manual: { label: 'Dépôt manuel', cls: 'badge-gray', hint: 'Annonce déposée à la main, suivie ici' },
}

const pieces = computed<Piece[]>(() => {
  const q = search.value.toLowerCase().trim()
  return stock.activePieces
    .filter((p) => p.qty > 0)
    .filter((p) => {
      if (filter.value === 'all') return true
      const live = pub.liveChannels(p._id!).length > 0
      return filter.value === 'online' ? live : !live
    })
    .filter((p) =>
      !q ? true : p.ref.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.vehicle.toLowerCase().includes(q),
    )
    .slice(0, 100)
})

const onlineCount = computed(() => stock.activePieces.filter((p) => p.qty > 0 && pub.liveChannels(p._id!).length > 0).length)

async function toggleChannel(c: Channel) {
  await pub.setChannelActive(c.id, !c.active)
  toast(c.active ? `${c.label} désactivé` : `${c.label} activé`)
}

/** Configuration eBay (admin) : vérifie le jeton, lit politiques et lieu d'expédition, enregistre la config du canal. */
const ebaySetupBusy = ref(false)
const ebaySetupResult = ref<{ ok: boolean; step: string; message: string; notes: string[]; missing: string[] } | null>(null)
async function setupEbay() {
  ebaySetupBusy.value = true
  try {
    ebaySetupResult.value = await pub.setupEbay()
    toast(ebaySetupResult.value.message, !ebaySetupResult.value.ok)
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    ebaySetupBusy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="page-title text-xl">Multidiffusion</div>
        <div class="text-gray-500 text-xs mt-1">
          Publiez vos pièces sur plusieurs marketplaces depuis une source unique. Anti-survente automatique.
        </div>
      </div>
      <router-link to="/commandes" class="btn btn-secondary btn-sm">
        <AppIcon name="truck" class="w-4 h-4" /> Commandes en ligne
        <span v-if="pub.ordersToShip.length" class="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold inline-flex items-center justify-center">{{ pub.ordersToShip.length }}</span>
      </router-link>
    </div>

    <!-- Info banner -->
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-gray-700 leading-relaxed">
      Un canal « API » (eBay) publie pour de vrai une fois ses accès configurés (Supabase → Edge Functions → Secrets) ;
      sans accès, la publication reste en <span class="text-red-600">Erreur</span> avec le détail de ce qui manque.
      Les canaux « Dépôt manuel » (LeBonCoin, Facebook…) servent à suivre les annonces déposées à la main :
      dès qu'une pièce est vendue quelque part, elle est retirée partout.
    </div>

    <!-- Channels -->
    <div class="card p-4">
      <div class="card-title">Canaux de vente</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div
          v-for="c in pub.channels"
          :key="c.id"
          class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
          :title="integrationBadge[c.integration]?.hint"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-gray-900 text-xs font-semibold truncate">{{ c.label }}</span>
            <span class="badge shrink-0" :class="integrationBadge[c.integration]?.cls">{{ integrationBadge[c.integration]?.label }}</span>
          </div>
          <button
            v-if="auth.isAdmin"
            @click="toggleChannel(c)"
            class="text-[10px] px-2 py-1 rounded cursor-pointer border transition-colors shrink-0"
            :class="c.active ? 'bg-green-50 text-green-600 border-green-200' : 'bg-transparent text-gray-500 border-gray-200 hover:border-gray-300'"
          >
            {{ c.active ? 'Actif' : 'Inactif' }}
          </button>
          <span v-else class="text-[10px] px-2 py-1 rounded border shrink-0" :class="c.active ? 'bg-green-50 text-green-600 border-green-200' : 'text-gray-400 border-gray-200'">{{ c.active ? 'Actif' : 'Inactif' }}</span>
        </div>
      </div>
    </div>

    <!-- Configuration eBay (admin) -->
    <div v-if="auth.isAdmin" class="card p-4 space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="card-title mb-0">Connexion eBay</div>
          <div class="text-[11px] text-gray-500 mt-0.5">Après avoir saisi les clés eBay dans Supabase (Edge Functions → Secrets), lancez la configuration : politiques de vente et lieu d'expédition sont récupérés automatiquement.</div>
        </div>
        <button class="btn btn-secondary btn-sm" :disabled="ebaySetupBusy" @click="setupEbay"><AppIcon name="refresh" class="w-4 h-4" /> {{ ebaySetupBusy ? 'Vérification…' : 'Configurer eBay' }}</button>
      </div>
      <div v-if="ebaySetupResult" class="rounded-lg border p-3 text-[12px] leading-relaxed" :class="ebaySetupResult.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-gray-700'">
        <div class="font-semibold">{{ ebaySetupResult.message }}</div>
        <ul v-if="ebaySetupResult.notes.length" class="list-disc pl-4 mt-1"><li v-for="n in ebaySetupResult.notes" :key="n">{{ n }}</li></ul>
      </div>
    </div>

    <!-- No active channel hint -->
    <div v-if="!pub.activeChannels.length" class="card p-6 text-center text-gray-500 text-sm">
      Activez au moins un canal ci-dessus pour commencer à diffuser vos pièces.
    </div>

    <!-- Pieces -->
    <div v-else class="card p-4 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div class="text-[12px] font-semibold text-gray-700">Pièces à diffuser <span class="text-gray-400 font-normal">· {{ onlineCount }} en ligne</span></div>
        <div class="flex items-center gap-2">
          <select v-model="filter" class="input w-auto py-1.5">
            <option value="all">Toutes</option>
            <option value="online">En ligne</option>
            <option value="offline">Pas encore en ligne</option>
          </select>
          <input v-model="search" type="text" placeholder="Rechercher…" class="input w-auto py-1.5">
        </div>
      </div>

      <div v-if="!pieces.length" class="text-center py-6 text-gray-500 text-xs">Aucune pièce.</div>

      <div v-else class="space-y-2">
        <div v-for="p in pieces" :key="p._id" class="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <router-link :to="`/piece/${p._id}`" class="badge-ref shrink-0 hover:underline">{{ p.ref }}</router-link>
            <span class="text-gray-900 text-xs truncate flex-1">{{ p.name }}</span>
            <span class="text-[10px] text-green-600 font-semibold shrink-0">{{ formatPrice(p.price) }}</span>
            <span v-if="p.publishable" class="badge badge-blue shrink-0" title="Visible sur la boutique en ligne FISSA">Boutique</span>
          </div>
          <PiecePublishPanel :piece="p" compact />
        </div>
      </div>
    </div>
  </div>
</template>
