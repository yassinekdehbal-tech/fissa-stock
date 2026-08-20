<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useModeStore } from '@/stores/mode'

const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()
const modeStore = useModeStore()

interface NavItem {
  to: string
  label: string
  icon: string
  show: boolean
  /** 'piece' = magasin, 'mecanique' = atelier, 'both' = pages de gestion communes */
  mode: 'piece' | 'mecanique' | 'both'
}

// Le profil (donc le role et les permissions) est charge de facon asynchrone
// apres le montage : la liste doit etre recalculee a son arrivee, sinon le menu
// reste fige sur l'etat "pas encore de profil".
const navItems = computed<NavItem[]>(() => [
  { to: '/', label: 'Dashboard', icon: '📊', show: auth.isAdmin, mode: 'both' },
  { to: '/add', label: 'Ajouter', icon: '＋', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'piece' },
  { to: '/stock', label: 'Stock', icon: '📦', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'piece' },
  { to: '/scanner', label: 'Scanner', icon: '📷', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/panier', label: 'Panier', icon: '🛒', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/planning', label: 'Atelier', icon: '🔧', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'mecanique' },
  { to: '/history', label: 'Historique', icon: '📋', show: true, mode: 'both' },
  { to: '/reporting', label: 'Reporting', icon: '📈', show: auth.isAdmin, mode: 'both' },
  { to: '/caisse', label: 'Caisse', icon: '💵', show: auth.isAdmin, mode: 'both' },
  { to: '/multidiffusion', label: 'Multidiffusion', icon: '📡', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/users', label: 'Utilisateurs', icon: '👥', show: auth.isAdmin, mode: 'both' },
])

const visibleItems = computed(() =>
  navItems.value.filter((i) => i.show && (i.mode === 'both' || i.mode === modeStore.mode)),
)
</script>

<template>
  <nav class="bg-[#21262d] border-b border-[#30363d] px-5 flex overflow-x-auto scrollbar-hide">
    <router-link
      v-for="item in visibleItems"
      :key="item.to"
      :to="item.to"
      class="px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors"
      :class="route.path === item.to
        ? 'text-[#e6a817] border-[#e6a817]'
        : 'text-[#8b949e] border-transparent hover:text-[#e6edf3]'"
    >
      {{ item.icon }} {{ item.label }}
      <span v-if="item.to === '/panier' && cart.count > 0" class="ml-1 text-[10px] text-orange-400">({{ cart.count }})</span>
    </router-link>
  </nav>
</template>
