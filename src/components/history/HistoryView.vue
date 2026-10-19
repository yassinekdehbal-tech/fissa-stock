<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useAuthStore } from '@/stores/auth'

const history = useHistoryStore()
const auth = useAuthStore()

const filter = ref('')
const search = ref('')

const filteredEntries = computed(() => {
  let list = history.entries
  if (!auth.isAdmin) {
    list = list.filter(e => e.user === auth.currentUser?.name)
  }
  if (filter.value) list = list.filter(e => e.type === filter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(e =>
      (e.ref || '').toLowerCase().includes(q) ||
      (e.name || '').toLowerCase().includes(q) ||
      (e.user || '').toLowerCase().includes(q) ||
      (e.client || '').toLowerCase().includes(q)
    )
  }
  return list.slice(0, 200)
})

const typeStyles: Record<string, { bg: string; text: string; label: string }> = {
  vente: { bg: 'bg-green-50', text: 'text-green-700', label: 'Vente' },
  ajout: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Ajout' },
  modif: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Modification' },
  suppression: { bg: 'bg-red-50', text: 'text-red-700', label: 'Supprimé' },
  connexion: { bg: 'bg-violet-50', text: 'text-violet-700', label: 'Connexion' }
}
</script>

<template>
  <div class="card p-5">
    <div class="card-title">
      {{ auth.isAdmin ? 'Historique complet' : 'Mon historique' }}
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-3 flex-wrap items-center">
      <select v-model="filter" class="input">
        <option value="">Tous</option>
        <option value="vente">Ventes</option>
        <option value="ajout">Ajouts</option>
        <option value="modif">Modifications</option>
        <option value="connexion">Connexions</option>
      </select>
      <input
        v-model="search"
        placeholder="Rechercher…"
        class="input"
      >
    </div>

    <!-- List -->
    <div v-if="!filteredEntries.length" class="text-gray-500 text-xs text-center py-4">Aucun mouvement</div>
    <div v-for="h in filteredEntries" :key="h._id" class="flex items-start gap-2 py-2.5 border-b border-gray-200 text-xs flex-wrap">
      <span class="text-[10px] text-gray-500 min-w-[110px]">{{ h.date || '—' }}</span>
      <span class="text-[10px] text-amber-600 font-bold min-w-[75px]">{{ h.ref }}</span>
      <span v-if="auth.isAdmin" class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 whitespace-nowrap">
        {{ h.user || '—' }}{{ h.device ? ' (' + h.device + ')' : '' }}
      </span>
      <span class="flex-1">
        {{ h.name }}
        <span v-if="h.qty" class="text-gray-500"> ×{{ h.qty }}</span>
        <span v-if="h.prixVente" class="text-green-600 font-semibold"> — {{ ((h.prixVente || 0) * (h.qty || 1)).toFixed(2) }} €</span>
        <span v-if="h.remise" class="text-orange-600 text-[10px]"> (-{{ h.remise }}%)</span>
        <span v-if="h.payment" class="text-gray-500 text-[10px]"> ({{ h.payment }})</span>
        <span v-if="h.client" class="text-blue-600 text-[10px]"> · {{ h.client }}</span>
      </span>
      <span
        v-if="typeStyles[h.type]"
        class="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
        :class="[typeStyles[h.type].bg, typeStyles[h.type].text]"
      >
        {{ typeStyles[h.type].label }}
      </span>
    </div>
  </div>
</template>
