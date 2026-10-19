<script setup lang="ts">
import { onMounted, watch, computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useStockStore } from './stores/stock'
import { useHistoryStore } from './stores/history'
import { useUsersStore } from './stores/users'
import { usePlanningStore } from './stores/planning'
import { useNative } from './composables/useNative'
import AppSidebar from './components/ui/AppSidebar.vue'
import AppTopbar from './components/ui/AppTopbar.vue'
import AppMobileHeader from './components/ui/AppMobileHeader.vue'
import AppTabBar from './components/ui/AppTabBar.vue'
import AppLogo from './components/ui/AppLogo.vue'
import ToastNotification from './components/ui/ToastNotification.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const stock = useStockStore()
const history = useHistoryStore()
const users = useUsersStore()
const planning = usePlanningStore()
const { initNative } = useNative()

const isPublic = computed(() => route.meta.public === true)
const menuOpen = ref(false)
const scrollEl = ref<HTMLElement | null>(null)

let started = false
function startInternal() {
  if (started) return
  started = true
  void auth.ensureAdmin()
  stock.listen()
  history.listen()
  users.listen()
  planning.listen()
}

onMounted(async () => {
  await initNative()
  if (auth.isLoggedIn) startInternal()
})

watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (loggedIn) startInternal()
    else if (!isPublic.value && route.name !== 'login') router.push('/login')
  },
)

// Lien de récupération de mot de passe : on ouvre directement le profil
// avec le formulaire « nouveau mot de passe ».
watch(
  () => auth.passwordRecovery,
  (v) => { if (v) void router.push({ path: '/profil', query: { reset: '1' } }) },
)

watch(() => route.path, () => {
  menuOpen.value = false
  // Nouvelle page : on repart du haut de la zone de contenu
  scrollEl.value?.scrollTo({ top: 0 })
})
</script>

<template>
  <!-- Surface publique : vitrine / boutique -->
  <div v-if="isPublic" class="min-h-screen flex flex-col bg-page" style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);">
    <header class="bg-white border-b border-gray-200">
      <div class="max-w-[1200px] mx-auto px-5 py-3 flex items-center justify-between">
        <router-link to="/boutique" class="flex items-center gap-3">
          <span class="bg-sidebar rounded-lg px-2.5 py-1.5"><AppLogo compact /></span>
          <span class="text-sm font-semibold text-gray-800 hidden sm:inline">Pièces automobiles d'occasion & neuves</span>
        </router-link>
        <router-link to="/login" class="btn btn-secondary btn-sm">
          Espace pro
        </router-link>
      </div>
    </header>
    <main class="flex-1 w-full">
      <router-view />
    </main>
    <footer class="bg-white border-t border-gray-200 mt-8">
      <div class="max-w-[1200px] mx-auto px-5 py-6 text-center text-gray-500 text-xs space-y-1">
        <div class="font-bold text-gray-900">FISSA PIÈCE AUTO</div>
        <div>Pièces automobiles d'occasion et neuves, contrôlées et prêtes à poser.</div>
        <div class="text-[11px] text-gray-400">
          © FISSA PIÈCE AUTO ·
          <router-link to="/confidentialite" class="hover:text-gray-700 underline-offset-2 hover:underline">Politique de confidentialité</router-link>
        </div>
      </div>
    </footer>
    <ToastNotification />
  </div>

  <!-- Application interne (authentifiée).
       La coque occupe exactement la hauteur de l'écran et seule la zone <main>
       défile : l'en-tête et la barre d'onglets restent fixes, y compris dans
       la WebView iOS/Android (où les éléments « fixed » bougent au rebond). -->
  <div v-else-if="auth.isLoggedIn" class="h-screen h-[100dvh] flex bg-page overflow-hidden">
    <!-- Barre latérale (desktop) / menu secondaire « Plus » (mobile) -->
    <AppSidebar :open="menuOpen" @close="menuOpen = false" />
    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <AppTopbar class="hidden lg:block shrink-0" />
      <AppMobileHeader class="shrink-0" />
      <main id="app-scroll" ref="scrollEl" class="flex-1 min-h-0 overflow-y-auto overscroll-contain" style="-webkit-overflow-scrolling: touch;">
        <div class="w-full max-w-[1280px] mx-auto p-4 md:p-6 pb-6">
          <router-view />
        </div>
      </main>
      <AppTabBar class="shrink-0" @more="menuOpen = true" />
    </div>
    <ToastNotification />
  </div>

  <!-- Connexion -->
  <div v-else class="min-h-screen bg-page" style="padding-bottom: env(safe-area-inset-bottom);">
    <router-view />
    <ToastNotification />
  </div>
</template>
