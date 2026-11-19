<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSuppliersStore } from '@/stores/suppliers'
import { normalizeLabel } from '@/stores/subcategories'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Choix du fournisseur d'une pièce neuve : puces des fournisseurs enregistrés
 * + saisie libre, enregistrable dans la liste (admin ou magasinier).
 */
const props = defineProps<{ modelValue: string; canAdd?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const suppliers = useSuppliersStore()
const { toast } = useToast()
const free = ref('')
const adding = ref(false)

const selectedKey = computed(() => normalizeLabel(props.modelValue || ''))
const isFree = computed(() => !!props.modelValue && !suppliers.items.some((s) => normalizeLabel(s.name) === selectedKey.value))

watch(() => props.modelValue, (v) => { if (!v) free.value = '' })

function pick(name: string) {
  emit('update:modelValue', selectedKey.value === normalizeLabel(name) ? '' : name)
}
function applyFree() {
  const v = free.value.replace(/\s+/g, ' ').trim()
  if (!v) return
  const known = suppliers.byName(v)
  emit('update:modelValue', known ? known.name : v)
}
async function saveFree() {
  const v = (props.modelValue || free.value).replace(/\s+/g, ' ').trim()
  if (!v) return
  adding.value = true
  try {
    const s = await suppliers.add(v)
    emit('update:modelValue', s.name)
    free.value = ''
    toast(`« ${s.name} » ajouté aux fournisseurs`)
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), true)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="suppliers.active.length" class="flex flex-wrap gap-1.5">
      <button v-for="s in suppliers.active" :key="s.id" type="button" class="chip" :class="selectedKey === normalizeLabel(s.name) ? 'chip-on' : ''" :aria-pressed="selectedKey === normalizeLabel(s.name)" @click="pick(s.name)">{{ s.name }}</button>
    </div>
    <div class="flex gap-1.5">
      <input v-model="free" class="input flex-1" :placeholder="suppliers.active.length ? 'Autre fournisseur…' : 'Nom du grossiste, du site…'" autocapitalize="words" @keydown.enter.prevent="applyFree" @blur="applyFree">
      <button v-if="canAdd && (isFree || free.trim())" type="button" class="btn btn-secondary whitespace-nowrap" :disabled="adding" @click="saveFree" title="Enregistrer dans la liste pour les prochaines pièces"><AppIcon name="plus" class="w-4 h-4" /> Dans la liste</button>
    </div>
    <div v-if="modelValue" class="text-[12px] text-gray-700">Fournisseur : <strong class="text-gray-900">{{ modelValue }}</strong><span v-if="isFree" class="text-gray-500"> (saisie libre)</span></div>
  </div>
</template>
