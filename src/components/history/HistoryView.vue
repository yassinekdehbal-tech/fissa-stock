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
  vente: { bg: 'bg-green-500/15', text: 'text-green-400', label: '💰 Vente' },
  ajout: { bg: 'bg-blue-400/15', text: 'text-blue-400', label: '＋ Ajout' },
  modif: { bg: 'bg-[#e6a817]/15', text: 'text-[#e6a817]', label: '✏ Modif' },
  suppression: { bg: 'bg-red-500/15', text: 'text-red-400', label: '✕ Supprimé' },
  connexion: { bg: 'bg-purple-400/15', text: 'text-purple-400', label: '🔐 Connexion' }
}
</script>

<template>
  <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
    <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px] mb-3.5">
      {{ auth.isAdmin ? 'Historique complet' : 'Mon historique' }}
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-3 flex-wrap items-center">
      <select v-model="filter" class="bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-xs px-2 py-2 outline-none">
        <option value="">Tous</option>
        <option value="vente">Ventes</option>
        <option value="ajout">Ajouts</option>
        <option value="modif">Modifications</option>
        <option value="connexion">Connexions</option>
      </select>
      <input
        v-model="search"
        placeholder="Rechercher…"
        class="flex-1 min-w-[120px] bg-[#0d1117] border border-[#30363d] rounded-lg text-[#e6edf3] font-mono text-sm px-3 py-2 outline-none focus:border-[#e6a817]"
      >
    </div>

    <!-- List -->
    <div v-if="!filteredEntries.length" class="text-[#8b949e] text-xs text-center py-4">Aucun mouvement</div>
    <div v-for="h in filteredEntries" :key="h._id" class="flex items-start gap-2 py-2.5 border-b border-[#30363d] text-xs flex-wrap">
      <span class="font-mono text-[10px] text-[#8b949e] min-w-[110px]">{{ h.date || '—' }}</span>
      <span class="font-mono text-[10px] text-[#e6a817] font-bold min-w-[75px]">{{ h.ref }}</span>
      <span v-if="auth.isAdmin" class="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20 whitespace-nowrap">
        {{ h.user || '—' }}{{ h.device ? ' (' + h.device + ')' : '' }}
      </span>
      <span class="flex-1">
        {{ h.name }}
        <span v-if="h.qty" class="text-[#8b949e]"> ×{{ h.qty }}</span>
        <span v-if="h.prixVente" class="text-[#3fb950] font-mono font-semibold"> — {{ ((h.prixVente || 0) * (h.qty || 1)).toFixed(2) }} €</span>
        <span v-if="h.remise" class="text-orange-400 text-[10px]"> (-{{ h.remise }}%)</span>
        <span v-if="h.payment" class="text-[#8b949e] text-[10px]"> ({{ h.payment }})</span>
        <span v-if="h.client" class="text-blue-400 text-[10px]"> · {{ h.client }}</span>
      </span>
      <span
        v-if="typeStyles[h.type]"
        class="font-mono text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap"
        :class="[typeStyles[h.type].bg, typeStyles[h.type].text]"
      >
        {{ typeStyles[h.type].label }}
      </span>
    </div>
  </div>
</template>
