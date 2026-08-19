<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlanningStore } from '@/stores/planning'
import { useStockStore } from '@/stores/stock'
import { useToast } from '@/composables/useToast'
import { supabase } from '@/lib/supabase'
import { sanitize } from '@/utils/security'
import { formatPrice } from '@/utils/format'
import BaseModal from '@/components/ui/BaseModal.vue'
import type { Intervention, Piece } from '@/types'

const planning = usePlanningStore()
const stock = useStockStore()
const { toast } = useToast()

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------
const showCreate = ref(false)
const creating = ref(false)
const newIntervention = ref(emptyForm())

function emptyForm() {
  return {
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    vehicleMake: '',
    vehicleModel: '',
    vehiclePlate: '',
    description: '',
    notes: '',
    dateScheduled: ''
  }
}

function openCreate() {
  newIntervention.value = emptyForm()
  showCreate.value = true
}

async function submitCreate() {
  const f = newIntervention.value
  if (!f.clientName || !f.clientPhone || !f.vehicleMake || !f.vehicleModel || !f.vehiclePlate || !f.description || !f.dateScheduled) {
    toast('Veuillez remplir tous les champs obligatoires', true)
    return
  }
  creating.value = true
  try {
    const intervention: Omit<Intervention, '_id'> = {
      clientName: sanitize(f.clientName.trim()),
      clientPhone: sanitize(f.clientPhone.trim()),
      clientEmail: sanitize(f.clientEmail.trim()),
      vehicleMake: sanitize(f.vehicleMake.trim()),
      vehicleModel: sanitize(f.vehicleModel.trim()),
      vehiclePlate: sanitize(f.vehiclePlate.trim().toUpperCase()),
      description: sanitize(f.description.trim()),
      notes: sanitize(f.notes.trim()),
      status: 'todo',
      parts: [],
      estimatedTotal: 0,
      dateScheduled: f.dateScheduled,
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    }
    await planning.addIntervention(intervention)
    toast('Intervention créée')
    showCreate.value = false
  } catch {
    toast('Erreur lors de la création', true)
  } finally {
    creating.value = false
  }
}

// ---------------------------------------------------------------------------
// Detail / Edit Modal
// ---------------------------------------------------------------------------
const showDetail = ref(false)
const saving = ref(false)
const editData = ref<Intervention | null>(null)
const activeDetailTab = ref<'info' | 'parts' | 'history'>('info')
const confirmDelete = ref(false)

function openDetail(intervention: Intervention) {
  editData.value = JSON.parse(JSON.stringify(intervention))
  activeDetailTab.value = 'info'
  confirmDelete.value = false
  partSearch.value = ''
  showDetail.value = true
}

/** Recharge la copie éditée depuis le store (après une opération sur les pièces). */
function syncEditData() {
  if (!editData.value?._id) return
  const fresh = planning.interventions.find((i) => i._id === editData.value!._id)
  if (fresh) editData.value = JSON.parse(JSON.stringify(fresh))
}

function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message || ''
  if (/stock insuffisant/i.test(m)) return m
  return 'Erreur sur la pièce'
}

async function saveDetail() {
  if (!editData.value?._id) return
  saving.value = true
  try {
    const d = editData.value
    // Les pièces sont gérées en direct (RPC : décompte/retour de stock) ; on ne
    // renvoie que les informations du chantier.
    const data: Partial<Intervention> = {
      clientName: sanitize(d.clientName.trim()),
      clientPhone: sanitize(d.clientPhone.trim()),
      clientEmail: sanitize(d.clientEmail.trim()),
      vehicleMake: sanitize(d.vehicleMake.trim()),
      vehicleModel: sanitize(d.vehicleModel.trim()),
      vehiclePlate: sanitize(d.vehiclePlate.trim().toUpperCase()),
      description: sanitize(d.description.trim()),
      notes: sanitize(d.notes.trim()),
      dateScheduled: d.dateScheduled
    }
    await planning.updateIntervention(d._id!, data)
    toast('Intervention mise à jour')
    showDetail.value = false
  } catch {
    toast('Erreur lors de la sauvegarde', true)
  } finally {
    saving.value = false
  }
}

async function deleteDetail() {
  if (!editData.value?._id) return
  try {
    await planning.deleteIntervention(editData.value._id)
    toast('Intervention supprimée')
    showDetail.value = false
  } catch {
    toast('Erreur lors de la suppression', true)
  }
}

