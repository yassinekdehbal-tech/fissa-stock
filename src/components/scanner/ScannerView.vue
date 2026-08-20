<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
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

const SOURCES: Record<string, string> = {
  'demontage': 'Démontage',
  'don': 'Don',
  'lot-occasion': "Lot d'occasion",
  'grossiste-neuf': 'Grossiste neuf',
  'web': 'Web',
  'autre': 'Autre',
}

const isScanning = ref(false)
const camError = ref('')
const usbInput = ref('')
const scanLog = ref<{ time: string; code: string; found: boolean; name: string }[]>([])

let html5QrCode: any = null
let lastCode = ''
let lastCodeTime = 0

// La caméra démarre seule à l'ouverture de l'écran ; le scan est mis en
// pause pendant que la fiche pièce est ouverte, puis reprend à sa fermeture.
async function startCam() {
  if (isScanning.value) return
  camError.value = ''
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
    camError.value = e?.message || 'Caméra inaccessible'
    isScanning.value = false
  }
}

function stopCam() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {})
    html5QrCode = null
  }
  isScanning.value = false
}

function pauseCam() {
  try { html5QrCode?.pause(true) } catch { /* déjà arrêté */ }
}

function resumeCam() {
  try { html5QrCode?.resume() } catch { /* caméra coupée entre-temps */ }
}

function processUSB() {
  const val = usbInput.value.trim().toUpperCase()
  if (!val) return
  usbInput.value = ''
  processCode(val)
}

const scanError = ref('')

function processCode(code: string) {
  const p = stock.findByRef(code)
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (p) {
    scanError.value = ''
    scanLog.value.unshift({ time, code: p.ref, found: true, name: p.name })
    openFiche(p)
  } else {
    scanError.value = code
    toast('Code inconnu : ' + code, true)
    scanLog.value.unshift({ time, code, found: false, name: 'Inconnu' })
  }
}

// ---------------------------------------------------------------------------
// Fiche pièce (modal) : consultation, édition, panier
// ---------------------------------------------------------------------------
const fiche = ref<Piece | null>(null)
const ficheOpen = ref(false)
const editing = ref(false)
const saving = ref(false)
const editForm = ref({ name: '', price: 0, qty: 0, zone: '', notes: '' })

const cartQty = ref(1)
const cartPrice = ref(0)

function openFiche(p: Piece) {
  fiche.value = p
  editing.value = false
  cartQty.value = 1
  cartPrice.value = p.price || 0
  ficheOpen.value = true
  pauseCam()
}

function closeFiche() {
  ficheOpen.value = false
  editing.value = false
  fiche.value = null
  resumeCam()
}

function startEdit() {
  if (!fiche.value) return
  editForm.value = {
    name: fiche.value.name,
    price: fiche.value.price,
    qty: fiche.value.qty,
    zone: fiche.value.zone,
    notes: fiche.value.notes,
  }
  editing.value = true
}

async function saveEdit() {
  if (!fiche.value?._id) return
  saving.value = true
  try {
    await stock.updatePiece(fiche.value._id, {
      name: editForm.value.name.trim(),
      price: editForm.value.price,
      qty: editForm.value.qty,
      zone: editForm.value.zone.trim(),
      notes: editForm.value.notes.trim(),
    })
    const fresh = stock.findByRef(fiche.value.ref)
    if (fresh) fiche.value = fresh
    editing.value = false
    toast('✓ Fiche mise à jour')
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    saving.value = false
  }
}

function addToCart() {
  if (!fiche.value) return
  if (cartQty.value < 1 || cartPrice.value <= 0) { toast('Valeurs invalides', true); return }
  if (cartQty.value > fiche.value.qty) { toast('Stock insuffisant', true); return }
  cart.add(fiche.value, cartQty.value, cartPrice.value)
  toast(`✓ ${fiche.value.ref} ajouté au panier`)
  closeFiche()
}

