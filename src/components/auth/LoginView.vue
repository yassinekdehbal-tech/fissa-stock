<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const id = ref('')
const pwd = ref('')

async function handleLogin() {
  const success = await auth.login(id.value, pwd.value)
  if (success) router.push('/')
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_50%_0%,rgba(230,168,23,0.08)_0%,transparent_70%)]">
    <div class="bg-[#161b22] border border-[#30363d] rounded-2xl p-10 w-[90%] max-w-[380px] text-center">
      <div class="font-mono text-2xl font-bold text-[#e6a817] mb-1 tracking-tight">
        FISSA <span class="text-[#3fb950]">PIECE</span> AUTO
      </div>
      <div class="text-[#8b949e] text-[11px] mb-7 font-mono tracking-[2px] uppercase">
        Pièces automobiles d'occasion
      </div>
      <form @submit.prevent="handleLogin" class="flex flex-col gap-3 text-left">
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Identifiant</label>
          <input
            v-model="id"
            type="text"
            placeholder="Votre identifiant"
            autocomplete="username"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3.5 py-2.5 outline-none w-full focus:border-[#e6a817] transition-colors"
          >
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Mot de passe</label>
          <input
            v-model="pwd"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3.5 py-2.5 outline-none w-full focus:border-[#e6a817] transition-colors"
          >
        </div>
        <p v-if="auth.error" class="text-red-400 text-xs font-mono text-center mt-1">
          {{ auth.error }}
        </p>
        <button
          type="submit"
          :disabled="auth.loading"
          class="w-full mt-1 bg-[#e6a817] text-black font-mono text-xs font-semibold uppercase tracking-wider py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50"
        >
          {{ auth.loading ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>
    </div>
  </div>
</template>
