<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'

// Champ photo : prise/choix depuis l'appareil, compression côté client
// (max 1600 px, JPEG), upload dans le bucket public `piece-photos` sous le
// dossier de l'organisation (imposé par les policies storage), et v-model
// sur l'URL publique. Un champ URL manuel reste disponible en repli.
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const auth = useAuthStore()
const { toast } = useToast()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showUrl = ref(false)

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
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const orgId = auth.profile?.org_id
  if (!orgId) { toast('Profil non chargé — réessayez', true); return }
  uploading.value = true
  try {
    const blob = await compress(file)
    const path = `${orgId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const { error } = await supabase.storage.from('piece-photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw error
    const { data } = supabase.storage.from('piece-photos').getPublicUrl(path)
    emit('update:modelValue', data.publicUrl)
    toast('✓ Photo ajoutée')
  } catch (err) {
    toast('Erreur photo : ' + (err instanceof Error ? err.message : String(err)), true)
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label class="label">Photo</label>
    <div class="grid grid-cols-2 gap-3">
      <button
        type="button"
        :disabled="uploading"
        @click="fileInput?.click()"
        class="rounded-xl border-2 border-dashed border-gray-300 hover:border-brand hover:bg-amber-50/40 transition-colors flex flex-col items-center justify-center gap-1.5 p-4 min-h-[120px] text-gray-500 disabled:opacity-50"
      >
        <span class="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <AppIcon :name="uploading ? 'upload' : 'camera'" class="w-4 h-4" />
        </span>
        <span class="text-[13px] font-semibold text-blue-600">{{ uploading ? 'Envoi…' : 'Ajouter une photo' }}</span>
        <span class="text-[11px] text-gray-400">JPG, PNG (max 5 Mo)</span>
      </button>
      <div class="rounded-xl border border-gray-200 bg-gray-50 min-h-[120px] relative overflow-hidden flex items-center justify-center text-gray-300">
        <img
          v-if="modelValue"
          :src="modelValue"
          class="w-full h-full object-cover absolute inset-0"
          alt=""
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        >
        <AppIcon v-else name="image" class="w-8 h-8" />
        <button
          v-if="modelValue"
          type="button"
          @click="emit('update:modelValue', '')"
          class="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/90 text-red-600 hover:bg-red-50 flex items-center justify-center shadow"
          title="Retirer la photo"
        ><AppIcon name="trash" class="w-3.5 h-3.5" /></button>
      </div>
    </div>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPick">
    <button type="button" class="text-[11px] text-gray-400 hover:text-gray-700 text-left" @click="showUrl = !showUrl">
      {{ showUrl ? 'Masquer' : 'ou coller une URL d\'image' }}
    </button>
    <input
      v-if="showUrl"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      type="url"
      placeholder="https://…"
      class="input text-[12px]"
    >
  </div>
</template>
