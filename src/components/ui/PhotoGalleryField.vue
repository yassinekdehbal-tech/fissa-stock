<script setup lang="ts">
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Galerie photo d'une pièce : emplacements guidés (angle attendu, obligatoire
 * ou non) + photos supplémentaires. Prise/choix depuis l'appareil, compression
 * côté client, upload dans le bucket public `piece-photos`. v-model : tableau
 * d'URL dans l'ordre des emplacements (la première est la photo principale).
 */
const props = defineProps<{
  modelValue: string[]
  slots: { label: string; hint: string; required: boolean }[]
  max?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const auth = useAuthStore()
const { toast } = useToast()
const uploadingIndex = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const targetIndex = ref(0)
const showUrl = ref(false)
const urlDraft = ref('')
const maxPhotos = computed(() => props.max ?? 8)

/** Emplacements affichés : les guidés, puis les photos libres déjà prises. */
const tiles = computed(() => {
  const n = Math.max(props.slots.length, props.modelValue.length)
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    url: props.modelValue[i] ?? '',
    label: props.slots[i]?.label ?? `Photo ${i + 1}`,
    hint: props.slots[i]?.hint ?? 'Angle libre',
    required: props.slots[i]?.required ?? false,
  }))
})
const count = computed(() => props.modelValue.filter(Boolean).length)
const canAddMore = computed(() => tiles.value.every((t) => t.url) && tiles.value.length < maxPhotos.value)

function setAt(i: number, url: string) {
  const next = [...props.modelValue]
  while (next.length <= i) next.push('')
  next[i] = url
  // Les emplacements libres vides en fin de liste disparaissent
  while (next.length > props.slots.length && !next[next.length - 1]) next.pop()
  emit('update:modelValue', next)
}
function removeAt(i: number) {
  if (i < props.slots.length) { setAt(i, ''); return }
  const next = props.modelValue.filter((_, k) => k !== i)
  emit('update:modelValue', next)
}
function pickFor(i: number) {
  targetIndex.value = i
  fileInput.value?.click()
}

async function compress(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compression impossible'))), 'image/jpeg', quality),
  )
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const orgId = auth.profile?.org_id
  if (!orgId) { toast('Profil non chargé — réessayez', true); return }
  const i = targetIndex.value
  uploadingIndex.value = i
  try {
    const blob = await compress(file)
    const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await supabase.storage.from('piece-photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw error
    const { data } = supabase.storage.from('piece-photos').getPublicUrl(path)
    setAt(i, data.publicUrl)
  } catch (err) {
    toast('Erreur photo : ' + (err instanceof Error ? err.message : String(err)), true)
  } finally {
    uploadingIndex.value = null
  }
}
function applyUrl() {
  const u = urlDraft.value.trim()
  if (!u) return
  const firstEmpty = tiles.value.findIndex((t) => !t.url)
  setAt(firstEmpty >= 0 ? firstEmpty : tiles.value.length, u)
  urlDraft.value = ''
  showUrl.value = false
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-center justify-between">
      <label class="label">Photos <span class="text-gray-400 font-normal">({{ count }}<template v-if="slots.some(s => s.required)">/{{ slots.filter(s => s.required).length }} min.</template>)</span></label>
      <button type="button" class="text-[11px] text-gray-400 hover:text-gray-700" @click="showUrl = !showUrl">{{ showUrl ? 'Masquer' : "coller une URL d'image" }}</button>
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div v-for="t in tiles" :key="t.index" class="relative">
        <button
          type="button"
          :disabled="uploadingIndex !== null"
          @click="pickFor(t.index)"
          class="w-full aspect-square rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center gap-1 p-2 text-center transition-colors disabled:opacity-60"
          :class="t.url ? 'border-gray-200 bg-gray-50' : t.required ? 'border-dashed border-amber-400 bg-amber-50/40 hover:bg-amber-50' : 'border-dashed border-gray-300 hover:border-brand hover:bg-amber-50/40'"
        >
          <img v-if="t.url" :src="t.url" class="absolute inset-0 w-full h-full object-cover" alt="" @error="($event.target as HTMLImageElement).style.display = 'none'">
          <template v-else>
            <span class="w-8 h-8 rounded-full flex items-center justify-center" :class="t.required ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'">
              <AppIcon :name="uploadingIndex === t.index ? 'upload' : 'camera'" class="w-4 h-4" />
            </span>
            <span class="text-[11px] font-semibold text-gray-800 leading-tight">{{ uploadingIndex === t.index ? 'Envoi…' : t.label }}</span>
            <span class="text-[10px] text-gray-500 leading-tight">{{ t.hint }}</span>
          </template>
        </button>
        <span v-if="t.url" class="absolute bottom-1 left-1 right-8 text-[10px] font-medium text-white bg-gray-900/60 rounded px-1.5 py-0.5 truncate">{{ t.label }}</span>
        <button v-if="t.url" type="button" class="absolute top-1 right-1 w-7 h-7 rounded-md bg-white/90 text-red-600 hover:bg-red-50 flex items-center justify-center shadow" title="Retirer la photo" @click.stop="removeAt(t.index)"><AppIcon name="trash" class="w-3.5 h-3.5" /></button>
      </div>
      <button v-if="canAddMore" type="button" class="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-brand hover:bg-amber-50/40 flex flex-col items-center justify-center gap-1 text-gray-500" @click="pickFor(tiles.length)">
        <AppIcon name="plus" class="w-5 h-5" /><span class="text-[11px] font-semibold">Ajouter</span>
      </button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPick">
    <div v-if="showUrl" class="flex gap-1.5">
      <input v-model="urlDraft" type="url" placeholder="https://…" class="input text-[12px]" @keydown.enter.prevent="applyUrl">
      <button type="button" class="btn btn-secondary btn-sm" @click="applyUrl">Ajouter</button>
    </div>
  </div>
</template>
