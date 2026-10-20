<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Piece } from '@/types'
import { useCategoriesStore } from '@/stores/categories'
import { formatPrice } from '@/utils/format'
import { useOcr } from '@/composables/useOcr'
import { findExact, suggestPieces, ocrCandidates, scoreLabel, type RefSuggestion } from '@/utils/refMatch'

const route = useRoute()
const stock = useStockStore()
const cats = useCategoriesStore()
const cart = useCartStore()
const auth = useAuthStore()
const { toast } = useToast()

type Tab = 'camera' | 'manual' | 'ocr'
const tab = ref<Tab>('camera')
const isScanning = ref(false)
const camError = ref('')
const torch = ref(false)
const torchAvailable = ref(false)
const usbInput = ref('')
const scanLog = ref<{ time: string; code: string; found: boolean; name: string }[]>([])

let html5QrCode: any = null
let lastCode = ''
let lastCodeTime = 0

// La caméra démarre seule à l'ouverture de l'écran.
async function startCam() {
  if (isScanning.value) return
  camError.value = ''
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('camera-view')
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 140 } },
      (val: string) => {
        const now = Date.now()
        if (!val || (val === lastCode && now - lastCodeTime < 3000)) return
        lastCode = val
        lastCodeTime = now
        processCode(val.toUpperCase())
      },
      () => {}
    )
    isScanning.value = true
    try {
      const caps = html5QrCode.getRunningTrackCapabilities?.()
      torchAvailable.value = !!caps?.torch
    } catch { torchAvailable.value = false }
  } catch (e: any) {
    camError.value = e?.message || 'Caméra inaccessible'
    isScanning.value = false
  }
}

function stopCam() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => {})
    html5QrCode = null
  }
  isScanning.value = false
  torch.value = false
}

async function toggleTorch() {
  if (!html5QrCode || !isScanning.value) return
  try {
    await html5QrCode.applyVideoConstraints({ advanced: [{ torch: !torch.value }] })
    torch.value = !torch.value
  } catch {
    toast('Flash non disponible sur cet appareil', true)
  }
}

function switchTab(t: Tab) {
  tab.value = t
  if (t === 'camera') void startCam()
  else stopCam()
}

function processUSB() {
  const val = usbInput.value.trim().toUpperCase()
  if (!val) return
  usbInput.value = ''
  processCode(val)
}

const scanError = ref('')
const detected = ref<Piece | null>(null)
const qty = ref(1)
/** Pièces proches proposées quand la lecture ne correspond à rien d'exact. */
const suggestions = ref<RefSuggestion[]>([])

function select(p: Piece, code = p.ref) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  scanError.value = ''
  suggestions.value = []
  detected.value = p
  qty.value = 1
  scanLog.value.unshift({ time, code: p.ref === code ? p.ref : `${code} → ${p.ref}`, found: true, name: p.name })
  if (navigator.vibrate) navigator.vibrate(60)
}

/**
 * Un code lu (code-barres, saisie, douchette) : correspondance exacte sur la
 * référence (séparateurs ignorés) ou sur le n° OEM, sinon les pièces les plus
 * proches sont proposées pour une sélection manuelle.
 */
function processCode(code: string, extraInputs: string[] = []) {
  const p = stock.findByRef(code) || findExact(stock.activePieces, code)
  if (p) { select(p, code); return }
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  scanError.value = code
  detected.value = null
  suggestions.value = suggestPieces(stock.activePieces, [code, ...extraInputs])
  if (suggestions.value.length) toast(`${code} : ${suggestions.value.length} pièce${suggestions.value.length > 1 ? 's' : ''} proche${suggestions.value.length > 1 ? 's' : ''} — choisissez`)
  else toast('Code inconnu : ' + code, true)
  scanLog.value.unshift({ time, code, found: false, name: 'Inconnu' })
}

// ---- Référence écrite à la main (photo + OCR)
const ocr = useOcr()
const ocrInput = ref<HTMLInputElement | null>(null)
const ocrPreview = ref('')
const ocrText = ref('')
const ocrEdit = ref('')
const ocrError = ref('')

