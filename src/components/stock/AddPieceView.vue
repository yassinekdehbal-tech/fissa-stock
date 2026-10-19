<script setup lang="ts">
import { ref } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { sanitize } from '@/utils/security'
import type { Piece, PieceCategory, PieceSource, PieceState } from '@/types'
import BarcodeLabelModal from '@/components/stock/BarcodeLabelModal.vue'
import PhotoUploadField from '@/components/ui/PhotoUploadField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const stock = useStockStore()
const history = useHistoryStore()
const auth = useAuthStore()
const { toast } = useToast()

const form = ref({
  ref: '',
  name: '',
  cat: '' as PieceCategory,
  vehicle: '',
  oem: '',
  supplier: '',
  donor: '',
  source: 'autre' as PieceSource,
  qty: 1,
  price: 0,
  threshold: 0,
  zone: '',
  etat: 'Bon état' as PieceState,
  compat: '',
  photo: '',
  notes: '',
  fmt: 'CODE128' as 'CODE128' | 'CODE39',
  publishable: false,
})

function clearForm() {
  form.value = { ref: '', name: '', cat: '', vehicle: '', oem: '', supplier: '', donor: '', source: 'autre', qty: 1, price: 0, threshold: 0, zone: '', etat: 'Bon état', compat: '', photo: '', notes: '', fmt: 'CODE128', publishable: false }
}

const saving = ref(false)

async function submit() {
  const r = form.value.ref.trim().toUpperCase()
  const name = form.value.name.trim()
  if (!r) { toast('La référence est requise', true); return }
  if (!name) { toast('La désignation est requise', true); return }
  if (stock.pieces.find(p => p.ref === r)) { toast('Référence déjà existante', true); return }

  const piece = {
    ref: sanitize(r),
    name: sanitize(name),
    cat: form.value.cat,
    vehicle: sanitize(form.value.vehicle.trim()),
    oem: sanitize(form.value.oem.trim()),
    supplier: sanitize(form.value.supplier.trim()),
    donor: sanitize(form.value.donor.trim()),
    source: form.value.source,
    qty: form.value.qty,
    price: form.value.price,
    threshold: form.value.threshold || undefined,
    zone: sanitize(form.value.zone.trim()),
    etat: form.value.etat,
    compat: sanitize(form.value.compat.trim()),
    photo: form.value.photo.trim(),
    notes: sanitize(form.value.notes.trim()),
    fmt: form.value.fmt,
    added: new Date().toISOString(),
    archived: false,
    publishable: form.value.publishable,
  }

  saving.value = true
  try {
    await stock.addPiece(piece as any)
    await history.addEntry({
      type: 'ajout',
      ref: r,
      name,
      qty: form.value.qty,
      user: auth.currentUser?.name || '',
      ts: Date.now(),
      date: new Date().toLocaleString('fr-FR')
    })
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
    saving.value = false
    return
  }
  saving.value = false

  toast('✓ ' + r + ' enregistré !')
  // Ouvre l'étiquette de la pièce qui vient d'être créée (flux préparateur :
  // référencer → imprimer → coller sur la pièce)
  labelPiece.value = { ...(piece as unknown as Piece) }
  showLabel.value = true
  clearForm()
}

