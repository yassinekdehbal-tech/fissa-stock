<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStockStore } from '@/stores/stock'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import StatCard from '@/components/ui/StatCard.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import type { Piece, PieceCategory, PieceState } from '@/types'
import { CATEGORIES } from '@/types'
import { formatPrice } from '@/utils/format'
import { sanitize } from '@/utils/security'

const stock = useStockStore()
const auth = useAuthStore()
const cart = useCartStore()
const { toast } = useToast()

const search = ref('')
const filterCat = ref<PieceCategory | ''>('')
const filterEtat = ref<PieceState | ''>('')
const filterArchive = ref<'actif' | 'archive' | 'tous'>('actif')

const filteredPieces = computed(() => {
  let list = stock.pieces
  if (filterArchive.value === 'actif') list = list.filter(p => !p.archived)
  else if (filterArchive.value === 'archive') list = list.filter(p => p.archived)
  if (filterCat.value) list = list.filter(p => p.cat === filterCat.value)
  if (filterEtat.value) list = list.filter(p => p.etat === filterEtat.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      p.ref.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.vehicle || '').toLowerCase().includes(q) ||
      (p.oem || '').toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q) ||
      (p.compat || '').toLowerCase().includes(q)
    )
  }
  return list
})

// Edit modal
const editOpen = ref(false)
const editPiece = ref<Piece | null>(null)
const editForm = ref({ name: '', cat: '' as PieceCategory, vehicle: '', oem: '', supplier: '', donor: '', qty: 0, threshold: 0, price: 0, zone: '', etat: 'Bon état' as PieceState, compat: '', photo: '', notes: '' })

function openEdit(p: Piece) {
  editPiece.value = p
  editForm.value = { name: p.name, cat: p.cat, vehicle: p.vehicle, oem: p.oem, supplier: p.supplier, donor: p.donor, qty: p.qty, threshold: p.threshold || 0, price: p.price, zone: p.zone, etat: p.etat, compat: p.compat, photo: p.photo, notes: p.notes }
  editOpen.value = true
}

async function saveEdit() {
  if (!editPiece.value?._id) return
  await stock.updatePiece(editPiece.value._id, {
    name: sanitize(editForm.value.name),
    cat: editForm.value.cat,
    vehicle: sanitize(editForm.value.vehicle),
    oem: sanitize(editForm.value.oem),
    supplier: sanitize(editForm.value.supplier),
    donor: sanitize(editForm.value.donor),
    qty: editForm.value.qty,
    threshold: editForm.value.threshold || undefined,
    price: editForm.value.price,
    zone: sanitize(editForm.value.zone),
    etat: editForm.value.etat,
    compat: sanitize(editForm.value.compat),
    photo: editForm.value.photo,
    notes: sanitize(editForm.value.notes)
  })
  editOpen.value = false
  toast('Pièce mise à jour')
}

// Cart modal
const cartModalOpen = ref(false)
const cartPiece = ref<Piece | null>(null)
const cartQty = ref(1)
const cartPrice = ref(0)

function openAddCart(p: Piece) {
  cartPiece.value = p
  cartQty.value = 1
  cartPrice.value = p.price || 0
  cartModalOpen.value = true
}

function addToCart() {
  if (!cartPiece.value) return
  if (cartQty.value < 1) { toast('Quantité invalide', true); return }
  if (cartPrice.value <= 0) { toast('Prix obligatoire', true); return }
  if (cartQty.value > cartPiece.value.qty) { toast('Stock insuffisant', true); return }
  cart.add(cartPiece.value, cartQty.value, cartPrice.value)
  cartModalOpen.value = false
  toast(`✓ ${cartPiece.value.ref} ajouté au panier`)
}

async function handleArchive(p: Piece) {
  await stock.toggleArchive(p._id!)
  toast(p.archived ? 'Pièce restaurée' : 'Pièce archivée')
}

async function handleDelete(p: Piece) {
  if (!confirm('Supprimer définitivement ' + p.ref + ' ?')) return
  await stock.deletePiece(p._id!)
  toast('Pièce supprimée')
}

