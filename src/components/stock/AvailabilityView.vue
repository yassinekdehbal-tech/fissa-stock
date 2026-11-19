<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStockStore } from '@/stores/stock'
import { useSuppliersStore, supplierSearchLink } from '@/stores/suppliers'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useCategoriesStore } from '@/stores/categories'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import { normalizeRef } from '@/utils/refMatch'
import { sanitize } from '@/utils/security'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BarcodeScanModal from '@/components/ui/BarcodeScanModal.vue'
import type { Piece, SupplierCatalogHit } from '@/types'

/**
 * Disponibilité au comptoir : une référence (trouvée chez un fournisseur, sur
 * PartsLink24, Oscaro…) ou des mots-clés → la pièce est-elle en stock chez
 * nous (neuve ou occasion) ? Sinon, existe-t-elle chez l'un de nos
 * fournisseurs (catalogues importés), à quel prix ? Et si le vendeur la
 * retrouve malgré tout dans le stock, il associe la référence à la pièce
 * pour la prochaine fois.
 */
const route = useRoute()
const router = useRouter()
const stock = useStockStore()
const suppliers = useSuppliersStore()
const cart = useCartStore()
const auth = useAuthStore()
const cats = useCategoriesStore()
const { toast } = useToast()

const query = ref(String(route.query.q ?? ''))
const scanOpen = ref(false)
const searching = ref(false)
const hits = ref<SupplierCatalogHit[]>([])
const searched = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

const canSell = computed(() => auth.isAdmin || auth.hasPerm('vendeur'))
const q = computed(() => query.value.trim())
const looksLikeRef = computed(() => /\d/.test(q.value) && !/\s/.test(q.value))

/** Pièces en stock correspondant à la recherche (toutes références + mots-clés). */
const inStock = computed<Piece[]>(() => {
  if (q.value.length < 2) return []
  return stock.activePieces.filter((p) => stock.matchesQuery(p, q.value)).slice(0, 30)
})
const available = computed(() => inStock.value.filter((p) => p.qty > 0))
const outOfStock = computed(() => inStock.value.filter((p) => p.qty === 0))

/** Fournisseurs avec un lien de recherche, pour ouvrir leur site avec la référence. */
const supplierLinks = computed(() =>
  suppliers.active
    .map((s) => ({ s, href: supplierSearchLink(s, q.value) }))
    .filter((x) => x.href && (x.s.searchUrl || x.s.website)),
)
const hitsBySupplier = computed(() => {
  const m = new Map<string, SupplierCatalogHit[]>()
  for (const h of hits.value) {
    if (!m.has(h.supplierName)) m.set(h.supplierName, [])
    m.get(h.supplierName)!.push(h)
  }
  return [...m.entries()]
})

async function runSearch() {
  const value = q.value
  if (value.length < 2) { hits.value = []; searched.value = ''; return }
  searching.value = true
  try {
    const res = await suppliers.searchCatalog(value)
    if (q.value === value) { hits.value = res; searched.value = value }
  } catch (e) {
    toast('Recherche fournisseurs : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    searching.value = false
  }
}
watch(query, () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void runSearch() }, 350)
  void router.replace({ query: q.value ? { q: q.value } : {} })
})
onMounted(() => { if (q.value) void runSearch() })

function onScanned(code: string) {
  query.value = code
  scanOpen.value = false
}

// --- Panier (vente comptoir) --------------------------------------------------
function addToCart(p: Piece) {
  const already = cart.items.find((i) => i.piece._id === p._id)?.qty ?? 0
  if (p.qty - already < 1) { toast('Plus de stock disponible', true); return }
  cart.add(p, 1, p.price || 0)
  toast(`✓ ${p.ref} ajouté au panier`)
}

// --- Associer la référence cherchée à une pièce du stock ----------------------
const attachOpen = ref(false)
const attachQuery = ref('')
const attaching = ref(false)
const attachCandidates = computed(() => {
  const aq = attachQuery.value.trim()
  if (aq.length < 2) return []
  return stock.activePieces.filter((p) => stock.matchesQuery(p, aq)).slice(0, 12)
})
function openAttach() { attachQuery.value = ''; attachOpen.value = true }
async function attachTo(p: Piece) {
  if (!p._id) return
  attaching.value = true
  try {
    await stock.addAltRef(p._id, sanitize(q.value))
    attachOpen.value = false
    toast(`✓ « ${q.value} » associée à ${p.ref} : la prochaine recherche la trouvera directement`)
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    attaching.value = false
  }
}

const matchLabel: Record<string, string> = { ref: 'Référence exacte', ean: 'Code EAN', 'ref-prefix': 'Référence proche', label: 'Désignation' }
function qtyClass(p: Piece) { return p.qty === 0 ? 'badge-red' : 'badge-green' }
</script>

