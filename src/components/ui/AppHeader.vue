<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useModeStore, type WorkspaceMode } from '@/stores/mode'

const auth = useAuthStore()
const modeStore = useModeStore()
const route = useRoute()
const router = useRouter()

// Pages propres a un seul mode : si on bascule alors qu'on est dessus,
// on renvoie vers la page d'accueil du mode choisi.
const pieceOnly = ['/add', '/stock', '/scanner', '/panier', '/multidiffusion']
const mecaOnly = ['/planning']

function switchMode(m: WorkspaceMode) {
  if (modeStore.mode === m) return
  modeStore.setMode(m)
  if (m === 'mecanique' && pieceOnly.includes(route.path)) void router.push('/planning')
  if (m === 'piece' && mecaOnly.includes(route.path)) void router.push('/stock')
}
</script>

<template>
  <header class="bg-[#161b22] border-b border-[#30363d] px-5 py-3 flex items-center gap-3 sticky top-0 z-50">
    <div class="font-mono font-bold text-[15px] text-[#e6a817] tracking-tight">
      FISSA <span class="text-[#3fb950]">PIECE</span> AUTO
    </div>
    <span class="text-[10px] text-[#8b949e] font-mono hidden sm:inline">🟢 Sync</span>
    <div class="flex rounded-lg border border-[#30363d] overflow-hidden font-mono text-[10px] font-bold">
      <button
        @click="switchMode('piece')"
        class="px-2.5 py-1 uppercase tracking-wider transition-colors"
        :class="modeStore.mode === 'piece' ? 'bg-[#e6a817] text-black' : 'text-[#8b949e] hover:text-[#e6edf3]'"
      >
        📦 Pièce
      </button>
      <button
        @click="switchMode('mecanique')"
        class="px-2.5 py-1 uppercase tracking-wider transition-colors"
        :class="modeStore.mode === 'mecanique' ? 'bg-[#e6a817] text-black' : 'text-[#8b949e] hover:text-[#e6edf3]'"
      >
        🔧 Mécanique
      </button>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <span class="text-xs font-mono text-[#8b949e] hidden sm:inline">{{ auth.currentUser?.name }}</span>
      <span
        class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono"
        :class="auth.isAdmin
          ? 'bg-purple-400/20 text-purple-400 border border-purple-400/30'
          : 'bg-green-500/20 text-green-400 border border-green-500/30'"
      >
        {{ auth.isAdmin ? 'Admin' : 'User' }}
      </span>
      <button
        @click="auth.logout()"
        class="border border-[#30363d] text-[#8b949e] rounded px-2.5 py-1 text-[11px] font-mono hover:border-red-400 hover:text-red-400 transition-colors"
      >
        ⏻
      </button>
    </div>
  </header>
</template>