onMounted(() => { void startCam() })
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
        <span>{{ isScanning ? 'Visez un code-barres…' : camError ? 'Caméra inaccessible' : 'Caméra arrêtée' }}</span>
      </div>

      <div v-if="camError" class="mt-3 bg-[#21262d] border border-red-500/50 rounded-lg p-3 text-xs text-[#8b949e]">
        <div class="text-red-400 font-semibold mb-1">{{ camError }}</div>
        Autorisez l'accès à la caméra dans votre navigateur, puis réessayez.
        <button @click="startCam" class="block mt-2 bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">↻ Réessayer</button>
      </div>

      <div class="flex gap-2 mt-3 flex-wrap">
        <button v-if="isScanning" @click="stopCam" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase hover:text-[#e6edf3]">⏹ Couper la caméra</button>
        <button v-if="auth.hasPerm('vendeur')" @click="$router.push('/panier')" class="bg-[#f0883e] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">
          🛒 Panier ({{ cart.count }})
        </button>
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

    <!-- Fiche pièce -->
    <BaseModal :title="fiche ? '🔩 ' + fiche.ref : ''" :open="ficheOpen" @close="closeFiche" max-width="480px">
      <div v-if="fiche">
        <img v-if="fiche.photo" :src="fiche.photo" class="w-full max-h-44 object-cover rounded-lg border border-[#30363d] mb-3" @error="($event.target as HTMLImageElement).style.display='none'">

        <!-- Consultation -->
        <template v-if="!editing">
          <div class="text-base font-semibold">{{ fiche.name }}</div>
          <div v-if="fiche.cat && CATEGORIES[fiche.cat]" class="text-[11px] mt-0.5" :class="CATEGORIES[fiche.cat].textClass">
            {{ CATEGORIES[fiche.cat].icon }} {{ CATEGORIES[fiche.cat].label }}
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
            <div><span class="text-[#8b949e]">Stock</span><div class="font-mono font-bold" :class="fiche.qty <= 1 ? 'text-red-400' : 'text-[#e6a817]'">{{ fiche.qty }}</div></div>
            <div><span class="text-[#8b949e]">Prix</span><div class="font-mono font-bold text-[#3fb950]">{{ (fiche.price || 0).toFixed(2) }} €</div></div>
            <div><span class="text-[#8b949e]">Zone</span><div class="font-mono">{{ fiche.zone || '—' }}</div></div>
            <div><span class="text-[#8b949e]">État</span><div>{{ fiche.etat || '—' }}</div></div>
            <div><span class="text-[#8b949e]">Véhicule</span><div>{{ fiche.vehicle || '—' }}</div></div>
            <div><span class="text-[#8b949e]">OEM</span><div class="font-mono">{{ fiche.oem || '—' }}</div></div>
            <div><span class="text-[#8b949e]">Provenance</span><div>{{ SOURCES[fiche.source] || fiche.source }}</div></div>
            <div><span class="text-[#8b949e]">Donneur</span><div>{{ fiche.donor || '—' }}</div></div>
          </div>
          <div v-if="fiche.notes" class="mt-2 text-xs text-[#8b949e] bg-[#0d1117] border border-[#30363d] rounded-lg p-2">{{ fiche.notes }}</div>

          <!-- Panier -->
          <div v-if="auth.hasPerm('vendeur') && fiche.qty > 0" class="mt-4 pt-3 border-t border-[#30363d]">
            <div class="grid grid-cols-2 gap-2.5">
              <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Quantité</label><input v-model.number="cartQty" type="number" min="1" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
              <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prix (€)</label><input v-model.number="cartPrice" type="number" step="0.01" min="0.01" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
            </div>
          </div>

          <div class="flex gap-2 mt-4 flex-wrap">
            <button v-if="auth.hasPerm('vendeur') && fiche.qty > 0" @click="addToCart" class="bg-[#3fb950] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">🛒 Panier</button>
            <button v-if="auth.isAdmin || auth.hasPerm('magasinier')" @click="startEdit" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">✏ Modifier</button>
            <button @click="closeFiche" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase ml-auto">Fermer</button>
          </div>
        </template>

        <!-- Édition -->
        <template v-else>
          <div class="grid grid-cols-2 gap-2.5">
            <div class="flex flex-col gap-1 col-span-2"><label class="text-[11px] text-[#8b949e] uppercase">Désignation</label><input v-model="editForm.name" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
            <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prix (€)</label><input v-model.number="editForm.price" type="number" step="0.01" min="0" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
            <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Quantité</label><input v-model.number="editForm.qty" type="number" min="0" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
            <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Zone</label><input v-model="editForm.zone" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
            <div class="flex flex-col gap-1 col-span-2"><label class="text-[11px] text-[#8b949e] uppercase">Notes</label><textarea v-model="editForm.notes" rows="2" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></textarea></div>
          </div>
          <div class="flex gap-2 mt-4">
            <button @click="saveEdit" :disabled="saving" class="bg-[#3fb950] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase disabled:opacity-50">{{ saving ? '…' : '💾 Enregistrer' }}</button>
            <button @click="editing = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase">Annuler</button>
          </div>
        </template>
      </div>
    </BaseModal>
  </div>
</template>
