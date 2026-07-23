<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/format'
import { CATEGORIES } from '@/types'
import type { PieceCategory } from '@/types'

interface PublicPiece {
  id: string
  ref: string
  name: string
  cat: PieceCategory
  vehicle: string
  price: number
  photo: string
  etat: string
}

const pieces = ref<PublicPiece[]>([])
const loading = ref(true)
const search = ref('')
const cat = ref<string>('')

async function load() {
  const { data } = await supabase
    .from('pieces')
    .select('id, ref, name, cat, vehicle, price, photo, etat')
    .eq('publishable', true)
    .eq('archived', false)
    .gt('qty', 0)
    .order('added', { ascending: false })
    .limit(500)
  pieces.value = ((data as Record<string, unknown>[]) ?? []).map((p) => ({
    id: p.id as string,
    ref: p.ref as string,
    name: p.name as string,
    cat: (p.cat ?? '') as PieceCategory,
    vehicle: (p.vehicle as string) ?? '',
    price: Number(p.price),
    photo: (p.photo as string) ?? '',
    etat: (p.etat as string) ?? '',
  }))
  loading.value = false
}

onMounted(load)

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  return pieces.value
    .filter((p) => (cat.value ? p.cat === cat.value : true))
    .filter((p) =>
      !q ? true : p.ref.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.vehicle.toLowerCase().includes(q),
    )
})

const categoryList = Object.entries(CATEGORIES).filter(([k]) => k) as [PieceCategory, (typeof CATEGORIES)[PieceCategory]][]
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-[radial-gradient(ellipse_at_50%_0%,rgba(230,168,23,0.10)_0%,transparent_70%)] border-b border-[#30363d]">
      <div class="max-w-[1200px] mx-auto px-5 py-10 text-center">
        <h1 class="font-mono text-2xl sm:text-3xl font-bold text-[#e6edf3]">
          Pièces auto <span class="text-[#e6a817]">d'occasion</span> & neuves
        </h1>
        <p class="text-[#8b949e] text-sm mt-2">Contrôlées, prêtes à poser. Trouvez votre pièce par référence ou par véhicule.</p>
        <input
          v-model="search"
          type="text"
          placeholder="Rechercher : référence, pièce, véhicule…"
          class="mt-5 w-full max-w-[520px] bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-[#e6edf3] text-sm placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
        >
      </div>
    </div>

    <div class="max-w-[1200px] mx-auto px-5 py-6">
      <!-- Category filter -->
      <div class="flex flex-wrap gap-2 mb-5">
        <button
          @click="cat = ''"
          class="text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
          :class="cat === '' ? 'bg-[#e6a817] text-[#0d1117] border-[#e6a817]' : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#484f58]'"
        >Toutes</button>
        <button
          v-for="[k, info] in categoryList"
          :key="k"
          @click="cat = k"
          class="text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
          :class="cat === k ? 'bg-[#e6a817] text-[#0d1117] border-[#e6a817]' : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#484f58]'"
        >{{ info.icon }} {{ info.label }}</button>
      </div>

      <div v-if="loading" class="text-center py-16 text-[#8b949e] text-sm">Chargement du catalogue…</div>
      <div v-else-if="!filtered.length" class="text-center py-16 text-[#8b949e] text-sm">
        Aucune pièce ne correspond. Essayez une autre recherche.
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <router-link
          v-for="p in filtered"
          :key="p.id"
          :to="`/boutique/${p.id}`"
          class="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden hover:border-[#e6a817]/50 transition-colors group"
        >
          <div class="aspect-square bg-[#0d1117] overflow-hidden flex items-center justify-center">
            <img
              v-if="p.photo"
              :src="p.photo"
              :alt="p.name"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            >
            <span v-else class="text-4xl opacity-30">🔧</span>
          </div>
          <div class="p-2.5">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="font-mono text-[9px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded truncate">{{ p.ref }}</span>
              <span v-if="p.etat" class="text-[9px] text-[#8b949e] truncate">{{ p.etat }}</span>
            </div>
            <div class="text-[#e6edf3] text-xs font-medium leading-snug line-clamp-2 min-h-[2.2em]">{{ p.name }}</div>
            <div v-if="p.vehicle" class="text-[#8b949e] text-[10px] mt-0.5 truncate">{{ p.vehicle }}</div>
            <div class="text-[#3fb950] font-mono text-sm font-bold mt-1.5">{{ formatPrice(p.price) }}</div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
