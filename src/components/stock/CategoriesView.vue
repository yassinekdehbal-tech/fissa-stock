<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useStockStore } from '@/stores/stock'
import { useCategoriesStore, proposeCode, CODE_RE, RISKY_LETTERS } from '@/stores/categories'
import { useToast } from '@/composables/useToast'
import { CATEGORY_COLORS, type Category, type CategoryColor } from '@/types'
import AppIcon from '@/components/ui/AppIcon.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Paramétrage des catégories de pièces (administrateur) :
 * libellé, code à 2 lettres (préfixe des références générées), couleur,
 * ordre, archivage. Une catégorie utilisée par des pièces ne peut pas être
 * supprimée, seulement archivée.
 */
const auth = useAuthStore()
const stock = useStockStore()
const cats = useCategoriesStore()
const { toast } = useToast()

const COLORS = Object.keys(CATEGORY_COLORS) as CategoryColor[]

function count(key: string) {
  return stock.pieces.filter((p) => p.cat === key).length
}

// ---- Formulaire (création / modification)
const open = ref(false)
const editing = ref<Category | null>(null)
const label = ref('')
const code = ref('')
const color = ref<CategoryColor>('gray')
const codeTouched = ref(false)
const saving = ref(false)

const takenCodes = computed(() => new Set(cats.categories.filter((c) => c.id !== editing.value?.id).map((c) => c.code)))

function openCreate() {
  editing.value = null
  label.value = ''
  code.value = ''
  color.value = COLORS[cats.categories.length % COLORS.length] || 'gray'
  codeTouched.value = false
  open.value = true
}
function openEdit(c: Category) {
  editing.value = c
  label.value = c.label
  code.value = c.code
  color.value = c.color
  codeTouched.value = true
  open.value = true
}

// Code proposé automatiquement à partir du libellé tant qu'il n'a pas été modifié à la main
watch(label, (l) => {
  if (!codeTouched.value) code.value = proposeCode(l, takenCodes.value)
})

const codeError = computed(() => {
  const c = code.value.toUpperCase()
  if (!c) return ''
  if (!CODE_RE.test(c)) return '2 lettres majuscules, sans I, O ni Q'
  if (takenCodes.value.has(c)) return 'Code déjà utilisé par une autre catégorie'
  return ''
})
const codeWarning = computed(() => {
  const risky = code.value.toUpperCase().split('').filter((ch) => RISKY_LETTERS.includes(ch))
  return risky.length ? `Lettre${risky.length > 1 ? 's' : ''} ${risky.join(', ')} facile${risky.length > 1 ? 's' : ''} à confondre à l'écriture (B/8, S/5, Z/2, G/6)` : ''
})

async function save() {
  const l = label.value.trim()
  const c = code.value.toUpperCase().trim()
  if (!l) { toast('Le libellé est requis', true); return }
  if (!c || codeError.value) { toast(codeError.value || 'Le code est requis', true); return }
  saving.value = true
  try {
    if (editing.value) await cats.update(editing.value.id, { label: l, code: c, color: color.value })
    else await cats.add({ label: l, code: c, color: color.value })
    toast(editing.value ? 'Catégorie mise à jour' : 'Catégorie ajoutée')
    open.value = false
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), true)
  } finally {
    saving.value = false
  }
}

async function toggleArchive(c: Category) {
  try {
    await cats.update(c.id, { archived: !c.archived })
    toast(c.archived ? 'Catégorie réactivée' : 'Catégorie archivée')
  } catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
}

async function remove(c: Category) {
  if (count(c.key)) { toast('Des pièces utilisent cette catégorie : archivez-la plutôt', true); return }
  if (!confirm(`Supprimer la catégorie « ${c.label} » ?`)) return
  try { await cats.remove(c.id); toast('Catégorie supprimée') }
  catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
}

