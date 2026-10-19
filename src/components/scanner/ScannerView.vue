<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Piece } from '@/types'
import { CATEGORIES } from '@/types'
import { formatPrice } from '@/utils/format'

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

const tab = ref<'camera' | 'manual'>('camera')
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

// Panier (colonne de droite)
function setQty(index: number, qty: number) {
  const item = cart.items[index]
  if (!item) return
  if (qty < 1) { cart.remove(index); return }
  if (qty > item.piece.qty) { toast(`Stock insuffisant (max ${item.piece.qty})`, true); return }
  cart.updateQty(index, qty)
}

const totalQty = () => cart.items.reduce((a, i) => a + i.qty, 0)

onMounted(() => { void startCam() })
onUnmounted(() => { stopCam() })
</script>

<template>
  <div class="space-y-4">
    <!-- En-tête -->
    <div class="flex items-center gap-3">
      <router-link to="/stock" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour au stock">
        <AppIcon name="arrow-left" class="w-4 h-4" />
      </router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Scanner une commande</h1>
        <p class="page-subtitle">Scannez les pièces pour les sortir du stock</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <!-- Scanner -->
      <div class="lg:col-span-3 space-y-4">
        <div class="card p-4">
          <!-- Onglets -->
          <div class="flex rounded-lg bg-gray-100 p-1 text-[13px] font-semibold mb-4">
            <button class="flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'camera' ? 'bg-brand text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'" @click="tab = 'camera'">
              <AppIcon name="camera" class="w-4 h-4" /> Caméra
            </button>
            <button class="flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition-colors" :class="tab === 'manual' ? 'bg-brand text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'" @click="tab = 'manual'">
              <AppIcon name="keyboard" class="w-4 h-4" /> Saisie manuelle
            </button>
          </div>

          <!-- Vue caméra (toujours montée pour que html5-qrcode garde son conteneur) -->
          <div v-show="tab === 'camera'">
            <div class="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-200 min-h-[260px]">
              <div id="camera-view" class="w-full"></div>
              <div v-if="isScanning" class="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div class="w-[70%] max-w-[300px] aspect-[16/9] relative">
                  <span class="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-[3px] border-l-[3px] border-brand rounded-tl"></span>
                  <span class="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-[3px] border-r-[3px] border-brand rounded-tr"></span>
                  <span class="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-[3px] border-l-[3px] border-brand rounded-bl"></span>
                  <span class="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-[3px] border-r-[3px] border-brand rounded-br"></span>
                </div>
              </div>
              <div v-if="!isScanning" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                <AppIcon name="camera" class="w-8 h-8" />
                <span class="text-sm">{{ camError ? 'Caméra inaccessible' : 'Caméra arrêtée' }}</span>
                <span v-if="!camError" class="text-[12px] text-gray-500">Activez la caméra pour scanner</span>
              </div>
              <div v-if="isScanning" class="absolute bottom-0 inset-x-0 bg-gray-900/70 text-white text-[12px] text-center py-1.5">Placez le code-barres dans le cadre</div>
            </div>
            <div class="flex gap-2 mt-3">
              <button v-if="!isScanning" @click="startCam" class="btn btn-primary flex-1"><AppIcon name="camera" class="w-4 h-4" /> Activer la caméra</button>
              <button v-else @click="stopCam" class="btn btn-secondary flex-1"><AppIcon name="x" class="w-4 h-4" /> Couper la caméra</button>
            </div>
            <div v-if="camError" class="mt-3 text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              Autorisez l'accès à la caméra dans votre navigateur, puis réessayez. ({{ camError }})
            </div>
          </div>

          <!-- Saisie manuelle / douchette USB -->
          <div v-show="tab === 'manual'" class="space-y-2">
            <p class="text-[12px] text-gray-500">Tapez la référence ou utilisez une douchette USB : le code est traité à l'appui sur Entrée.</p>
          </div>

          <div class="mt-4">
            <label class="label">Saisir un code manuellement</label>
            <div class="flex gap-2 mt-1">
              <input
                v-model="usbInput"
                @keydown.enter="processUSB"
                placeholder="ex : ALT-PFU-001"
                class="input font-mono uppercase placeholder:normal-case"
                autocapitalize="characters"
              >
              <button @click="processUSB" class="btn btn-primary px-3" aria-label="Rechercher"><AppIcon name="search" class="w-4 h-4" /></button>
            </div>
          </div>

          <div v-if="scanError" class="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <div class="text-red-700 text-sm font-semibold">Code inconnu : {{ scanError }}</div>
            <div class="text-red-600/80 text-[12px] mt-0.5">Cette référence n'existe pas dans le stock actif.</div>
          </div>
        </div>

        <!-- Journal -->
        <div class="card p-4">
          <div class="card-title">Journal des scans</div>
          <div v-if="!scanLog.length" class="text-gray-500 text-[13px] text-center py-4">Aucun scan pour le moment</div>
          <div v-else class="divide-y divide-gray-100">
            <div v-for="(entry, i) in scanLog" :key="i" class="flex items-center gap-3 py-2 text-[13px]">
              <span class="text-gray-400 text-[12px] font-mono w-16 shrink-0">{{ entry.time }}</span>
              <span class="badge-ref">{{ entry.code }}</span>
              <span class="flex-1 truncate text-gray-800">{{ entry.name }}</span>
              <span class="badge" :class="entry.found ? 'badge-green' : 'badge-red'">{{ entry.found ? 'Trouvé' : 'Inconnu' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Panier de sortie -->
      <div class="lg:col-span-2 card p-4 lg:sticky lg:top-20">
        <div class="card-title justify-between">
          <span class="inline-flex items-center gap-2"><AppIcon name="cart" class="w-4 h-4 text-gray-500" /> Panier de sortie</span>
          <button v-if="cart.items.length" @click="cart.clear()" class="btn btn-secondary btn-sm">Vider</button>
        </div>

        <div v-if="!cart.items.length" class="text-center py-10 text-gray-500 text-[13px]">
          <AppIcon name="scan" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
          Scannez une pièce pour l'ajouter au panier.
        </div>

        <div v-else class="divide-y divide-gray-100">
          <div v-for="(item, idx) in cart.items" :key="item.piece._id" class="flex items-center gap-3 py-2.5">
            <span class="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 text-gray-400">
              <img v-if="item.piece.photo" :src="item.piece.photo" class="w-full h-full object-cover" alt="">
              <AppIcon v-else name="package" class="w-4 h-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="badge-ref">{{ item.piece.ref }}</div>
              <div class="text-[12px] text-gray-700 truncate mt-0.5">{{ item.piece.name }}</div>
            </div>
            <div class="flex items-center rounded-lg border border-gray-200 overflow-hidden">
              <button @click="setQty(idx, item.qty - 1)" class="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Moins"><AppIcon name="minus" class="w-3.5 h-3.5" /></button>
              <span class="w-7 text-center text-[13px] font-semibold text-gray-900">{{ item.qty }}</span>
              <button @click="setQty(idx, item.qty + 1)" class="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100" aria-label="Plus"><AppIcon name="plus" class="w-3.5 h-3.5" /></button>
            </div>
            <button @click="cart.remove(idx)" class="icon-btn icon-btn-danger" title="Retirer"><AppIcon name="trash" class="w-4 h-4" /></button>
          </div>
        </div>

        <div v-if="cart.items.length" class="mt-3 pt-3 border-t border-gray-200">
          <div class="flex items-center justify-between text-[13px] text-gray-600">
            <span>Total :</span>
            <span class="text-base font-bold text-gray-900">{{ totalQty() }} pièce{{ totalQty() > 1 ? 's' : '' }} · {{ formatPrice(cart.total) }}</span>
          </div>
          <router-link v-if="auth.hasPerm('vendeur')" to="/panier" class="btn btn-success w-full mt-3">
            Valider la sortie du stock <AppIcon name="arrow-right" class="w-4 h-4" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- Fiche pièce -->
    <BaseModal :title="fiche ? fiche.ref : ''" :open="ficheOpen" @close="closeFiche" max-width="480px">
      <div v-if="fiche">
        <img v-if="fiche.photo" :src="fiche.photo" class="w-full max-h-44 object-cover rounded-lg border border-gray-200 mb-3" @error="($event.target as HTMLImageElement).style.display='none'">

        <!-- Consultation -->
        <template v-if="!editing">
          <div class="text-base font-semibold text-gray-900">{{ fiche.name }}</div>
          <div class="flex flex-wrap gap-1.5 mt-1.5">
            <span v-if="fiche.cat && CATEGORIES[fiche.cat]" class="badge" :class="[CATEGORIES[fiche.cat].bgClass, CATEGORIES[fiche.cat].textClass]">{{ CATEGORIES[fiche.cat].label }}</span>
            <span class="badge" :class="fiche.qty <= 1 ? 'badge-red' : 'badge-green'">Stock : {{ fiche.qty }}</span>
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-[13px]">
            <div><span class="text-gray-500 text-[11px]">Prix</span><div class="font-bold text-gray-900">{{ formatPrice(fiche.price || 0) }}</div></div>
            <div><span class="text-gray-500 text-[11px]">Zone</span><div class="text-gray-900">{{ fiche.zone || '—' }}</div></div>
            <div><span class="text-gray-500 text-[11px]">État</span><div class="text-gray-900">{{ fiche.etat || '—' }}</div></div>
            <div><span class="text-gray-500 text-[11px]">Véhicule</span><div class="text-gray-900">{{ fiche.vehicle || '—' }}</div></div>
            <div><span class="text-gray-500 text-[11px]">OEM</span><div class="text-gray-900 font-mono">{{ fiche.oem || '—' }}</div></div>
            <div><span class="text-gray-500 text-[11px]">Provenance</span><div class="text-gray-900">{{ SOURCES[fiche.source] || fiche.source }}</div></div>
            <div><span class="text-gray-500 text-[11px]">Donneur</span><div class="text-gray-900">{{ fiche.donor || '—' }}</div></div>
          </div>
          <div v-if="fiche.notes" class="mt-2 text-[12px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2">{{ fiche.notes }}</div>

          <!-- Panier -->
          <div v-if="auth.hasPerm('vendeur') && fiche.qty > 0" class="mt-4 pt-3 border-t border-gray-200">
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="cartQty" type="number" min="1" class="input"></div>
              <div class="flex flex-col gap-1"><label class="label">Prix (€)</label><input v-model.number="cartPrice" type="number" step="0.01" min="0.01" class="input"></div>
            </div>
          </div>

          <div class="flex gap-2 mt-4 flex-wrap">
            <button v-if="auth.hasPerm('vendeur') && fiche.qty > 0" @click="addToCart" class="btn btn-success"><AppIcon name="cart" class="w-4 h-4" /> Ajouter au panier</button>
            <button v-if="auth.isAdmin || auth.hasPerm('magasinier')" @click="startEdit" class="btn btn-secondary"><AppIcon name="edit" class="w-4 h-4" /> Modifier</button>
            <button @click="closeFiche" class="btn btn-ghost ml-auto">Fermer</button>
          </div>
        </template>

        <!-- Édition -->
        <template v-else>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1 col-span-2"><label class="label">Désignation</label><input v-model="editForm.name" class="input"></div>
            <div class="flex flex-col gap-1"><label class="label">Prix (€)</label><input v-model.number="editForm.price" type="number" step="0.01" min="0" class="input"></div>
            <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="editForm.qty" type="number" min="0" class="input"></div>
            <div class="flex flex-col gap-1"><label class="label">Zone</label><input v-model="editForm.zone" class="input"></div>
            <div class="flex flex-col gap-1 col-span-2"><label class="label">Notes</label><textarea v-model="editForm.notes" rows="2" class="input"></textarea></div>
          </div>
          <div class="flex gap-2 mt-4 justify-end">
            <button @click="editing = false" class="btn btn-secondary">Annuler</button>
            <button @click="saveEdit" :disabled="saving" class="btn btn-primary">{{ saving ? '…' : 'Enregistrer' }}</button>
          </div>
        </template>
      </div>
    </BaseModal>
  </div>
</template>
