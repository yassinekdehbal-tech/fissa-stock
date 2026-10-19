<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useModeStore, type WorkspaceMode } from '@/stores/mode'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const modeStore = useModeStore()
const { toast } = useToast()

const initials = computed(() => {
  const n = auth.currentUser?.name || auth.email || '?'
  return n.split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('')
})

// Pages propres à un seul mode (même logique que la barre du haut)
const pieceOnly = ['/add', '/stock', '/scanner', '/panier', '/multidiffusion']
const mecaOnly = ['/planning']
function switchMode(m: WorkspaceMode) {
  if (modeStore.mode === m) return
  modeStore.setMode(m)
  if (m === 'mecanique' && pieceOnly.includes(route.path)) void router.push('/planning')
  if (m === 'piece' && mecaOnly.includes(route.path)) void router.push('/stock')
}

// --- Modifier les informations ---------------------------------------------
const infoOpen = ref(false)
const name = ref('')
const savingInfo = ref(false)
function openInfo() { name.value = auth.currentUser?.name || ''; infoOpen.value = true }
async function saveInfo() {
  if (!name.value.trim()) { toast('Le nom est requis', true); return }
  savingInfo.value = true
  try { await auth.updateName(name.value); toast('Profil mis à jour'); infoOpen.value = false }
  catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
  finally { savingInfo.value = false }
}

// --- Changer le mot de passe ------------------------------------------------
const pwdOpen = ref(false)
const pwd1 = ref('')
const pwd2 = ref('')
const showPwd = ref(false)
const savingPwd = ref(false)
async function savePwd() {
  if (pwd1.value.length < 6) { toast('6 caractères minimum', true); return }
  if (pwd1.value !== pwd2.value) { toast('Les deux mots de passe diffèrent', true); return }
  savingPwd.value = true
  try {
    await auth.updatePassword(pwd1.value)
    auth.passwordRecovery = false
    toast('Mot de passe modifié')
    pwdOpen.value = false; pwd1.value = ''; pwd2.value = ''
  } catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
  finally { savingPwd.value = false }
}

// --- Notifications (préférence locale à l'appareil) --------------------------
const NOTIF_KEY = 'fissa-notif-alertes'
const notifAlerts = ref(localStorage.getItem(NOTIF_KEY) !== 'off')
function toggleNotif() {
  notifAlerts.value = !notifAlerts.value
  localStorage.setItem(NOTIF_KEY, notifAlerts.value ? 'on' : 'off')
  toast(notifAlerts.value ? 'Alertes de stock activées' : 'Alertes de stock désactivées')
}

onMounted(() => {
  // Arrivée depuis un lien de réinitialisation : ouvre directement le formulaire
  if (route.query.reset === '1' || auth.passwordRecovery) pwdOpen.value = true
})

async function logout() {
  await auth.logout()
  void router.push('/login')
}
</script>

