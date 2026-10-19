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
  <div class="card p-5">
    <div class="card-title">Comptes utilisateurs</div>

    <div v-for="u in users.users" :key="u._id" class="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2">
      <div class="flex items-center gap-2.5 mb-2">
        <div class="w-9 h-9 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center font-bold text-sm text-amber-600">
          {{ (u.name || '?')[0].toUpperCase() }}
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold">{{ u.name }}</div>
          <div class="text-[11px] text-gray-500">{{ u.role === 'admin' ? 'Administrateur' : 'Utilisateur' }}</div>
        </div>
        <div v-if="u.role !== 'admin'" class="flex gap-1">
          <button @click="openEdit(u)" class="icon-btn icon-btn-brand">✏</button>
          <button @click="handleDelete(u)" class="icon-btn icon-btn-danger">✕</button>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span v-if="u.role === 'admin'" class="text-[10px] px-2 py-0.5 rounded font-semibold bg-violet-50 text-violet-600 border border-violet-200">Accès total</span>
        <span v-if="u.perms?.magasinier" class="text-[10px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-600 border border-blue-200">Magasinier</span>
        <span v-if="u.perms?.vendeur" class="text-[10px] px-2 py-0.5 rounded font-semibold bg-green-50 text-green-600 border border-green-200">Vendeur</span>
        <span v-if="u.perms?.historique" class="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-600 border border-amber-200">Historique</span>
      </div>
    </div>

    <button @click="createOpen = true" class="btn btn-primary">Créer un compte</button>

    <!-- Create modal -->
    <BaseModal title="Créer un compte" :open="createOpen" @close="createOpen = false">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1"><label class="label">Identifiant</label><input v-model="newUser.id" placeholder="jean.dupont" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Prénom / Nom</label><input v-model="newUser.name" placeholder="Jean Dupont" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Mot de passe</label><input v-model="newUser.pwd" type="password" placeholder="6 caractères min." class="input"></div>
        <div class="text-[12px] font-semibold text-gray-700 mt-2">Permissions</div>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="newUser.magasinier" class="accent-amber-500"><div><strong class="text-xs">Magasinier</strong><div class="text-[11px] text-gray-500">Ajouter et modifier des pièces</div></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="newUser.vendeur" class="accent-amber-500"><div><strong class="text-xs">Vendeur</strong><div class="text-[11px] text-gray-500">Scanner et enregistrer des ventes</div></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="newUser.historique" class="accent-amber-500"><div><strong class="text-xs">Historique</strong><div class="text-[11px] text-gray-500">Consulter son historique</div></div></label>
      </div>
      <div class="flex gap-2 mt-4">
        <button @click="handleCreate" class="btn btn-primary">Créer</button>
        <button @click="createOpen = false" class="btn btn-secondary">Annuler</button>
      </div>
    </BaseModal>

    <!-- Edit modal -->
    <BaseModal title="✏ Modifier le compte" :open="editOpen" @close="editOpen = false">
      <div class="text-sm font-bold mb-3">{{ editName }}</div>
      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1"><label class="label">Nouveau mot de passe (optionnel)</label><input v-model="editPwd" type="password" placeholder="Laisser vide = inchangé" class="input"></div>
        <div class="text-[12px] font-semibold text-gray-700 mt-1">Permissions</div>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="editPerms.magasinier" class="accent-amber-500"><div><strong class="text-xs">Magasinier</strong></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="editPerms.vendeur" class="accent-amber-500"><div><strong class="text-xs">Vendeur</strong></div></label>
        <label class="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg border border-gray-200 cursor-pointer"><input type="checkbox" v-model="editPerms.historique" class="accent-amber-500"><div><strong class="text-xs">Historique</strong></div></label>
      </div>
      <div class="flex gap-2 mt-4">
        <button @click="handleSaveEdit" class="btn btn-primary">Enregistrer</button>
        <button @click="editOpen = false" class="btn btn-secondary">Annuler</button>
      </div>
    </BaseModal>
  </div>
</template>