async function onOcrFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (ocrPreview.value) URL.revokeObjectURL(ocrPreview.value)
  ocrPreview.value = URL.createObjectURL(file)
  ocrText.value = ''
  ocrEdit.value = ''
  ocrError.value = ''
  detected.value = null
  scanError.value = ''
  suggestions.value = []
  try {
    const { text } = await ocr.readImage(file)
    const candidates = ocrCandidates(text)
    ocrText.value = candidates.join(' · ')
    if (!candidates.length) { ocrError.value = 'Aucun texte lisible sur la photo. Rapprochez-vous, éclairez l\'inscription et recommencez.'; return }
    // Lecture exacte d'une des références → fiche directement
    for (const c of candidates) {
      const p = findExact(stock.activePieces, c)
      if (p) { ocrEdit.value = p.ref; select(p, c); return }
    }
    suggestions.value = suggestPieces(stock.activePieces, candidates)
    ocrEdit.value = candidates.sort((a, b) => b.length - a.length)[0] || ''
    if (!suggestions.value.length) ocrError.value = 'Aucune pièce du stock ne ressemble au texte lu. Corrigez la lecture ci-dessous ou reprenez la photo.'
  } catch (err) {
    ocrError.value = 'Lecture impossible : ' + (err instanceof Error ? err.message : String(err)) + '. Vérifiez la connexion (le moteur de lecture se télécharge la première fois).'
  }
}

function searchOcrEdit() {
  const v = ocrEdit.value.trim().toUpperCase()
  if (!v) return
  processCode(v)
}

const inCart = computed(() => detected.value ? cart.items.find(i => i.piece._id === detected.value!._id) : undefined)
const maxQty = computed(() => detected.value ? Math.max(0, detected.value.qty - (inCart.value?.qty || 0)) : 0)

function addToCart() {
  if (!detected.value) return
  if (qty.value < 1) { toast('Quantité invalide', true); return }
  if (qty.value > maxQty.value) { toast(`Stock insuffisant (max ${maxQty.value})`, true); return }
  cart.add(detected.value, qty.value, detected.value.price || 0)
  toast(`✓ ${detected.value.ref} ajouté au panier`)
  detected.value = null
}

const totalQty = computed(() => cart.items.reduce((a, i) => a + i.qty, 0))

onMounted(() => {
  // Arrivée depuis une fiche produit : /scanner?ref=XXX
  const pre = String(route.query.ref || '')
  if (pre) { tab.value = 'manual'; processCode(pre.toUpperCase()) }
  else void startCam()
})
onUnmounted(() => { stopCam(); if (ocrPreview.value) URL.revokeObjectURL(ocrPreview.value) })
</script>

