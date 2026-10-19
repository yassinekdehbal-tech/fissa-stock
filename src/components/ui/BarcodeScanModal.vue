<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Lecteur de code-barres en fenêtre : renvoie le code lu via `scanned`.
 * Utilisé pour remplir la référence à l'ajout d'une pièce.
 */
const props = defineProps<{ open: boolean; title?: string }>()
const emit = defineEmits<{ close: []; scanned: [string] }>()

const error = ref('')
const manual = ref('')
let reader: any = null

async function start() {
  error.value = ''
  await nextTick()
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    reader = new Html5Qrcode('barcode-modal-view')
    await reader.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 130 } },
      (val: string) => {
        if (!val) return
        emit('scanned', val.trim().toUpperCase())
        void stop()
        emit('close')
      },
      () => {},
    )
  } catch (e: any) {
    error.value = e?.message || 'Caméra inaccessible'
  }
}

async function stop() {
  if (!reader) return
  try { await reader.stop(); reader.clear() } catch { /* déjà arrêté */ }
  reader = null
}

function submitManual() {
  const v = manual.value.trim().toUpperCase()
  if (!v) return
  emit('scanned', v)
  manual.value = ''
  emit('close')
}

watch(() => props.open, (o) => { if (o) void start(); else void stop() })
onUnmounted(() => { void stop() })
</script>

<template>
  <BaseModal :open="open" :title="title || 'Scanner un code-barres'" max-width="440px" @close="emit('close')">
    <div class="rounded-xl overflow-hidden bg-gray-900 min-h-[220px] relative">
      <div id="barcode-modal-view" class="w-full"></div>
      <div v-if="error" class="absolute inset-0 flex flex-col items-center justify-center text-gray-300 gap-2 p-4 text-center">
        <AppIcon name="camera" class="w-7 h-7" />
        <span class="text-sm">{{ error }}</span>
        <button class="btn btn-primary btn-sm mt-1" @click="start">Réessayer</button>
      </div>
    </div>
    <div class="mt-3">
      <label class="label">Ou saisir le code</label>
      <div class="flex gap-2 mt-1">
        <input v-model="manual" @keydown.enter="submitManual" class="input font-mono uppercase placeholder:normal-case" placeholder="ex : ALT-PFU-001" autocapitalize="characters">
        <button class="btn btn-primary px-3" @click="submitManual" aria-label="Valider"><AppIcon name="check" class="w-4 h-4" /></button>
      </div>
    </div>
  </BaseModal>
</template>
