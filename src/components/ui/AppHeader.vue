<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <header class="bg-[#161b22] border-b border-[#30363d] px-5 py-3 flex items-center gap-3 sticky top-0 z-50">
    <div class="font-mono font-bold text-[15px] text-[#e6a817] tracking-tight">
      FISSA <span class="text-[#3fb950]">PIECE</span> AUTO
    </div>
    <span class="text-[10px] text-[#8b949e] font-mono">🟢 Sync</span>
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
