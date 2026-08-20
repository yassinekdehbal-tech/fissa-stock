<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'

const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()

interface NavItem {
  to: string
  label: string
  icon: string
  show: boolean
}

// Le profil (donc le role et les permissions) est charge de facon asynchrone
// apres le montage : la liste doit etre recalculee a son arrivee, sinon le menu
// reste fige sur l'etat "pas encore de profil".
const navItems = computed<NavItem[]>(() => [
  { to: '/', label: 'Dashboard', icon: '📊', show: auth.isAdmin },
  { to: '/add', label: 'Ajouter', icon: '＋', show: auth.isAdmin || auth.hasPerm('magasinier') },
  { to: '/stock', label: 'Stock', icon: '📦', show: auth.isAdmin || auth.hasPerm('magasinier') },
  { to: '/scanner', label: 'Scanner', icon: '📷', show: auth.isAdmin || auth.hasPerm('vendeur') },
  { to: '/panier', label: 'Panier', icon: '🛒', show: auth.isAdmin || auth.hasPerm('vendeur') },
  { to: '/planning', label: 'Atelier', icon: '🔧', show: auth.isAdmin || auth.hasPerm('magasinier') },
  { to: '/history', label: 'Historique', icon: '📋', show: true },
  { to: '/reporting', label: 'Reporting', icon: '📈', show: auth.isAdmin },
  { to: '/caisse', label: 'Caisse', icon: '💵', show: auth.isAdmin },
  { to: '/multidiffusion', label: 'Multidiffusion', icon: '📡', show: auth.isAdmin || auth.hasPerm('vendeur') },
  { to: '/users', label: 'Utilisateurs', icon: '👥', show: auth.isAdmin },
])
</script>

<template>
  <nav class="bg-[#21262d] border-b border-[#30363d] px-5 flex overflow-x-auto scrollbar-hide">
    <router-link
      v-for="item in navItems.filter((i) => i.show)"
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
