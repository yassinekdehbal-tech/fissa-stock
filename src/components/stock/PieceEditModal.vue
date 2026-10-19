<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PhotoUploadField from '@/components/ui/PhotoUploadField.vue'
import type { Piece, PieceCategory, PieceSource, PieceState } from '@/types'
import { sanitize } from '@/utils/security'

/** Modification d'une pièce (utilisée par le stock et la fiche produit). */
const props = defineProps<{ piece: Piece | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const stock = useStockStore()
const { toast } = useToast()
const saving = ref(false)

const form = ref({
  name: '', cat: '' as PieceCategory, vehicle: '', oem: '', supplier: '', donor: '', source: 'autre' as PieceSource,
  qty: 0, threshold: 0, price: 0, zone: '', etat: 'Bon état' as PieceState, compat: '', photo: '', notes: '', publishable: false,
})

watch(() => [props.open, props.piece?._id], () => {
  const p = props.piece
  if (!props.open || !p) return
  form.value = {
    name: p.name, cat: p.cat, vehicle: p.vehicle, oem: p.oem, supplier: p.supplier, donor: p.donor, source: p.source || 'autre',
    qty: p.qty, threshold: p.threshold || 0, price: p.price, zone: p.zone, etat: p.etat, compat: p.compat, photo: p.photo, notes: p.notes,
    publishable: !!p.publishable,
  }
}, { immediate: true })

async function save() {
  if (!props.piece?._id) return
  if (!form.value.name.trim()) { toast('La désignation est requise', true); return }
  saving.value = true
  try {
    await stock.updatePiece(props.piece._id, {
      name: sanitize(form.value.name.trim()),
      cat: form.value.cat,
      vehicle: sanitize(form.value.vehicle.trim()),
      oem: sanitize(form.value.oem.trim()),
      supplier: sanitize(form.value.supplier.trim()),
      donor: sanitize(form.value.donor.trim()),
      source: form.value.source,
      qty: form.value.qty,
      threshold: form.value.threshold || undefined,
      price: form.value.price,
      zone: sanitize(form.value.zone.trim()),
      etat: form.value.etat,
      compat: sanitize(form.value.compat.trim()),
      photo: form.value.photo,
      notes: sanitize(form.value.notes.trim()),
      publishable: form.value.publishable,
    })
    toast('Pièce mise à jour')
    emit('saved')
    emit('close')
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :title="piece ? 'Modifier ' + piece.ref : 'Modifier la pièce'" :open="open" @close="emit('close')" max-width="560px">
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-1 col-span-2"><label class="label">Désignation</label><input v-model="form.name" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Catégorie</label><select v-model="form.cat" class="input"><option value="">—</option><option value="moteur">Moteur</option><option value="carrosserie">Carrosserie</option><option value="train-avant">Train avant</option><option value="train-arriere">Train arrière</option><option value="electronique">Électricité</option><option value="autre">Autre</option></select></div>
      <div class="flex flex-col gap-1"><label class="label">État</label><select v-model="form.etat" class="input"><option>Très bon état</option><option>Bon état</option><option>État moyen</option><option>Pour pièces</option></select></div>
      <div class="flex flex-col gap-1"><label class="label">Véhicule</label><input v-model="form.vehicle" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">N° OEM</label><input v-model="form.oem" class="input font-mono"></div>
      <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="form.qty" type="number" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Seuil d'alerte</label><input v-model.number="form.threshold" type="number" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Prix de vente (€)</label><input v-model.number="form.price" type="number" step="0.01" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Zone</label><input v-model="form.zone" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Fournisseur</label><input v-model="form.supplier" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Véhicule donneur</label><input v-model="form.donor" class="input"></div>
      <div class="flex flex-col gap-1 col-span-2"><label class="label">Provenance</label><select v-model="form.source" class="input"><option value="demontage">Démontage</option><option value="don">Don</option><option value="lot-occasion">Lot d'occasion</option><option value="grossiste-neuf">Grossiste neuf</option><option value="web">Web</option><option value="autre">Autre</option></select></div>
      <div class="col-span-2 flex flex-col gap-1"><label class="label">Compatibilités</label><input v-model="form.compat" class="input"></div>
      <div class="col-span-2 flex flex-col gap-1"><label class="label">Notes</label><textarea v-model="form.notes" rows="2" class="input"></textarea></div>
      <div class="col-span-2"><PhotoUploadField v-model="form.photo" /></div>
      <label class="col-span-2 flex items-center gap-3 cursor-pointer select-none">
        <button type="button" class="toggle" :data-on="form.publishable" @click="form.publishable = !form.publishable" aria-label="Visible sur la boutique"><span></span></button>
        <span class="text-[13px] text-gray-700">Visible sur la boutique en ligne</span>
      </label>
    </div>
    <div class="flex gap-2 mt-4 justify-end">
      <button @click="emit('close')" class="btn btn-secondary">Annuler</button>
      <button @click="save" :disabled="saving" class="btn btn-primary"><AppIcon name="check" class="w-4 h-4" /> {{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
    </div>
  </BaseModal>
</template>
