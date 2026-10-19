<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

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
  <div class="min-h-screen flex flex-col lg:flex-row">
    <!-- Panneau de marque -->
    <div class="bg-sidebar text-white lg:w-[42%] flex flex-col justify-between p-8 lg:p-12">
      <AppLogo />
      <div class="hidden lg:block">
        <h2 class="text-3xl font-bold leading-tight">Gestion de stock<br>pièces automobiles</h2>
        <p class="text-gray-400 mt-3 text-sm max-w-sm">Référencement, étiquettes code-barres, scan caméra, panier et atelier : tout le magasin dans une seule application.</p>
        <div class="flex gap-6 mt-8 text-[12px] text-gray-400">
          <span class="inline-flex items-center gap-1.5"><AppIcon name="scan" class="w-4 h-4 text-brand" /> Scan caméra</span>
          <span class="inline-flex items-center gap-1.5"><AppIcon name="tag" class="w-4 h-4 text-brand" /> Étiquettes</span>
          <span class="inline-flex items-center gap-1.5"><AppIcon name="wrench" class="w-4 h-4 text-brand" /> Atelier</span>
        </div>
      </div>
      <div class="hidden lg:block text-[11px] text-gray-500">© FISSA PIÈCE AUTO · Version 1.0</div>
    </div>

    <!-- Formulaire -->
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="card p-8 w-full max-w-[400px]">
        <h1 class="text-xl font-bold text-gray-900">{{ mode === 'login' ? 'Connexion' : 'Créer un compte' }}</h1>
        <p class="text-sm text-gray-500 mt-1 mb-6">{{ mode === 'login' ? 'Accédez à votre espace de gestion.' : 'Le premier compte créé devient administrateur.' }}</p>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <div v-if="mode === 'signup'" class="flex flex-col gap-1.5">
            <label class="label">Nom</label>
            <input v-model="name" type="text" placeholder="Votre nom" autocomplete="name" class="input">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="label">Email</label>
            <input v-model="email" type="email" placeholder="vous@exemple.fr" autocomplete="email" class="input">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="label">Mot de passe</label>
            <input v-model="pwd" type="password" placeholder="••••••••" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" class="input">
          </div>
          <p v-if="auth.error" class="text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ auth.error }}</p>
          <p v-if="info" class="text-green-700 text-[13px] bg-green-50 border border-green-200 rounded-lg px-3 py-2">{{ info }}</p>
          <button type="submit" :disabled="auth.loading" class="btn btn-primary w-full py-2.5">
            {{ auth.loading ? '…' : (mode === 'login' ? 'Se connecter' : 'Créer le compte') }}
          </button>
        </form>

        <button type="button" @click="toggleMode" class="mt-5 w-full text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
          {{ mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter' }}
        </button>

        <div class="mt-6 pt-4 border-t border-gray-100 text-center">
          <router-link to="/boutique" class="text-[12px] text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
            <AppIcon name="store" class="w-3.5 h-3.5" /> Voir la boutique publique
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
