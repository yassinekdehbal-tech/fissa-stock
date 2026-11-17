<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSubcategoriesStore, normalizeLabel } from '@/stores/subcategories'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Choix rapide d'une sous-catégorie : puces des familles enregistrées pour la
 * catégorie, puis les désignations les plus saisies qui n'y figurent pas, et
 * un champ libre. Une saisie libre peut être enregistrée dans la liste
 * (admin ou magasinier) pour les prochaines pièces.
 */
const props = defineProps<{ cat: string; modelValue: string; canAdd?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; picked: [label: string] }>()

const subs = useSubcategoriesStore()
const { toast } = useToast()
const free = ref('')
const adding = ref(false)

const list = computed(() => subs.forCat(props.cat))
const suggestions = computed(() => subs.suggestions(props.cat))
const selectedKey = computed(() => normalizeLabel(props.modelValue || ''))
/** Vrai quand la valeur courante ne correspond à aucune puce (saisie libre). */
const isFree = computed(() => {
  if (!props.modelValue) return false
  const k = selectedKey.value
  return !list.value.some((s) => normalizeLabel(s.label) === k) && !suggestions.value.some((s) => normalizeLabel(s.label) === k)
})

watch(() => props.cat, () => { free.value = '' })
watch(() => props.modelValue, (v) => { if (!v) free.value = '' })

function pick(label: string) {
  const same = selectedKey.value === normalizeLabel(label)
  emit('update:modelValue', same ? '' : label)
  if (!same) emit('picked', label)
}
function applyFree() {
  const v = free.value.replace(/\s+/g, ' ').trim()
  if (!v) return
  // Si la saisie correspond à une puce existante, on la sélectionne
  const known = list.value.find((s) => normalizeLabel(s.label) === normalizeLabel(v))
  emit('update:modelValue', known ? known.label : v)
  emit('picked', known ? known.label : v)
}
async function saveFree() {
  const v = (props.modelValue || free.value).replace(/\s+/g, ' ').trim()
  if (!v || !props.cat) return
  adding.value = true
  try {
    const s = await subs.add(props.cat, v)
    emit('update:modelValue', s.label)
    free.value = ''
    toast(`« ${s.label} » ajoutée aux sous-catégories`)
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), true)
  } finally {
    adding.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="list.length" class="flex flex-wrap gap-1.5">
      <button v-for="s in list" :key="s.id" type="button" class="chip" :class="selectedKey === normalizeLabel(s.label) ? 'chip-on' : ''" :aria-pressed="selectedKey === normalizeLabel(s.label)" @click="pick(s.label)">{{ s.label }}</button>
    </div>
    <div v-if="suggestions.length" class="space-y-1">
      <div class="text-[11px] text-gray-500">Déjà saisies dans cette catégorie</div>
      <div class="flex flex-wrap gap-1.5">
        <button v-for="s in suggestions" :key="s.label" type="button" class="chip chip-dashed" :class="selectedKey === normalizeLabel(s.label) ? 'chip-on' : ''" :aria-pressed="selectedKey === normalizeLabel(s.label)" @click="pick(s.label)">{{ s.label }} <span class="text-gray-400 font-normal">×{{ s.count }}</span></button>
      </div>
    </div>
    <div class="flex gap-1.5">
      <input v-model="free" class="input flex-1" :placeholder="list.length ? 'Autre sous-catégorie…' : 'Sous-catégorie (ex : Alternateur)'" autocapitalize="sentences" @keydown.enter.prevent="applyFree" @blur="applyFree">
      <button v-if="canAdd && (isFree || free.trim())" type="button" class="btn btn-secondary whitespace-nowrap" :disabled="adding" @click="saveFree" title="Enregistrer dans la liste pour les prochaines pièces"><AppIcon name="plus" class="w-4 h-4" /> Dans la liste</button>
    </div>
    <div v-if="modelValue" class="text-[12px] text-gray-700">Sous-catégorie : <strong class="text-gray-900">{{ modelValue }}</strong><span v-if="isFree" class="text-gray-500"> (saisie libre)</span></div>
  </div>
</template>
