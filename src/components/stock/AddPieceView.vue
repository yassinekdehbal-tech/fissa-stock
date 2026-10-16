<script setup lang="ts">
import { ref, nextTick, onUnmounted } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { sanitize } from '@/utils/security'
import { normalizeCode } from '@/utils/codes'
import type { Piece, PieceCategory, PieceSource, PieceState } from '@/types'
import BarcodeLabelModal from '@/components/stock/BarcodeLabelModal.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PhotoUploadField from '@/components/ui/PhotoUploadField.vue'

const stock = useStockStore()
const history = useHistoryStore()
const auth = useAuthStore()
const { toast } = useToast()

const form = ref({
  ref: '',
  name: '',
  cat: '' as PieceCategory,
  vehicle: '',
  oem: '',
  supplier: '',
  donor: '',
  source: 'autre' as PieceSource,
  qty: 1,
  price: 0,
  threshold: 0,
  zone: '',
  etat: 'Bon état' as PieceState,
  compat: '',
  photo: '',
  notes: '',
  // Pièce neuve : codes déjà présents sur l'emballage / chez le fournisseur
  ean: '',
  supplierRef: '',
  fmt: 'CODE128' as 'CODE128' | 'CODE39'
})

function clearForm() {
  form.value = { ref: '', name: '', cat: '', vehicle: '', oem: '', supplier: '', donor: '', source: 'autre', qty: 1, price: 0, threshold: 0, zone: '', etat: 'Bon état', compat: '', photo: '', notes: '', ean: '', supplierRef: '', fmt: 'CODE128' }
}

// ---------------------------------------------------------------------------
// Scan du code-barres de l'emballage (caméra) pour remplir le champ EAN.
// Une douchette USB fonctionne aussi : focus sur le champ, scan, le code s'y tape.
// ---------------------------------------------------------------------------
const eanScanOpen = ref(false)
const eanScanError = ref('')
let eanScanner: any = null

async function openEanScan() {
  eanScanError.value = ''
  eanScanOpen.value = true
  await nextTick()
  try {
    const { Html5Qrcode } = await import('html5-qrcode')
    eanScanner = new Html5Qrcode('ean-camera')
    await eanScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 130 } },
      (val: string) => {
        if (!val) return
        form.value.ean = normalizeCode(val)
        toast('✓ Code emballage lu : ' + form.value.ean)
        closeEanScan()
      },
      () => {}
    )
  } catch (e: any) {
    eanScanError.value = e?.message || 'Caméra inaccessible'
  }
}

function closeEanScan() {
  if (eanScanner) {
    eanScanner.stop().then(() => eanScanner?.clear()).catch(() => {})
    eanScanner = null
  }
  eanScanOpen.value = false
}

onUnmounted(() => { if (eanScanner) closeEanScan() })

async function submit() {
  const r = form.value.ref.trim().toUpperCase()
  const name = form.value.name.trim()
  if (!r) { toast('La référence est requise', true); return }
  if (!name) { toast('La désignation est requise', true); return }
  if (stock.pieces.find(p => p.ref === r)) { toast('Référence déjà existante', true); return }

  const ean = normalizeCode(form.value.ean)
  const supplierRef = form.value.supplierRef.trim()
  // Pièce neuve déjà référencée (réassort) : on prévient, l'ajout de quantité
  // sur la fiche existante est souvent le bon geste.
  const twin = stock.activePieces.find(p =>
    (ean && normalizeCode(p.ean) === ean) ||
    (supplierRef && normalizeCode(p.supplierRef) === normalizeCode(supplierRef))
  )
  if (twin && !confirm(`Une pièce porte déjà ce code emballage / réf fournisseur :\n${twin.ref} — ${twin.name} (stock ${twin.qty}, zone ${twin.zone || '—'})\n\nCréer quand même une nouvelle fiche ?`)) return

  const piece = {
    ref: sanitize(r),
    name: sanitize(name),
    cat: form.value.cat,
    vehicle: sanitize(form.value.vehicle.trim()),
    oem: sanitize(form.value.oem.trim()),
    supplier: sanitize(form.value.supplier.trim()),
    donor: sanitize(form.value.donor.trim()),
    source: form.value.source,
    qty: form.value.qty,
    price: form.value.price,
    threshold: form.value.threshold || undefined,
    zone: sanitize(form.value.zone.trim()),
    etat: form.value.etat,
    compat: sanitize(form.value.compat.trim()),
    photo: form.value.photo.trim(),
    notes: sanitize(form.value.notes.trim()),
    ean,
    supplierRef: sanitize(supplierRef),
    fmt: form.value.fmt,
    added: new Date().toISOString(),
    archived: false
  }

  const id = await stock.addPiece(piece as any)
  await history.addEntry({
    type: 'ajout',
    ref: r,
    name,
    qty: form.value.qty,
    user: auth.currentUser?.name || '',
    ts: Date.now(),
    date: new Date().toLocaleString('fr-FR')
  })

  toast('✓ ' + r + ' enregistré !')
  // Ouvre la fiche d'identification de la pièce qui vient d'être créée (flux
  // magasinier : référencer → imprimer l'étiquette OU écrire le code court au
  // marqueur). On relit la pièce depuis le store : le code court est généré
  // par la base à l'insertion.
  labelPiece.value = stock.findById(id) ?? { ...(piece as unknown as Piece) }
  showLabel.value = true
  clearForm()
}

