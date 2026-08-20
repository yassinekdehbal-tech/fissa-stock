<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import JsBarcode from 'jsbarcode'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import type { Piece } from '@/types'

const props = defineProps<{
  piece: Piece | null
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { toast } = useToast()
const svgEl = ref<SVGSVGElement | null>(null)

function meta(p: Piece): string {
  return [p.vehicle, p.price ? p.price.toFixed(2) + ' €' : null, p.etat].filter(Boolean).join(' | ')
}

watch(
  () => [props.open, props.piece?.ref],
  async () => {
    if (!props.open || !props.piece) return
    await nextTick()
    if (!svgEl.value) return
    try {
      JsBarcode(svgEl.value, props.piece.ref, {
        format: props.piece.fmt || 'CODE128',
        width: 2,
        height: 45,
        displayValue: true,
        fontSize: 10,
        margin: 6,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      toast('Référence non encodable en ' + (props.piece.fmt || 'CODE128'), true)
    }
  },
  { immediate: true },
)

function printLabel() {
  const p = props.piece
  if (!p || !svgEl.value) return
  const svg = svgEl.value.outerHTML
  const win = window.open('', '_blank', 'width=500,height=350')
  if (!win) { toast('Popup bloquée — autorisez les popups', true); return }
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Étiquette ${p.ref}</title>
<style>
@page{size:62mm 29mm;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:62mm;height:29mm;overflow:hidden}
.label{width:62mm;height:29mm;padding:1.5mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
.label svg{max-width:58mm;max-height:17mm}
.label-name{font-size:8pt;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58mm}
.label-meta{font-size:6.5pt;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58mm}
.print-btn{display:block;margin:4mm auto;background:#e6a817;border:none;font-weight:700;padding:8px 24px;border-radius:6px;cursor:pointer;font-family:inherit}
@media print{.print-btn{display:none}}
</style></head><body>
<div class="label">
  <div>${svg}</div>
  <div class="label-name">${p.name}</div>
  <div class="label-meta">${meta(p)}</div>
</div>
<button class="print-btn" onclick="window.print()">🖨 Imprimer</button>
</body></html>`)
  win.document.close()
  // Laisse le SVG se peindre avant d'ouvrir le dialogue d'impression
  setTimeout(() => { try { win.print() } catch { /* l'utilisateur peut cliquer le bouton */ } }, 300)
}
</script>

<template>
  <BaseModal :open="open" title="🏷 Étiquette code-barres" max-width="420px" @close="emit('close')">
    <div v-if="piece" class="space-y-3">
      <div class="bg-white rounded-lg p-3 flex justify-center">
        <svg ref="svgEl"></svg>
      </div>
      <div class="text-center">
        <div class="font-mono font-bold text-[#e6edf3]">{{ piece.name }}</div>
        <div class="text-xs text-[#8b949e] font-mono">{{ meta(piece) }}</div>
      </div>
      <p class="text-[10px] text-[#8b949e] text-center">Format 62×29 mm (Brother DK-11209 / Dymo / NIIMBOT)</p>
      <button
        @click="printLabel"
        class="w-full bg-[#e6a817] text-black font-mono text-xs font-bold px-4 py-2.5 rounded-lg uppercase tracking-wider hover:bg-[#d49b15] transition-colors"
      >
        🖨 Imprimer l'étiquette
      </button>
    </div>
  </BaseModal>
</template>
