<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useModeStore } from '@/stores/mode'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppLogo from '@/components/ui/AppLogo.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

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

// Le profil (donc le rôle et les permissions) est chargé de façon asynchrone
// après le montage : la liste doit être recalculée à son arrivée.
const navItems = computed<NavItem[]>(() => [
  { to: '/', label: 'Dashboard', icon: 'dashboard', show: auth.isAdmin, mode: 'both' },
  { to: '/add', label: 'Ajouter', icon: 'plus-circle', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'piece' },
  { to: '/stock', label: 'Stock', icon: 'box', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'piece' },
  { to: '/scanner', label: 'Scanner', icon: 'scan', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/panier', label: 'Panier', icon: 'cart', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/planning', label: 'Atelier', icon: 'wrench', show: auth.isAdmin || auth.hasPerm('magasinier'), mode: 'mecanique' },
  { to: '/history', label: 'Historique', icon: 'history', show: true, mode: 'both' },
  { to: '/reporting', label: 'Reporting', icon: 'chart', show: auth.isAdmin, mode: 'both' },
  { to: '/caisse', label: 'Caisse', icon: 'cash', show: auth.isAdmin, mode: 'both' },
  { to: '/multidiffusion', label: 'Multidiffusion', icon: 'broadcast', show: auth.isAdmin || auth.hasPerm('vendeur'), mode: 'piece' },
  { to: '/users', label: 'Utilisateurs', icon: 'users', show: auth.isAdmin, mode: 'both' },
  { to: '/profil', label: 'Paramètres', icon: 'settings', show: true, mode: 'both' },
])

const visibleItems = computed(() =>
  navItems.value.filter((i) => i.show && (i.mode === 'both' || i.mode === modeStore.mode)),
)

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <!-- Voile mobile -->
  <div
    v-if="open"
    class="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
    @click="emit('close')"
  ></div>

  <aside
    class="fixed inset-y-0 left-0 z-50 w-60 bg-sidebar text-gray-200 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto lg:h-full lg:shrink-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
    style="padding-top: env(safe-area-inset-top);"
  >
    <!-- Logo -->
    <div class="px-5 pt-5 pb-4 flex items-center justify-between">
      <AppLogo />
      <button class="lg:hidden text-gray-400 hover:text-white" @click="emit('close')" aria-label="Fermer le menu">
        <AppIcon name="x" class="w-5 h-5" />
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
      <router-link
        v-for="item in visibleItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
        @click="emit('close')"
      >
        <AppIcon :name="item.icon" class="w-[18px] h-[18px] shrink-0" />
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.to === '/panier' && cart.count > 0"
          class="text-[10px] font-bold rounded-full px-1.5 py-0.5"
          :class="isActive(item.to) ? 'bg-gray-900/15 text-gray-900' : 'bg-brand text-gray-900'"
        >{{ cart.count }}</span>
      </router-link>
    </nav>

    <!-- Pied -->
    <div class="px-5 py-4 border-t border-white/10 text-[11px] text-gray-500 flex items-center justify-between" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);">
      <span>Version 1.0</span>
      <span class="inline-flex items-center gap-1 text-green-400">
        <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span> Sync
      </span>
    </div>
  </aside>
</template>
