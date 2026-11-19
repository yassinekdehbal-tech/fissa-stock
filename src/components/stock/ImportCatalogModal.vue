<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSuppliersStore, type CatalogRow } from '@/stores/suppliers'
import { useToast } from '@/composables/useToast'
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Supplier } from '@/types'

/**
 * Import du fichier tarif d'un fournisseur (Excel ou CSV) dans `supplier_catalog`.
 * Les colonnes sont reconnues d'après leurs en-têtes et la correspondance est
 * mémorisée sur le fournisseur pour la prochaine fois. L'import remplace le
 * catalogue précédent du fournisseur.
 */
const props = defineProps<{ supplier: Supplier | null; open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const suppliers = useSuppliersStore()
const { toast } = useToast()

type Field = 'ref' | 'ean' | 'label' | 'family' | 'pricePublic' | 'priceNet' | 'discount'
const FIELDS: { key: Field; label: string; required?: boolean; hints: RegExp }[] = [
  { key: 'ref', label: 'Référence fournisseur', required: true, hints: /^(r[ée]f([ée]rence)?|article|code ?article|sku|r[ée]f\.? ?fournisseur)/i },
  { key: 'ean', label: 'Code EAN', hints: /ean|gencod|code ?barre/i },
  { key: 'label', label: 'Désignation', hints: /d[ée]signation|description|libell[ée]|nom/i },
  { key: 'family', label: 'Famille', hints: /famille|cat[ée]gorie|groupe/i },
  { key: 'pricePublic', label: 'Prix public', hints: /public|conseill|ppc|tarif de base|brut/i },
  { key: 'priceNet', label: 'Prix net (achat)', hints: /remis[ée]|net|achat/i },
  { key: 'discount', label: 'Remise (%)', hints: /^remise|^rem\b|discount/i },
]

const fileName = ref('')
const headers = ref<string[]>([])
const rows = ref<unknown[][]>([])
const mapping = ref<Record<Field, string>>({ ref: '', ean: '', label: '', family: '', pricePublic: '', priceNet: '', discount: '' })
const parsing = ref(false)
const importing = ref(false)
const progress = ref({ done: 0, total: 0 })
const fileInput = ref<HTMLInputElement | null>(null)

watch(() => props.open, (o) => { if (o) reset() })
function reset() {
  fileName.value = ''; headers.value = []; rows.value = []; progress.value = { done: 0, total: 0 }
  mapping.value = { ref: '', ean: '', label: '', family: '', pricePublic: '', priceNet: '', discount: '' }
}

/** Correspondance proposée : mémorisée sur le fournisseur, sinon devinée d'après les en-têtes. */
function proposeMapping() {
  const saved = props.supplier?.importMapping ?? {}
  const used = new Set<string>()
  for (const f of FIELDS) {
    const s = saved[f.key]
    if (s && headers.value.includes(s)) { mapping.value[f.key] = s; used.add(s); continue }
    const h = headers.value.find((x) => !used.has(x) && f.hints.test(x.trim()))
    mapping.value[f.key] = h ?? ''
    if (h) used.add(h)
  }
  // « Prix public » puis « Prix unitaire remisé » : si la devinette a inversé, l'utilisateur corrige dans la liste
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  parsing.value = true
  try {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', raw: false })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) throw new Error('fichier vide')
    const sheet = wb.Sheets[sheetName]!
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    // Première ligne non vide = en-têtes
    const hIdx = data.findIndex((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim()))
    if (hIdx < 0) throw new Error('aucune ligne lisible')
    headers.value = (data[hIdx] as unknown[]).map((c, i) => String(c ?? '').trim() || `Colonne ${i + 1}`)
    rows.value = data.slice(hIdx + 1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim())) as unknown[][]
    fileName.value = file.name
    proposeMapping()
  } catch (err) {
    toast('Fichier illisible : ' + (err instanceof Error ? err.message : String(err)), true)
  } finally {
    parsing.value = false
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}
function col(key: Field): number {
  const h = mapping.value[key]
  return h ? headers.value.indexOf(h) : -1
}
const preview = computed(() => rows.value.slice(0, 5))
const refCol = computed(() => col('ref'))
const usable = computed(() => rows.value.filter((r) => String(r[refCol.value] ?? '').trim()).length)

async function doImport() {
  if (!props.supplier) return
  if (refCol.value < 0) { toast('Indiquez la colonne de la référence fournisseur', true); return }
  const idx = { ean: col('ean'), label: col('label'), family: col('family'), pricePublic: col('pricePublic'), priceNet: col('priceNet'), discount: col('discount') }
  const out: CatalogRow[] = []
  for (const r of rows.value) {
    const ref = String(r[refCol.value] ?? '').trim()
    if (!ref) continue
    out.push({
      ref,
      ean: idx.ean >= 0 ? String(r[idx.ean] ?? '') : '',
      label: idx.label >= 0 ? String(r[idx.label] ?? '') : '',
      family: idx.family >= 0 ? String(r[idx.family] ?? '') : '',
      pricePublic: idx.pricePublic >= 0 ? num(r[idx.pricePublic]) : null,
      priceNet: idx.priceNet >= 0 ? num(r[idx.priceNet]) : null,
      discount: idx.discount >= 0 ? num(r[idx.discount]) : null,
    })
  }
  if (!out.length) { toast('Aucune ligne avec référence', true); return }
  if (!confirm(`Remplacer le catalogue ${props.supplier.name} par ${out.length} références ?`)) return
  importing.value = true
  try {
    const n = await suppliers.replaceCatalog(props.supplier.id, out, { ...mapping.value }, (done, total) => { progress.value = { done, total } })
    toast(`✓ ${n} références importées pour ${props.supplier.name}`)
    emit('close')
  } catch (e) {
    toast('Import interrompu : ' + (e instanceof Error ? e.message : String(e)), true)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <BaseModal :title="supplier ? 'Tarif ' + supplier.name : 'Importer un tarif'" :open="open" @close="emit('close')" max-width="640px">
    <p class="text-[12px] text-gray-500 leading-snug mb-3">
      Fichier Excel ou CSV du fournisseur (tarif, catalogue). Les colonnes sont reconnues d'après leurs en-têtes, vérifiez-les ci-dessous.
      L'import <strong>remplace</strong> le catalogue précédent de ce fournisseur.
    </p>

    <div v-if="!headers.length" class="rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
      <AppIcon name="upload" class="w-8 h-8 mx-auto text-gray-300 mb-2" />
      <button type="button" class="btn btn-primary" :disabled="parsing" @click="fileInput?.click()">{{ parsing ? 'Lecture…' : 'Choisir le fichier' }}</button>
      <div class="text-[11px] text-gray-400 mt-2">.xlsx, .xls ou .csv</div>
    </div>

    <template v-else>
      <div class="flex items-center justify-between text-[12px] mb-2">
        <span class="text-gray-700 truncate"><strong>{{ fileName }}</strong> · {{ rows.length }} lignes</span>
        <button type="button" class="text-blue-600 hover:underline shrink-0" @click="fileInput?.click()">Autre fichier</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div v-for="f in FIELDS" :key="f.key" class="flex flex-col gap-1">
          <label class="label">{{ f.label }} <span v-if="f.required" class="text-red-500">*</span></label>
          <select v-model="mapping[f.key]" class="input">
            <option value="">—</option>
            <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
      </div>
      <div class="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table class="text-[11px] w-full">
          <thead class="bg-gray-50 text-gray-600"><tr><th class="px-2 py-1 text-left">Référence</th><th class="px-2 py-1 text-left">EAN</th><th class="px-2 py-1 text-left">Désignation</th><th class="px-2 py-1 text-right">Public</th><th class="px-2 py-1 text-right">Net</th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in preview" :key="i" class="border-t border-gray-100">
              <td class="px-2 py-1 font-mono">{{ refCol >= 0 ? r[refCol] : '—' }}</td>
              <td class="px-2 py-1 font-mono">{{ col('ean') >= 0 ? r[col('ean')] : '' }}</td>
              <td class="px-2 py-1 truncate max-w-[200px]">{{ col('label') >= 0 ? r[col('label')] : '' }}</td>
              <td class="px-2 py-1 text-right">{{ col('pricePublic') >= 0 ? r[col('pricePublic')] : '' }}</td>
              <td class="px-2 py-1 text-right">{{ col('priceNet') >= 0 ? r[col('priceNet')] : '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="text-[12px] text-gray-600 mt-2">{{ usable }} ligne{{ usable > 1 ? 's' : '' }} avec référence seront importées.</div>
      <div v-if="importing" class="mt-2">
        <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-brand transition-all" :style="{ width: (progress.total ? Math.round(progress.done / progress.total * 100) : 5) + '%' }"></div></div>
        <div class="text-[11px] text-gray-500 mt-1">{{ progress.done }} / {{ progress.total || usable }}</div>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-secondary" :disabled="importing" @click="emit('close')">Annuler</button>
        <button class="btn btn-primary" :disabled="importing || refCol < 0" @click="doImport"><AppIcon name="upload" class="w-4 h-4" /> {{ importing ? 'Import…' : 'Importer' }}</button>
      </div>
    </template>
    <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" class="hidden" @change="onFile">
  </BaseModal>
</template>