function qtyClass(p: Piece) {
  if (p.qty === 0) return 'bg-gray-500/15 text-[#8b949e] border-[#30363d]'
  if (p.qty <= (p.threshold || 1)) return 'bg-red-500/15 text-red-400 border-red-500/30'
  return 'bg-green-500/15 text-green-400 border-green-500/30'
}

function exportCSV() {
  const header = ['Référence', 'Désignation', 'Catégorie', 'Véhicule', 'OEM', 'Quantité', 'Prix', 'Zone', 'État']
  const rows = stock.pieces.map(p => [p.ref, p.name, p.cat, p.vehicle, p.oem, p.qty, p.price, p.zone, p.etat])
  const csv = '﻿' + [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'stock_fissa_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  toast('Export CSV téléchargé')
}
</script>

<template>
  <div>
    <!-- Stats -->
    <div class="grid grid-cols-3 gap-2.5 mb-4">
      <StatCard :value="stock.activePieces.length" label="Références" color="text-[#e6a817]" />
      <StatCard :value="stock.totalQty" label="Pièces" />
      <StatCard :value="`${stock.totalValue.toFixed(0)} €`" label="Valeur catalogue" color="text-[#3fb950]" />
    </div>

    <!-- Toolbar -->
    <div class="flex gap-2 mb-3 flex-wrap items-center">
      <input
        v-model="search"
        type="text"
        placeholder="🔍 Réf, désignation, véhicule, OEM, zone…"
        class="flex-1 min-w-[140px] bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"
      >
      <select v-model="filterCat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-xs px-2 py-2 outline-none">
        <option value="">Toutes catégories</option>
        <option value="moteur">🔴 Moteur</option>
        <option value="carrosserie">🔵 Carrosserie</option>
        <option value="train-avant">🟢 Train avant</option>
        <option value="train-arriere">🟠 Train arrière</option>
        <option value="electronique">🟣 Électronique</option>
        <option value="autre">⚫ Autre</option>
      </select>
      <select v-model="filterArchive" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-xs px-2 py-2 outline-none">
        <option value="actif">Stock actif</option>
        <option value="archive">Archivées</option>
        <option value="tous">Tout</option>
      </select>
      <button v-if="auth.isAdmin" @click="exportCSV" class="bg-[#3fb950] text-black font-mono text-[11px] font-semibold px-3 py-2 rounded-lg uppercase">⬇ CSV</button>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto bg-[#161b22] border border-[#30363d] rounded-xl">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="bg-[#21262d] border-b border-[#30363d]">
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider">Réf</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider">Désignation</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider hidden md:table-cell">Catégorie</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider hidden lg:table-cell">Véhicule</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider">Qté</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider">Prix</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider hidden md:table-cell">Zone</th>
            <th class="text-left px-3 py-2 font-mono text-[10px] uppercase text-[#8b949e] tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in filteredPieces"
            :key="p._id"
            class="border-b border-[#30363d] hover:bg-[#21262d] transition-colors"
            :class="{ 'opacity-50': p.archived }"
          >
            <td class="px-3 py-2">
              <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded border border-[#e6a817]/30">{{ p.ref }}</span>
            </td>
            <td class="px-3 py-2">
              <div>{{ p.name }}</div>
              <div v-if="p.compat" class="text-[10px] text-blue-400 mt-0.5">↔ {{ p.compat }}</div>
            </td>
            <td class="px-3 py-2 hidden md:table-cell">
              <span v-if="p.cat && CATEGORIES[p.cat]" class="text-[10px] px-1.5 py-0.5 rounded border" :class="[CATEGORIES[p.cat].bgClass, CATEGORIES[p.cat].textClass, CATEGORIES[p.cat].borderClass]">
                {{ CATEGORIES[p.cat].icon }} {{ CATEGORIES[p.cat].label }}
              </span>
            </td>
            <td class="px-3 py-2 text-[11px] text-[#8b949e] hidden lg:table-cell">{{ p.vehicle || '—' }}</td>
            <td class="px-3 py-2">
              <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded-full border" :class="qtyClass(p)">{{ p.qty }}</span>
            </td>
            <td class="px-3 py-2">
              <span class="font-mono text-[11px] text-[#3fb950] font-semibold">{{ p.price ? formatPrice(p.price) : '—' }}</span>
            </td>
            <td class="px-3 py-2 hidden md:table-cell">
              <span v-if="p.zone" class="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded">{{ p.zone }}</span>
              <span v-else class="text-[#8b949e]">—</span>
            </td>
            <td class="px-3 py-2">
              <div class="flex gap-1 flex-wrap">
                <button v-if="auth.hasPerm('vendeur') && !p.archived" @click="openAddCart(p)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-green-400 hover:text-green-400 transition-colors">🛒</button>
                <button v-if="(auth.isAdmin || auth.hasPerm('magasinier')) && !p.archived" @click="openEdit(p)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-[#e6a817] hover:text-[#e6a817] transition-colors">✏</button>
                <button v-if="auth.isAdmin" @click="handleArchive(p)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-[#e6a817] hover:text-[#e6a817] transition-colors">{{ p.archived ? '↺' : '📦' }}</button>
                <button v-if="auth.isAdmin && p.archived" @click="handleDelete(p)" class="px-1.5 py-0.5 text-[10px] rounded border border-[#30363d] text-[#8b949e] font-mono font-semibold hover:border-red-400 hover:text-red-400 transition-colors">✕</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filteredPieces.length" class="text-center py-8 text-[#8b949e] text-sm">
        Aucune pièce trouvée
      </div>
    </div>

    <!-- Edit Modal -->
    <BaseModal title="✏ Modifier la pièce" :open="editOpen" @close="editOpen = false">
      <div class="grid grid-cols-2 gap-2.5">
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Désignation</label><input v-model="editForm.name" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Catégorie</label><select v-model="editForm.cat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none"><option value="">—</option><option value="moteur">Moteur</option><option value="carrosserie">Carrosserie</option><option value="train-avant">Train avant</option><option value="train-arriere">Train arrière</option><option value="electronique">Électronique</option><option value="autre">Autre</option></select></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Véhicule</label><input v-model="editForm.vehicle" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">OEM</label><input v-model="editForm.oem" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Quantité</label><input v-model.number="editForm.qty" type="number" min="0" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prix (€)</label><input v-model.number="editForm.price" type="number" step="0.01" min="0" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Zone</label><input v-model="editForm.zone" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">État</label><select v-model="editForm.etat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none"><option>Bon état</option><option>Très bon état</option><option>État moyen</option><option>Pour pièces</option></select></div>
        <div class="col-span-2 flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Compatibilités</label><input v-model="editForm.compat" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
      </div>
      <div class="flex gap-2 mt-3.5">
        <button @click="saveEdit" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">Enregistrer</button>
        <button @click="editOpen = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase hover:border-[#e6a817] hover:text-[#e6a817]">Annuler</button>
      </div>
    </BaseModal>

    <!-- Add to cart modal -->
    <BaseModal title="➕ Ajouter au panier" :open="cartModalOpen" @close="cartModalOpen = false" max-width="400px">
      <div v-if="cartPiece" class="mb-3">
        <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded border border-[#e6a817]/30">{{ cartPiece.ref }}</span>
        <strong class="ml-2">{{ cartPiece.name }}</strong>
        <div class="text-[#8b949e] text-[11px] mt-1">Stock : <strong class="text-[#e6a817]">{{ cartPiece.qty }}</strong></div>
      </div>
      <div class="grid grid-cols-2 gap-2.5">
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Quantité</label><input v-model.number="cartQty" type="number" min="1" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
        <div class="flex flex-col gap-1"><label class="text-[11px] text-[#8b949e] uppercase">Prix unitaire (€)</label><input v-model.number="cartPrice" type="number" step="0.01" min="0.01" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"></div>
      </div>
      <div class="flex gap-2 mt-3.5">
        <button @click="addToCart" class="bg-[#e6a817] text-black font-mono text-xs font-semibold px-4 py-2 rounded-lg uppercase">Ajouter</button>
        <button @click="cartModalOpen = false" class="border border-[#30363d] text-[#8b949e] font-mono text-xs px-4 py-2 rounded-lg uppercase hover:border-[#e6a817] hover:text-[#e6a817]">Annuler</button>
      </div>
    </BaseModal>
  </div>
</template>
