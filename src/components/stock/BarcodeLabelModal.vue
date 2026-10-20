<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import JsBarcode from 'jsbarcode'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import type { Piece } from '@/types'
import { formatRef } from '@/utils/format'

const props = defineProps<{
  piece: Piece | null
  open: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const { toast } = useToast()
const svgEl = ref<SVGSVGElement | null>(null)

// Formats supportés — mémorisé par appareil (l'imprimante ne change pas tous les jours)
const FORMATS = {
  '62x29': { w: 62, h: 29, label: '62×29 mm — Brother QL (DK-11209)' },
  '50x30': { w: 50, h: 30, label: '50×30 mm — NIIMBOT B1 / Phomemo' },
} as const
type FormatKey = keyof typeof FORMATS

const FORMAT_STORAGE_KEY = 'fissa-label-format'
const stored = localStorage.getItem(FORMAT_STORAGE_KEY)
const format = ref<FormatKey>(stored === '50x30' ? '50x30' : '62x29')
watch(format, (f) => localStorage.setItem(FORMAT_STORAGE_KEY, f))

const dims = computed(() => FORMATS[format.value])

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
        text: formatRef(props.piece.ref),
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
  const { w, h } = dims.value
  const svg = svgEl.value.outerHTML
  const svgMaxW = w - 4
  const svgMaxH = Math.round(h * 0.58)
  const win = window.open('', '_blank', 'width=500,height=350')
  if (!win) { toast('Popup bloquée — autorisez les popups', true); return }
  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Étiquette ${p.ref}</title>
<style>
@page{size:${w}mm ${h}mm;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',monospace;width:${w}mm;height:${h}mm;overflow:hidden}
.label{width:${w}mm;height:${h}mm;padding:1.5mm 2mm;display:flex;flex-direction:column;align-items:center;justify-content:center}
.label svg{max-width:${svgMaxW}mm;max-height:${svgMaxH}mm}
.label-name{font-size:8pt;font-weight:700;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${svgMaxW}mm}
.label-meta{font-size:6.5pt;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:${svgMaxW}mm}
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

// Export PNG à 8 px/mm (≈ 203 dpi, la résolution native des thermiques) :
// à envoyer dans l'appli NIIMBOT / Phomemo quand l'imprimante n'a pas AirPrint.
function downloadPng() {
  const p = props.piece
  if (!p) return
  const { w, h } = dims.value
  const SCALE = 8
  const W = w * SCALE
  const H = h * SCALE

  const barcodeCanvas = document.createElement('canvas')
  try {
    JsBarcode(barcodeCanvas, p.ref, {
      format: p.fmt || 'CODE128',
      width: 3,
      height: Math.round(H * 0.42),
      displayValue: true,
      text: formatRef(p.ref),
      fontSize: Math.round(H * 0.11),
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
  } catch {
    toast('Référence non encodable en ' + (p.fmt || 'CODE128'), true)
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // Code-barres centré, borné à la largeur utile
  const maxBw = W - 4 * SCALE
  const ratio = Math.min(1, maxBw / barcodeCanvas.width)
  const bw = barcodeCanvas.width * ratio
  const bh = barcodeCanvas.height * ratio
  ctx.drawImage(barcodeCanvas, (W - bw) / 2, Math.round(H * 0.06), bw, bh)

  // Désignation + méta
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(H * 0.115)}px 'Courier New', monospace`
  ctx.fillText(p.name, W / 2, Math.round(H * 0.78), maxBw)
  ctx.font = `${Math.round(H * 0.09)}px 'Courier New', monospace`
  ctx.fillText(meta(p), W / 2, Math.round(H * 0.93), maxBw)

  canvas.toBlob((blob) => {
    if (!blob) { toast("Impossible de générer l'image", true); return }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `etiquette-${p.ref}-${w}x${h}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast('✓ Image téléchargée — ouvrez-la dans l\'appli de votre imprimante')
  }, 'image/png')
}
</script>

<template>
  <BaseModal :open="open" title="Étiquette code-barres" max-width="420px" @close="emit('close')">
    <div v-if="piece" class="space-y-3">
      <div class="bg-white rounded-lg p-3 flex justify-center">
        <svg ref="svgEl"></svg>
      </div>
      <div class="text-center">
        <div class="font-bold text-gray-900">{{ piece.name }}</div>
        <div class="text-xs text-gray-500">{{ meta(piece) }}</div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="label">Format d'étiquette</label>
        <select v-model="format" class="input">
          <option v-for="(f, key) in FORMATS" :key="key" :value="key">{{ f.label }}</option>
        </select>
      </div>

      <div class="flex gap-2">
        <button
          @click="printLabel"
          class="flex-1 btn btn-primary hover:bg-brand-dark transition-colors"
        >
          Imprimer
        </button>
        <button
          @click="downloadPng"
          class="flex-1 btn btn-secondary"
        >
          Image
        </button>
      </div>
      <p class="text-[10px] text-gray-500 text-center">
        Imprimer : imprimante AirPrint (Brother QL…) · Image : PNG pour l'appli NIIMBOT / Phomemo
      </p>
    </div>
  </BaseModal>
</template>
