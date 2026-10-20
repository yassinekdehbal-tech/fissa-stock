<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import { useToast } from '@/composables/useToast'
import { sanitize } from '@/utils/security'
import type { Piece, PieceCategory, PieceSource, PieceState } from '@/types'
import { formatRef } from '@/utils/format'
import BarcodeLabelModal from '@/components/stock/BarcodeLabelModal.vue'
import HandwrittenRefModal from '@/components/stock/HandwrittenRefModal.vue'
import BarcodeScanModal from '@/components/ui/BarcodeScanModal.vue'
import PhotoUploadField from '@/components/ui/PhotoUploadField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const router = useRouter()
const stock = useStockStore()
const history = useHistoryStore()
const auth = useAuthStore()
const cats = useCategoriesStore()
const { toast } = useToast()

const STEPS = [
  { n: 1, label: 'Identification' },
  { n: 2, label: 'Stock et prix' },
  { n: 3, label: 'Photo et validation' },
]
const step = ref(1)
const scanOpen = ref(false)
const saving = ref(false)

/**
 * Marquage de la pièce après enregistrement : étiquette code-barres à
 * imprimer, ou référence écrite à la main (pièce sale, grasse, sans surface
 * plane…). Le choix est mémorisé sur l'appareil.
 */
type Marking = 'barcode' | 'manual'
const MARKING_KEY = 'fissa-marking'
const marking = ref<Marking>(localStorage.getItem(MARKING_KEY) === 'manual' ? 'manual' : 'barcode')
function setMarking(m: Marking) { marking.value = m; localStorage.setItem(MARKING_KEY, m) }

const form = ref({
  ref: '', name: '', cat: '' as PieceCategory, vehicle: '', oem: '', supplier: '', donor: '',
  source: 'autre' as PieceSource, qty: 1, price: 0, threshold: 0, zone: '', etat: 'Bon état' as PieceState,
  compat: '', photo: '', notes: '', fmt: 'CODE128' as 'CODE128' | 'CODE39', publishable: false,
})

function clearForm() {
  form.value = { ref: '', name: '', cat: '', vehicle: '', oem: '', supplier: '', donor: '', source: 'autre', qty: 1, price: 0, threshold: 0, zone: '', etat: 'Bon état', compat: '', photo: '', notes: '', fmt: 'CODE128', publishable: false }
  step.value = 1
}

const SOURCES: Record<string, string> = { demontage: 'Démontage', don: 'Don', 'lot-occasion': "Lot d'occasion", 'grossiste-neuf': 'Grossiste neuf', web: 'Web', autre: 'Autre' }

const refError = computed(() => {
  if (autoRef.value) return ''
  const r = form.value.ref.trim().toUpperCase()
  if (!r) return ''
  return stock.pieces.find(p => p.ref === r) ? 'Cette référence existe déjà' : ''
})

/**
 * Référence automatique : code de la catégorie + numéro (MT0142), attribuée
 * par la base à l'enregistrement. On affiche un aperçu de la prochaine ; le
 * choix auto/manuel est mémorisé sur l'appareil.
 */
const AUTO_REF_KEY = 'fissa-ref-auto'
const autoRef = ref(localStorage.getItem(AUTO_REF_KEY) !== 'manual')
function setAutoRef(v: boolean) { autoRef.value = v; localStorage.setItem(AUTO_REF_KEY, v ? 'auto' : 'manual') }
const previewRef = ref('')
let previewSeq = 0
watch([() => form.value.cat, autoRef], async ([cat, auto]) => {
  const seq = ++previewSeq
  if (!auto || !cat) { previewRef.value = ''; return }
  try {
    const r = await cats.peekRef(cat as string)
    if (seq === previewSeq) previewRef.value = r
  } catch { if (seq === previewSeq) previewRef.value = '' }
}, { immediate: true })
const refDisplay = computed(() => autoRef.value ? (previewRef.value ? formatRef(previewRef.value) : 'Automatique') : (form.value.ref.toUpperCase() || '—'))

