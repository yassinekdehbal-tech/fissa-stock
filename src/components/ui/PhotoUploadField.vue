<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

// Champ photo : prise/choix depuis l'appareil, compression cote client
// (max 1600 px, JPEG), upload dans le bucket public `piece-photos` sous le
// dossier de l'organisation (impose par les policies storage), et v-model
// sur l'URL publique. Un champ URL manuel reste disponible en repli.
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const auth = useAuthStore()
const { toast } = useToast()
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

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
    <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Photo</label>
    <div class="flex items-center gap-2">
      <button
        type="button"
        :disabled="uploading"
        @click="fileInput?.click()"
        class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
      >
        {{ uploading ? '⏳ Envoi…' : '📷 Photo' }}
      </button>
      <img
        v-if="modelValue"
        :src="modelValue"
        class="w-10 h-10 object-cover rounded-md border border-[#30363d]"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      >
      <button
        v-if="modelValue"
        type="button"
        @click="emit('update:modelValue', '')"
        class="text-[#8b949e] hover:text-red-400 text-xs font-mono"
        title="Retirer la photo"
      >✕</button>
    </div>
    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPick">
    <input
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      type="url"
      placeholder="ou collez une URL https://…"
      class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-[11px] px-3 py-1.5 outline-none focus:border-[#e6a817]"
    >
  </div>
</template>
