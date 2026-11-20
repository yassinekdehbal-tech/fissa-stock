<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useLeadsStore } from '@/stores/leads'
import { useStockStore } from '@/stores/stock'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { formatRef } from '@/utils/format'
import { LEAD_KIND_LABELS, LEAD_STATUS_LABELS } from '@/types'
import type { Lead, LeadKind, LeadStatus } from '@/types'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

/**
 * Demandes reçues depuis le portail public fissagroupe.fr (table `leads`) :
 * devis atelier, dépôt-vente de véhicule, demande de pièce, contact.
 * On les lit, on les traite (statut), un administrateur peut les supprimer.
 */
const leads = useLeadsStore()
const stock = useStockStore()
const auth = useAuthStore()
const { toast } = useToast()

onMounted(() => { if (leads.loading) leads.listen() })

const SITE_URL = 'https://fissagroupe.fr'

type StatusTab = LeadStatus | 'all'
const tab = ref<StatusTab>('nouveau')
const kind = ref<LeadKind | ''>('')
const search = ref('')

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'nouveau', label: 'Nouvelles' },
  { key: 'traite', label: 'Traitées' },
  { key: 'archive', label: 'Archivées' },
  { key: 'all', label: 'Toutes' },
]
const KINDS = (Object.keys(LEAD_KIND_LABELS) as LeadKind[]).map((k) => ({ key: k, label: LEAD_KIND_LABELS[k] }))

function countFor(t: StatusTab) {
  return t === 'all' ? leads.leads.length : leads.leads.filter((l) => l.status === t).length
}

const list = computed(() => {
  const q = search.value.toLowerCase().trim()
  return leads.leads
    .filter((l) => (tab.value === 'all' ? true : l.status === tab.value))
    .filter((l) => !kind.value || l.kind === kind.value)
    .filter((l) => !q || [l.name, l.phone, l.email, l.vehicle, l.message].some((v) => (v || '').toLowerCase().includes(q)))
})

