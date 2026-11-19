<script setup lang="ts">
import { ref, watch } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useCategoriesStore } from '@/stores/categories'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import PhotoGalleryField from '@/components/ui/PhotoGalleryField.vue'
import SubcategoryPicker from '@/components/stock/SubcategoryPicker.vue'
import SupplierPicker from '@/components/stock/SupplierPicker.vue'
import { useAuthStore } from '@/stores/auth'
import type { Piece, PieceCategory, PieceCondition, PieceSource, PieceState } from '@/types'
import { SOURCES_BY_CONDITION, SOURCE_LABELS, PHOTO_SLOTS } from '@/types'
import { computed } from 'vue'
import { sanitize } from '@/utils/security'

/** Modification d'une pièce (utilisée par le stock et la fiche produit). */
const props = defineProps<{ piece: Piece | null; open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const stock = useStockStore()
const cats = useCategoriesStore()
const auth = useAuthStore()
const { toast } = useToast()
const saving = ref(false)

const form = ref({
  name: '', cat: '' as PieceCategory, subcat: '', vehicle: '', oem: '', supplierRef: '', ean: '', supplier: '', donor: '', source: 'autre' as PieceSource,
  condition: 'occasion' as PieceCondition,
  qty: 0, threshold: 0, price: 0, zone: '', etat: 'Bon état' as PieceState, compat: '', photos: [] as string[], notes: '', publishable: false,
})
const sourceOptions = computed(() => {
  const list = SOURCES_BY_CONDITION[form.value.condition]
  return list.includes(form.value.source) ? list : [...list, form.value.source]
})
const photoSlots = computed(() => PHOTO_SLOTS[form.value.condition])
const galleryRef = ref<InstanceType<typeof PhotoGalleryField> | null>(null)
function setCondition(c: PieceCondition) {
  if (form.value.condition === c) return
  form.value.condition = c
  if (!SOURCES_BY_CONDITION[c].includes(form.value.source)) form.value.source = c === 'neuve' ? 'grossiste-neuf' : 'demontage'
  if (c === 'neuve') form.value.etat = 'Neuf'
  else if (form.value.etat === 'Neuf') form.value.etat = 'Bon état'
}

watch(() => [props.open, props.piece?._id], () => {
  const p = props.piece
  if (!props.open || !p) return
  form.value = {
    name: p.name, cat: p.cat, subcat: p.subcat || '', vehicle: p.vehicle, oem: p.oem, supplierRef: p.supplierRef || '', ean: p.ean || '',
    supplier: p.supplier, donor: p.donor, source: p.source || 'autre', condition: p.condition || 'occasion',
    qty: p.qty, threshold: p.threshold || 0, price: p.price, zone: p.zone, etat: p.etat, compat: p.compat,
    photos: p.photos?.length ? [...p.photos] : p.photo ? [p.photo] : [], notes: p.notes,
    publishable: !!p.publishable,
  }
}, { immediate: true })

async function save() {
  if (!props.piece?._id) return
  if (!form.value.name.trim()) { toast('La désignation est requise', true); return }
  if (form.value.condition === 'neuve' && !form.value.supplier.trim()) { toast('Indiquez le fournisseur de la pièce neuve', true); return }
  const photos = form.value.photos.map(u => u.trim()).filter(Boolean)
  const photoError = await galleryRef.value?.validate()
  if (photoError) { toast((form.value.condition === 'occasion' ? "Pièce d'occasion : " : '') + photoError, true); return }
  saving.value = true
  try {
    await stock.updatePiece(props.piece._id, {
      name: sanitize(form.value.name.trim()),
      cat: form.value.cat,
      subcat: sanitize(form.value.subcat.trim()),
      vehicle: sanitize(form.value.vehicle.trim()),
      oem: sanitize(form.value.oem.trim()),
      supplierRef: sanitize(form.value.supplierRef.trim()),
      ean: sanitize(form.value.ean.trim()),
      supplier: sanitize(form.value.supplier.trim()),
      donor: form.value.condition === 'neuve' ? '' : sanitize(form.value.donor.trim()),
      source: form.value.source,
      condition: form.value.condition,
      qty: form.value.qty,
      threshold: form.value.threshold || 0,
      price: form.value.price,
      zone: sanitize(form.value.zone.trim()),
      etat: form.value.condition === 'neuve' ? 'Neuf' : form.value.etat,
      compat: sanitize(form.value.compat.trim()),
      photos,
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
      <div class="col-span-2 flex rounded-xl bg-gray-100 p-1 text-[13px] font-semibold">
        <button type="button" class="flex-1 py-2 rounded-lg transition-colors" :class="form.condition === 'neuve' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="setCondition('neuve')">NEUVE</button>
        <button type="button" class="flex-1 py-2 rounded-lg transition-colors" :class="form.condition === 'occasion' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="setCondition('occasion')">OCCASION</button>
      </div>
      <div class="flex flex-col gap-1 col-span-2"><label class="label">Désignation</label><input v-model="form.name" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Catégorie</label><select v-model="form.cat" class="input"><option value="">—</option><option v-for="c in cats.categories.filter((c) => !c.archived || c.key === form.cat)" :key="c.key" :value="c.key">{{ c.label }}{{ c.archived ? ' (archivée)' : '' }}</option></select></div>
      <div v-if="form.cat" class="flex flex-col gap-1 col-span-2"><label class="label">Sous-catégorie</label><SubcategoryPicker v-model="form.subcat" :cat="form.cat" :can-add="auth.hasPerm('magasinier')" /></div>
      <div class="flex flex-col gap-1"><label class="label">État</label><select v-model="form.etat" class="input" :disabled="form.condition === 'neuve'"><option v-if="form.condition === 'neuve'">Neuf</option><option>Très bon état</option><option>Bon état</option><option>État moyen</option><option>Pour pièces</option></select></div>
      <div class="flex flex-col gap-1"><label class="label">Véhicule(s) compatible(s)</label><input v-model="form.vehicle" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">N° OEM</label><input v-model="form.oem" class="input font-mono"></div>
      <div class="flex flex-col gap-1"><label class="label">Réf. fournisseur</label><input v-model="form.supplierRef" class="input font-mono"></div>
      <div class="flex flex-col gap-1"><label class="label">Code-barres (EAN)</label><input v-model="form.ean" class="input font-mono" inputmode="numeric"></div>
      <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="form.qty" type="number" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Seuil d'alerte</label><input v-model.number="form.threshold" type="number" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Prix de vente (€)</label><input v-model.number="form.price" type="number" step="0.01" min="0" class="input"></div>
      <div class="flex flex-col gap-1"><label class="label">Zone</label><input v-model="form.zone" class="input"></div>
      <div class="flex flex-col gap-1 col-span-2"><label class="label">Provenance</label><select v-model="form.source" class="input"><option v-for="k in sourceOptions" :key="k" :value="k">{{ SOURCE_LABELS[k] }}</option></select></div>
      <div v-if="form.condition === 'neuve'" class="col-span-2 flex flex-col gap-1"><label class="label">Fournisseur <span class="text-red-500">*</span></label><SupplierPicker v-model="form.supplier" :can-add="auth.hasPerm('magasinier') || auth.isAdmin" /></div>
      <div v-else-if="form.source === 'demontage'" class="col-span-2 flex flex-col gap-1"><label class="label">Véhicule donneur</label><input v-model="form.donor" class="input" placeholder="Immatriculation ou VIN"></div>
      <div v-else-if="form.source === 'lot-occasion'" class="col-span-2 flex flex-col gap-1"><label class="label">Vendeur du lot</label><input v-model="form.supplier" class="input"></div>
      <div v-if="form.compat" class="col-span-2 flex flex-col gap-1"><label class="label">Compatibilités (ancien champ)</label><input v-model="form.compat" class="input"></div>
      <div class="col-span-2 flex flex-col gap-1"><label class="label">Notes</label><textarea v-model="form.notes" rows="2" class="input"></textarea></div>
      <div class="col-span-2"><PhotoGalleryField ref="galleryRef" v-model="form.photos" :slots="photoSlots" /></div>
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
