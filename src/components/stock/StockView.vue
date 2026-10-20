<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import StatCard from '@/components/ui/StatCard.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import BarcodeLabelModal from '@/components/stock/BarcodeLabelModal.vue'
import PieceEditModal from '@/components/stock/PieceEditModal.vue'
import type { Piece, PieceCategory, PieceState } from '@/types'
import { useCategoriesStore } from '@/stores/categories'
import { formatPrice } from '@/utils/format'

const route = useRoute()
const stock = useStockStore()
const auth = useAuthStore()
const cart = useCartStore()
const { toast } = useToast()

const cats = useCategoriesStore()
// Catégories de l'exploitant (Paramètres → Catégories) + les archivées encore utilisées
const CATS = computed<{ key: PieceCategory | ''; label: string }[]>(() => [
  { key: '', label: 'Toutes' },
  ...cats.categories
    .filter((c) => !c.archived || stock.pieces.some((p) => p.cat === c.key))
    .map((c) => ({ key: c.key, label: c.label })),
])

const search = ref(String(route.query.q ?? ''))
const filterCat = ref<PieceCategory | ''>('')
const filterEtat = ref<PieceState | ''>('')
const filterStock = ref<'actif' | 'dispo' | 'rupture' | 'alerte' | 'archive' | 'tous'>(route.query.stock === 'alerte' ? 'alerte' : 'actif')
const sort = ref<'recent' | 'ref' | 'name' | 'price-asc' | 'price-desc' | 'qty'>('recent')
const showFilters = ref(false)

watch(() => route.query.q, (q) => { search.value = String(q ?? '') })
watch(() => route.query.stock, (s) => { if (s === 'alerte') filterStock.value = 'alerte' })

function resetFilters() {
  search.value = ''; filterCat.value = ''; filterEtat.value = ''; filterStock.value = 'actif'; sort.value = 'recent'
}

const filteredPieces = computed(() => {
  let list = stock.pieces
  switch (filterStock.value) {
    case 'actif': list = list.filter(p => !p.archived); break
    case 'dispo': list = list.filter(p => !p.archived && p.qty > 0); break
    case 'rupture': list = list.filter(p => !p.archived && p.qty === 0); break
    case 'alerte': list = list.filter(p => !p.archived && p.qty <= (p.threshold || 1)); break
    case 'archive': list = list.filter(p => p.archived); break
  }
  if (filterCat.value) list = list.filter(p => p.cat === filterCat.value)
  if (filterEtat.value) list = list.filter(p => p.etat === filterEtat.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(p =>
      p.ref.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) ||
      (p.vehicle || '').toLowerCase().includes(q) || (p.oem || '').toLowerCase().includes(q) ||
      (p.zone || '').toLowerCase().includes(q) || (p.compat || '').toLowerCase().includes(q))
  }
  const sorted = [...list]
  switch (sort.value) {
    case 'ref': sorted.sort((a, b) => a.ref.localeCompare(b.ref)); break
    case 'name': sorted.sort((a, b) => a.name.localeCompare(b.name)); break
    case 'price-asc': sorted.sort((a, b) => (a.price || 0) - (b.price || 0)); break
    case 'price-desc': sorted.sort((a, b) => (b.price || 0) - (a.price || 0)); break
    case 'qty': sorted.sort((a, b) => a.qty - b.qty); break
    default: sorted.sort((a, b) => (b.added || '').localeCompare(a.added || ''))
  }
  return sorted
})

// --- Étiquette / édition / panier -------------------------------------------
const labelPiece = ref<Piece | null>(null)
const showLabel = ref(false)
function openLabel(p: Piece) { labelPiece.value = p; showLabel.value = true }

const editOpen = ref(false)
const editPiece = ref<Piece | null>(null)
function openEdit(p: Piece) { editPiece.value = p; editOpen.value = true }

