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
import PhotoUploadField from '@/components/ui/PhotoUploadField.vue'
import type { Piece, PieceCategory, PieceState } from '@/types'
import { CATEGORIES } from '@/types'
import { formatPrice } from '@/utils/format'
import { sanitize } from '@/utils/security'

const route = useRoute()
const stock = useStockStore()
const auth = useAuthStore()
const cart = useCartStore()
const { toast } = useToast()

const labelPiece = ref<Piece | null>(null)
const showLabel = ref(false)
function openLabel(p: Piece) {
  labelPiece.value = p
  showLabel.value = true
}

const search = ref(String(route.query.q ?? ''))
watch(() => route.query.q, (q) => { search.value = String(q ?? '') })

const filterCat = ref<PieceCategory | ''>('')
const filterEtat = ref<PieceState | ''>('')
const filterArchive = ref<'actif' | 'archive' | 'tous'>('actif')

function resetFilters() {
  search.value = ''
  filterCat.value = ''
  filterEtat.value = ''
  filterArchive.value = 'actif'
}

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

// --- Fiche (consultation) ---------------------------------------------------
const viewPiece = ref<Piece | null>(null)
const viewOpen = ref(false)
function openView(p: Piece) {
  viewPiece.value = p
  viewOpen.value = true
}

// --- Édition ----------------------------------------------------------------
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

// --- Panier -----------------------------------------------------------------
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
  if (p.qty === 0) return 'badge-red'
  if (p.qty <= (p.threshold || 1)) return 'badge-orange'
  return 'badge-green'
}

