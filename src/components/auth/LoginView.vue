<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const pwd = ref('')
const name = ref('')
const info = ref('')

async function handleSubmit() {
  info.value = ''
  if (mode.value === 'login') {
    const ok = await auth.login(email.value, pwd.value)
    if (ok) router.push('/')
    return
  }
  // Inscription (le tout premier compte devient automatiquement admin)
  const created = await auth.signUp(email.value, pwd.value, name.value)
  if (!created) return
  // Tente une connexion immédiate (si la confirmation d'email est désactivée)
  const logged = await auth.login(email.value, pwd.value)
  if (logged) {
    router.push('/')
  } else {
    info.value = 'Compte créé. Si la confirmation par email est activée, validez-la puis connectez-vous.'
    mode.value = 'login'
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  auth.error = ''
  info.value = ''
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
      <form @submit.prevent="handleSubmit" class="flex flex-col gap-3 text-left">
        <div v-if="mode === 'signup'" class="flex flex-col gap-1.5">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Nom</label>
          <input
            v-model="name"
            type="text"
            placeholder="Votre nom"
            autocomplete="name"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3.5 py-2.5 outline-none w-full focus:border-[#e6a817] transition-colors"
          >
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="vous@exemple.fr"
            autocomplete="email"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3.5 py-2.5 outline-none w-full focus:border-[#e6a817] transition-colors"
          >
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Mot de passe</label>
          <input
            v-model="pwd"
            type="password"
            placeholder="••••••••"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3.5 py-2.5 outline-none w-full focus:border-[#e6a817] transition-colors"
          >
        </div>
        <p v-if="auth.error" class="text-red-400 text-xs font-mono text-center mt-1">
          {{ auth.error }}
        </p>
        <p v-if="info" class="text-[#3fb950] text-xs font-mono text-center mt-1">
          {{ info }}
        </p>
        <button
          type="submit"
          :disabled="auth.loading"
          class="w-full mt-1 bg-[#e6a817] text-black font-mono text-xs font-semibold uppercase tracking-wider py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50"
        >
          {{ auth.loading ? '...' : (mode === 'login' ? 'Se connecter' : 'Créer le compte') }}
        </button>
      </form>
      <button
        type="button"
        @click="toggleMode"
        class="mt-4 text-[11px] text-[#8b949e] hover:text-[#e6a817] font-mono transition-colors bg-transparent border-none cursor-pointer"
      >
        {{ mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter' }}
      </button>
    </div>
  </div>
</template>
