<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStockStore } from '@/stores/stock'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppLogo from '@/components/ui/AppLogo.vue'

/**
 * En-tête sombre de l'app sur mobile (< lg) :
 *  - page d'accueil : logo + cloche d'alertes + avatar (→ profil)
 *  - autres pages : flèche retour + titre (route.meta.title / back)
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const stock = useStockStore()

const isHome = computed(() => route.meta.home === true)
const title = computed(() => (route.meta.title as string) || '')
const alerts = computed(() => stock.lowStockPieces.length)

const initials = computed(() => {
  const n = auth.currentUser?.name || auth.email || '?'
  return n.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('')
})

function goBack() {
  const back = route.meta.back as string | undefined
  if (window.history.length > 1 && !back) router.back()
  else void router.push(back || '/')
}
</script>

<template>
  <header class="lg:hidden sticky top-0 z-30 bg-sidebar text-white" style="padding-top: env(safe-area-inset-top);">
    <div class="h-14 px-4 flex items-center gap-3">
      <template v-if="isHome">
        <AppLogo compact />
        <div class="ml-auto flex items-center gap-1">
          <router-link to="/" class="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10" :title="alerts ? alerts + ' alerte(s) de stock' : 'Notifications'" aria-label="Notifications">
            <AppIcon name="bell" class="w-5 h-5" />
            <span v-if="alerts" class="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{{ alerts > 9 ? '9+' : alerts }}</span>
          </router-link>
          <router-link to="/profil" class="w-9 h-9 rounded-full bg-white text-sidebar text-[12px] font-bold flex items-center justify-center" aria-label="Profil">{{ initials }}</router-link>
        </div>
      </template>
      <template v-else>
        <button class="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-white/10" @click="goBack" aria-label="Retour">
          <AppIcon name="arrow-left" class="w-5 h-5" />
        </button>
        <h1 class="text-[17px] font-semibold truncate flex-1">{{ title }}</h1>
        <slot name="actions" />
      </template>
    </div>
  </header>
</template>