const kindStyle: Record<LeadKind, { cls: string; icon: string }> = {
  garage: { cls: 'badge-blue', icon: 'wrench' },
  auto: { cls: 'badge-violet', icon: 'truck' },
  piece: { cls: 'badge-amber', icon: 'package' },
  contact: { cls: 'badge-gray', icon: 'mail' },
}
const statusStyle: Record<LeadStatus, string> = {
  nouveau: 'badge-orange',
  traite: 'badge-green',
  archive: 'badge-gray',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function pieceFor(l: Lead) {
  return l.pieceId ? stock.pieces.find((p) => p._id === l.pieceId) : undefined
}
function pageUrl(page: string) {
  return page.startsWith('/') ? SITE_URL + page : page
}
/** Numéro affichable → lien `tel:` (espaces et points retirés). */
function telHref(phone: string) {
  return 'tel:' + phone.replace(/[\s.()-]/g, '')
}

// --- Fiche d'une demande ----------------------------------------------------
const open = ref(false)
const current = ref<Lead | null>(null)
function show(l: Lead) {
  current.value = l
  open.value = true
}
// La fiche suit la ligne du store (mise à jour après changement de statut)
const detail = computed(() => current.value ? leads.leads.find((l) => l.id === current.value!.id) ?? null : null)

const busy = ref<string | null>(null)
async function setStatus(l: Lead, status: LeadStatus) {
  busy.value = l.id
  try {
    await leads.setStatus(l.id, status)
    toast(status === 'traite' ? '✓ Demande marquée traitée' : status === 'archive' ? 'Demande archivée' : 'Demande rouverte')
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    busy.value = null
  }
}
async function remove(l: Lead) {
  if (!confirm(`Supprimer définitivement la demande de ${l.name} ?`)) return
  busy.value = l.id
  try {
    await leads.deleteLead(l.id)
    open.value = false
    toast('Demande supprimée')
  } catch (e) {
    toast('Erreur : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="max-w-[960px] mx-auto space-y-4">
    <div class="hidden lg:block">
      <h1 class="page-title">Demandes</h1>
      <p class="page-subtitle">Formulaires reçus depuis le site fissagroupe.fr : devis atelier, véhicules, pièces, contact</p>
    </div>

    <!-- Indicateurs -->
    <div class="grid grid-cols-3 gap-2">
      <div class="card p-3"><div class="text-[11px] text-gray-500">Nouvelles</div><div class="text-xl font-bold" :class="leads.newCount ? 'text-orange-600' : 'text-gray-900'">{{ leads.newCount }}</div></div>
      <div class="card p-3"><div class="text-[11px] text-gray-500">Traitées</div><div class="text-xl font-bold text-green-600">{{ countFor('traite') }}</div></div>
      <div class="card p-3"><div class="text-[11px] text-gray-500">Archivées</div><div class="text-xl font-bold text-gray-500">{{ countFor('archive') }}</div></div>
    </div>

    <!-- Filtres -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
      <div class="flex gap-1 overflow-x-auto scrollbar-hide">
        <button v-for="t in TABS" :key="t.key" class="btn btn-sm whitespace-nowrap" :class="tab === t.key ? 'btn-primary' : 'btn-secondary'" @click="tab = t.key">
          {{ t.label }} <span class="opacity-70">({{ countFor(t.key) }})</span>
        </button>
      </div>
      <div class="flex gap-2">
        <select v-model="kind" class="input sm:w-44" aria-label="Type de demande">
          <option value="">Tous les types</option>
          <option v-for="k in KINDS" :key="k.key" :value="k.key">{{ k.label }}</option>
        </select>
        <input v-model="search" type="search" placeholder="Nom, téléphone, véhicule…" class="input sm:w-56">
      </div>
    </div>

    <div v-if="leads.loading" class="text-center py-12 text-gray-500 text-sm">Chargement…</div>
    <div v-else-if="!list.length" class="card text-center py-12 text-gray-500 text-sm">
      <AppIcon name="inbox" class="w-8 h-8 mx-auto text-gray-300 mb-2" />
      Aucune demande {{ tab === 'nouveau' ? 'nouvelle' : tab === 'traite' ? 'traitée' : tab === 'archive' ? 'archivée' : '' }}.
      <div class="text-[12px] text-gray-400 mt-1">Les demandes arrivent automatiquement depuis les formulaires de fissagroupe.fr.</div>
    </div>

    <!-- Liste (du plus récent au plus ancien) -->
    <div v-else class="space-y-2">
      <div v-for="l in list" :key="l.id" class="card p-3 lg:p-4 hover:border-gray-300 cursor-pointer" :class="l.status === 'nouveau' ? 'border-l-4 border-l-brand' : ''" @click="show(l)">
        <div class="flex items-start gap-3">
          <span class="w-11 h-11 shrink-0 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center"><AppIcon :name="kindStyle[l.kind]?.icon || 'mail'" class="w-5 h-5" /></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="badge" :class="kindStyle[l.kind]?.cls">{{ LEAD_KIND_LABELS[l.kind] || l.kind }}</span>
              <span class="badge" :class="statusStyle[l.status]">{{ LEAD_STATUS_LABELS[l.status] || l.status }}</span>
              <span v-if="pieceFor(l)" class="badge-ref">{{ formatRef(pieceFor(l)!.ref) }}</span>
            </div>
            <div class="text-[14px] font-semibold text-gray-900 truncate mt-1">{{ l.name }}</div>
            <div class="text-[12px] text-gray-500 mt-0.5">
              {{ fmt(l.createdAt) }}<template v-if="l.vehicle"> · {{ l.vehicle }}</template>
            </div>
            <div class="text-[12px] text-gray-700 mt-1 flex flex-wrap gap-x-3 gap-y-0.5" @click.stop>
              <a v-if="l.phone" :href="telHref(l.phone)" class="inline-flex items-center gap-1 hover:underline"><AppIcon name="phone" class="w-3.5 h-3.5 text-gray-400" /> {{ l.phone }}</a>
              <a v-if="l.email" :href="'mailto:' + l.email" class="inline-flex items-center gap-1 hover:underline truncate"><AppIcon name="mail" class="w-3.5 h-3.5 text-gray-400" /> {{ l.email }}</a>
            </div>
            <div v-if="l.message" class="text-[12px] text-gray-500 mt-1 line-clamp-2">{{ l.message }}</div>
          </div>
          <AppIcon name="chevron-right" class="w-4 h-4 text-gray-400 shrink-0 mt-1" />
        </div>
      </div>
    </div>

    <!-- Fiche d'une demande -->
    <BaseModal :title="detail ? LEAD_KIND_LABELS[detail.kind] + ' · ' + detail.name : 'Demande'" :open="open" @close="open = false" max-width="520px">
      <div v-if="detail" class="space-y-3">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="badge" :class="kindStyle[detail.kind]?.cls">{{ LEAD_KIND_LABELS[detail.kind] }}</span>
          <span class="badge" :class="statusStyle[detail.status]">{{ LEAD_STATUS_LABELS[detail.status] }}</span>
          <span class="text-[12px] text-gray-500 ml-auto">{{ fmt(detail.createdAt) }}</span>
        </div>

        <div class="rounded-lg bg-gray-50 border border-gray-200 p-3 text-[13px] space-y-1.5">
          <div class="font-semibold text-gray-900">{{ detail.name }}</div>
          <div v-if="detail.phone"><span class="text-gray-500">Téléphone :</span> <a :href="telHref(detail.phone)" class="text-blue-600 font-medium hover:underline">{{ detail.phone }}</a></div>
          <div v-if="detail.email"><span class="text-gray-500">E-mail :</span> <a :href="'mailto:' + detail.email" class="text-blue-600 font-medium hover:underline break-all">{{ detail.email }}</a></div>
          <div v-if="detail.vehicle"><span class="text-gray-500">Véhicule :</span> {{ detail.vehicle }}</div>
        </div>

        <div v-if="detail.message">
          <div class="label">Message</div>
          <div class="text-[13px] text-gray-800 whitespace-pre-line leading-relaxed">{{ detail.message }}</div>
        </div>

        <div v-if="detail.pieceId" class="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[13px]">
          <div class="text-[11px] text-gray-500 mb-1">Pièce demandée</div>
          <router-link :to="`/piece/${detail.pieceId}`" class="inline-flex items-center gap-2 font-medium text-gray-900 hover:underline" @click="open = false">
            <span v-if="pieceFor(detail)" class="badge-ref">{{ formatRef(pieceFor(detail)!.ref) }}</span>
            <span>{{ pieceFor(detail)?.name || 'Voir la fiche pièce' }}</span>
            <AppIcon name="arrow-right" class="w-3.5 h-3.5" />
          </router-link>
          <div v-if="pieceFor(detail)" class="text-[11px] text-gray-500 mt-0.5">{{ pieceFor(detail)!.qty }} en stock · {{ pieceFor(detail)!.price.toFixed(2) }} €</div>
          <div v-else class="text-[11px] text-gray-500 mt-0.5">Pièce absente du stock actif (vendue ou archivée).</div>
        </div>

        <div v-if="detail.page" class="text-[11px] text-gray-500">
          Envoyé depuis <a :href="pageUrl(detail.page)" target="_blank" rel="noopener" class="text-blue-600 hover:underline break-all">{{ pageUrl(detail.page) }}</a>
        </div>

        <div class="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <button v-if="detail.status === 'nouveau'" class="btn btn-primary btn-sm" :disabled="busy === detail.id" @click="setStatus(detail, 'traite')"><AppIcon name="check" class="w-4 h-4" /> Marquer traitée</button>
          <button v-if="detail.status !== 'archive'" class="btn btn-secondary btn-sm" :disabled="busy === detail.id" @click="setStatus(detail, 'archive')">Archiver</button>
          <button v-if="detail.status !== 'nouveau'" class="btn btn-secondary btn-sm" :disabled="busy === detail.id" @click="setStatus(detail, 'nouveau')"><AppIcon name="refresh" class="w-4 h-4" /> Rouvrir</button>
          <span class="flex-1"></span>
          <button v-if="auth.isAdmin" class="btn btn-ghost btn-sm text-red-600" :disabled="busy === detail.id" @click="remove(detail)"><AppIcon name="trash" class="w-4 h-4" /> Supprimer</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
