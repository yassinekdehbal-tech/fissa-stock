<script setup lang="ts">
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { imageHash, sameAngle, type ImageHash } from '@/utils/imageHash'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Galerie photo d'une pièce : emplacements guidés (angle attendu, obligatoire
 * ou non) + photos supplémentaires. Chaque emplacement accepte une prise de
 * vue (caméra) ou un import depuis la galerie du téléphone ; un import
 * multiple remplit les emplacements libres dans l'ordre. Les photos servent
 * aux annonces en ligne : un contrôle d'angle (empreinte visuelle) refuse
 * deux photos quasi identiques. v-model : tableau d'URL dans l'ordre des
 * emplacements (la première est la photo principale).
 */
const props = defineProps<{
  modelValue: string[]
  slots: { label: string; hint: string; required: boolean }[]
  max?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const auth = useAuthStore()
const { toast } = useToast()
const busy = ref(false)
const uploadingIndex = ref<number | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const targetIndex = ref(0)
const showUrl = ref(false)
const urlDraft = ref('')
const maxPhotos = computed(() => props.max ?? 8)
/** Empreintes connues, par URL (calculées à l'envoi ou à la demande). */
const hashes = ref<Record<string, ImageHash | null>>({})

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
const requiredCount = computed(() => props.slots.filter((s) => s.required).length)
const canAddMore = computed(() => tiles.value.every((t) => t.url) && tiles.value.length < maxPhotos.value)
const emptyIndexes = computed(() => tiles.value.filter((t) => !t.url).map((t) => t.index))

function setAt(i: number, url: string) {
  const next = [...props.modelValue]
  while (next.length <= i) next.push('')
  next[i] = url
  while (next.length > props.slots.length && !next[next.length - 1]) next.pop()
  emit('update:modelValue', next)
  return next
}
function removeAt(i: number) {
  if (i < props.slots.length) { setAt(i, ''); return }
  emit('update:modelValue', props.modelValue.filter((_, k) => k !== i))
}
function takeFor(i: number) { targetIndex.value = i; cameraInput.value?.click() }
function importFor(i: number) { targetIndex.value = i; importInput.value?.click() }
function importMany() { targetIndex.value = -1; importInput.value?.click() }

async function compress(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compression impossible'))), 'image/jpeg', quality),
  )
}

async function hashOf(url: string): Promise<ImageHash | null> {
  if (url in hashes.value) return hashes.value[url] ?? null
  const h = await imageHash(url)
  hashes.value[url] = h
  return h
}

/** Libellé de l'emplacement dont la photo ressemble trop à `hash`, sinon null. */
async function similarTo(hash: ImageHash | null, urls: string[], exceptIndex = -1): Promise<string | null> {
  if (!hash) return null
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i]
    if (!u || i === exceptIndex) continue
    const h = await hashOf(u)
    if (h && sameAngle(hash, h)) return tiles.value[i]?.label ?? `photo ${i + 1}`
  }
  return null
}

async function upload(blob: Blob): Promise<string> {
  const orgId = auth.profile?.org_id
  if (!orgId) throw new Error('Profil non chargé — réessayez')
  const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('piece-photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from('piece-photos').getPublicUrl(path).data.publicUrl
}

/** Prise de vue ou import : une ou plusieurs photos, contrôle d'angle, envoi. */
async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  busy.value = true
  let current = [...props.modelValue]
  let rejected = 0
  let added = 0
  try {
    // Emplacements cibles : celui choisi, puis les libres, puis en fin de liste
    const targets: number[] = targetIndex.value >= 0 ? [targetIndex.value] : []
    for (const i of emptyIndexes.value) if (!targets.includes(i)) targets.push(i)
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      let slot = targets.shift()
      if (slot === undefined) {
        const filled = current.filter(Boolean).length
        if (filled >= maxPhotos.value) { toast(`${maxPhotos.value} photos maximum`, true); break }
        slot = Math.max(current.length, props.slots.length)
      }
      uploadingIndex.value = slot
      try {
        const blob = await compress(file)
        const hash = await imageHash(blob)
        const dup = await similarTo(hash, current, slot)
        if (dup) {
          rejected++
          toast(`Photo refusée : même angle que « ${dup} ». Changez de point de vue (dos, côté, détail).`, true)
          targets.unshift(slot)
          continue
        }
        const url = await upload(blob)
        hashes.value[url] = hash
        current = setAt(slot, url)
        added++
      } catch (err) {
        toast('Erreur photo : ' + (err instanceof Error ? err.message : String(err)), true)
      }
    }
    if (added > 1) toast(`✓ ${added} photos ajoutées${rejected ? `, ${rejected} refusée${rejected > 1 ? 's' : ''} (même angle)` : ''}`)
  } finally {
    uploadingIndex.value = null
    busy.value = false
  }
}
function applyUrl() {
  const u = urlDraft.value.trim()
  if (!u) return
  const firstEmpty = emptyIndexes.value[0]
  setAt(firstEmpty ?? tiles.value.length, u)
  urlDraft.value = ''
  showUrl.value = false
}