function etatClass(etat: string) {
  if (etat === 'Très bon état' || etat === 'Neuf') return 'badge-green'
  if (etat === 'Bon état') return 'badge-blue'
  if (etat === 'État moyen') return 'badge-amber'
  return 'badge-gray'
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
  <div class="space-y-4">
    <!-- En-tête -->
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="page-title">Stock</h1>
        <p class="page-subtitle">Gérez votre stock de pièces neuves et d'occasion</p>
      </div>
      <div class="flex gap-2">
        <button v-if="auth.isAdmin" @click="exportCSV" class="btn btn-secondary">
          <AppIcon name="download" class="w-4 h-4" /> Exporter CSV
        </button>
        <router-link v-if="canEdit" to="/add" class="btn btn-primary">
          <AppIcon name="plus" class="w-4 h-4" /> Ajouter une pièce
        </router-link>
      </div>
    </div>

    <!-- Indicateurs -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard :value="stock.activePieces.length" label="Références" icon="package" tone="amber" />
      <StatCard :value="stock.totalQty" label="Pièces en stock" icon="layers" tone="blue" />
      <StatCard :value="`${stock.totalValue.toFixed(0)} €`" label="Valeur catalogue" icon="euro" tone="green" />
    </div>

    <!-- Filtres -->
    <div class="card p-3 space-y-2.5">
      <div class="relative">
        <AppIcon name="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input v-model="search" type="text" placeholder="Réf., désignation, véhicule, OEM, zone…" class="input pl-9">
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <select v-model="filterCat" class="input w-auto min-w-[160px]">
          <option value="">Toutes catégories</option>
          <option value="moteur">Moteur</option>
          <option value="carrosserie">Carrosserie</option>
          <option value="train-avant">Train avant</option>
          <option value="train-arriere">Train arrière</option>
          <option value="electronique">Électronique</option>
          <option value="autre">Autre</option>
        </select>
        <select v-model="filterEtat" class="input w-auto min-w-[140px]">
          <option value="">Tous états</option>
          <option>Très bon état</option>
          <option>Bon état</option>
          <option>État moyen</option>
          <option>Pour pièces</option>
        </select>
        <select v-model="filterArchive" class="input w-auto min-w-[130px]">
          <option value="actif">Stock actif</option>
          <option value="archive">Archivées</option>
          <option value="tous">Tout</option>
        </select>
        <button @click="resetFilters" class="btn btn-secondary btn-sm">
          <AppIcon name="refresh" class="w-3.5 h-3.5" /> Réinitialiser
        </button>
        <span class="ml-auto text-[12px] text-gray-500">{{ filteredPieces.length }} résultat(s)</span>
      </div>
    </div>

    <!-- Tableau -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Désignation</th>
              <th class="hidden md:table-cell">Catégorie</th>
              <th class="hidden lg:table-cell">Véhicule</th>
              <th class="text-center">Qté</th>
              <th>Prix</th>
              <th class="hidden md:table-cell">Zone</th>
              <th class="hidden lg:table-cell">État</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredPieces" :key="p._id" :class="{ 'opacity-50': p.archived }">
              <td>
                <div class="flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 text-gray-400">
                    <img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt="" @error="($event.target as HTMLImageElement).style.display = 'none'">
                    <AppIcon v-else name="package" class="w-4 h-4" />
                  </span>
                  <span class="badge-ref">{{ p.ref }}</span>
                </div>
              </td>
              <td>
                <div class="font-medium text-gray-900">{{ p.name }}</div>
                <div v-if="p.compat" class="text-[11px] text-gray-500 mt-0.5 truncate max-w-[260px]">{{ p.compat }}</div>
              </td>
              <td class="hidden md:table-cell">
                <span v-if="p.cat && CATEGORIES[p.cat]" class="badge" :class="[CATEGORIES[p.cat].bgClass, CATEGORIES[p.cat].textClass]">{{ CATEGORIES[p.cat].label }}</span>
              </td>
              <td class="hidden lg:table-cell text-gray-600">{{ p.vehicle || '—' }}</td>
              <td class="text-center"><span class="badge" :class="qtyClass(p)">{{ p.qty }}</span></td>
              <td class="font-semibold text-gray-900 whitespace-nowrap">{{ p.price ? formatPrice(p.price) : '—' }}</td>
              <td class="hidden md:table-cell"><span v-if="p.zone" class="badge-zone">{{ p.zone }}</span><span v-else class="text-gray-400">—</span></td>
              <td class="hidden lg:table-cell"><span v-if="p.etat" class="badge" :class="etatClass(p.etat)">{{ p.etat }}</span></td>
              <td>
                <div class="flex justify-end gap-0.5">
                  <button @click="openView(p)" class="icon-btn" title="Voir la fiche"><AppIcon name="eye" class="w-4 h-4" /></button>
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
      <div v-if="!filteredPieces.length" class="text-center py-12 text-gray-500 text-sm">
        <AppIcon name="package" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
        Aucune pièce trouvée
      </div>
    </div>

    <!-- Fiche -->
    <BaseModal :title="viewPiece ? viewPiece.ref : ''" :open="viewOpen" @close="viewOpen = false" max-width="520px">
      <div v-if="viewPiece" class="space-y-3">
        <div class="flex gap-4">
          <span class="w-28 h-28 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0 text-gray-400">
            <img v-if="viewPiece.photo" :src="viewPiece.photo" class="w-full h-full object-cover" alt="">
            <AppIcon v-else name="package" class="w-8 h-8" />
          </span>
          <div class="min-w-0">
            <div class="text-base font-semibold text-gray-900">{{ viewPiece.name }}</div>
            <div class="flex flex-wrap gap-1.5 mt-1.5">
              <span v-if="viewPiece.cat && CATEGORIES[viewPiece.cat]" class="badge" :class="[CATEGORIES[viewPiece.cat].bgClass, CATEGORIES[viewPiece.cat].textClass]">{{ CATEGORIES[viewPiece.cat].label }}</span>
              <span v-if="viewPiece.etat" class="badge" :class="etatClass(viewPiece.etat)">{{ viewPiece.etat }}</span>
              <span class="badge" :class="qtyClass(viewPiece)">Stock : {{ viewPiece.qty }}</span>
            </div>
            <div class="text-xl font-bold text-gray-900 mt-2">{{ formatPrice(viewPiece.price || 0) }}</div>
          </div>
        </div>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
          <div><dt class="text-gray-500 text-[11px]">Véhicule</dt><dd class="text-gray-900">{{ viewPiece.vehicle || '—' }}</dd></div>
          <div><dt class="text-gray-500 text-[11px]">N° OEM</dt><dd class="text-gray-900 font-mono">{{ viewPiece.oem || '—' }}</dd></div>
          <div><dt class="text-gray-500 text-[11px]">Zone</dt><dd class="text-gray-900">{{ viewPiece.zone || '—' }}</dd></div>
          <div><dt class="text-gray-500 text-[11px]">Fournisseur</dt><dd class="text-gray-900">{{ viewPiece.supplier || '—' }}</dd></div>
          <div><dt class="text-gray-500 text-[11px]">Véhicule donneur</dt><dd class="text-gray-900">{{ viewPiece.donor || '—' }}</dd></div>
          <div><dt class="text-gray-500 text-[11px]">Ajoutée le</dt><dd class="text-gray-900">{{ viewPiece.added ? new Date(viewPiece.added).toLocaleDateString('fr-FR') : '—' }}</dd></div>
          <div class="col-span-2"><dt class="text-gray-500 text-[11px]">Compatibilités</dt><dd class="text-gray-900">{{ viewPiece.compat || '—' }}</dd></div>
          <div v-if="viewPiece.notes" class="col-span-2"><dt class="text-gray-500 text-[11px]">Notes</dt><dd class="text-gray-700 bg-gray-50 rounded-lg p-2 mt-1">{{ viewPiece.notes }}</dd></div>
        </dl>
        <div class="flex gap-2 pt-1">
          <button @click="openLabel(viewPiece)" class="btn btn-secondary"><AppIcon name="tag" class="w-4 h-4" /> Étiquette</button>
          <button v-if="canEdit && !viewPiece.archived" @click="viewOpen = false; openEdit(viewPiece)" class="btn btn-primary"><AppIcon name="edit" class="w-4 h-4" /> Modifier</button>
          <button @click="viewOpen = false" class="btn btn-ghost ml-auto">Fermer</button>
        </div>
      </div>
    </BaseModal>

    <!-- Édition -->
    <BaseModal title="Modifier la pièce" :open="editOpen" @close="editOpen = false">
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1"><label class="label">Désignation</label><input v-model="editForm.name" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Catégorie</label><select v-model="editForm.cat" class="input"><option value="">—</option><option value="moteur">Moteur</option><option value="carrosserie">Carrosserie</option><option value="train-avant">Train avant</option><option value="train-arriere">Train arrière</option><option value="electronique">Électronique</option><option value="autre">Autre</option></select></div>
        <div class="flex flex-col gap-1"><label class="label">Véhicule</label><input v-model="editForm.vehicle" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">OEM</label><input v-model="editForm.oem" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Quantité</label><input v-model.number="editForm.qty" type="number" min="0" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Seuil d'alerte</label><input v-model.number="editForm.threshold" type="number" min="0" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Prix (€)</label><input v-model.number="editForm.price" type="number" step="0.01" min="0" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">Zone</label><input v-model="editForm.zone" class="input"></div>
        <div class="flex flex-col gap-1"><label class="label">État</label><select v-model="editForm.etat" class="input"><option>Bon état</option><option>Très bon état</option><option>État moyen</option><option>Pour pièces</option></select></div>
        <div class="flex flex-col gap-1"><label class="label">Fournisseur</label><input v-model="editForm.supplier" class="input"></div>
        <div class="col-span-2 flex flex-col gap-1"><label class="label">Compatibilités</label><input v-model="editForm.compat" class="input"></div>
        <div class="col-span-2 flex flex-col gap-1"><label class="label">Notes</label><textarea v-model="editForm.notes" rows="2" class="input"></textarea></div>
        <div class="col-span-2"><PhotoUploadField v-model="editForm.photo" /></div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button @click="editOpen = false" class="btn btn-secondary">Annuler</button>
        <button @click="saveEdit" class="btn btn-primary"><AppIcon name="check" class="w-4 h-4" /> Enregistrer</button>
      </div>
    </BaseModal>

    <!-- Ajouter au panier -->
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
