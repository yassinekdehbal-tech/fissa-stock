<script setup lang="ts">
import { onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useStockStore } from './stores/stock'
import { useHistoryStore } from './stores/history'
import { useUsersStore } from './stores/users'
import { usePlanningStore } from './stores/planning'
import { useNative } from './composables/useNative'
import AppHeader from './components/ui/AppHeader.vue'
import AppNav from './components/ui/AppNav.vue'
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
</script>

<template>
  <div class="min-h-screen flex flex-col" style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);">
    <!-- Surface publique : vitrine / boutique -->
    <template v-if="isPublic">
      <header class="bg-[#161b22] border-b border-[#30363d]">
        <div class="max-w-[1200px] mx-auto px-5 py-3 flex items-center justify-between">
          <router-link to="/boutique" class="font-mono text-lg font-bold text-[#e6a817] tracking-tight">
            FISSA <span class="text-[#3fb950]">PIECE</span> AUTO
          </router-link>
          <router-link to="/login" class="text-[11px] font-mono text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            Espace pro →
          </router-link>
        </div>
      </header>
      <main class="flex-1 w-full">
        <router-view />
      </main>
      <footer class="bg-[#161b22] border-t border-[#30363d] mt-8">
        <div class="max-w-[1200px] mx-auto px-5 py-6 text-center text-[#8b949e] text-xs space-y-1">
          <div class="font-mono text-[#e6a817] font-bold">FISSA PIECE AUTO</div>
          <div>Pièces automobiles d'occasion et neuves</div>
          <div class="text-[10px] text-[#484f58]">© FISSA PIECE AUTO — Toutes les pièces sont vérifiées.</div>
        </div>
      </footer>
    </template>

    <!-- Application interne (authentifiée) -->
    <template v-else-if="auth.isLoggedIn">
      <AppHeader />
      <AppNav />
      <main class="flex-1 p-5 max-w-[1200px] w-full mx-auto">
        <router-view />
      </main>
    </template>

    <!-- Connexion -->
    <template v-else>
      <router-view />
    </template>

    <ToastNotification />
  </div>
</template>