function scrollTop() {
  const el = document.getElementById('app-scroll')
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

function next() {
  if (step.value === 1) {
    const r = form.value.ref.trim().toUpperCase()
    if (!autoRef.value && !r) { toast('La référence est requise', true); return }
    if (refError.value) { toast(refError.value, true); return }
    if (!form.value.name.trim()) { toast('La désignation est requise', true); return }
    if (!form.value.cat) { toast('Choisissez une catégorie', true); return }
  }
  if (step.value === 2) {
    if (form.value.qty < 0) { toast('Quantité invalide', true); return }
    if (!(form.value.price > 0)) { toast('Le prix de vente est requis', true); return }
    if (!form.value.zone.trim()) { toast("La zone d'emplacement est requise", true); return }
  }
  step.value = Math.min(3, step.value + 1)
  scrollTop()
}
function prev() {
  step.value = Math.max(1, step.value - 1)
  scrollTop()
}

async function submit() {
  const r = autoRef.value ? '' : form.value.ref.trim().toUpperCase()
  const name = form.value.name.trim()
  if ((!autoRef.value && !r) || !name) { step.value = 1; toast('Référence et désignation requises', true); return }
  if (!form.value.cat) { step.value = 1; toast('Choisissez une catégorie', true); return }
  if (r && stock.pieces.find(p => p.ref === r)) { step.value = 1; toast('Référence déjà existante', true); return }

  const piece = {
    ref: sanitize(r), name: sanitize(name), cat: form.value.cat,
    vehicle: sanitize(form.value.vehicle.trim()), oem: sanitize(form.value.oem.trim()),
    supplier: sanitize(form.value.supplier.trim()), donor: sanitize(form.value.donor.trim()),
    source: form.value.source, qty: form.value.qty, price: form.value.price,
    threshold: form.value.threshold || undefined, zone: sanitize(form.value.zone.trim()), etat: form.value.etat,
    compat: sanitize(form.value.compat.trim()), photo: form.value.photo.trim(), notes: sanitize(form.value.notes.trim()),
    fmt: form.value.fmt, added: new Date().toISOString(), archived: false, publishable: form.value.publishable,
  }

  saving.value = true
  let saved: Piece
  try {
    // La base attribue la référence quand elle est vide (trigger pieces_assign_ref)
    saved = await stock.addPiece(piece as any)
    await history.addEntry({ type: 'ajout', ref: saved.ref, name, qty: form.value.qty, user: auth.currentUser?.name || '', ts: Date.now(), date: new Date().toLocaleString('fr-FR') })
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
    saving.value = false
    return
  }
  saving.value = false
  toast('✓ ' + formatRef(saved.ref) + ' enregistré !')
  // Marquage de la pièce créée : étiquette à imprimer et coller,
  // ou référence à recopier au marqueur.
  labelPiece.value = saved
  if (marking.value === 'manual') showHandwritten.value = true
  else showLabel.value = true
  clearForm()
}

const labelPiece = ref<Piece | null>(null)
const showLabel = ref(false)
const showHandwritten = ref(false)
function closeLabel() {
  showLabel.value = false
  void router.push('/stock')
}
function closeHandwritten() {
  showHandwritten.value = false
  void router.push('/stock')
}
function printFromHandwritten() {
  showHandwritten.value = false
  showLabel.value = true
}
</script>

<template>
  <div class="max-w-[720px] mx-auto space-y-4">
    <!-- En-tête (desktop) -->
    <div class="hidden lg:flex items-center gap-3">
      <router-link to="/stock" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour au stock"><AppIcon name="arrow-left" class="w-4 h-4" /></router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Ajouter une pièce</h1>
        <p class="page-subtitle">Référencer une nouvelle pièce dans le stock</p>
      </div>
    </div>

    <!-- Stepper -->
    <div class="card p-3">
      <div class="stepper">
        <template v-for="(s, i) in STEPS" :key="s.n">
          <div class="flex flex-col items-center gap-1 w-24">
            <span class="step-dot" :class="step > s.n ? 'bg-green-500 border-green-500 text-white' : step === s.n ? 'bg-brand border-brand text-gray-900' : 'bg-white border-gray-300 text-gray-400'">
              <AppIcon v-if="step > s.n" name="check" class="w-3.5 h-3.5" :stroke-width="3" /><template v-else>{{ s.n }}</template>
            </span>
            <span class="text-[10px] font-medium text-center leading-tight" :class="step >= s.n ? 'text-gray-900' : 'text-gray-400'">{{ s.label }}</span>
          </div>
          <div v-if="i < STEPS.length - 1" class="flex-1 h-0.5 -mt-4 rounded" :class="step > s.n ? 'bg-green-500' : 'bg-gray-200'"></div>
        </template>
      </div>
    </div>

    <!-- Étape 1 : identification -->
    <form v-if="step === 1" @submit.prevent="next" class="card p-4 lg:p-5 space-y-3">
      <div class="card-title">Informations principales</div>
      <div class="flex flex-col gap-1">
        <label class="label">Catégorie <span class="text-red-500">*</span></label>
        <div class="relative">
          <AppIcon name="zap" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
          <select v-model="form.cat" class="input pl-9">
            <option value="">Choisir…</option>
            <option v-for="c in cats.active" :key="c.key" :value="c.key">{{ c.label }} ({{ c.code }})</option>
          </select>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <label class="label">Référence <span class="text-red-500">*</span></label>
          <button type="button" class="text-[12px] font-semibold text-blue-600 hover:underline" @click="setAutoRef(!autoRef)">{{ autoRef ? 'Saisir moi-même' : 'Générer automatiquement' }}</button>
        </div>
        <div v-if="autoRef" class="input flex items-center gap-2 bg-gray-50 min-h-11">
          <AppIcon name="zap" class="w-4 h-4 text-amber-500 shrink-0" />
          <span v-if="previewRef" class="font-mono font-bold text-[16px] text-gray-900 tracking-wider">{{ formatRef(previewRef) }}</span>
          <span v-else class="text-[13px] text-gray-500">{{ form.cat ? 'Calcul de la prochaine référence…' : 'Choisissez une catégorie : la référence sera générée' }}</span>
        </div>
        <div v-else class="relative">
          <input v-model="form.ref" placeholder="ALT-PFU-001" class="input font-mono uppercase placeholder:normal-case pr-11" autocapitalize="characters">
          <button type="button" class="absolute right-1.5 top-1/2 -translate-y-1/2 icon-btn border border-gray-200" @click="scanOpen = true" title="Scanner le code-barres" aria-label="Scanner le code-barres"><AppIcon name="scan" class="w-4 h-4" /></button>
        </div>
        <span v-if="refError" class="text-[12px] text-red-600">{{ refError }}</span>
        <span v-else-if="autoRef && previewRef" class="text-[11px] text-gray-500">Prochaine référence de la catégorie {{ cats.label(form.cat) }} : attribuée définitivement à l'enregistrement.</span>
        <span v-else-if="!autoRef" class="text-[11px] text-gray-500">Référence libre (code-barres fournisseur, ancienne numérotation…).</span>
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Désignation <span class="text-red-500">*</span></label>
        <input v-model="form.name" placeholder="Alternateur Peugeot 308" class="input">
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Véhicule compatible</label>
        <input v-model="form.vehicle" placeholder="Peugeot 308 1.6 HDi" class="input">
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">N° OEM</label>
        <input v-model="form.oem" placeholder="5702.E2" class="input font-mono">
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Fournisseur</label>
        <input v-model="form.supplier" placeholder="Démontage, grossiste…" class="input">
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Véhicule donneur</label>
        <input v-model="form.donor" placeholder="Immatriculation ou VIN" class="input">
      </div>
      <button type="submit" class="btn btn-primary w-full py-3 mt-2">Continuer <AppIcon name="arrow-right" class="w-4 h-4" /></button>
    </form>

    <!-- Étape 2 : stock et tarif -->
    <form v-else-if="step === 2" @submit.prevent="next" class="card p-4 lg:p-5 space-y-3">
      <div class="card-title">Stock et tarif</div>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="label">Quantité <span class="text-red-500">*</span></label>
          <div class="flex items-stretch gap-1">
            <input v-model.number="form.qty" type="number" min="0" inputmode="numeric" class="input text-center">
            <div class="qty-stepper">
              <button type="button" @click="form.qty = Math.max(0, (form.qty || 0) - 1)" aria-label="Moins"><AppIcon name="minus" class="w-4 h-4" /></button>
              <button type="button" @click="form.qty = (form.qty || 0) + 1" aria-label="Plus"><AppIcon name="plus" class="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="label">Seuil d'alerte</label>
          <input v-model.number="form.threshold" type="number" min="0" inputmode="numeric" placeholder="0" class="input">
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Prix de vente (€) <span class="text-red-500">*</span></label>
        <input v-model.number="form.price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00" class="input">
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">État <span class="text-red-500">*</span></label>
        <select v-model="form.etat" class="input">
          <option>Très bon état</option><option>Bon état</option><option>État moyen</option><option>Pour pièces</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Zone d'emplacement <span class="text-red-500">*</span></label>
        <div class="relative">
          <AppIcon name="map-pin" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
          <input v-model="form.zone" placeholder="Étagère A3" class="input pl-9">
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Provenance</label>
        <select v-model="form.source" class="input">
          <option v-for="(l, k) in SOURCES" :key="k" :value="k">{{ l }}</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="label">Compatibilités</label>
        <textarea v-model="form.compat" rows="2" placeholder="ex : Peugeot 208, 308, Citroën C3…" class="input min-h-[64px]"></textarea>
      </div>
      <div class="flex gap-2 pt-1">
        <button type="button" class="btn btn-secondary flex-1 py-3" @click="prev"><AppIcon name="arrow-left" class="w-4 h-4" /> Retour</button>
        <button type="submit" class="btn btn-primary flex-1 py-3">Continuer <AppIcon name="arrow-right" class="w-4 h-4" /></button>
      </div>
    </form>

    <!-- Étape 3 : photo et validation -->
    <form v-else @submit.prevent="submit" class="space-y-4">
      <div class="card p-4 lg:p-5 space-y-3">
        <PhotoUploadField v-model="form.photo" />

        <!-- Marquage : étiquette code-barres OU référence écrite à la main -->
        <div class="flex flex-col gap-1.5">
          <label class="label">Marquage de la pièce</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="rounded-xl border-2 p-3 text-left transition-colors" :class="marking === 'barcode' ? 'border-brand bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'" @click="setMarking('barcode')" :aria-pressed="marking === 'barcode'">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center mb-2" :class="marking === 'barcode' ? 'bg-brand text-gray-900' : 'bg-gray-100 text-gray-600'"><AppIcon name="printer" class="w-5 h-5" /></span>
              <span class="block text-[13px] font-semibold text-gray-900">Étiquette code-barres</span>
              <span class="block text-[11px] text-gray-500 leading-snug mt-0.5">À imprimer et coller sur la pièce</span>
            </button>
            <button type="button" class="rounded-xl border-2 p-3 text-left transition-colors" :class="marking === 'manual' ? 'border-brand bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'" @click="setMarking('manual')" :aria-pressed="marking === 'manual'">
              <span class="w-9 h-9 rounded-lg flex items-center justify-center mb-2" :class="marking === 'manual' ? 'bg-brand text-gray-900' : 'bg-gray-100 text-gray-600'"><AppIcon name="edit" class="w-5 h-5" /></span>
              <span class="block text-[13px] font-semibold text-gray-900">Référence écrite à la main</span>
              <span class="block text-[11px] text-gray-500 leading-snug mt-0.5">Au marqueur, quand l'étiquette ne tient pas</span>
            </button>
          </div>
          <p class="text-[11px] text-gray-500 leading-snug">
            <template v-if="marking === 'barcode'">Après l'enregistrement, l'étiquette s'affiche pour impression. Le scanner lit le code-barres.</template>
            <template v-else>Après l'enregistrement, la référence s'affiche en grand pour la recopier. Le scanner la lit en mode « Réf. écrite » et propose les pièces proches en cas de doute.</template>
          </p>
        </div>
        <div v-if="marking === 'barcode'" class="flex flex-col gap-1">
          <label class="label">Format du code-barres</label>
          <select v-model="form.fmt" class="input"><option value="CODE128">CODE128 (recommandé)</option><option value="CODE39">CODE39</option></select>
        </div>
        <label class="flex items-center gap-3 cursor-pointer select-none pt-1">
          <button type="button" class="toggle" :data-on="form.publishable" @click="form.publishable = !form.publishable" aria-label="Visible sur la boutique en ligne"><span></span></button>
          <span class="text-[13px] text-gray-700 leading-snug">Visible sur la boutique en ligne <span class="text-gray-400">(diffusable sur les canaux de vente)</span></span>
        </label>
        <div class="flex flex-col gap-1">
          <label class="label">Notes</label>
          <textarea v-model="form.notes" rows="2" placeholder="Remarques…" class="input"></textarea>
        </div>
      </div>

      <!-- Résumé -->
      <div class="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <div class="text-[13px] font-semibold text-gray-900 mb-2">Résumé</div>
        <div class="flex gap-3">
          <span class="w-16 h-16 thumb bg-white"><img v-if="form.photo" :src="form.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-5 h-5" /></span>
          <div class="min-w-0 text-[12px] text-gray-600 space-y-0.5">
            <div class="badge-ref">{{ refDisplay }}</div>
            <div class="text-[13px] font-semibold text-gray-900 truncate">{{ form.name || '—' }}</div>
            <div v-if="form.cat">{{ cats.label(form.cat) }} · {{ form.etat }}</div>
            <div>Stock : <strong class="text-gray-900">{{ form.qty }}</strong> · Prix : <strong class="text-gray-900">{{ (form.price || 0).toFixed(2) }} €</strong> · Zone : <strong class="text-gray-900">{{ form.zone || '—' }}</strong></div>
            <div v-if="form.vehicle" class="truncate">{{ form.vehicle }}</div>
          </div>
        </div>
      </div>

      <div class="flex gap-2">
        <button type="button" class="btn btn-secondary flex-1 py-3" @click="prev"><AppIcon name="arrow-left" class="w-4 h-4" /> Retour</button>
        <button type="submit" :disabled="saving" class="btn btn-primary flex-1 py-3">{{ saving ? 'Enregistrement…' : 'Enregistrer' }} <AppIcon name="check" class="w-4 h-4" /></button>
      </div>
    </form>

    <BarcodeScanModal :open="scanOpen" title="Scanner la référence" @close="scanOpen = false" @scanned="(c) => { form.ref = c }" />
    <BarcodeLabelModal :piece="labelPiece" :open="showLabel" @close="closeLabel" />
    <HandwrittenRefModal :piece="labelPiece" :open="showHandwritten" @close="closeHandwritten" @print="printFromHandwritten" />
  </div>
</template>