<template>
  <div class="max-w-[560px] mx-auto space-y-3">
    <div class="hidden lg:block">
      <h1 class="page-title">Profil</h1>
      <p class="page-subtitle">Compte connecté et préférences</p>
    </div>

    <!-- Identité -->
    <div class="card p-6 text-center">
      <span class="mx-auto w-20 h-20 rounded-full bg-sidebar text-brand text-2xl font-bold flex items-center justify-center">{{ initials }}</span>
      <div class="text-lg font-bold text-gray-900 mt-3">{{ auth.currentUser?.name || 'Compte' }}</div>
      <div class="text-[13px] text-gray-500">{{ auth.email }}</div>
      <span class="badge mt-2" :class="auth.isAdmin ? 'badge-violet' : 'badge-green'"><AppIcon name="shield" class="w-3 h-3" /> {{ auth.isAdmin ? 'Administrateur' : 'Utilisateur' }}</span>
      <div v-if="!auth.isAdmin" class="flex flex-wrap justify-center gap-1.5 mt-2">
        <span v-if="auth.hasPerm('magasinier')" class="badge badge-blue">Magasinier</span>
        <span v-if="auth.hasPerm('vendeur')" class="badge badge-green">Vendeur</span>
        <span v-if="auth.hasPerm('historique')" class="badge badge-amber">Historique</span>
      </div>
    </div>

    <!-- Espace de travail -->
    <div class="card p-1.5 flex text-[13px] font-semibold">
      <button class="flex-1 py-2.5 rounded-lg transition-colors" :class="modeStore.mode === 'piece' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchMode('piece')">Pièce</button>
      <button class="flex-1 py-2.5 rounded-lg transition-colors" :class="modeStore.mode === 'mecanique' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchMode('mecanique')">Mécanique</button>
    </div>

    <!-- Réglages -->
    <div class="space-y-2">
      <button class="menu-row w-full text-left" @click="openInfo"><AppIcon name="edit" class="w-5 h-5 text-gray-500" /> <span class="flex-1">Modifier les informations</span><AppIcon name="chevron-right" class="w-4 h-4 text-gray-400" /></button>
      <button class="menu-row w-full text-left" @click="pwdOpen = true"><AppIcon name="lock" class="w-5 h-5 text-gray-500" /> <span class="flex-1">Changer le mot de passe</span><AppIcon name="chevron-right" class="w-4 h-4 text-gray-400" /></button>
      <button class="menu-row w-full text-left" @click="toggleNotif"><AppIcon name="bell" class="w-5 h-5 text-gray-500" /> <span class="flex-1">Notifications <span class="block text-[11px] font-normal text-gray-500">Alertes de stock dans l'application</span></span><span class="toggle" :data-on="notifAlerts"><span></span></span></button>
    </div>

    <button class="card w-full px-4 py-3.5 flex items-center justify-center gap-2 text-[14px] font-semibold text-red-600 hover:bg-red-50" @click="logout"><AppIcon name="log-out" class="w-5 h-5" /> Se déconnecter</button>

    <!-- Modales -->
    <BaseModal title="Modifier les informations" :open="infoOpen" @close="infoOpen = false" max-width="400px">
      <div class="flex flex-col gap-1"><label class="label">Nom affiché</label><input v-model="name" class="input" placeholder="Prénom Nom"></div>
      <div class="flex flex-col gap-1 mt-3"><label class="label">E-mail</label><input :value="auth.email" class="input" disabled></div>
      <p class="text-[11px] text-gray-500 mt-1">L'e-mail de connexion ne peut pas être modifié ici.</p>
      <div class="flex gap-2 mt-4 justify-end"><button class="btn btn-secondary" @click="infoOpen = false">Annuler</button><button class="btn btn-primary" :disabled="savingInfo" @click="saveInfo">Enregistrer</button></div>
    </BaseModal>

    <BaseModal title="Changer le mot de passe" :open="pwdOpen" @close="pwdOpen = false" max-width="400px">
      <div class="flex flex-col gap-1">
        <label class="label">Nouveau mot de passe</label>
        <div class="relative">
          <input v-model="pwd1" :type="showPwd ? 'text' : 'password'" class="input pr-10" autocomplete="new-password" placeholder="6 caractères minimum">
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 icon-btn" @click="showPwd = !showPwd" aria-label="Afficher"><AppIcon :name="showPwd ? 'eye-off' : 'eye'" class="w-4 h-4" /></button>
        </div>
      </div>
      <div class="flex flex-col gap-1 mt-3"><label class="label">Confirmer</label><input v-model="pwd2" :type="showPwd ? 'text' : 'password'" class="input" autocomplete="new-password"></div>
      <div class="flex gap-2 mt-4 justify-end"><button class="btn btn-secondary" @click="pwdOpen = false">Annuler</button><button class="btn btn-primary" :disabled="savingPwd" @click="savePwd">Enregistrer</button></div>
    </BaseModal>
  </div>
</template>