<template>
  <div class="max-w-[720px] mx-auto space-y-3">
    <!-- En-tête (desktop) -->
    <div class="hidden lg:flex items-center gap-3">
      <router-link to="/" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour"><AppIcon name="arrow-left" class="w-4 h-4" /></router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Scanner une commande</h1>
        <p class="page-subtitle">Scannez les pièces pour les sortir du stock</p>
      </div>
    </div>

    <!-- Onglets -->
    <div class="flex rounded-xl bg-white border border-gray-200 p-1 text-[13px] font-semibold">
      <button class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'camera' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchTab('camera')"><AppIcon name="camera" class="w-4 h-4" /> Caméra</button>
      <button class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'ocr' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchTab('ocr')"><AppIcon name="edit" class="w-4 h-4" /> Réf. écrite</button>
      <button class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'manual' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchTab('manual')"><AppIcon name="keyboard" class="w-4 h-4" /> Saisie</button>
    </div>

    <!-- Caméra -->
    <div v-show="tab === 'camera'" class="relative rounded-2xl overflow-hidden bg-gray-900 min-h-[300px] lg:min-h-[360px]">
      <div id="camera-view" class="w-full"></div>
      <div v-if="isScanning" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div class="w-[72%] max-w-[320px] aspect-[16/9] relative">
          <span class="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3px] border-l-[3px] border-brand rounded-tl-md"></span>
          <span class="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3px] border-r-[3px] border-brand rounded-tr-md"></span>
          <span class="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3px] border-l-[3px] border-brand rounded-bl-md"></span>
          <span class="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3px] border-r-[3px] border-brand rounded-br-md"></span>
        </div>
      </div>
      <button v-if="isScanning" class="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center" :class="torch ? 'bg-brand text-gray-900' : 'bg-white/15 text-white hover:bg-white/25'" @click="toggleTorch" aria-label="Flash" title="Flash">
        <AppIcon name="zap" class="w-5 h-5" />
      </button>
      <div v-if="!isScanning" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2 p-4 text-center">
        <AppIcon name="camera" class="w-8 h-8" />
        <span class="text-sm">{{ camError ? 'Caméra inaccessible' : 'Caméra arrêtée' }}</span>
        <span v-if="camError" class="text-[12px] text-gray-500">Autorisez l'accès à la caméra, puis réessayez.</span>
        <button @click="startCam" class="btn btn-primary btn-sm mt-1"><AppIcon name="camera" class="w-4 h-4" /> Activer la caméra</button>
      </div>
      <div v-else class="absolute bottom-0 inset-x-0 bg-gray-900/70 text-white text-[12px] text-center py-1.5">Placez le code-barres dans le cadre</div>
    </div>

    <!-- Saisie manuelle / douchette -->
    <div v-show="tab === 'manual'" class="card p-4">
      <label class="label">Référence</label>
      <div class="flex gap-2 mt-1">
        <input v-model="usbInput" @keydown.enter="processUSB" placeholder="ex : ALT-PFU-001" class="input font-mono uppercase placeholder:normal-case h-11" autocapitalize="characters" autofocus>
        <button @click="processUSB" class="btn btn-primary px-4" aria-label="Rechercher"><AppIcon name="search" class="w-4 h-4" /></button>
      </div>
      <p class="text-[12px] text-gray-500 mt-2">Tapez la référence ou utilisez une douchette USB : le code est traité à l'appui sur Entrée.</p>
    </div>

    <!-- Référence écrite à la main : photo + lecture du texte -->
    <div v-show="tab === 'ocr'" class="card p-4 space-y-3">
      <div class="flex gap-3">
        <button type="button" class="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center text-gray-400" @click="ocrInput?.click()" aria-label="Photographier la référence">
          <img v-if="ocrPreview" :src="ocrPreview" class="w-full h-full object-cover" alt="">
          <AppIcon v-else name="camera" class="w-7 h-7" />
        </button>
        <div class="flex-1 min-w-0">
          <div class="text-[14px] font-semibold text-gray-900">Référence écrite sur la pièce</div>
          <p class="text-[12px] text-gray-500 mt-0.5">Photographiez l'inscription de près, bien éclairée et droite. La pièce s'affiche si la lecture est sûre, sinon les pièces les plus proches sont proposées.</p>
          <button type="button" class="btn btn-primary btn-sm mt-2" :disabled="ocr.busy.value" @click="ocrInput?.click()"><AppIcon name="camera" class="w-4 h-4" /> {{ ocrPreview ? 'Reprendre la photo' : 'Photographier' }}</button>
          <input ref="ocrInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onOcrFile">
        </div>
      </div>
      <div v-if="ocr.busy.value" class="space-y-1">
        <div class="text-[12px] text-gray-600">{{ ocr.status.value }}</div>
        <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-brand transition-all" :style="{ width: Math.round(ocr.progress.value * 100) + '%' }"></div></div>
      </div>
      <div v-if="ocrText && !ocr.busy.value" class="text-[12px] text-gray-500">Texte lu : <span class="font-mono text-gray-800">{{ ocrText }}</span></div>
      <div v-if="ocrError" class="text-[12px] text-red-600">{{ ocrError }}</div>
      <div v-if="ocrPreview && !ocr.busy.value" class="flex gap-2">
        <input v-model="ocrEdit" @keydown.enter="searchOcrEdit" placeholder="Corriger la lecture…" class="input font-mono uppercase placeholder:normal-case h-11" autocapitalize="characters">
        <button type="button" @click="searchOcrEdit" class="btn btn-secondary px-4" aria-label="Rechercher"><AppIcon name="search" class="w-4 h-4" /></button>
      </div>
    </div>

    <div v-if="scanError && !suggestions.length" class="bg-red-50 border border-red-200 rounded-xl p-3">
      <div class="text-red-700 text-sm font-semibold">Code inconnu : {{ scanError }}</div>
      <div class="text-red-600/80 text-[12px] mt-0.5">Cette référence n'existe pas dans le stock actif.</div>
    </div>

    <!-- Pièces proches : sélection manuelle quand la lecture n'est pas sûre -->
    <div v-if="suggestions.length" class="card p-3 border-amber-200">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><AppIcon name="alert" class="w-4 h-4" /></span>
        <div class="min-w-0">
          <div class="text-[14px] font-semibold text-gray-900">Lecture incertaine : <span class="font-mono">{{ scanError }}</span></div>
          <div class="text-[12px] text-gray-500">Choisissez la bonne pièce parmi les plus proches.</div>
        </div>
      </div>
      <div class="divide-y divide-gray-100">
        <button v-for="s in suggestions" :key="s.piece._id" type="button" class="w-full flex items-center gap-3 py-2 text-left hover:bg-gray-50 rounded-lg px-1" @click="select(s.piece, scanError)">
          <span class="w-11 h-11 thumb shrink-0"><img v-if="s.piece.photo" :src="s.piece.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><span class="badge-ref">{{ s.piece.ref }}</span><span v-if="s.field === 'oem'" class="text-[11px] text-gray-500">OEM {{ s.piece.oem }}</span></span>
            <span class="block text-[13px] font-medium text-gray-900 truncate">{{ s.piece.name }}</span>
            <span class="block text-[12px] text-gray-500">Stock : {{ s.piece.qty }} · {{ s.piece.zone || '—' }}</span>
          </span>
          <span class="badge shrink-0" :class="scoreLabel(s.score).cls">{{ scoreLabel(s.score).text }}</span>
          <AppIcon name="chevron-right" class="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>
    </div>

    <!-- Pièce détectée -->
    <div v-if="detected" class="card p-3 border-green-200">
      <div class="flex items-center gap-3">
        <span class="w-14 h-14 thumb"><img v-if="detected.photo" :src="detected.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-5 h-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2"><span class="badge-ref">{{ detected.ref }}</span><span v-if="detected.cat" class="badge hidden sm:inline-flex" :class="[cats.info(detected.cat).bgClass, cats.info(detected.cat).textClass]">{{ cats.info(detected.cat).label }}</span></div>
          <div class="text-[14px] font-semibold text-gray-900 truncate">{{ detected.name }}</div>
          <div class="text-[12px] text-gray-500">En stock : <strong :class="maxQty > 0 ? 'text-green-600' : 'text-red-600'">{{ maxQty }}</strong><span v-if="inCart"> (+{{ inCart.qty }} au panier)</span> · <strong class="text-gray-900">{{ formatPrice(detected.price || 0) }}</strong></div>
        </div>
        <span class="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0"><AppIcon name="check" class="w-4 h-4" :stroke-width="3" /></span>
      </div>
      <div class="flex items-center gap-2 mt-3">
        <div class="qty-stepper">
          <button @click="qty = Math.max(1, qty - 1)" aria-label="Moins"><AppIcon name="minus" class="w-4 h-4" /></button>
          <span>{{ qty }}</span>
          <button @click="qty = Math.min(Math.max(1, maxQty), qty + 1)" aria-label="Plus"><AppIcon name="plus" class="w-4 h-4" /></button>
        </div>
        <button v-if="auth.hasPerm('vendeur')" @click="addToCart" :disabled="maxQty < 1" class="btn btn-primary flex-1 py-2.5"><AppIcon name="cart" class="w-4 h-4" /> Ajouter au panier</button>
        <router-link v-else :to="`/piece/${detected._id}`" class="btn btn-secondary flex-1">Voir la fiche</router-link>
        <router-link :to="`/piece/${detected._id}`" class="icon-btn border border-gray-200 w-10 h-10" title="Fiche produit"><AppIcon name="eye" class="w-4 h-4" /></router-link>
      </div>
    </div>

    <!-- Panier de sortie -->
    <router-link to="/panier" class="card p-3 flex items-center gap-3 hover:border-gray-300">
      <span class="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center"><AppIcon name="cart" class="w-5 h-5" /></span>
      <span class="flex-1 text-[14px] font-semibold text-gray-900">Panier de sortie</span>
      <span class="text-[13px] font-semibold text-gray-700">{{ totalQty }} pièce{{ totalQty > 1 ? 's' : '' }}</span>
      <AppIcon name="chevron-right" class="w-4 h-4 text-gray-400" />
    </router-link>

    <!-- Journal -->
    <details v-if="scanLog.length" class="card p-3">
      <summary class="text-[13px] font-semibold text-gray-700 cursor-pointer">Derniers scans ({{ scanLog.length }})</summary>
      <div class="divide-y divide-gray-100 mt-2">
        <div v-for="(entry, i) in scanLog.slice(0, 10)" :key="i" class="flex items-center gap-3 py-1.5 text-[13px]">
          <span class="text-gray-400 text-[12px] font-mono w-16 shrink-0">{{ entry.time }}</span>
          <span class="badge-ref">{{ entry.code }}</span>
          <span class="flex-1 truncate text-gray-800">{{ entry.name }}</span>
          <span class="badge" :class="entry.found ? 'badge-green' : 'badge-red'">{{ entry.found ? 'Trouvé' : 'Inconnu' }}</span>
        </div>
      </div>
    </details>
  </div>
</template>
