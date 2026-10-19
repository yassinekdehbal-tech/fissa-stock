<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import AppIcon from '@/components/ui/AppIcon.vue'

/** Barre d'onglets mobile : Accueil · Stock · [Scanner] · Panier · Plus. */
const emit = defineEmits<{ more: [] }>()
const route = useRoute()
const auth = useAuthStore()
const cart = useCartStore()

const canScan = computed(() => auth.isAdmin || auth.hasPerm('vendeur'))
const canStock = computed(() => auth.isAdmin || auth.hasPerm('magasinier'))

function active(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<template>
  <nav class="lg:hidden relative z-30 px-3 pt-2 bg-page" style="padding-bottom: calc(env(safe-area-inset-bottom) + 8px);">
    <div class="bg-sidebar text-gray-300 rounded-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.25)] h-[64px] grid grid-cols-5 items-center">
      <router-link to="/" class="flex flex-col items-center gap-0.5 text-[10px] font-medium" :class="active('/') ? 'text-brand' : 'hover:text-white'">
        <AppIcon name="home" class="w-5 h-5" /> Accueil
      </router-link>
      <router-link :to="canStock ? '/stock' : '/history'" class="flex flex-col items-center gap-0.5 text-[10px] font-medium" :class="active(canStock ? '/stock' : '/history') ? 'text-brand' : 'hover:text-white'">
        <AppIcon :name="canStock ? 'box' : 'history'" class="w-5 h-5" /> {{ canStock ? 'Stock' : 'Historique' }}
      </router-link>
      <div class="flex justify-center">
        <router-link
          :to="canScan ? '/scanner' : '/stock'"
          class="w-14 h-14 -mt-7 rounded-full bg-brand text-gray-900 flex items-center justify-center shadow-lg ring-4 ring-page"
          :class="active('/scanner') ? 'brightness-95' : ''"
          aria-label="Scanner"
        >
          <AppIcon name="scan" class="w-6 h-6" :stroke-width="2.4" />
        </router-link>
      </div>
      <router-link to="/panier" class="relative flex flex-col items-center gap-0.5 text-[10px] font-medium" :class="active('/panier') ? 'text-brand' : 'hover:text-white'">
        <span class="relative">
          <AppIcon name="cart" class="w-5 h-5" />
          <span v-if="cart.count" class="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand text-gray-900 text-[10px] font-bold flex items-center justify-center">{{ cart.count }}</span>
        </span>
        Panier
      </router-link>
      <button class="flex flex-col items-center gap-0.5 text-[10px] font-medium hover:text-white" @click="emit('more')">
        <AppIcon name="plus-circle" class="w-5 h-5" /> Plus
      </button>
    </div>
  </nav>
</template>