// ---------------------------------------------------------------------------
// Parts management within detail modal
// ---------------------------------------------------------------------------
const partSearch = ref('')

const filteredParts = computed<Piece[]>(() => {
  const q = partSearch.value.toLowerCase().trim()
  if (!q) return []
  return stock.activePieces
    .filter(p => p.qty > 0 && (
      p.ref.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.vehicle.toLowerCase().includes(q)
    ))
    .slice(0, 10)
})

// Ajout d'une pièce : décompte immédiat du stock via RPC (add_intervention_part).
async function addPart(piece: Piece) {
  if (!editData.value?._id) return
  if (editData.value.parts.find(p => p.pieceId === piece._id)) {
    toast('Pièce déjà ajoutée au chantier', true)
    return
  }
  try {
    await planning.addPart(editData.value._id, {
      pieceId: piece._id!,
      ref: piece.ref,
      name: piece.name,
      qty: 1,
      prixUnitaire: piece.price
    })
    syncEditData()
    partSearch.value = ''
    toast('Pièce ajoutée — stock décompté')
  } catch (e) {
    toast(errMsg(e), true)
  }
}

// Désistement : retrait de la pièce → retour au stock (remove_intervention_part).
async function removePart(index: number) {
  const part = editData.value?.parts[index]
  if (!part?.id) return
  try {
    await planning.removePart(part.id)
    syncEditData()
    toast('Pièce retirée — retournée au stock')
  } catch (e) {
    toast(errMsg(e), true)
  }
}

// Ajustement de quantité (+/-) → synchronise le stock (adjust_intervention_part).
async function updatePartQty(index: number, qty: number) {
  const part = editData.value?.parts[index]
  if (!part?.id) return
  if (qty < 1) {
    await removePart(index)
    return
  }
  const delta = qty - part.qty
  if (delta === 0) return
  try {
    await planning.adjustPart(part.id, delta)
    syncEditData()
  } catch (e) {
    toast(errMsg(e), true)
  }
}

const partsTotal = computed(() => {
  if (!editData.value) return 0
  return editData.value.parts.reduce((sum, p) => sum + p.qty * p.prixUnitaire, 0)
})

// ---------------------------------------------------------------------------
// Client history within detail modal
// ---------------------------------------------------------------------------
const clientHistory = computed<Intervention[]>(() => {
  if (!editData.value?.clientPhone) return []
  return planning.getClientHistory(editData.value.clientPhone)
    .filter(i => i._id !== editData.value?._id)
})

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------
async function moveToInProgress(intervention: Intervention) {
  if (!intervention._id) return
  try {
    await planning.moveStatus(intervention._id, 'in_progress')
    toast('Intervention en cours')
  } catch {
    toast('Erreur', true)
  }
}

async function moveToTodo(intervention: Intervention) {
  if (!intervention._id) return
  try {
    await planning.moveStatus(intervention._id, 'todo')
    toast('Intervention remise à faire')
  } catch {
    toast('Erreur', true)
  }
}

