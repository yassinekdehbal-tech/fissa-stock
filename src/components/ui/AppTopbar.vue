<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useStockStore } from '@/stores/stock'
import { useModeStore, type WorkspaceMode } from '@/stores/mode'
import AppIcon from '@/components/ui/AppIcon.vue'

const emit = defineEmits<{ 'toggle-menu': [] }>()

const auth = useAuthStore()
const stock = useStockStore()
const modeStore = useModeStore()
const route = useRoute()
const router = useRouter()

const query = ref('')
const menuOpen = ref(false)

const initials = computed(() => {
  const n = auth.currentUser?.name || auth.email || '?'
  return n
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('')
})

const alerts = computed(() => stock.lowStockPieces.length)

// Pages propres à un seul mode : si on bascule alors qu'on est dessus,
// on renvoie vers la page d'accueil du mode choisi.
const pieceOnly = ['/add', '/stock', '/scanner', '/panier', '/multidiffusion']
const mecaOnly = ['/planning']

function switchMode(m: WorkspaceMode) {
  if (modeStore.mode === m) return
  modeStore.setMode(m)
  if (m === 'mecanique' && pieceOnly.includes(route.path)) void router.push('/planning')
  if (m === 'piece' && mecaOnly.includes(route.path)) void router.push('/stock')
}

function submitSearch() {
  const q = query.value.trim()
  void router.push({ path: '/stock', query: q ? { q } : {} })
}

function goAlerts() {
  void router.push(auth.isAdmin ? '/' : '/stock')
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200" style="padding-top: env(safe-area-inset-top);">
    <div class="flex items-center gap-3 px-4 md:px-6 h-16">
      <!-- Menu mobile -->
      <button class="icon-btn lg:hidden -ml-1" @click="emit('toggle-menu')" aria-label="Ouvrir le menu">
        <AppIcon name="menu" class="w-5 h-5" />
      </button>

      <!-- Recherche globale -->
      <form class="flex-1 max-w-xl relative" @submit.prevent="submitSearch">
        <AppIcon name="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="query"
          type="search"
          placeholder="Rechercher une référence, une désignation, un véhicule, un OEM…"
          class="input pl-9 bg-gray-50 border-gray-200 h-10"
        >
      </form>

      <!-- Espace de travail -->
      <div class="hidden md:flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-[11px] font-semibold">
        <button
          @click="switchMode('piece')"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="modeStore.mode === 'piece' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'"
        >Pièce</button>
        <button
          @click="switchMode('mecanique')"
          class="px-2.5 py-1 rounded-md transition-colors"
          :class="modeStore.mode === 'mecanique' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'"
        >Mécanique</button>
      </div>

      <div class="ml-auto flex items-center gap-1.5">
        <!-- Alertes -->
        <button class="icon-btn relative" @click="goAlerts" :title="alerts ? alerts + ' alerte(s) de stock' : 'Aucune alerte'">
          <AppIcon name="bell" class="w-5 h-5" />
          <span
            v-if="alerts"
            class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >{{ alerts > 9 ? '9+' : alerts }}</span>
        </button>

        <!-- Utilisateur -->
        <div class="relative">
          <button class="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-gray-100 transition-colors" @click="menuOpen = !menuOpen">
            <span class="w-8 h-8 rounded-full bg-sidebar text-brand text-[11px] font-bold flex items-center justify-center">{{ initials }}</span>
            <span class="hidden sm:block text-sm font-medium text-gray-800 max-w-[120px] truncate">{{ auth.currentUser?.name || 'Compte' }}</span>
            <AppIcon name="chevron-down" class="w-4 h-4 text-gray-400 hidden sm:block" />
          </button>
          <div v-if="menuOpen" class="fixed inset-0 z-40" @click="menuOpen = false"></div>
          <div v-if="menuOpen" class="absolute right-0 mt-1 w-56 card p-1.5 z-50">
            <div class="px-3 py-2">
              <div class="text-sm font-semibold text-gray-900 truncate">{{ auth.currentUser?.name }}</div>
              <div class="text-xs text-gray-500 truncate">{{ auth.email }}</div>
              <span class="badge mt-1.5" :class="auth.isAdmin ? 'badge-violet' : 'badge-green'">{{ auth.isAdmin ? 'Administrateur' : 'Utilisateur' }}</span>
            </div>
            <div class="md:hidden border-t border-gray-100 my-1"></div>
            <div class="md:hidden px-1.5 pb-1 flex gap-1">
              <button class="btn btn-sm flex-1" :class="modeStore.mode === 'piece' ? 'btn-primary' : 'btn-secondary'" @click="switchMode('piece'); menuOpen = false">Pièce</button>
              <button class="btn btn-sm flex-1" :class="modeStore.mode === 'mecanique' ? 'btn-primary' : 'btn-secondary'" @click="switchMode('mecanique'); menuOpen = false">Mécanique</button>
            </div>
            <div class="border-t border-gray-100 my-1"></div>
            <router-link to="/profil" class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100" @click="menuOpen = false">
              <AppIcon name="user" class="w-4 h-4" /> Mon profil
            </router-link>
            <button class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50" @click="auth.logout()">
              <AppIcon name="logout" class="w-4 h-4" /> Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
