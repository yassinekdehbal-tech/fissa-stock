<script setup lang="ts">
import { ref } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { sanitize } from '@/utils/security'
import type { PieceCategory, PieceState } from '@/types'

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
  qty: 1,
  price: 0,
  threshold: 0,
  zone: '',
  etat: 'Bon état' as PieceState,
  compat: '',
  photo: '',
  notes: '',
  fmt: 'CODE128' as 'CODE128' | 'CODE39'
})

function clearForm() {
  form.value = { ref: '', name: '', cat: '', vehicle: '', oem: '', supplier: '', donor: '', qty: 1, price: 0, threshold: 0, zone: '', etat: 'Bon état', compat: '', photo: '', notes: '', fmt: 'CODE128' }
}

async function submit() {
  const r = form.value.ref.trim().toUpperCase()
  const name = form.value.name.trim()
  if (!r) { toast('La référence est requise', true); return }
  if (!name) { toast('La désignation est requise', true); return }
  if (stock.pieces.find(p => p.ref === r)) { toast('Référence déjà existante', true); return }

  const piece = {
    ref: sanitize(r),
    name: sanitize(name),
    cat: form.value.cat,
    vehicle: sanitize(form.value.vehicle.trim()),
    oem: sanitize(form.value.oem.trim()),
    supplier: sanitize(form.value.supplier.trim()),
    donor: sanitize(form.value.donor.trim()),
    qty: form.value.qty,
    price: form.value.price,
    threshold: form.value.threshold || undefined,
    zone: sanitize(form.value.zone.trim()),
    etat: form.value.etat,
    compat: sanitize(form.value.compat.trim()),
    photo: form.value.photo.trim(),
    notes: sanitize(form.value.notes.trim()),
    fmt: form.value.fmt,
    added: new Date().toISOString(),
    archived: false
  }

  await stock.addPiece(piece as any)
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
  clearForm()
}
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
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">URL Photo</label>
        <input v-model="form.photo" type="url" placeholder="https://..." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-[11px] text-[#8b949e] uppercase tracking-wider">Notes</label>
        <input v-model="form.notes" placeholder="Remarques..." class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]">
      </div>
      <div class="md:col-span-2 flex gap-2 mt-2">
        <button type="submit" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2.5 rounded-lg uppercase tracking-wider hover:brightness-110">Enregistrer</button>
        <button type="button" @click="clearForm" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2.5 rounded-lg uppercase hover:border-[#e6a817] hover:text-[#e6a817]">Effacer</button>
      </div>
    </form>
  </div>
</template>
