<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BarcodeLabelModal from '@/components/stock/BarcodeLabelModal.vue'
import PieceEditModal from '@/components/stock/PieceEditModal.vue'
import { CATEGORIES } from '@/types'
import { formatPrice } from '@/utils/format'

/** Fiche produit : photo, identifiants, stock, prix, actions (sortir / modifier / étiquette). */
const route = useRoute()
const router = useRouter()
const stock = useStockStore()
const auth = useAuthStore()
const cart = useCartStore()
const { toast } = useToast()

const piece = computed(() => stock.pieces.find(p => p._id === route.params.id))
const canEdit = computed(() => auth.isAdmin || auth.hasPerm('magasinier'))
const canSell = computed(() => auth.hasPerm('vendeur'))

const SOURCES: Record<string, string> = { demontage: 'Démontage', don: 'Don', 'lot-occasion': "Lot d'occasion", 'grossiste-neuf': 'Grossiste neuf', web: 'Web', autre: 'Autre' }

const editOpen = ref(false)
const labelOpen = ref(false)

// Sortie de stock : quantité puis panier
const outOpen = ref(false)
const outQty = ref(1)
const inCart = computed(() => piece.value ? cart.items.find(i => i.piece._id === piece.value!._id) : undefined)
const maxQty = computed(() => piece.value ? Math.max(0, piece.value.qty - (inCart.value?.qty || 0)) : 0)

function openOut() { outQty.value = 1; outOpen.value = true }
function confirmOut() {
  if (!piece.value) return
  if (outQty.value < 1 || outQty.value > maxQty.value) { toast(`Quantité invalide (max ${maxQty.value})`, true); return }
  cart.add(piece.value, outQty.value, piece.value.price || 0)
  outOpen.value = false
  toast(`✓ ${piece.value.ref} ajouté au panier`)
  void router.push('/panier')
}

function etatClass(etat: string) {
  if (etat === 'Très bon état' || etat === 'Neuf') return 'badge-green'
  if (etat === 'Bon état') return 'badge-blue'
  if (etat === 'État moyen') return 'badge-amber'
  return 'badge-gray'
}
</script>