/**
 * Contrôle avant enregistrement : nombre de photos obligatoires atteint et
 * angles différents (pas deux photos quasi identiques). Renvoie le message
 * d'erreur à afficher, ou null si tout est bon.
 */
async function validate(): Promise<string | null> {
  const urls = props.modelValue.filter(Boolean)
  if (urls.length < requiredCount.value) {
    return `${requiredCount.value} photos sous ${requiredCount.value} angles différents sont requises (${urls.length}/${requiredCount.value})`
  }
  for (let i = 0; i < urls.length; i++) {
    const a = await hashOf(urls[i]!)
    if (!a) continue
    for (let j = i + 1; j < urls.length; j++) {
      const b = await hashOf(urls[j]!)
      if (b && sameAngle(a, b)) {
        const la = tiles.value.find((t) => t.url === urls[i])?.label ?? `photo ${i + 1}`
        const lb = tiles.value.find((t) => t.url === urls[j])?.label ?? `photo ${j + 1}`
        return `Les photos « ${la} » et « ${lb} » sont prises sous le même angle : remplacez-en une`
      }
    }
  }
  return null
}
defineExpose({ validate })
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <label class="label">Photos <span class="text-gray-400 font-normal">({{ count }}<template v-if="requiredCount">/{{ requiredCount }} min.</template>)</span></label>
      <div class="flex items-center gap-3">
        <button type="button" class="text-[12px] font-semibold text-blue-600 hover:underline inline-flex items-center gap-1" :disabled="busy" @click="importMany"><AppIcon name="upload" class="w-3.5 h-3.5" /> Importer de la galerie</button>
        <button type="button" class="text-[11px] text-gray-400 hover:text-gray-700" @click="showUrl = !showUrl">{{ showUrl ? 'Masquer' : 'URL' }}</button>
      </div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div v-for="t in tiles" :key="t.index" class="relative">
        <!-- Photo prise -->
        <div v-if="t.url" class="aspect-square rounded-xl border-2 border-gray-200 bg-gray-50 overflow-hidden relative">
          <img :src="t.url" class="absolute inset-0 w-full h-full object-cover" alt="" @error="($event.target as HTMLImageElement).style.display = 'none'">
          <span class="absolute bottom-1 left-1 right-9 text-[10px] font-medium text-white bg-gray-900/60 rounded px-1.5 py-0.5 truncate">{{ t.label }}</span>
          <button type="button" class="absolute top-1 right-1 w-8 h-8 rounded-md bg-white/90 text-red-600 hover:bg-red-50 flex items-center justify-center shadow" title="Retirer la photo" aria-label="Retirer la photo" @click="removeAt(t.index)"><AppIcon name="trash" class="w-4 h-4" /></button>
        </div>
        <!-- Emplacement libre : prendre ou importer -->
        <div v-else class="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-between p-2 text-center" :class="t.required ? 'border-amber-400 bg-amber-50/40' : 'border-gray-300 bg-white'">
          <div class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-0">
            <span class="w-8 h-8 rounded-full flex items-center justify-center" :class="t.required ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'">
              <AppIcon :name="uploadingIndex === t.index ? 'upload' : 'camera'" class="w-4 h-4" />
            </span>
            <span class="text-[12px] font-semibold text-gray-800 leading-tight">{{ uploadingIndex === t.index ? 'Envoi…' : t.label }}</span>
            <span class="text-[10px] text-gray-500 leading-tight">{{ t.hint }}<template v-if="t.required"> · obligatoire</template></span>
          </div>
          <div class="grid grid-cols-2 gap-1 w-full">
            <button type="button" class="h-9 rounded-lg bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50" :disabled="busy" @click="takeFor(t.index)" aria-label="Prendre une photo"><AppIcon name="camera" class="w-3.5 h-3.5" /> Prendre</button>
            <button type="button" class="h-9 rounded-lg bg-white border border-gray-300 text-gray-700 text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50" :disabled="busy" @click="importFor(t.index)" aria-label="Importer une photo"><AppIcon name="image" class="w-3.5 h-3.5" /> Importer</button>
          </div>
        </div>
      </div>
      <button v-if="canAddMore" type="button" class="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-brand hover:bg-amber-50/40 flex flex-col items-center justify-center gap-1 text-gray-500 disabled:opacity-50" :disabled="busy" @click="importFor(tiles.length)">
        <AppIcon name="plus" class="w-5 h-5" /><span class="text-[11px] font-semibold">Ajouter</span>
      </button>
    </div>
    <p class="text-[11px] text-gray-500 leading-snug">Ces photos servent aux annonces en ligne : des angles différents sont exigés, une photo trop semblable à une autre est refusée.</p>
    <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFiles">
    <input ref="importInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles">
    <div v-if="showUrl" class="flex gap-1.5">
      <input v-model="urlDraft" type="url" placeholder="https://…" class="input text-[12px]" @keydown.enter.prevent="applyUrl">
      <button type="button" class="btn btn-secondary btn-sm" @click="applyUrl">Ajouter</button>
    </div>
  </div>
</template>