async function moveToDone(intervention: Intervention) {
  if (!intervention._id) return
  // Le stock est déjà décompté à l'ajout des pièces : la clôture ne fait que
  // changer le statut (pas de double déduction).
  try {
    await planning.moveStatus(intervention._id, 'done')
    toast('Intervention terminée')
  } catch {
    toast('Erreur lors de la clôture', true)
  }
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------
const columns = computed(() => [
  {
    key: 'todo',
    label: 'À faire',
    borderColor: '#e6a817',
    badgeBg: 'bg-[#e6a817]/15',
    badgeText: 'text-[#e6a817]',
    items: planning.todo
  },
  {
    key: 'in_progress',
    label: 'En cours',
    borderColor: '#58a6ff',
    badgeBg: 'bg-[#58a6ff]/15',
    badgeText: 'text-[#58a6ff]',
    items: planning.inProgress
  },
  {
    key: 'done',
    label: 'Terminé',
    borderColor: '#3fb950',
    badgeBg: 'bg-[#3fb950]/15',
    badgeText: 'text-[#3fb950]',
    items: planning.done
  }
])

function formatScheduled(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function truncate(str: string, len: number): string {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

// ---------------------------------------------------------------------------
// Invoice generation
// ---------------------------------------------------------------------------
interface InvoiceResult {
  id: string
  number: string
  date_issued: string
  total_ht: number
  total_tva: number
  total_ttc: number
  existing: boolean
}

async function generateInvoice(intervention: Intervention) {
  if (!intervention._id) return
  // La facture est créée en base (table invoices) avec un numéro
  // séquentiel par organisation ; ce même appel la retourne si elle
  // existe déjà (réimpression, pas de doublon de numérotation).
  let inv: InvoiceResult
  try {
    const { data, error } = await supabase.rpc('create_invoice_for_intervention', {
      p_intervention: intervention._id
    })
    if (error) throw error
    inv = data as unknown as InvoiceResult
  } catch (e) {
    toast('Erreur facture : ' + (e instanceof Error ? e.message : String(e)), true)
    return
  }
  if (inv.existing) toast('Facture déjà émise — réimpression de ' + inv.number)

  const num = inv.number
  const dateStr = new Date(inv.date_issued).toLocaleDateString('fr-FR')
  const parts = intervention.parts || []
  const totalHT = Number(inv.total_ht)
  const totalTVA = Number(inv.total_tva)
  const totalTTC = Number(inv.total_ttc)

  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) { toast('Popup bloquée — autorisez les popups', true); return }

  win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Facture ${num}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#1a1a1a;padding:40px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #e6a817}
.brand{font-size:22px;font-weight:800;color:#e6a817;font-family:'Courier New',monospace}
.brand span{color:#3fb950}
.brand-sub{font-size:10px;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:2px}
.invoice-info{text-align:right}
.invoice-num{font-size:18px;font-weight:700;color:#333}
.invoice-date{font-size:12px;color:#666;margin-top:4px}
.parties{display:flex;justify-content:space-between;margin-bottom:30px;gap:40px}
.party{flex:1}
.party-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#e6a817;font-weight:700;margin-bottom:8px;font-family:'Courier New',monospace}
.party-name{font-size:15px;font-weight:700;margin-bottom:4px}
.party-detail{font-size:12px;color:#555;line-height:1.6}
.vehicle-box{background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:24px}
.vehicle-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#e6a817;font-weight:700;margin-bottom:6px;font-family:'Courier New',monospace}
.vehicle-detail{font-size:13px;color:#333}
.vehicle-plate{display:inline-block;background:#e6a817;color:#000;font-weight:800;font-family:'Courier New',monospace;padding:2px 10px;border-radius:4px;font-size:13px;margin-left:8px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead th{background:#161b22;color:#e6edf3;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;font-family:'Courier New',monospace}
tbody td{padding:10px 12px;border-bottom:1px solid #e8e8e8;font-size:12px}
tbody tr:nth-child(even){background:#fafafa}
.ref-cell{font-family:'Courier New',monospace;font-weight:700;color:#e6a817;font-size:11px}
.qty-cell{text-align:center;font-family:'Courier New',monospace;font-weight:600}
.price-cell{text-align:right;font-family:'Courier New',monospace}
.total-row{border-top:2px solid #161b22}
.total-row td{padding:14px 12px;font-size:14px;font-weight:800}
.total-label{text-align:right;font-family:'Courier New',monospace;text-transform:uppercase;letter-spacing:1px}
.total-val{text-align:right;font-family:'Courier New',monospace;color:#3fb950;font-size:16px}
.desc-box{background:#f8f8f8;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin-bottom:24px}
.desc-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#e6a817;font-weight:700;margin-bottom:6px;font-family:'Courier New',monospace}
.desc-text{font-size:12px;color:#555;line-height:1.5}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #ddd;text-align:center;font-size:10px;color:#999}
.no-parts{padding:20px;text-align:center;color:#999;font-style:italic}
@media print{body{padding:20px}button{display:none!important}}
.print-btn{display:block;margin:30px auto 0;background:#e6a817;color:#000;border:none;font-size:13px;font-weight:700;padding:10px 30px;border-radius:6px;cursor:pointer;font-family:'Courier New',monospace}
.print-btn:hover{background:#d49b15}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">FISSA <span>PIECE</span> AUTO</div>
    <div class="brand-sub">Pièces automobiles d'occasion</div>
  </div>
  <div class="invoice-info">
    <div class="invoice-num">${num}</div>
    <div class="invoice-date">Date : ${dateStr}</div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <div class="party-title">Client</div>
    <div class="party-name">${intervention.clientName}</div>
    <div class="party-detail">
      ${intervention.clientPhone ? '📞 ' + intervention.clientPhone + '<br>' : ''}
      ${intervention.clientEmail ? '✉ ' + intervention.clientEmail : ''}
    </div>
  </div>
  <div class="party" style="text-align:right">
    <div class="party-title">Intervention</div>
    <div class="party-detail">
      Prévu le : ${intervention.dateScheduled ? new Date(intervention.dateScheduled).toLocaleDateString('fr-FR') : '—'}<br>
      ${intervention.dateDone ? 'Terminé le : ' + new Date(intervention.dateDone).toLocaleDateString('fr-FR') : ''}
    </div>
  </div>
</div>

<div class="vehicle-box">
  <div class="vehicle-title">Véhicule</div>
  <div class="vehicle-detail">
    ${intervention.vehicleMake} ${intervention.vehicleModel}
    <span class="vehicle-plate">${intervention.vehiclePlate}</span>
  </div>
</div>

${intervention.description ? `<div class="desc-box"><div class="desc-title">Description des travaux</div><div class="desc-text">${intervention.description}</div></div>` : ''}

<table>
  <thead><tr><th>Réf</th><th>Désignation</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${parts.length ? parts.map(p => `<tr>
      <td class="ref-cell">${p.ref}</td>
      <td>${p.name}</td>
      <td class="qty-cell">${p.qty}</td>
      <td class="price-cell">${p.prixUnitaire.toFixed(2)} €</td>
      <td class="price-cell">${(p.qty * p.prixUnitaire).toFixed(2)} €</td>
    </tr>`).join('') : '<tr><td colspan="5" class="no-parts">Aucune pièce facturée</td></tr>'}
  </tbody>
  <tr>
    <td colspan="4" class="total-label" style="text-align:right;font-family:'Courier New',monospace">Total HT</td>
    <td class="price-cell">${totalHT.toFixed(2)} €</td>
  </tr>
  <tr>
    <td colspan="4" class="total-label" style="text-align:right;font-family:'Courier New',monospace">TVA 20 %</td>
    <td class="price-cell">${totalTVA.toFixed(2)} €</td>
  </tr>
  <tr class="total-row">
    <td colspan="4" class="total-label">Total TTC</td>
    <td class="total-val">${totalTTC.toFixed(2)} €</td>
  </tr>
</table>

${intervention.notes ? `<div class="desc-box"><div class="desc-title">Notes</div><div class="desc-text">${intervention.notes}</div></div>` : ''}

<div class="footer">
  FISSA PIECE AUTO — Facture ${num} — Émise le ${dateStr}<br>
  TVA au taux normal de 20 % incluse. Paiement à réception — pénalités de retard : 3 × le taux d'intérêt légal ;
  indemnité forfaitaire de recouvrement : 40 € (art. L441-10 C. com.).<br>
  Pièces d'occasion : garantie légale de conformité de 12 mois (art. L217-3 s. C. conso.).<br>
  Merci de votre confiance
</div>

<button class="print-btn" onclick="window.print()">🖨 Imprimer / PDF</button>
</body></html>`)
  win.document.close()
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px]">
          🔧 Planning Atelier
        </div>
        <div class="text-[#8b949e] text-xs mt-1">
          {{ planning.todo.length + planning.inProgress.length }} intervention(s) en attente
        </div>
      </div>
      <button
        @click="openCreate"
        class="flex items-center gap-2 bg-[#e6a817] hover:bg-[#d49b15] text-[#0d1117] font-mono text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
      >
        <span class="text-base leading-none">+</span>
        Nouvelle intervention
      </button>
    </div>

    <!-- Loading -->
    <div v-if="planning.loading" class="text-center py-12 text-[#8b949e] text-sm">
      Chargement du planning...
    </div>

    <!-- Kanban Board -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div
        v-for="col in columns"
        :key="col.key"
        class="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex flex-col"
      >
        <!-- Column Header -->
        <div
          class="px-4 py-3 border-b border-[#30363d] flex items-center justify-between"
          :style="{ borderTopWidth: '3px', borderTopStyle: 'solid', borderTopColor: col.borderColor }"
        >
          <span class="font-mono text-xs font-bold text-[#e6edf3] uppercase tracking-wider">
            {{ col.label }}
          </span>
          <span
            class="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full"
            :class="[col.badgeBg, col.badgeText]"
          >
            {{ col.items.length }}
          </span>
        </div>

        <!-- Cards container -->
        <div class="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
          <div v-if="!col.items.length" class="text-center py-8 text-[#8b949e] text-xs">
            Aucune intervention
          </div>

          <!-- Intervention Card -->
          <div
            v-for="item in col.items"
            :key="item._id"
            @click="openDetail(item)"
            class="bg-[#21262d] hover:bg-[#262c36] border border-[#30363d] hover:border-[#484f58] rounded-lg p-3 cursor-pointer transition-colors group"
          >
            <!-- Card Header -->
            <div class="flex items-start justify-between mb-1.5">
              <span class="text-[#e6edf3] text-sm font-semibold truncate flex-1">
                {{ item.clientName }}
              </span>
              <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded ml-2 shrink-0">
                {{ item.vehiclePlate }}
              </span>
            </div>

            <!-- Vehicle -->
            <div class="text-[#8b949e] text-xs mb-1.5">
              {{ item.vehicleMake }} {{ item.vehicleModel }}
            </div>

            <!-- Description -->
            <div class="text-[#e6edf3] text-xs leading-relaxed mb-2">
              {{ truncate(item.description, 80) }}
            </div>

            <!-- Meta row -->
            <div class="flex items-center justify-between text-[10px] text-[#8b949e]">
              <div class="flex items-center gap-3">
                <!-- Date -->
                <span class="font-mono" :title="item.dateScheduled">
                  📅 {{ formatScheduled(item.dateScheduled) }}
                </span>
                <!-- Parts count -->
                <span v-if="item.parts.length" class="font-mono">
                  🔩 {{ item.parts.length }}
                </span>
              </div>
              <!-- Total -->
              <span v-if="item.estimatedTotal" class="font-mono text-[#3fb950] font-semibold">
                {{ formatPrice(item.estimatedTotal) }}
              </span>
            </div>

            <!-- Action buttons -->
            <div
              class="flex gap-1.5 mt-2.5 pt-2 border-t border-[#30363d]"
              @click.stop
            >
              <!-- Move to In Progress (from todo) -->
              <button
                v-if="item.status === 'todo'"
                @click="moveToInProgress(item)"
                class="flex-1 text-[10px] font-mono font-semibold text-[#58a6ff] bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 border border-[#58a6ff]/20 rounded px-2 py-1 transition-colors cursor-pointer"
                title="Démarrer"
              >
                → En cours
              </button>

              <!-- Move back to todo (from in_progress) -->
              <button
                v-if="item.status === 'in_progress'"
                @click="moveToTodo(item)"
                class="flex-1 text-[10px] font-mono font-semibold text-[#e6a817] bg-[#e6a817]/10 hover:bg-[#e6a817]/20 border border-[#e6a817]/20 rounded px-2 py-1 transition-colors cursor-pointer"
                title="Remettre à faire"
              >
                ← Retour
              </button>

              <!-- Move to Done (from in_progress) -->
              <button
                v-if="item.status === 'in_progress'"
                @click="moveToDone(item)"
                class="flex-1 text-[10px] font-mono font-semibold text-[#3fb950] bg-[#3fb950]/10 hover:bg-[#3fb950]/20 border border-[#3fb950]/20 rounded px-2 py-1 transition-colors cursor-pointer"
                title="Terminer"
              >
                → Terminé
              </button>

              <!-- Move back to in_progress (from done) -->
              <button
                v-if="item.status === 'done'"
                @click="moveToInProgress(item)"
                class="flex-1 text-[10px] font-mono font-semibold text-[#58a6ff] bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 border border-[#58a6ff]/20 rounded px-2 py-1 transition-colors cursor-pointer"
                title="Remettre en cours"
              >
                ← Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================= -->
    <!-- Create Modal                                                      -->
    <!-- ================================================================= -->
    <BaseModal title="Nouvelle intervention" :open="showCreate" max-width="560px" @close="showCreate = false">
      <form @submit.prevent="submitCreate" class="space-y-3">
        <!-- Client -->
        <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mb-1">Client</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            v-model="newIntervention.clientName"
            type="text"
            placeholder="Nom *"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          />
          <input
            v-model="newIntervention.clientPhone"
            type="tel"
            placeholder="Téléphone *"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          />
        </div>
        <input
          v-model="newIntervention.clientEmail"
          type="email"
          placeholder="Email"
          class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
        />

        <!-- Vehicle -->
        <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mb-1 mt-3">Véhicule</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <input
            v-model="newIntervention.vehicleMake"
            type="text"
            placeholder="Marque *"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          />
          <input
            v-model="newIntervention.vehicleModel"
            type="text"
            placeholder="Modèle *"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          />
          <input
            v-model="newIntervention.vehiclePlate"
            type="text"
            placeholder="Immatriculation *"
            class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono uppercase placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          />
        </div>

        <!-- Details -->
        <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mb-1 mt-3">Détails</div>
        <textarea
          v-model="newIntervention.description"
          rows="3"
          placeholder="Description des travaux *"
          class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors resize-none"
        />
        <textarea
          v-model="newIntervention.notes"
          rows="2"
          placeholder="Notes internes"
          class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors resize-none"
        />
        <input
          v-model="newIntervention.dateScheduled"
          type="date"
          class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono focus:outline-none focus:border-[#e6a817] transition-colors"
        />

        <!-- Submit -->
        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="showCreate = false"
            class="text-xs text-[#8b949e] hover:text-[#e6edf3] px-4 py-2 rounded-lg border border-[#30363d] hover:border-[#484f58] transition-colors cursor-pointer bg-transparent"
          >
            Annuler
          </button>
          <button
            type="submit"
            :disabled="creating"
            class="text-xs font-mono font-bold text-[#0d1117] bg-[#e6a817] hover:bg-[#d49b15] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {{ creating ? 'Création...' : 'Créer' }}
          </button>
        </div>
      </form>
    </BaseModal>

    <!-- ================================================================= -->
    <!-- Detail / Edit Modal                                               -->
    <!-- ================================================================= -->
    <BaseModal
      :title="editData ? editData.clientName + ' — ' + editData.vehiclePlate : ''"
      :open="showDetail"
      max-width="720px"
      @close="showDetail = false"
    >
      <template v-if="editData">
        <!-- Tabs -->
        <div class="flex gap-1 mb-4 border-b border-[#30363d]">
          <button
            v-for="tab in ([
              { key: 'info', label: 'Informations' },
              { key: 'parts', label: 'Pièces (' + editData.parts.length + ')' },
              { key: 'history', label: 'Historique client' }
            ] as const)"
            :key="tab.key"
            @click="activeDetailTab = tab.key"
            class="text-xs font-mono px-3 py-2 -mb-px border-b-2 transition-colors cursor-pointer bg-transparent"
            :class="activeDetailTab === tab.key
              ? 'border-[#e6a817] text-[#e6a817]'
              : 'border-transparent text-[#8b949e] hover:text-[#e6edf3]'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Tab: Info -->
        <div v-if="activeDetailTab === 'info'" class="space-y-3">
          <!-- Status badge -->
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[10px] font-mono uppercase tracking-wider text-[#8b949e]">Statut :</span>
            <span
              class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
              :class="{
                'bg-[#e6a817]/15 text-[#e6a817]': editData.status === 'todo',
                'bg-[#58a6ff]/15 text-[#58a6ff]': editData.status === 'in_progress',
                'bg-[#3fb950]/15 text-[#3fb950]': editData.status === 'done'
              }"
            >
              {{ editData.status === 'todo' ? 'À faire' : editData.status === 'in_progress' ? 'En cours' : 'Terminé' }}
            </span>
          </div>

          <!-- Client fields -->
          <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest">Client</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="text-[10px] text-[#8b949e] mb-0.5 block">Nom</label>
              <input
                v-model="editData.clientName"
                type="text"
                class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors"
              />
            </div>
            <div>
              <label class="text-[10px] text-[#8b949e] mb-0.5 block">Téléphone</label>
              <input
                v-model="editData.clientPhone"
                type="tel"
                class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono focus:outline-none focus:border-[#e6a817] transition-colors"
              />
            </div>
          </div>
          <div>
            <label class="text-[10px] text-[#8b949e] mb-0.5 block">Email</label>
            <input
              v-model="editData.clientEmail"
              type="email"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors"
            />
          </div>

          <!-- Vehicle fields -->
          <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mt-3">Véhicule</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label class="text-[10px] text-[#8b949e] mb-0.5 block">Marque</label>
              <input
                v-model="editData.vehicleMake"
                type="text"
                class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors"
              />
            </div>
            <div>
              <label class="text-[10px] text-[#8b949e] mb-0.5 block">Modèle</label>
              <input
                v-model="editData.vehicleModel"
                type="text"
                class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors"
              />
            </div>
            <div>
              <label class="text-[10px] text-[#8b949e] mb-0.5 block">Immatriculation</label>
              <input
                v-model="editData.vehiclePlate"
                type="text"
                class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono uppercase focus:outline-none focus:border-[#e6a817] transition-colors"
              />
            </div>
          </div>

          <!-- Work details -->
          <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mt-3">Travaux</div>
          <div>
            <label class="text-[10px] text-[#8b949e] mb-0.5 block">Description</label>
            <textarea
              v-model="editData.description"
              rows="3"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors resize-none"
            />
          </div>
          <div>
            <label class="text-[10px] text-[#8b949e] mb-0.5 block">Notes internes</label>
            <textarea
              v-model="editData.notes"
              rows="2"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs focus:outline-none focus:border-[#e6a817] transition-colors resize-none"
            />
          </div>
          <div>
            <label class="text-[10px] text-[#8b949e] mb-0.5 block">Date prévue</label>
            <input
              v-model="editData.dateScheduled"
              type="date"
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs font-mono focus:outline-none focus:border-[#e6a817] transition-colors"
            />
          </div>

          <!-- Timestamps -->
          <div class="flex flex-wrap gap-4 text-[10px] text-[#8b949e] font-mono pt-2 border-t border-[#30363d]">
            <span>Créée : {{ editData.dateCreated ? new Date(editData.dateCreated).toLocaleString('fr-FR') : '—' }}</span>
            <span>Modifiée : {{ editData.dateUpdated ? new Date(editData.dateUpdated).toLocaleString('fr-FR') : '—' }}</span>
            <span v-if="editData.dateDone">Terminée : {{ new Date(editData.dateDone).toLocaleString('fr-FR') }}</span>
          </div>
        </div>

        <!-- Tab: Parts -->
        <div v-if="activeDetailTab === 'parts'" class="space-y-3">
          <!-- Part search -->
          <div class="relative">
            <input
              v-model="partSearch"
              type="text"
              placeholder="Rechercher une pièce (réf, nom, véhicule)..."
              class="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
            />
            <!-- Search results dropdown -->
            <div
              v-if="filteredParts.length"
              class="absolute left-0 right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-10 max-h-52 overflow-y-auto"
            >
              <button
                v-for="piece in filteredParts"
                :key="piece._id"
                @click="addPart(piece)"
                class="w-full text-left px-3 py-2 hover:bg-[#21262d] transition-colors flex items-center gap-2 cursor-pointer bg-transparent border-none border-b border-[#30363d] last:border-b-0"
              >
                <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded shrink-0">
                  {{ piece.ref }}
                </span>
                <span class="text-[#e6edf3] text-xs truncate flex-1">{{ piece.name }}</span>
                <span class="font-mono text-[10px] text-[#8b949e] shrink-0">
                  Stock: {{ piece.qty }}
                </span>
                <span class="font-mono text-[10px] text-[#3fb950] font-semibold shrink-0">
                  {{ formatPrice(piece.price) }}
                </span>
              </button>
            </div>
            <div
              v-if="partSearch.length >= 1 && !filteredParts.length"
              class="absolute left-0 right-0 top-full mt-1 bg-[#161b22] border border-[#30363d] rounded-lg p-3 text-[#8b949e] text-xs text-center z-10"
            >
              Aucune pièce trouvée
            </div>
          </div>

          <!-- Parts list -->
          <div v-if="!editData.parts.length" class="text-center py-6 text-[#8b949e] text-xs">
            Aucune pièce ajoutée. Utilisez la recherche ci-dessus.
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="(part, idx) in editData.parts"
              :key="idx"
              class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 flex items-center gap-2"
            >
              <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded shrink-0">
                {{ part.ref }}
              </span>
              <span class="text-[#e6edf3] text-xs truncate flex-1">{{ part.name }}</span>
              <!-- Qty controls -->
              <div class="flex items-center gap-1 shrink-0">
                <button
                  @click="updatePartQty(idx, part.qty - 1)"
                  class="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] rounded text-xs cursor-pointer border-none transition-colors"
                >
                  -
                </button>
                <span class="font-mono text-xs text-[#e6edf3] w-6 text-center">{{ part.qty }}</span>
                <button
                  @click="updatePartQty(idx, part.qty + 1)"
                  class="w-5 h-5 flex items-center justify-center text-[#8b949e] hover:text-[#e6edf3] bg-[#21262d] hover:bg-[#30363d] rounded text-xs cursor-pointer border-none transition-colors"
                >
                  +
                </button>
              </div>
              <!-- Unit price -->
              <span class="font-mono text-[10px] text-[#8b949e] shrink-0">
                {{ formatPrice(part.prixUnitaire) }}/u
              </span>
              <!-- Subtotal -->
              <span class="font-mono text-xs text-[#3fb950] font-semibold shrink-0 min-w-[65px] text-right">
                {{ formatPrice(part.qty * part.prixUnitaire) }}
              </span>
              <!-- Remove -->
              <button
                @click="removePart(idx)"
                class="text-[#f85149] hover:text-[#ff6e67] text-sm cursor-pointer bg-transparent border-none transition-colors ml-1"
                title="Retirer"
              >
                ✕
              </button>
            </div>
          </div>

          <!-- Total -->
          <div v-if="editData.parts.length" class="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
            <span class="font-mono text-xs text-[#8b949e]">Total estimé :</span>
            <span class="font-mono text-sm font-bold text-[#3fb950]">{{ formatPrice(partsTotal) }}</span>
          </div>
        </div>

        <!-- Tab: Client History -->
        <div v-if="activeDetailTab === 'history'" class="space-y-2">
          <div v-if="!editData.clientPhone" class="text-center py-6 text-[#8b949e] text-xs">
            Renseignez un numéro de téléphone pour voir l'historique.
          </div>
          <div v-else-if="!clientHistory.length" class="text-center py-6 text-[#8b949e] text-xs">
            Aucun historique pour ce client.
          </div>
          <div
            v-for="hist in clientHistory"
            :key="hist._id"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5"
          >
            <div class="flex items-start justify-between mb-1">
              <span class="text-[#e6edf3] text-xs font-semibold">
                {{ hist.vehicleMake }} {{ hist.vehicleModel }}
              </span>
              <span class="font-mono text-[10px] text-[#3fb950] font-bold bg-[#3fb950]/10 px-1.5 py-0.5 rounded">
                Terminé
              </span>
            </div>
            <div class="text-[#8b949e] text-xs mb-1">{{ truncate(hist.description, 100) }}</div>
            <div class="flex items-center justify-between text-[10px] text-[#8b949e] font-mono">
              <span>{{ hist.dateDone ? new Date(hist.dateDone).toLocaleDateString('fr-FR') : '—' }}</span>
              <span>{{ hist.parts.length }} pièce(s) — {{ formatPrice(hist.estimatedTotal) }}</span>
            </div>
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="flex items-center justify-between pt-4 mt-4 border-t border-[#30363d]">
          <!-- Delete -->
          <div>
            <button
              v-if="!confirmDelete"
              @click="confirmDelete = true"
              class="text-[10px] font-mono text-[#f85149] hover:text-[#ff6e67] bg-transparent border border-[#f85149]/20 hover:border-[#f85149]/40 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
              Supprimer
            </button>
            <div v-else class="flex items-center gap-2">
              <span class="text-[10px] text-[#f85149]">Confirmer ?</span>
              <button
                @click="deleteDetail"
                class="text-[10px] font-mono font-bold text-white bg-[#f85149] hover:bg-[#da3633] px-3 py-1 rounded cursor-pointer border-none transition-colors"
              >
                Oui
              </button>
              <button
                @click="confirmDelete = false"
                class="text-[10px] font-mono text-[#8b949e] hover:text-[#e6edf3] px-2 py-1 cursor-pointer bg-transparent border-none transition-colors"
              >
                Non
              </button>
            </div>
          </div>

          <!-- Invoice / Save / Close -->
          <div class="flex gap-2">
            <button
              v-if="editData"
              @click="generateInvoice(editData)"
              class="text-xs font-mono font-bold text-[#0d1117] bg-[#bc8cff] hover:bg-[#a371e3] px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              🧾 Facture
            </button>
            <button
              @click="showDetail = false"
              class="text-xs text-[#8b949e] hover:text-[#e6edf3] px-4 py-2 rounded-lg border border-[#30363d] hover:border-[#484f58] transition-colors cursor-pointer bg-transparent"
            >
              Fermer
            </button>
            <button
              @click="saveDetail"
              :disabled="saving"
              class="text-xs font-mono font-bold text-[#0d1117] bg-[#e6a817] hover:bg-[#d49b15] disabled:opacity-50 px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