<template>
  <div class="max-w-[760px] mx-auto space-y-3">
    <div v-if="stock.loading && !piece" class="text-center py-16 text-gray-500 text-sm">Chargement…</div>
    <div v-else-if="!piece" class="card text-center py-16 text-gray-500 text-sm">
      Pièce introuvable.
      <div class="mt-3"><router-link to="/stock" class="btn btn-secondary btn-sm">Retour au stock</router-link></div>
    </div>

    <template v-else>
      <!-- En-tête (desktop) -->
      <div class="hidden lg:flex items-center gap-3">
        <router-link to="/stock" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour au stock"><AppIcon name="arrow-left" class="w-4 h-4" /></router-link>
        <div class="flex-1 min-w-0">
          <h1 class="page-title">{{ piece.ref }}</h1>
          <p class="page-subtitle">Fiche produit</p>
        </div>
        <button v-if="canEdit" class="btn btn-secondary" @click="labelOpen = true"><AppIcon name="tag" class="w-4 h-4" /> Étiquette</button>
        <button v-if="canEdit" class="btn btn-primary" @click="editOpen = true"><AppIcon name="edit" class="w-4 h-4" /> Modifier</button>
      </div>

      <!-- Photo -->
      <div class="card overflow-hidden relative">
        <div class="aspect-[4/3] lg:aspect-[16/7] bg-gray-100 flex items-center justify-center text-gray-300">
          <img v-if="piece.photo" :src="piece.photo" class="w-full h-full object-cover" :alt="piece.name" @error="($event.target as HTMLImageElement).style.display = 'none'">
          <AppIcon v-else name="image" class="w-12 h-12" />
        </div>
        <button v-if="canEdit" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow text-gray-700 flex items-center justify-center hover:bg-white lg:hidden" @click="editOpen = true" aria-label="Modifier"><AppIcon name="edit" class="w-4 h-4" /></button>
        <button class="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow text-gray-700 flex items-center justify-center hover:bg-white lg:hidden" @click="labelOpen = true" aria-label="Étiquette"><AppIcon name="tag" class="w-4 h-4" /></button>
      </div>

      <!-- Identité -->
      <div class="card p-4">
        <h2 class="text-lg font-bold text-gray-900 leading-snug">{{ piece.name }}</h2>
        <div class="flex flex-wrap items-center gap-2 mt-2">
          <span v-if="piece.cat && CATEGORIES[piece.cat]" class="badge" :class="[CATEGORIES[piece.cat].bgClass, CATEGORIES[piece.cat].textClass]"><AppIcon name="zap" class="w-3 h-3" /> {{ piece.cat === 'electronique' ? 'Électricité' : CATEGORIES[piece.cat].label }}</span>
          <span class="badge" :class="piece.qty === 0 ? 'badge-red' : piece.qty <= (piece.threshold || 1) ? 'badge-orange' : 'badge-green'">{{ piece.qty === 0 ? 'Rupture' : `En stock : ${piece.qty}` }}</span>
          <span v-if="piece.archived" class="badge badge-gray">Archivée</span>
          <span v-if="piece.publishable" class="badge badge-blue">Boutique</span>
        </div>
        <div class="text-2xl font-bold text-gray-900 mt-3">{{ formatPrice(piece.price || 0) }}</div>

        <dl class="mt-4 grid grid-cols-[110px_1fr] gap-y-2 gap-x-3 text-[13px]">
          <dt class="text-gray-500">Référence</dt><dd class="font-mono text-gray-900">{{ piece.ref }}</dd>
          <dt class="text-gray-500">N° OEM</dt><dd class="font-mono text-gray-900">{{ piece.oem || '—' }}</dd>
          <dt class="text-gray-500">Véhicule</dt><dd class="text-gray-900">{{ piece.vehicle || '—' }}</dd>
          <dt class="text-gray-500">Compatibilités</dt><dd class="text-gray-900">{{ piece.compat || '—' }}</dd>
          <dt class="text-gray-500">Fournisseur</dt><dd class="text-gray-900">{{ piece.supplier || '—' }}</dd>
          <dt class="text-gray-500">Zone</dt><dd class="text-gray-900"><span v-if="piece.zone" class="badge-zone"><AppIcon name="map-pin" class="w-3 h-3" /> {{ piece.zone }}</span><span v-else>—</span></dd>
          <dt class="text-gray-500">État</dt><dd><span class="badge" :class="etatClass(piece.etat)">{{ piece.etat || '—' }}</span></dd>
          <dt class="text-gray-500">Provenance</dt><dd class="text-gray-900">{{ SOURCES[piece.source] || piece.source || '—' }}</dd>
          <dt class="text-gray-500">Donneur</dt><dd class="text-gray-900">{{ piece.donor || '—' }}</dd>
          <dt class="text-gray-500">Seuil d'alerte</dt><dd class="text-gray-900">{{ piece.threshold || 1 }}</dd>
          <dt class="text-gray-500">Ajoutée le</dt><dd class="text-gray-900">{{ piece.added ? new Date(piece.added).toLocaleDateString('fr-FR') : '—' }}</dd>
        </dl>
        <div v-if="piece.notes" class="mt-3 text-[13px] text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">{{ piece.notes }}</div>
      </div>

      <!-- Actions -->
      <div class="grid grid-cols-2 gap-2">
        <button v-if="canSell && !piece.archived" class="btn btn-secondary py-3" :disabled="maxQty < 1" @click="openOut"><AppIcon name="scan" class="w-4 h-4" /> Scanner / Sortir</button>
        <router-link v-else to="/stock" class="btn btn-secondary py-3">Retour au stock</router-link>
        <button v-if="canEdit && !piece.archived" class="btn btn-primary py-3" @click="editOpen = true"><AppIcon name="edit" class="w-4 h-4" /> Modifier</button>
        <button v-else class="btn btn-secondary py-3" @click="labelOpen = true"><AppIcon name="tag" class="w-4 h-4" /> Étiquette</button>
      </div>

      <PieceEditModal :piece="piece" :open="editOpen" @close="editOpen = false" />
      <BarcodeLabelModal :piece="piece" :open="labelOpen" @close="labelOpen = false" />

      <BaseModal title="Sortir du stock" :open="outOpen" @close="outOpen = false" max-width="380px">
        <div class="flex items-center gap-3 mb-4">
          <span class="w-12 h-12 thumb"><img v-if="piece.photo" :src="piece.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
          <div class="min-w-0"><span class="badge-ref">{{ piece.ref }}</span><div class="text-[13px] font-semibold text-gray-900 truncate">{{ piece.name }}</div><div class="text-[12px] text-gray-500">Disponible : {{ maxQty }}</div></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="label">Quantité à sortir</span>
          <div class="qty-stepper">
            <button @click="outQty = Math.max(1, outQty - 1)" aria-label="Moins"><AppIcon name="minus" class="w-4 h-4" /></button>
            <span>{{ outQty }}</span>
            <button @click="outQty = Math.min(maxQty, outQty + 1)" aria-label="Plus"><AppIcon name="plus" class="w-4 h-4" /></button>
          </div>
        </div>
        <div class="flex gap-2 mt-5 justify-end">
          <button class="btn btn-secondary" @click="outOpen = false">Annuler</button>
          <button class="btn btn-primary" @click="confirmOut"><AppIcon name="cart" class="w-4 h-4" /> Ajouter au panier</button>
        </div>
      </BaseModal>
    </template>
  </div>
</template>
