<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import type { Piece } from '@/types'
import { CATEGORIES } from '@/types'

const stock = useStockStore()
const cart = useCartStore()
const auth = useAuthStore()
const { toast } = useToast()

const isScanning = ref(false)
const scanResult = ref<Piece | null>(null)
const scanError = ref('')
const usbInput = ref('')
const scanLog = ref<{ time: string; code: string; found: boolean; name: string }[]>([])

let html5QrCode: any = null
let lastCode = ''
let lastCodeTime = 0

async function toggleCam() {
  if (isScanning.value) { stopCam(); return }
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    html5QrCode = new Html5Qrcode('camera-view')
    await html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 130 } },
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
  } catch (e: any) {
    toast('Caméra inaccessible: ' + e.message, true)
  }
}

function stopCam() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {})
    html5QrCode = null
  }
  isScanning.value = false
}

function processUSB() {
  const val = usbInput.value.trim().toUpperCase()
  if (!val) return
  usbInput.value = ''
  processCode(val)
}

function processCode(code: string) {
  const p = stock.findByRef(code)
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (p) {
    scanResult.value = p
    scanError.value = ''
    toast('✓ ' + p.ref + ' — ' + p.name)
    scanLog.value.unshift({ time, code: p.ref, found: true, name: p.name })
  } else {
    scanResult.value = null
    scanError.value = code
    toast('Code inconnu : ' + code, true)
    scanLog.value.unshift({ time, code, found: false, name: 'Inconnu' })
  }
}

// Cart from scan
const cartModalOpen = ref(false)
const cartQty = ref(1)
const cartPrice = ref(0)

function openAddCart(p: Piece) {
  cartQty.value = 1
  cartPrice.value = p.price || 0
  cartModalOpen.value = true
}

function addToCart() {
  if (!scanResult.value) return
  if (cartQty.value < 1 || cartPrice.value <= 0) { toast('Valeurs invalides', true); return }
  if (cartQty.value > scanResult.value.qty) { toast('Stock insuffisant', true); return }
  cart.add(scanResult.value, cartQty.value, cartPrice.value)
  cartModalOpen.value = false
  toast(`✓ ${scanResult.value.ref} ajouté au panier`)
}

onUnmounted(() => { stopCam() })
</script>

<template>
  <div>
    <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
      <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">Scanner par caméra</div>

      <div class="relative w-full max-w-[440px]">
        <div id="camera-view" class="w-full rounded-lg overflow-hidden border-2 border-[#30363d] bg-black min-h-[160px]"></div>
      </div>

      <div class="flex items-center gap-2 mt-2 text-[11px] font-mono text-[#8b949e]">
        <div class="w-2 h-2 rounded-full" :class="isScanning ? 'bg-green-400 animate-pulse' : 'bg-[#8b949e]'"></div>
        <span>{{ isScanning ? 'Scanning…' : 'Caméra arrêtée' }}</span>
      </div>

      <div class="flex gap-2 mt-3 flex-wrap">
        <button @click="toggleCam" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">
          {{ isScanning ? '⏹ Arrêter' : '▶ Démarrer' }}
        </button>
        <button v-if="auth.hasPerm('vendeur')" @click="$router.push('/panier')" class="bg-[#f0883e] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">
          🛒 Panier ({{ cart.count }})
        </button>
      </div>

      <!-- Scan result -->
      <div v-if="scanResult" class="mt-4 bg-[#21262d] border-2 border-green-500 rounded-xl p-3.5">
        <div class="flex items-center gap-2.5 flex-wrap">
          <img v-if="scanResult.photo" :src="scanResult.photo" class="w-14 h-14 object-cover rounded-md border border-[#30363d]" @error="($event.target as HTMLImageElement).style.display='none'">
          <div class="flex-1">
            <div class="font-mono text-[15px] font-bold text-[#e6a817]">
              {{ scanResult.ref }}
              <span v-if="scanResult.cat && CATEGORIES[scanResult.cat]" class="text-[10px] ml-1" :class="CATEGORIES[scanResult.cat].textClass">{{ CATEGORIES[scanResult.cat].icon }} {{ CATEGORIES[scanResult.cat].label }}</span>
            </div>
            <div class="text-sm font-semibold mt-0.5">{{ scanResult.name }}</div>
            <div class="text-[11px] text-[#8b949e]">
              <span v-if="scanResult.vehicle">🚗 {{ scanResult.vehicle }} </span>
              📍 {{ scanResult.zone || '—' }}
              📦 <strong :class="scanResult.qty <= 1 ? 'text-red-400' : 'text-[#e6a817]'">{{ scanResult.qty }}</strong>
            </div>
            <div v-if="scanResult.price" class="text-[#3fb950] font-mono text-xs font-semibold mt-1">Prix : {{ scanResult.price.toFixed(2) }} €</div>
          </div>
        </div>
        <div v-if="auth.hasPerm('vendeur')" class="flex gap-2 mt-2">
          <button @click="openAddCart(scanResult)" class="bg-[#3fb950] text-black font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg">🛒 Ajouter au panier</button>
        </div>
      </div>

      <div v-if="scanError" class="mt-4 bg-[#21262d] border-2 border-red-500 rounded-xl p-3.5">
        <div class="text-red-400 font-mono text-sm font-bold">Code inconnu : {{ scanError }}</div>
        <div class="text-[#8b949e] text-xs mt-1">Cette référence n'existe pas dans le stock actif.</div>
      </div>

      <!-- USB input -->
      <div class="mt-5">
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-2">Douchette USB</div>
        <div class="flex gap-2">
          <input
            v-model="usbInput"
            @keydown.enter="processUSB"
            placeholder="Code reçu…"
            class="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"
          >
          <button @click="processUSB" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg">OK</button>
        </div>
      </div>
    </div>

    <!-- Log -->
    <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mt-4">
      <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3">Journal des scans</div>
      <div v-if="!scanLog.length" class="text-[#8b949e] text-xs text-center py-3">Aucun scan</div>
      <div v-for="(entry, i) in scanLog" :key="i" class="flex items-center gap-2 py-1.5 border-b border-[#30363d] font-mono text-[10px]">
        <span class="text-[#8b949e] min-w-[55px]">{{ entry.time }}</span>
        <span class="text-[#e6a817] font-bold">{{ entry.code }}</span>
        <span class="flex-1">{{ entry.name }}</span>
        <span :class="entry.found ? 'text-green-400' : 'text-red-400'">{{ entry.found ? '✓' : '✕' }}</span>
      </div>
    </div>

    <!-- Add to cart modal -->
    <BaseModal title="🛒 Ajouter au panier" :open="cartModalOpen" @close="cartModalOpen = false" max-width="400px">
      <div v-if="scanResult" class="mb-3 text-sm">
        <span class="font-mono text-[#e6a817] font-bold">{{ scanResult.ref }}</span> — {{ scanResult.name }}
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Quantité</label><input v-model.number="cartQty" type="number" min="1" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prix (€)</label><input v-model.number="cartPrice" type="number" step="0.01" min="0.01" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
      </div>
      <div class="flex gap-2 mt-3.5">
        <button @click="addToCart" class="bg-[#3fb950] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">Ajouter</button>
        <button @click="cartModalOpen = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase">Annuler</button>
      </div>
    </BaseModal>
  </div>
</template>