async function move(c: Category, dir: -1 | 1) {
  const list = cats.categories
  const i = list.findIndex((x) => x.id === c.id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  const other = list[j]!
  try {
    // Échange des rangs ; si deux rangs sont égaux, on renumérote toute la liste
    if (c.sort === other.sort) {
      await Promise.all(list.map((x, k) => cats.update(x.id, { sort: k + 1 })))
    }
    await cats.update(c.id, { sort: other.sort })
    await cats.update(other.id, { sort: c.sort })
  } catch (e) { toast(e instanceof Error ? e.message : String(e), true) }
}
</script>

<template>
  <div class="max-w-[720px] mx-auto space-y-3">
    <!-- En-tête (desktop) -->
    <div class="hidden lg:flex items-center gap-3">
      <router-link to="/profil" class="icon-btn border-gray-200 bg-white w-9 h-9" title="Retour"><AppIcon name="arrow-left" class="w-4 h-4" /></router-link>
      <div class="flex-1 min-w-0">
        <h1 class="page-title">Catégories de pièces</h1>
        <p class="page-subtitle">Libellés, codes des références générées, couleurs</p>
      </div>
      <button v-if="auth.isAdmin" class="btn btn-primary" @click="openCreate"><AppIcon name="plus" class="w-4 h-4" /> Ajouter</button>
    </div>

    <div v-if="!auth.isAdmin" class="card p-4 text-[13px] text-gray-600">Le paramétrage des catégories est réservé à l'administrateur.</div>

    <template v-else>
      <div class="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[12px] text-gray-700 leading-snug">
        Le <strong>code</strong> (2 lettres) est le début des références générées : <span class="font-mono font-semibold">MT0142</span> = 142<sup>e</sup> pièce de la catégorie <span class="font-mono font-semibold">MT</span>. Les lettres I, O et Q sont exclues pour ne pas être confondues avec 1 et 0. Les références déjà attribuées ne changent jamais, même si le code est modifié.
      </div>

      <div class="card divide-y divide-gray-100">
        <div v-for="(c, i) in cats.categories" :key="c.id" class="flex items-center gap-3 px-3 py-2.5" :class="c.archived ? 'opacity-60' : ''">
          <span class="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-[13px] shrink-0" :class="[CATEGORY_COLORS[c.color].bgClass, CATEGORY_COLORS[c.color].textClass]">{{ c.code }}</span>
          <div class="min-w-0 flex-1">
            <div class="text-[14px] font-semibold text-gray-900 truncate">{{ c.label }} <span v-if="c.archived" class="badge badge-gray ml-1">Archivée</span></div>
            <div class="text-[12px] text-gray-500">{{ count(c.key) }} pièce{{ count(c.key) > 1 ? 's' : '' }}</div>
          </div>
          <div class="flex items-center gap-0.5 shrink-0">
            <button class="icon-btn" :disabled="i === 0" @click="move(c, -1)" aria-label="Monter" title="Monter"><AppIcon name="chevron-up" class="w-4 h-4" /></button>
            <button class="icon-btn" :disabled="i === cats.categories.length - 1" @click="move(c, 1)" aria-label="Descendre" title="Descendre"><AppIcon name="chevron-down" class="w-4 h-4" /></button>
            <button class="icon-btn" @click="openEdit(c)" aria-label="Modifier" title="Modifier"><AppIcon name="edit" class="w-4 h-4" /></button>
            <button class="icon-btn" @click="toggleArchive(c)" :aria-label="c.archived ? 'Réactiver' : 'Archiver'" :title="c.archived ? 'Réactiver' : 'Archiver'"><AppIcon :name="c.archived ? 'refresh' : 'lock'" class="w-4 h-4" /></button>
            <button v-if="!count(c.key)" class="icon-btn text-red-600" @click="remove(c)" aria-label="Supprimer" title="Supprimer"><AppIcon name="trash" class="w-4 h-4" /></button>
          </div>
        </div>
        <div v-if="!cats.categories.length" class="px-3 py-6 text-center text-[13px] text-gray-500">{{ cats.loaded ? 'Aucune catégorie' : 'Chargement…' }}</div>
      </div>

      <button class="btn btn-primary w-full py-3 lg:hidden" @click="openCreate"><AppIcon name="plus" class="w-4 h-4" /> Ajouter une catégorie</button>
    </template>

    <BaseModal :title="editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'" :open="open" @close="open = false" max-width="440px">
      <div class="space-y-3">
        <div class="flex flex-col gap-1">
          <label class="label">Libellé</label>
          <input v-model="label" class="input" placeholder="ex : Démarreur" maxlength="60" autofocus>
        </div>
        <div class="flex flex-col gap-1">
          <label class="label">Code (2 lettres)</label>
          <input v-model="code" class="input font-mono uppercase w-28 text-center text-lg tracking-widest" maxlength="2" autocapitalize="characters" @input="codeTouched = true">
          <span v-if="codeError" class="text-[12px] text-red-600">{{ codeError }}</span>
          <span v-else-if="codeWarning" class="text-[12px] text-amber-700">{{ codeWarning }}</span>
          <span v-else-if="code" class="text-[12px] text-gray-500">Références générées : <span class="font-mono font-semibold text-gray-800">{{ code.toUpperCase() }}0001</span>, <span class="font-mono font-semibold text-gray-800">{{ code.toUpperCase() }}0002</span>…</span>
        </div>
        <div class="flex flex-col gap-1">
          <label class="label">Couleur</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="k in COLORS" :key="k" type="button" class="w-8 h-8 rounded-full border-2 transition-transform" :class="color === k ? 'border-gray-900 scale-110' : 'border-transparent'" :style="{ background: CATEGORY_COLORS[k].color }" @click="color = k" :aria-label="k" :aria-pressed="color === k"></button>
          </div>
        </div>
        <div class="flex gap-2 justify-end pt-1">
          <button class="btn btn-secondary" @click="open = false">Annuler</button>
          <button class="btn btn-primary" :disabled="saving" @click="save">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>
