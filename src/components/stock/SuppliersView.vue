<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSuppliersStore } from '@/stores/suppliers'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { Supplier } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ImportCatalogModal from '@/components/stock/ImportCatalogModal.vue'

/** Paramétrage des fournisseurs de pièces neuves (administrateur). */
const suppliers = useSuppliersStore()
const auth = useAuthStore()
const { toast } = useToast()

const open = ref(false)
const editing = ref<Supplier | null>(null)
const form = ref({ name: '', website: '', phone: '', notes: '', searchUrl: '' })
const canImport = computed(() => auth.isAdmin || auth.hasPerm('magasinier'))
const importOpen = ref(false)
const importSupplier = ref<Supplier | null>(null)
function openImport(s: Supplier) { importSupplier.value = s; importOpen.value = true }
function fmtDate(iso: string | null) { return iso ? new Date(iso).toLocaleDateString('fr-FR') : '' }
const saving = ref(false)

function openNew() { editing.value = null; form.value = { name: '', website: '', phone: '', notes: '', searchUrl: '' }; open.value = true }
function openEdit(s: Supplier) { editing.value = s; form.value = { name: s.name, website: s.website, phone: s.phone, notes: s.notes, searchUrl: s.searchUrl }; open.value = true }

async function save() {
  if (!form.value.name.trim()) { toast('Le nom est requis', true); return }
  saving.value = true
  try {
    if (editing.value) await suppliers.update(editing.value.id, { ...form.value })
    else { const s = await suppliers.add(form.value.name, { website: form.value.website, phone: form.value.phone, notes: form.value.notes }); if (form.value.searchUrl.trim()) await suppliers.update(s.id, { searchUrl: form.value.searchUrl }) }
    open.value = false
    toast(editing.value ? 'Fournisseur mis à jour' : 'Fournisseur ajouté')
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), true)
  } finally {
    saving.value = false
  }
}
async function toggleArchive(s: Supplier) {
  try { await suppliers.update(s.id, { archived: !s.archived }); toast(s.archived ? 'Fournisseur réactivé' : 'Fournisseur archivé') }
  catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
}
async function remove(s: Supplier) {
  if (suppliers.usage(s.name) > 0) { toast('Des pièces sont rattachées à ce fournisseur : archivez-le plutôt', true); return }
  if (!confirm(`Supprimer « ${s.name} » ?`)) return
  try { await suppliers.remove(s.id); toast('Fournisseur supprimé') }
  catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
}
function siteHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : 'https://' + url
}
</script>

<template>
  <div class="max-w-[760px] mx-auto space-y-3">
    <div class="hidden lg:flex items-center gap-3">
      <router-link to="/profil" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour"><AppIcon name="arrow-left" class="w-4 h-4" /></router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Fournisseurs</h1>
        <p class="page-subtitle">Grossistes et sites chez qui vous achetez les pièces neuves</p>
      </div>
      <button v-if="auth.isAdmin" class="btn btn-primary" @click="openNew"><AppIcon name="plus" class="w-4 h-4" /> Ajouter</button>
    </div>
    <button v-if="auth.isAdmin" class="btn btn-primary w-full lg:hidden" @click="openNew"><AppIcon name="plus" class="w-4 h-4" /> Ajouter un fournisseur</button>

    <div v-if="!suppliers.items.length" class="card text-center py-12 text-gray-500 text-sm">
      Aucun fournisseur. Ils s'ajoutent ici ou à la volée depuis le formulaire de référencement d'une pièce neuve.
    </div>
    <div v-else class="space-y-2">
      <div v-for="s in suppliers.items" :key="s.id" class="card p-3 flex items-center gap-3" :class="{ 'opacity-50': s.archived }">
        <span class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><AppIcon name="store" class="w-5 h-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="text-[14px] font-semibold text-gray-900 truncate">{{ s.name }} <span v-if="s.archived" class="badge badge-gray ml-1">Archivé</span></div>
          <div class="text-[12px] text-gray-500 truncate">
            {{ suppliers.usage(s.name) }} pièce{{ suppliers.usage(s.name) > 1 ? 's' : '' }}
            <template v-if="s.phone"> · {{ s.phone }}</template>
            <template v-if="s.website"> · <a :href="siteHref(s.website)" target="_blank" rel="noopener" class="text-blue-600 hover:underline">{{ s.website }}</a></template>
          </div>
          <div v-if="s.notes" class="text-[11px] text-gray-500 truncate">{{ s.notes }}</div>
          <div class="text-[11px] mt-0.5" :class="suppliers.catalogCounts[s.id] ? 'text-green-700' : 'text-gray-400'">
            <template v-if="suppliers.catalogCounts[s.id]">Tarif : {{ suppliers.catalogCounts[s.id]!.toLocaleString('fr-FR') }} références<span v-if="s.catalogImportedAt"> · importé le {{ fmtDate(s.catalogImportedAt) }}</span></template>
            <template v-else>Aucun tarif importé</template>
          </div>
        </div>
        <div class="flex gap-0.5 shrink-0">
          <button v-if="canImport && !s.archived" class="btn btn-secondary btn-sm" title="Importer le fichier tarif (Excel / CSV)" @click="openImport(s)"><AppIcon name="upload" class="w-4 h-4" /> <span class="hidden sm:inline">Tarif</span></button>
          <button v-if="auth.isAdmin" class="icon-btn" title="Modifier" @click="openEdit(s)"><AppIcon name="edit" class="w-4 h-4" /></button>
          <button v-if="auth.isAdmin" class="icon-btn" :title="s.archived ? 'Réactiver' : 'Archiver'" @click="toggleArchive(s)"><AppIcon :name="s.archived ? 'refresh' : 'box'" class="w-4 h-4" /></button>
          <button v-if="auth.isAdmin" class="icon-btn icon-btn-danger" title="Supprimer" @click="remove(s)"><AppIcon name="trash" class="w-4 h-4" /></button>
        </div>
      </div>
    </div>

    <BaseModal :title="editing ? 'Modifier ' + editing.name : 'Nouveau fournisseur'" :open="open" @close="open = false" max-width="440px">
      <div class="space-y-2">
        <div class="flex flex-col gap-1"><label class="label">Nom <span class="text-red-500">*</span></label><input v-model="form.name" class="input" placeholder="Ex : Autodistribution, Oscaro Pro…"></div>
        <div class="flex flex-col gap-1"><label class="label">Site web</label><input v-model="form.website" class="input" placeholder="www.exemple.fr"></div>
        <div class="flex flex-col gap-1"><label class="label">Téléphone</label><input v-model="form.phone" class="input" inputmode="tel"></div>
        <div class="flex flex-col gap-1"><label class="label">Lien de recherche</label><input v-model="form.searchUrl" class="input font-mono text-[12px]" placeholder="https://mymga.fr/AfficherProduit?Refs={ref}"><span class="text-[11px] text-gray-500">Ouvre la recherche du site fournisseur depuis l'écran Disponibilité ; <code>{ref}</code> est remplacé par la référence.</span></div>
        <div class="flex flex-col gap-1"><label class="label">Notes</label><textarea v-model="form.notes" rows="2" class="input" placeholder="Compte client, conditions, contact…"></textarea></div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-secondary" @click="open = false">Annuler</button>
        <button class="btn btn-primary" :disabled="saving" @click="save"><AppIcon name="check" class="w-4 h-4" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
      </div>
    </BaseModal>
    <ImportCatalogModal :supplier="importSupplier" :open="importOpen" @close="importOpen = false" />
  </div>
</template>
