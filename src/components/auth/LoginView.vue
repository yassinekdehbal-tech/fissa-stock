<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppLogo from '@/components/ui/AppLogo.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const auth = useAuthStore()
const { toast } = useToast()

const mode = ref<'login' | 'signup'>('login')
const email = ref('')
const pwd = ref('')
const name = ref('')
const info = ref('')
const showPwd = ref(false)
const sendingReset = ref(false)

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
  const logged = await auth.login(email.value, pwd.value)
  if (logged) {
    router.push('/')
  } else {
    info.value = 'Compte créé. Si la confirmation par email est activée, validez-la puis connectez-vous.'
    mode.value = 'login'
  }
}

async function forgotPassword() {
  auth.error = ''
  if (!email.value.trim()) { auth.error = 'Saisissez votre e-mail pour recevoir le lien de réinitialisation'; return }
  sendingReset.value = true
  try {
    await auth.resetPassword(email.value)
    info.value = 'Un e-mail de réinitialisation vient de vous être envoyé.'
    toast('E-mail envoyé')
  } catch (e) {
    auth.error = e instanceof Error ? e.message : String(e)
  } finally {
    sendingReset.value = false
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
    <div class="relative overflow-hidden bg-sidebar text-white lg:w-[42%] flex flex-col justify-between p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:p-12 min-h-[220px] lg:min-h-0">
      <div class="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true">
        <div class="absolute -right-16 -top-24 w-80 h-80 rounded-full border-[26px] border-brand/20"></div>
        <div class="absolute -right-6 top-6 w-44 h-44 rounded-full border-[18px] border-white/5"></div>
        <div class="absolute left-1/2 -bottom-40 w-[420px] h-[420px] rounded-full border-[30px] border-white/5"></div>
      </div>
      <div class="relative flex items-center justify-center lg:justify-start h-full lg:h-auto">
        <div class="text-center lg:text-left">
          <div class="font-black italic tracking-tight text-brand text-[44px] lg:text-[56px] leading-none">FISSA</div>
          <div class="font-bold tracking-[0.3em] uppercase text-white text-[13px] mt-1">Pièce Auto</div>
        </div>
      </div>
      <div class="relative hidden lg:block">
        <h2 class="text-3xl font-bold leading-tight">Gestion de stock<br>pièces automobiles</h2>
        <p class="text-gray-400 mt-3 text-sm max-w-sm">Référencement, étiquettes code-barres, scan caméra, panier et atelier : tout le magasin dans une seule application.</p>
        <div class="flex gap-6 mt-8 text-[12px] text-gray-400">
          <span class="inline-flex items-center gap-1.5"><AppIcon name="scan" class="w-4 h-4 text-brand" /> Scan caméra</span>
          <span class="inline-flex items-center gap-1.5"><AppIcon name="tag" class="w-4 h-4 text-brand" /> Étiquettes</span>
          <span class="inline-flex items-center gap-1.5"><AppIcon name="wrench" class="w-4 h-4 text-brand" /> Atelier</span>
        </div>
      </div>
      <div class="relative hidden lg:block text-[11px] text-gray-500">© FISSA PIÈCE AUTO · Version 1.0</div>
    </div>

    <!-- Formulaire -->
    <div class="flex-1 flex items-start lg:items-center justify-center p-4 lg:p-6 -mt-6 lg:mt-0">
      <div class="card p-6 lg:p-8 w-full max-w-[420px] rounded-2xl">
        <h1 class="text-xl font-bold text-gray-900">{{ mode === 'login' ? 'Connexion' : 'Créer un compte' }}</h1>
        <p class="text-sm text-gray-500 mt-1 mb-6">{{ mode === 'login' ? 'Accédez à votre espace de gestion.' : 'Le premier compte créé devient administrateur.' }}</p>

        <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
          <div v-if="mode === 'signup'" class="flex flex-col gap-1.5">
            <label class="label">Nom</label>
            <input v-model="name" type="text" placeholder="Votre nom" autocomplete="name" class="input">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="label">Email</label>
            <input v-model="email" type="email" placeholder="vous@exemple.fr" autocomplete="email" inputmode="email" class="input">
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="label">Mot de passe</label>
            <div class="relative">
              <input v-model="pwd" :type="showPwd ? 'text' : 'password'" placeholder="••••••••" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" class="input pr-10">
              <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 icon-btn" @click="showPwd = !showPwd" :aria-label="showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
                <AppIcon :name="showPwd ? 'eye-off' : 'eye'" class="w-4 h-4" />
              </button>
            </div>
          </div>
          <p v-if="auth.error" class="text-red-600 text-[13px] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ auth.error }}</p>
          <p v-if="info" class="text-green-700 text-[13px] bg-green-50 border border-green-200 rounded-lg px-3 py-2">{{ info }}</p>
          <button type="submit" :disabled="auth.loading" class="btn btn-primary w-full py-2.5">
            {{ auth.loading ? '…' : (mode === 'login' ? 'Se connecter' : 'Créer le compte') }}
          </button>
          <button v-if="mode === 'login'" type="button" :disabled="sendingReset" class="text-[13px] font-medium text-blue-600 hover:underline text-center" @click="forgotPassword">
            {{ sendingReset ? 'Envoi…' : 'Mot de passe oublié ?' }}
          </button>
        </form>

        <div class="flex items-center gap-3 my-5 text-[12px] text-gray-400">
          <span class="flex-1 border-t border-gray-200"></span> ou <span class="flex-1 border-t border-gray-200"></span>
        </div>

        <router-link to="/boutique" class="btn btn-secondary w-full">
          <AppIcon name="store" class="w-4 h-4" /> Voir la boutique publique
        </router-link>

        <button type="button" @click="toggleMode" class="mt-5 w-full text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
          {{ mode === 'login' ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter' }}
        </button>
      </div>
    </div>
  </div>
</template>
