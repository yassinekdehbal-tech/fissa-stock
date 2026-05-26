<script setup lang="ts">
import { ref } from 'vue'
import { useUsersStore } from '@/stores/users'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import type { UserPermissions } from '@/types'

const users = useUsersStore()
const { toast } = useToast()

// Create user
const createOpen = ref(false)
const newUser = ref({ id: '', name: '', pwd: '', magasinier: false, vendeur: false, historique: false })

async function handleCreate() {
  const { id, name, pwd, magasinier, vendeur, historique } = newUser.value
  if (!id || !name || !pwd) { toast('Remplissez tous les champs', true); return }
  if (pwd.length < 6) { toast('Mot de passe trop court (6 min.)', true); return }
  const perms: UserPermissions = { magasinier, vendeur, historique }
  const ok = await users.createUser(id, name, pwd, perms)
  if (!ok) { toast('Identifiant déjà utilisé', true); return }
  createOpen.value = false
  newUser.value = { id: '', name: '', pwd: '', magasinier: false, vendeur: false, historique: false }
  toast('✓ Compte créé pour ' + name)
}

// Edit user
const editOpen = ref(false)
const editId = ref('')
const editName = ref('')
const editPerms = ref<UserPermissions>({})
const editPwd = ref('')

function openEdit(u: any) {
  editId.value = u._id
  editName.value = u.name + ' (' + u.id + ')'
  editPerms.value = { ...u.perms }
  editPwd.value = ''
  editOpen.value = true
}

async function handleSaveEdit() {
  if (editPwd.value && editPwd.value.length < 6) { toast('Mot de passe trop court', true); return }
  await users.updateUser(editId.value, editPerms.value, editPwd.value || undefined)
  editOpen.value = false
  toast('Compte mis à jour')
}

async function handleDelete(u: any) {
  if (!confirm('Supprimer ' + u.name + ' ?')) return
  await users.deleteUser(u._id)
  toast('Compte supprimé')
}
</script>

<template>
  <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
    <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">Comptes utilisateurs</div>

    <div v-for="u in users.users" :key="u._id" class="bg-[#21262d] border border-[#30363d] rounded-lg p-3 mb-2">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-9 h-9 rounded-full bg-[#161b22] border-2 border-[#30363d] flex items-center justify-center font-mono font-bold text-sm text-[#e6a817]">
          {{ (u.name || '?')[0].toUpperCase() }}
        </div>
        <div class="flex-1">
          <div class="font-mono text-sm font-semibold">{{ u.name }}</div>
          <div class="text-[11px] text-[#8b949e] font-mono">{{ u.id }} · {{ u.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}</div>
        </div>
        <div v-if="u.role !== 'admin'" class="flex gap-1">
          <button @click="openEdit(u)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-[#e6a817] hover:text-[#e6a817] transition-colors">✏</button>
          <button @click="handleDelete(u)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-red-400 hover:text-red-400 transition-colors">✕</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span v-if="u.role === 'admin'" class="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-purple-400/20 text-purple-400 border border-purple-400/30">👑 Accès total</span>
        <span v-if="u.perms?.magasinier" class="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-blue-400/15 text-blue-400 border border-blue-400/30">📦 Magasinier</span>
        <span v-if="u.perms?.vendeur" class="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-green-500/15 text-green-400 border border-green-500/30">💰 Vendeur</span>
        <span v-if="u.perms?.historique" class="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-[#e6a817]/15 text-[#e6a817] border border-[#e6a817]/30">📋 Historique</span>
      </div>
    </div>

    <button @click="createOpen = true" class="mt-3 bg-[#bc8cff] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">＋ Créer un compte</button>

    <!-- Create modal -->
    <BaseModal title="👤 Créer un compte" :open="createOpen" @close="createOpen = false">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Identifiant</label><input v-model="newUser.id" placeholder="jean.dupont" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prénom / Nom</label><input v-model="newUser.name" placeholder="Jean Dupont" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Mot de passe</label><input v-model="newUser.pwd" type="password" placeholder="6 caractères min." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="font-mono text-[11px] text-[#e6a817] uppercase mt-2">Permissions</div>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="newUser.magasinier" class="accent-[#e6a817]"><div><strong class="text-xs">📦 Magasinier</strong><div class="text-[11px] text-[#8b949e]">Ajouter et modifier des pièces</div></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="newUser.vendeur" class="accent-[#e6a817]"><div><strong class="text-xs">💰 Vendeur</strong><div class="text-[11px] text-[#8b949e]">Scanner et enregistrer des ventes</div></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="newUser.historique" class="accent-[#e6a817]"><div><strong class="text-xs">📋 Historique</strong><div class="text-[11px] text-[#8b949e]">Consulter son historique</div></div></label>
      </div>
      <div class="flex gap-2 mt-4">
        <button @click="handleCreate" class="bg-[#bc8cff] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">Créer</button>
        <button @click="createOpen = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase">Annuler</button>
      </div>
    </BaseModal>

    <!-- Edit modal -->
    <BaseModal title="✏ Modifier le compte" :open="editOpen" @close="editOpen = false">
      <div class="font-mono text-sm font-bold mb-3">{{ editName }}</div>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Nouveau mot de passe (optionnel)</label><input v-model="editPwd" type="password" placeholder="Laisser vide = inchangé" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="font-mono text-[11px] text-[#e6a817] uppercase mt-1">Permissions</div>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="editPerms.magasinier" class="accent-[#e6a817]"><div><strong class="text-xs">📦 Magasinier</strong></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="editPerms.vendeur" class="accent-[#e6a817]"><div><strong class="text-xs">💰 Vendeur</strong></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-[#21262d] rounded-lg border border-[#30363d] cursor-pointer"><input type="checkbox" v-model="editPerms.historique" class="accent-[#e6a817]"><div><strong class="text-xs">📋 Historique</strong></div></label>
      </div>
      <div class="flex gap-2 mt-4">
        <button @click="handleSaveEdit" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">Enregistrer</button>
        <button @click="editOpen = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase">Annuler</button>
      </div>
    </BaseModal>
  </div>
</template>