<template>
  <div class="max-w-[860px] mx-auto space-y-3">
    <div class="hidden lg:block">
      <h1 class="page-title">Disponibilité</h1>
      <p class="page-subtitle">Une référence ou des mots-clés : en stock chez nous, ou chez l'un de nos fournisseurs</p>
    </div>

    <!-- Recherche -->
    <div class="card p-3 lg:p-4">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <AppIcon name="search" class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input v-model="query" type="search" placeholder="Réf. OEM, réf. fournisseur, EAN, « alternateur 308 »…" class="input pl-9 h-12 text-[15px] font-mono" autocapitalize="characters" autofocus>
        </div>
        <button class="w-12 h-12 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0" @click="scanOpen = true" aria-label="Scanner un code-barres"><AppIcon name="scan" class="w-5 h-5" /></button>
      </div>
      <p class="text-[11px] text-gray-500 mt-2 leading-snug">La référence peut venir d'un site fournisseur, de PartsLink24, d'Oscaro ou d'un emballage : points, espaces et tirets sont ignorés.</p>
    </div>

    <div v-if="q.length < 2" class="card text-center py-10 text-gray-500 text-sm">
      <AppIcon name="search" class="w-8 h-8 mx-auto text-gray-300 mb-2" /> Tapez ou scannez une référence.
    </div>

    <template v-else>
      <!-- 1. En stock chez nous -->
      <div class="card p-3 lg:p-4">
        <div class="card-title justify-between">
          <span class="inline-flex items-center gap-2"><AppIcon name="box" class="w-4 h-4 text-gray-400" /> Chez nous</span>
          <span class="badge" :class="available.length ? 'badge-green' : 'badge-gray'">{{ available.length ? available.length + ' disponible' + (available.length > 1 ? 's' : '') : 'Pas en stock' }}</span>
        </div>
        <div v-if="!inStock.length" class="text-[13px] text-gray-500">
          Aucune pièce du stock ne correspond à « {{ q }} ».
          <button v-if="canSell && looksLikeRef" class="text-blue-600 font-medium hover:underline ml-1" @click="openAttach">Associer cette référence à une pièce</button>
        </div>
        <div v-else class="divide-y divide-gray-100">
          <div v-for="p in [...available, ...outOfStock]" :key="p._id" class="flex items-center gap-3 py-2.5" :class="{ 'opacity-60': p.qty === 0 }">
            <router-link :to="`/piece/${p._id}`" class="w-12 h-12 thumb shrink-0"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></router-link>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <router-link :to="`/piece/${p._id}`" class="badge-ref hover:underline">{{ p.ref }}</router-link>
                <span class="badge" :class="p.condition === 'neuve' ? 'badge-green' : 'badge-violet'">{{ p.condition === 'neuve' ? 'Neuve' : 'Occasion' }}</span>
                <span v-if="p.cat" class="badge hidden sm:inline-flex" :class="[cats.info(p.cat).bgClass, cats.info(p.cat).textClass]">{{ cats.info(p.cat).label }}</span>
              </div>
              <div class="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{{ p.name }}</div>
              <div class="text-[11px] text-gray-500 truncate">
                <span v-if="p.vehicle">{{ p.vehicle }} · </span><span v-if="p.oem">OEM {{ p.oem }} · </span><span v-if="p.zone">{{ p.zone }}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-[14px] font-bold text-gray-900">{{ formatPrice(p.price || 0) }}</div>
              <span class="badge" :class="qtyClass(p)">{{ p.qty === 0 ? 'Rupture' : p.qty + ' en stock' }}</span>
            </div>
            <button v-if="canSell && p.qty > 0" class="icon-btn icon-btn-success border border-green-200 w-10 h-10 shrink-0" title="Ajouter au panier" @click="addToCart(p)"><AppIcon name="cart" class="w-4 h-4" /></button>
          </div>
          <div v-if="canSell && looksLikeRef && !available.length" class="pt-2 text-[12px]">
            <button class="text-blue-600 font-medium hover:underline" @click="openAttach">Associer « {{ q }} » à une autre pièce du stock</button>
          </div>
        </div>
      </div>

      <!-- 2. Chez nos fournisseurs -->
      <div class="card p-3 lg:p-4">
        <div class="card-title justify-between">
          <span class="inline-flex items-center gap-2"><AppIcon name="store" class="w-4 h-4 text-gray-400" /> Chez nos fournisseurs</span>
          <span v-if="searching" class="text-[11px] text-gray-400">Recherche…</span>
          <span v-else-if="searched" class="badge" :class="hits.length ? 'badge-blue' : 'badge-gray'">{{ hits.length ? hits.length + ' référence' + (hits.length > 1 ? 's' : '') : 'Rien dans les tarifs importés' }}</span>
        </div>
        <div v-if="hitsBySupplier.length" class="space-y-3">
          <div v-for="[name, list] in hitsBySupplier" :key="name">
            <div class="text-[12px] font-semibold text-gray-700 mb-1">{{ name }}</div>
            <div class="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              <div v-for="h in list" :key="h.id" class="flex items-center gap-3 px-3 py-2 bg-white">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="badge-ref">{{ h.ref }}</span>
                    <span class="badge" :class="h.match === 'ref' || h.match === 'ean' ? 'badge-green' : 'badge-gray'">{{ matchLabel[h.match] }}</span>
                    <span v-if="h.family" class="text-[11px] text-gray-500">{{ h.family }}</span>
                  </div>
                  <div class="text-[13px] text-gray-900 truncate mt-0.5">{{ h.label || '—' }}</div>
                  <div v-if="h.ean" class="text-[11px] text-gray-500 font-mono">EAN {{ h.ean }}</div>
                </div>
                <div class="text-right shrink-0 text-[12px]">
                  <div v-if="h.priceNet != null" class="text-[14px] font-bold text-gray-900">{{ formatPrice(h.priceNet) }} <span class="text-[10px] font-normal text-gray-500">net HT</span></div>
                  <div v-if="h.pricePublic != null" class="text-gray-500">public {{ formatPrice(h.pricePublic) }}</div>
                  <div v-if="h.discount != null" class="text-[11px] text-green-600">-{{ h.discount }} %</div>
                </div>
                <a v-if="supplierSearchLink({ searchUrl: h.searchUrl, website: '' }, h.ref)" :href="supplierSearchLink({ searchUrl: h.searchUrl, website: '' }, h.ref)" target="_blank" rel="noopener" class="icon-btn border border-gray-200 w-9 h-9 shrink-0" title="Voir chez le fournisseur (stock, délai)"><AppIcon name="arrow-up-right" class="w-4 h-4" /></a>
              </div>
            </div>
          </div>
          <p class="text-[11px] text-gray-500 leading-snug">Prix issus du dernier tarif importé. La disponibilité et le délai se vérifient sur le site du fournisseur (flèche).</p>
        </div>
        <div v-else-if="searched && !searching" class="text-[13px] text-gray-500">
          Aucune correspondance dans les catalogues importés<span v-if="!suppliers.active.some(s => suppliers.catalogCounts[s.id])"> (aucun tarif importé pour l'instant : Paramètres → Fournisseurs)</span>.
        </div>
        <!-- Liens directs vers les sites fournisseurs -->
        <div v-if="supplierLinks.length && looksLikeRef" class="mt-3 flex flex-wrap gap-1.5">
          <a v-for="x in supplierLinks" :key="x.s.id" :href="x.href" target="_blank" rel="noopener" class="chip">
            <AppIcon name="arrow-up-right" class="w-3 h-3" /> Chercher chez {{ x.s.name }}
          </a>
        </div>
      </div>
    </template>

    <BarcodeScanModal :open="scanOpen" title="Scanner une référence ou un EAN" @close="scanOpen = false" @scanned="onScanned" />

    <BaseModal :title="'Associer « ' + q + ' »'" :open="attachOpen" @close="attachOpen = false" max-width="520px">
      <p class="text-[12px] text-gray-500 leading-snug mb-3">Choisissez la pièce du stock qui correspond à cette référence. Elle sera retrouvée directement la prochaine fois (stock, scanner, disponibilité).</p>
      <input v-model="attachQuery" type="search" placeholder="Désignation, véhicule, référence FISSA…" class="input mb-2" autofocus>
      <div v-if="attachCandidates.length" class="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
        <button v-for="p in attachCandidates" :key="p._id" type="button" class="w-full flex items-center gap-3 py-2 text-left hover:bg-gray-50 rounded-lg px-1" :disabled="attaching" @click="attachTo(p)">
          <span class="w-10 h-10 thumb shrink-0"><img v-if="p.photo" :src="p.photo" class="w-full h-full object-cover" alt=""><AppIcon v-else name="package" class="w-4 h-4" /></span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2"><span class="badge-ref">{{ p.ref }}</span><span class="badge" :class="p.condition === 'neuve' ? 'badge-green' : 'badge-violet'">{{ p.condition === 'neuve' ? 'Neuve' : 'Occasion' }}</span></span>
            <span class="block text-[13px] font-medium text-gray-900 truncate">{{ p.name }}</span>
            <span class="block text-[11px] text-gray-500 truncate">{{ p.vehicle || '—' }} · {{ p.qty }} en stock</span>
          </span>
          <AppIcon name="chevron-right" class="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      </div>
      <div v-else-if="attachQuery.trim().length >= 2" class="text-[12px] text-gray-500 py-4 text-center">Aucune pièce.</div>
    </BaseModal>
  </div>
</template>
