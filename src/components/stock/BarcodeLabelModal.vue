<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import JsBarcode from 'jsbarcode'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import type { Piece } from '@/types'

/**
 * Identification d'une pièce : les deux moyens de marquage sont proposés
 * ensemble, le magasinier choisit selon la pièce et le matériel disponible.
 *  1. Étiquette code-barres (ref) à imprimer et coller.
 *  2. Code court à écrire au marqueur directement sur la pièce : aucune
 *     imprimante nécessaire, et pas d'étiquette qui se décolle sur une pièce
 *     d'occasion grasse ou rouillée.
 * Pour une pièce neuve, le code-barres de l'emballage (EAN) et la référence
 * fournisseur sont rappelés : ils suffisent à la retrouver au comptoir.
 */
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

const hasPackagingCodes = computed(() => !!(props.piece?.ean || props.piece?.supplierRef))

function meta(p: Piece): string {
  return [p.vehicle, p.price ? p.price.toFixed(2) + ' €' : null, p.etat].filter(Boolean).join(' | ')
}

// Ligne de désignation sur l'étiquette : le code court y figure pour qu'on
// puisse aussi le lire (et le réécrire) une fois l'étiquette collée.
function labelTitle(p: Piece): string {
  return p.shortCode ? `[${p.shortCode}] ${p.name}` : p.name
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

async function copyShortCode() {
  const code = props.piece?.shortCode
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    toast('✓ Code ' + code + ' copié')
  } catch {
    toast('Copie impossible — recopiez le code : ' + code, true)
  }
}

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
  <div class="label-name">${labelTitle(p)}</div>
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

  // Désignation (avec code court) + méta
  ctx.fillStyle = '#000000'
  ctx.textAlign = 'center'
  ctx.font = `bold ${Math.round(H * 0.115)}px 'Courier New', monospace`
  ctx.fillText(labelTitle(p), W / 2, Math.round(H * 0.78), maxBw)
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
  <BaseModal :open="open" title="🏷 Identification de la pièce" max-width="440px" @close="emit('close')">
    <div v-if="piece" class="space-y-4">
      <div class="text-center">
        <div class="font-mono font-bold text-[#e6edf3]">{{ piece.name }}</div>
        <div class="text-xs text-[#8b949e] font-mono">{{ meta(piece) }}</div>
      </div>

      <!-- Option 1 : étiquette code-barres -->
      <section class="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-3">
        <div class="flex items-center justify-between">
          <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px]">1 · Étiquette code-barres</div>
          <span class="text-[10px] text-[#8b949e]">à imprimer et coller</span>
        </div>
        <div class="bg-white rounded-lg p-3 flex justify-center">
          <svg ref="svgEl"></svg>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Format d'étiquette</label>
          <select v-model="format" class="bg-[#161b22] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-xs px-3 py-2 outline-none focus:border-[#e6a817]">
            <option v-for="(f, key) in FORMATS" :key="key" :value="key">{{ f.label }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button
            @click="printLabel"
            class="flex-1 bg-[#e6a817] text-black font-mono text-xs font-bold px-4 py-2.5 rounded-lg uppercase tracking-wider hover:bg-[#d49b15] transition-colors"
          >
            🖨 Imprimer
          </button>
          <button
            @click="downloadPng"
            class="flex-1 border border-[#e6a817] text-[#e6a817] font-mono text-xs font-bold px-4 py-2.5 rounded-lg uppercase tracking-wider hover:bg-[#e6a817]/10 transition-colors"
          >
            ⬇ Image
          </button>
        </div>
        <p class="text-[10px] text-[#8b949e] text-center">
          🖨 Imprimer : imprimante AirPrint (Brother QL…) · ⬇ Image : PNG pour l'appli NIIMBOT / Phomemo
        </p>
      </section>

      <!-- Option 2 : code à écrire au marqueur -->
      <section class="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 space-y-2">
        <div class="flex items-center justify-between">
          <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px]">2 · Code à écrire sur la pièce</div>
          <span class="text-[10px] text-[#8b949e]">sans imprimante</span>
        </div>
        <div v-if="piece.shortCode" class="bg-white rounded-lg py-3 px-2 text-center">
          <div class="font-mono font-black text-black text-4xl tracking-[0.35em] pl-[0.35em] select-all">{{ piece.shortCode }}</div>
        </div>
        <div v-else class="text-xs text-[#8b949e] text-center py-2">
          Code court non encore attribué — rechargez la fiche (la base le génère à l'enregistrement).
        </div>
        <p class="text-[10px] text-[#8b949e] text-center">
          Écrivez ce code au marqueur indélébile sur la pièce. Au comptoir, il se tape dans le scanner
          ou la recherche du stock : lettres et chiffres sans ambiguïté (pas de 0/O ni de 1/I/L).
        </p>
        <button
          v-if="piece.shortCode"
          @click="copyShortCode"
          class="w-full border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase hover:border-[#e6a817] hover:text-[#e6a817] transition-colors"
        >
          📋 Copier le code
        </button>
      </section>

      <!-- Pièce neuve : codes de l'emballage -->
      <section v-if="hasPackagingCodes" class="bg-[#0d1117] border border-blue-400/30 rounded-xl p-3 space-y-2">
        <div class="font-mono text-[11px] font-semibold text-blue-400 uppercase tracking-[2px]">📦 Codes de l'emballage (pièce neuve)</div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div v-if="piece.ean">
            <div class="text-[#8b949e]">Code-barres emballage</div>
            <div class="font-mono font-bold text-[#e6edf3]">{{ piece.ean }}</div>
          </div>
          <div v-if="piece.supplierRef">
            <div class="text-[#8b949e]">Réf. fournisseur</div>
            <div class="font-mono font-bold text-[#e6edf3]">{{ piece.supplierRef }}</div>
          </div>
        </div>
        <p class="text-[10px] text-[#8b949e]">
          Tant que la pièce reste dans son emballage, scanner ce code-barres ou saisir la réf fournisseur
          suffit à la retrouver : le marquage ci-dessus est facultatif.
        </p>
      </section>
    </div>
  </BaseModal>
</template>