const labelPiece = ref<Piece | null>(null)
const showLabel = ref(false)
</script>

<template>
  <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
    <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">
      Nouvelle pièce
    </div>
    <form @submit.prevent="submit" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Référence <span class="text-red-400">*</span></label>
        <input v-model="form.ref" placeholder="ALT-PEU-001" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Désignation <span class="text-red-400">*</span></label>
        <input v-model="form.name" placeholder="Alternateur Peugeot 308" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Catégorie</label>
        <select v-model="form.cat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none">
          <option value="">Non catégorisé</option>
          <option value="moteur">🔴 Moteur</option>
          <option value="carrosserie">🔵 Carrosserie</option>
          <option value="train-avant">🟢 Train avant</option>
          <option value="train-arriere">🟠 Train arrière</option>
          <option value="electronique">🟣 Électronique</option>
          <option value="autre">⚫ Autre</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Véhicule compatible</label>
        <input v-model="form.vehicle" placeholder="Peugeot 308 1.6 HDi" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">N° OEM</label>
        <input v-model="form.oem" placeholder="5702.E2" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Fournisseur</label>
        <input v-model="form.supplier" placeholder="Démontage, grossiste..." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Véhicule donneur</label>
        <input v-model="form.donor" placeholder="Immatriculation ou VIN" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Provenance</label>
        <select v-model="form.source" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
          <option value="demontage">Démontage</option>
          <option value="don">Don</option>
          <option value="lot-occasion">Lot d'occasion</option>
          <option value="grossiste-neuf">Grossiste neuf</option>
          <option value="web">Web</option>
          <option value="autre">Autre</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Quantité <span class="text-red-400">*</span></label>
        <input v-model.number="form.qty" type="number" min="0" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Prix catalogue (€)</label>
        <input v-model.number="form.price" type="number" step="0.01" min="0" placeholder="0.00" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Zone / Emplacement</label>
        <input v-model="form.zone" placeholder="Étagère A3" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">État</label>
        <select v-model="form.etat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none">
          <option>Bon état</option>
          <option>Très bon état</option>
          <option>État moyen</option>
          <option>Pour pièces</option>
        </select>
      </div>
      <div class="flex flex-col gap-1 md:col-span-2">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Compatibilités</label>
        <input v-model="form.compat" placeholder="ex: Peugeot 208, 3008, Citroën C3..." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <PhotoUploadField v-model="form.photo" />
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Notes</label>
        <input v-model="form.notes" placeholder="Remarques..." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>

      <!-- Pièce neuve : codes déjà présents sur l'emballage -->
      <fieldset class="md:col-span-2 border border-blue-400/30 rounded-xl p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <legend class="px-1.5 font-mono text-[11px] font-semibold text-blue-400 uppercase tracking-[2px]">📦 Pièce neuve — codes de l'emballage</legend>
        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Code-barres emballage (EAN)</label>
          <div class="flex gap-2">
            <input
              v-model="form.ean"
              inputmode="numeric"
              placeholder="3165143210987"
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              class="flex-1 min-w-0 bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"
            >
            <button type="button" @click="openEanScan" title="Scanner avec la caméra" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-3 py-2 rounded-lg hover:border-[#e6a817] hover:text-[#e6a817]">📷</button>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Réf. fournisseur</label>
          <input v-model="form.supplierRef" placeholder="Telle qu'affichée sur le site fournisseur" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
        </div>
        <p class="md:col-span-2 text-[10px] text-[#8b949e]">
          Scannez le code-barres de la boîte (caméra ou douchette USB) et recopiez la référence du fournisseur :
          le vendeur pourra vérifier au comptoir si la pièce est en stock avant de la commander.
          Pour une pièce d'occasion, laissez vide.
        </p>
      </fieldset>
      <div class="md:col-span-2 flex gap-2 mt-2">
        <button type="submit" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2.5 rounded-lg uppercase tracking-wider hover:brightness-110">Enregistrer</button>
        <button type="button" @click="clearForm" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2.5 rounded-lg uppercase hover:border-[#e6a817] hover:text-[#e6a817]">Effacer</button>
      </div>
    </form>
    <BarcodeLabelModal :piece="labelPiece" :open="showLabel" @close="showLabel = false" />

    <!-- Lecture caméra du code-barres de l'emballage -->
    <BaseModal title="📷 Code-barres de l'emballage" :open="eanScanOpen" max-width="440px" @close="closeEanScan">
      <div id="ean-camera" class="w-full rounded-lg overflow-hidden border-2 border-[#30363d] bg-black min-h-[160px]"></div>
      <div v-if="eanScanError" class="mt-3 text-xs text-red-400">{{ eanScanError }} — tapez le code à la main ou utilisez la douchette USB.</div>
      <p v-else class="mt-2 text-[11px] text-[#8b949e] font-mono">Visez le code-barres imprimé sur la boîte…</p>
    </BaseModal>
</div>
</template>