const cartModalOpen = ref(false)
const cartPiece = ref<Piece | null>(null)
const cartQty = ref(1)
const cartPrice = ref(0)
function openAddCart(p: Piece) { cartPiece.value = p; cartQty.value = 1; cartPrice.value = p.price || 0; cartModalOpen.value = true }
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
  if (p.qty === 0) return 'badge-red'
  if (p.qty <= (p.threshold || 1)) return 'badge-orange'
  return 'badge-green'
}
function qtyText(p: Piece) {
  return p.qty === 0 ? 'Rupture' : `${p.qty} en stock`
}
function etatClass(etat: string) {
  if (etat === 'Très bon état' || etat === 'Neuf') return 'badge-green'
  if (etat === 'Bon état') return 'badge-blue'
  if (etat === 'État moyen') return 'badge-amber'
  return 'badge-gray'
}
function catLabel(p: Piece) {
  return cats.label(p.cat)
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

const canEdit = computed(() => auth.isAdmin || auth.hasPerm('magasinier'))
</script>

<template>
  <div class="space-y-3 lg:space-y-4">
    <!-- En-tête -->
    <div class="flex items-center justify-between gap-3">
      <div class="hidden lg:block">
        <h1 class="page-title">Stock</h1>
        <p class="page-subtitle">Gérez votre stock de pièces neuves et d'occasion</p>
      </div>
      <div class="flex gap-2 w-full lg:w-auto justify-end">
        <button v-if="auth.isAdmin" @click="exportCSV" class="btn btn-secondary hidden lg:inline-flex"><AppIcon name="download" class="w-4 h-4" /> Exporter CSV</button>
        <router-link v-if="canEdit" to="/add" class="btn btn-primary lg:hidden fixed top-[calc(env(safe-area-inset-top)+0.6rem)] right-3 z-40 py-1.5"><AppIcon name="plus" class="w-4 h-4" /> Ajouter</router-link>
        <router-link v-if="canEdit" to="/add" class="btn btn-primary hidden lg:inline-flex"><AppIcon name="plus" class="w-4 h-4" /> Ajouter une pièce</router-link>
      </div>
    </div>

    <!-- Indicateurs (desktop) -->
    <div class="hidden lg:grid grid-cols-3 gap-3">
      <StatCard :value="stock.activePieces.length" label="Références" icon="package" tone="amber" />
      <StatCard :value="stock.totalQty" label="Pièces en stock" icon="layers" tone="blue" />
      <StatCard :value="`${stock.totalValue.toFixed(0)} €`" label="Valeur catalogue" icon="euro" tone="green" />
    </div>

    <!-- Recherche + filtres -->
    <div class="space-y-2.5">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <AppIcon name="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input v-model="search" type="search" placeholder="Réf., désignation, véhicule, OEM…" class="input pl-9 h-11 bg-white">
        </div>
        <button class="w-11 h-11 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 lg:hidden" :class="showFilters ? 'border-brand text-amber-700' : ''" @click="showFilters = !showFilters" aria-label="Filtres"><AppIcon name="filter" class="w-4 h-4" /></button>
      </div>
      <div class="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap">
        <button v-for="c in CATS" :key="c.key" class="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors" :class="filterCat === c.key ? 'bg-brand border-brand text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'" @click="filterCat = c.key">{{ c.label }}</button>
      </div>
      <div class="flex flex-wrap gap-2 items-center" :class="showFilters ? '' : 'hidden lg:flex'">
        <select v-model="filterEtat" class="input w-auto min-w-[140px] h-10">
          <option value="">Tous états</option><option>Très bon état</option><option>Bon état</option><option>État moyen</option><option>Pour pièces</option>
        </select>
        <select v-model="filterStock" class="input w-auto min-w-[140px] h-10">
          <option value="actif">Stock actif</option><option value="dispo">Disponibles</option><option value="rupture">En rupture</option><option value="alerte">Sous le seuil</option><option value="archive">Archivées</option><option value="tous">Tout</option>
        </select>
        <div class="relative">
          <AppIcon name="sort" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <select v-model="sort" class="input w-auto min-w-[150px] h-10 pl-9">
            <option value="recent">Plus récentes</option><option value="ref">Référence A→Z</option><option value="name">Désignation A→Z</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option><option value="qty">Quantité</option>
          </select>
        </div>
        <button @click="resetFilters" class="btn btn-secondary btn-sm h-10"><AppIcon name="refresh" class="w-3.5 h-3.5" /> Réinitialiser</button>
        <span class="ml-auto text-[12px] text-gray-500">{{ filteredPieces.length }} résultat(s)</span>
      </div>
    </div>

    <!-- Liste (mobile) -->
    <div class="lg:hidden space-y-2">
      <router-link v-for="p in filteredPieces" :key="p._id" :to="`/piece/${p._id}`" class="list-row" :class="{ 'opacity-50': p.archived }">
        <span class="w-14 h-14 thumb"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-5 h-5" /></span>
        <div class="min-w-0 flex-1">
          <span class="badge-ref">{{ p.ref }}</span>
          <div class="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{{ p.name }}</div>
          <div class="text-[12px] font-medium" :class="p.qty === 0 ? 'text-red-600' : p.qty <= (p.threshold || 1) ? 'text-orange-600' : 'text-green-600'">{{ qtyText(p) }}</div>
        </div>
        <div class="flex flex-col items-end gap-1 shrink-0">
          <span v-if="p.cat" class="badge" :class="[cats.info(p.cat).bgClass, cats.info(p.cat).textClass]">{{ catLabel(p) }}</span>
          <span class="text-[13px] font-bold text-gray-900">{{ p.price ? formatPrice(p.price) : '—' }}</span>
          <span v-if="p.zone" class="badge-zone"><AppIcon name="map-pin" class="w-3 h-3" /> {{ p.zone }}</span>
        </div>
      </router-link>
      <div v-if="!filteredPieces.length" class="card text-center py-12 text-gray-500 text-sm">
        <AppIcon name="package" class="w-8 h-8 mx-auto mb-2 text-gray-300" /> Aucune pièce trouvée
      </div>
    </div>

    <!-- Tableau (desktop) -->
    <div class="hidden lg:block card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr><th>Référence</th><th>Désignation</th><th>Catégorie</th><th>Véhicule</th><th class="text-center">Qté</th><th>Prix</th><th>Zone</th><th>État</th><th class="text-right">Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredPieces" :key="p._id" :class="{ 'opacity-50': p.archived }">
              <td>
                <router-link :to="`/piece/${p._id}`" class="flex items-center gap-2.5">
                  <span class="w-9 h-9 thumb"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
                  <span class="badge-ref">{{ p.ref }}</span>
                </router-link>
              </td>
              <td>
                <router-link :to="`/piece/${p._id}`" class="font-medium text-gray-900 hover:underline">{{ p.name }}</router-link>
                <div v-if="p.compat" class="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">{{ p.compat }}</div>
              </td>
              <td><span v-if="p.cat" class="badge" :class="[cats.info(p.cat).bgClass, cats.info(p.cat).textClass]">{{ catLabel(p) }}</span></td>
              <td class="text-gray-600">{{ p.vehicle || '—' }}</td>
              <td class="text-center"><span class="badge" :class="qtyClass(p)">{{ p.qty }}</span></td>
              <td class="font-semibold text-gray-900 whitespace-nowrap">{{ p.price ? formatPrice(p.price) : '—' }}</td>
              <td><span v-if="p.zone" class="badge-zone">{{ p.zone }}</span><span v-else class="text-gray-400">—</span></td>
              <td><span v-if="p.etat" class="badge" :class="etatClass(p.etat)">{{ p.etat }}</span></td>
              <td>
                <div class="flex justify-end gap-0.5">
                  <router-link :to="`/piece/${p._id}`" class="icon-btn" title="Voir la fiche"><AppIcon name="eye" class="w-4 h-4" /></router-link>
                  <button @click="openLabel(p)" class="icon-btn icon-btn-brand" title="Étiquette code-barres"><AppIcon name="tag" class="w-4 h-4" /></button>
                  <button v-if="auth.hasPerm('vendeur') && !p.archived && p.qty > 0" @click="openAddCart(p)" class="icon-btn icon-btn-success" title="Ajouter au panier"><AppIcon name="cart" class="w-4 h-4" /></button>
                  <button v-if="canEdit && !p.archived" @click="openEdit(p)" class="icon-btn icon-btn-brand" title="Modifier"><AppIcon name="edit" class="w-4 h-4" /></button>
                  <button v-if="auth.isAdmin" @click="handleArchive(p)" class="icon-btn" :title="p.archived ? 'Restaurer' : 'Archiver'"><AppIcon :name="p.archived ? 'refresh' : 'box'" class="w-4 h-4" /></button>
                  <button v-if="auth.isAdmin && p.archived" @click="handleDelete(p)" class="icon-btn icon-btn-danger" title="Supprimer définitivement"><AppIcon name="trash" class="w-4 h-4" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="!filteredPieces.length" class="text-center py-12 text-gray-500 text-sm"><AppIcon name="package" class="w-8 h-8 mx-auto mb-2 text-gray-300" /> Aucune pièce trouvée</div>
    </div>

    <PieceEditModal :piece="editPiece" :open="editOpen" @close="editOpen = false" />

    <BaseModal title="Ajouter au panier" :open="cartModalOpen" @close="cartModalOpen = false" max-width="400px">
      <div v-if="cartPiece" class="mb-3">
        <span class="badge-ref">{{ cartPiece.ref }}</span>
        <strong class="ml-2 text-gray-900">{{ cartPiece.name }}</strong>
        <div class="text-gray-500 text-[12px] mt-1">Stock disponible : <strong class="text-gray-900">{{ cartPiece.qty }}</strong></div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="cartQty" type="number" min="1" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Prix unitaire (€)</label><input v-model.number="cartPrice" type="number" step="0.01" min="0.01" class="input"></div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button @click="cartModalOpen = false" class="btn btn-secondary">Annuler</button>
        <button @click="addToCart" class="btn btn-primary"><AppIcon name="cart" class="w-4 h-4" /> Ajouter</button>
      </div>
    </BaseModal>
    <BarcodeLabelModal :piece="labelPiece" :open="showLabel" @close="showLabel = false" />
  </div>
</template>