const labelPiece = ref<Piece | null>(null)
const showLabel = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- En-tête -->
    <div class="flex items-center gap-3">
      <router-link to="/stock" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour au stock">
        <AppIcon name="arrow-left" class="w-4 h-4" />
      </router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Ajouter une pièce</h1>
        <p class="page-subtitle">Référencer une nouvelle pièce dans le stock</p>
      </div>
      <router-link to="/stock" class="btn btn-secondary hidden sm:inline-flex">Retour</router-link>
    </div>

    <form @submit.prevent="submit" class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <!-- Informations principales -->
      <div class="card p-5 lg:col-span-3">
        <div class="card-title">Informations principales</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="label">Référence <span class="text-red-500">*</span></label>
            <input v-model="form.ref" placeholder="ALT-PFU-001" class="input font-mono uppercase placeholder:normal-case" autocapitalize="characters">
          </div>
          <div class="flex flex-col gap-1">
            <label class="label">Désignation <span class="text-red-500">*</span></label>
            <input v-model="form.name" placeholder="Alternateur Peugeot 308" class="input">
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="label">Catégorie</label>
            <select v-model="form.cat" class="input">
              <option value="">Non catégorisé</option>
              <option value="moteur">Moteur</option>
              <option value="carrosserie">Carrosserie</option>
              <option value="train-avant">Train avant</option>
              <option value="train-arriere">Train arrière</option>
              <option value="electronique">Électronique</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="label">Véhicule compatible</label>
            <input v-model="form.vehicle" placeholder="Peugeot 308 1.6 HDi" class="input">
          </div>
          <div class="flex flex-col gap-1">
            <label class="label">N° OEM</label>
            <input v-model="form.oem" placeholder="5702.E2" class="input font-mono">
          </div>
          <div class="flex flex-col gap-1">
            <label class="label">Fournisseur</label>
            <input v-model="form.supplier" placeholder="Démontage, grossiste…" class="input">
          </div>
          <div class="flex flex-col gap-1">
            <label class="label">Véhicule donneur</label>
            <input v-model="form.donor" placeholder="Immatriculation ou VIN" class="input">
          </div>
          <div class="flex flex-col gap-1">
            <label class="label">Provenance</label>
            <select v-model="form.source" class="input">
              <option value="demontage">Démontage</option>
              <option value="don">Don</option>
              <option value="lot-occasion">Lot d'occasion</option>
              <option value="grossiste-neuf">Grossiste neuf</option>
              <option value="web">Web</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="label">Compatibilités</label>
            <textarea v-model="form.compat" rows="2" placeholder="ex : Peugeot 208, 308, Citroën C3…" class="input min-h-[64px]"></textarea>
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="label">Format du code-barres</label>
            <select v-model="form.fmt" class="input">
              <option value="CODE128">CODE128 (recommandé)</option>
              <option value="CODE39">CODE39</option>
            </select>
          </div>
          <label class="sm:col-span-2 flex items-center gap-3 pt-1 cursor-pointer select-none">
            <button type="button" class="toggle" :data-on="form.publishable" @click="form.publishable = !form.publishable" aria-label="Visible sur la boutique"><span></span></button>
            <span class="text-[13px] text-gray-700">Visible sur la boutique en ligne <span class="text-gray-400">(diffusable sur les canaux de vente)</span></span>
          </label>
        </div>
      </div>

      <!-- Stock, prix, photo -->
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-5">
          <div class="card-title">Stock et prix</div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="label">Quantité <span class="text-red-500">*</span></label>
              <input v-model.number="form.qty" type="number" min="0" class="input">
            </div>
            <div class="flex flex-col gap-1">
              <label class="label">Seuil d'alerte</label>
              <input v-model.number="form.threshold" type="number" min="0" placeholder="1" class="input">
            </div>
            <div class="flex flex-col gap-1">
              <label class="label">Prix de vente (€) <span class="text-red-500">*</span></label>
              <input v-model.number="form.price" type="number" step="0.01" min="0" placeholder="0.00" class="input">
            </div>
            <div class="flex flex-col gap-1">
              <label class="label">Zone d'emplacement</label>
              <input v-model="form.zone" placeholder="Étagère A3" class="input">
            </div>
            <div class="flex flex-col gap-1 col-span-2">
              <label class="label">État <span class="text-red-500">*</span></label>
              <select v-model="form.etat" class="input">
                <option>Très bon état</option>
                <option>Bon état</option>
                <option>État moyen</option>
                <option>Pour pièces</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <PhotoUploadField v-model="form.photo" />
          <div class="flex flex-col gap-1 mt-4">
            <label class="label">Notes</label>
            <textarea v-model="form.notes" rows="3" placeholder="Remarques…" class="input"></textarea>
          </div>
        </div>

        <div class="flex gap-2 justify-end">
          <button type="button" @click="clearForm" class="btn btn-secondary">Annuler</button>
          <button type="submit" :disabled="saving" class="btn btn-primary">
            <AppIcon name="check" class="w-4 h-4" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </form>
    <BarcodeLabelModal :piece="labelPiece" :open="showLabel" @close="showLabel = false" />
  </div>
</template>
