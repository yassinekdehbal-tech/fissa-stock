<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Piece } from '@/types'
import { CATEGORIES } from '@/types'
import { formatPrice } from '@/utils/format'

const route = useRoute()
const stock = useStockStore()
const cart = useCartStore()
const auth = useAuthStore()
const { toast } = useToast()

const tab = ref<'camera' | 'manual'>('camera')
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

function switchTab(t: 'camera' | 'manual') {
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

function processCode(code: string) {
  const p = stock.findByRef(code)
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  if (p) {
    scanError.value = ''
    detected.value = p
    qty.value = 1
    scanLog.value.unshift({ time, code: p.ref, found: true, name: p.name })
    if (navigator.vibrate) navigator.vibrate(60)
  } else {
    scanError.value = code
    detected.value = null
    toast('Code inconnu : ' + code, true)
    scanLog.value.unshift({ time, code, found: false, name: 'Inconnu' })
  }
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
onUnmounted(() => { stopCam() })
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
      <button class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'manual' ? 'bg-brand text-gray-900' : 'text-gray-500'" @click="switchTab('manual')"><AppIcon name="keyboard" class="w-4 h-4" /> Saisie manuelle</button>
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

    <div v-if="scanError" class="bg-red-50 border border-red-200 rounded-xl p-3">
      <div class="text-red-700 text-sm font-semibold">Code inconnu : {{ scanError }}</div>
      <div class="text-red-600/80 text-[12px] mt-0.5">Cette référence n'existe pas dans le stock actif.</div>
    </div>

    <!-- Pièce détectée -->
    <div v-if="detected" class="card p-3 border-green-200">
      <div class="flex items-center gap-3">
        <span class="w-14 h-14 thumb"><img v-if="detected.photo" :src="detected.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-5 h-5" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2"><span class="badge-ref">{{ detected.ref }}</span><span v-if="detected.cat && CATEGORIES[detected.cat]" class="badge hidden sm:inline-flex" :class="[CATEGORIES[detected.cat].bgClass, CATEGORIES[detected.cat].textClass]">{{ CATEGORIES[detected.cat].label }}</span></div>
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
