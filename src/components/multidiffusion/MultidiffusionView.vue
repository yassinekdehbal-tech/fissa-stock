<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePublicationsStore } from '@/stores/publications'
import { useStockStore } from '@/stores/stock'
import { useToast } from '@/composables/useToast'
import { formatPrice } from '@/utils/format'
import type { Channel } from '@/stores/publications'
import type { Piece } from '@/types'

const pub = usePublicationsStore()
const stock = useStockStore()
const { toast } = useToast()

const search = ref('')
const onlyPublishable = ref(false)
const busy = ref<string | null>(null) // clé "pieceId:channelId" en cours

onMounted(() => {
  pub.listen()
})

const integrationBadge: Record<string, { label: string; cls: string }> = {
  api: { label: 'API', cls: 'bg-[#3fb950]/15 text-[#3fb950]' },
  connector: { label: 'Connecteur', cls: 'bg-[#58a6ff]/15 text-[#58a6ff]' },
  manual: { label: 'Manuel', cls: 'bg-[#8b949e]/15 text-[#8b949e]' },
}

const pieces = computed<Piece[]>(() => {
  const q = search.value.toLowerCase().trim()
  return stock.activePieces
    .filter((p) => p.qty > 0)
    .filter((p) => (onlyPublishable.value ? p.publishable : true))
    .filter((p) =>
      !q ? true : p.ref.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.vehicle.toLowerCase().includes(q),
    )
    .slice(0, 100)
})

function key(pieceId: string, channelId: string) {
  return pieceId + ':' + channelId
}

async function togglePublishable(p: Piece) {
  if (!p._id) return
  await pub.setPublishable(p._id, !p.publishable)
  await stock.fetchAll()
}

async function toggleChannel(c: Channel) {
  await pub.setChannelActive(c.id, !c.active)
  toast(c.active ? `${c.label} désactivé` : `${c.label} activé`)
}

async function doPublish(p: Piece, c: Channel) {
  if (!p._id) return
  busy.value = key(p._id, c.id)
  try {
    await pub.publish(p._id, c.id)
    const st = pub.pubFor(p._id, c.id)
    if (st?.status === 'published') toast(`Publié sur ${c.label}`)
    else toast(st?.errorMsg || `${c.label} non configuré`, true)
  } catch {
    toast('Erreur de publication', true)
  } finally {
    busy.value = null
  }
}

async function doDelist(p: Piece, c: Channel) {
  if (!p._id) return
  busy.value = key(p._id, c.id)
  try {
    await pub.delist(p._id, c.id)
    toast(`Retiré de ${c.label}`)
  } catch {
    toast('Erreur de retrait', true)
  } finally {
    busy.value = null
  }
}

const statusStyle: Record<string, { label: string; cls: string }> = {
  published: { label: 'En ligne', cls: 'bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/30' },
  draft: { label: 'En file', cls: 'bg-[#e6a817]/15 text-[#e6a817] border-[#e6a817]/30' },
  sold: { label: 'Vendu', cls: 'bg-[#8b949e]/15 text-[#8b949e] border-[#8b949e]/30' },
  error: { label: 'Erreur', cls: 'bg-[#f85149]/15 text-[#f85149] border-[#f85149]/30' },
  delisted: { label: 'Retiré', cls: 'bg-[#8b949e]/10 text-[#8b949e] border-[#30363d]' },
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div>
      <div class="font-mono text-[11px] font-semibold text-[#e6a817] uppercase tracking-[2px]">
        📡 Multidiffusion
      </div>
      <div class="text-[#8b949e] text-xs mt-1">
        Publiez vos pièces sur plusieurs marketplaces depuis une source unique. Anti-survente automatique.
      </div>
    </div>

    <!-- Info banner -->
    <div class="bg-[#161b22] border border-[#e6a817]/30 rounded-xl p-3 text-xs text-[#c9d1d9] leading-relaxed">
      Les statuts reflètent la réalité : un canal « API » ne diffuse pour de vrai qu'une fois ses clés
      configurées (Supabase → Edge Functions → Secrets). Sans clés, la publication reste en
      <span class="text-[#f85149]">Erreur</span> (« non configuré »). Les canaux « Manuel » servent à
      suivre où vous avez déposé une annonce à la main.
    </div>

    <!-- Channels -->
    <div class="bg-[#161b22] border border-[#30363d] rounded-xl p-4">
      <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest mb-3">Canaux de vente</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div
          v-for="c in pub.channels"
          :key="c.id"
          class="flex items-center justify-between bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[#e6edf3] text-xs font-semibold truncate">{{ c.label }}</span>
            <span
              class="text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0"
              :class="integrationBadge[c.integration]?.cls"
            >{{ integrationBadge[c.integration]?.label }}</span>
          </div>
          <button
            @click="toggleChannel(c)"
            class="text-[10px] font-mono px-2 py-1 rounded cursor-pointer border transition-colors shrink-0"
            :class="c.active
              ? 'bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/30'
              : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#484f58]'"
          >
            {{ c.active ? 'Actif' : 'Inactif' }}
          </button>
        </div>
      </div>
    </div>

    <!-- No active channel hint -->
    <div
      v-if="!pub.activeChannels.length"
      class="bg-[#161b22] border border-[#30363d] rounded-xl p-6 text-center text-[#8b949e] text-sm"
    >
      Activez au moins un canal ci-dessus pour commencer à diffuser vos pièces.
    </div>

    <!-- Pieces -->
    <div v-else class="bg-[#161b22] border border-[#30363d] rounded-xl p-4 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div class="font-mono text-[10px] text-[#8b949e] uppercase tracking-widest">Pièces à diffuser</div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-[10px] text-[#8b949e] cursor-pointer">
            <input v-model="onlyPublishable" type="checkbox" class="accent-[#e6a817]"> Publiables seulement
          </label>
          <input
            v-model="search"
            type="text"
            placeholder="Rechercher…"
            class="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-[#e6edf3] text-xs placeholder:text-[#484f58] focus:outline-none focus:border-[#e6a817] transition-colors"
          >
        </div>
      </div>

      <div v-if="!pieces.length" class="text-center py-6 text-[#8b949e] text-xs">Aucune pièce.</div>

      <div v-else class="space-y-2">
        <div
          v-for="p in pieces"
          :key="p._id"
          class="bg-[#0d1117] border border-[#30363d] rounded-lg p-3"
        >
          <!-- Piece header -->
          <div class="flex items-center gap-2 mb-2">
            <span class="font-mono text-[10px] text-[#e6a817] font-bold bg-[#e6a817]/10 px-1.5 py-0.5 rounded shrink-0">
              {{ p.ref }}
            </span>
            <span class="text-[#e6edf3] text-xs truncate flex-1">{{ p.name }}</span>
            <span class="font-mono text-[10px] text-[#3fb950] font-semibold shrink-0">{{ formatPrice(p.price) }}</span>
            <button
              @click="togglePublishable(p)"
              class="text-[9px] font-mono px-2 py-0.5 rounded cursor-pointer border transition-colors shrink-0"
              :class="p.publishable
                ? 'bg-[#58a6ff]/15 text-[#58a6ff] border-[#58a6ff]/30'
                : 'bg-transparent text-[#8b949e] border-[#30363d] hover:border-[#484f58]'"
              :title="p.publishable ? 'Visible sur le catalogue public' : 'Non publiable'"
            >
              {{ p.publishable ? '● Publiable' : '○ Publiable' }}
            </button>
          </div>

          <!-- Per-channel actions -->
          <div class="flex flex-wrap gap-1.5">
            <template v-for="c in pub.activeChannels" :key="c.id">
              <div class="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-lg pl-2 pr-1 py-1">
                <span class="text-[10px] text-[#8b949e]">{{ c.label }}</span>
                <template v-if="pub.pubFor(p._id!, c.id) && ['published','draft','sold','error','delisted'].includes(pub.pubFor(p._id!, c.id)!.status)">
                  <span
                    class="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                    :class="statusStyle[pub.pubFor(p._id!, c.id)!.status]?.cls"
                    :title="pub.pubFor(p._id!, c.id)!.errorMsg || ''"
                  >{{ statusStyle[pub.pubFor(p._id!, c.id)!.status]?.label }}</span>
                  <!-- Actions selon statut -->
                  <button
                    v-if="pub.pubFor(p._id!, c.id)!.status === 'published'"
                    @click="doDelist(p, c)"
                    :disabled="busy === key(p._id!, c.id)"
                    class="text-[9px] font-mono text-[#f85149] hover:text-[#ff6e67] px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none disabled:opacity-50"
                  >Retirer</button>
                  <button
                    v-else-if="['error','delisted'].includes(pub.pubFor(p._id!, c.id)!.status)"
                    @click="doPublish(p, c)"
                    :disabled="busy === key(p._id!, c.id)"
                    class="text-[9px] font-mono text-[#e6a817] hover:brightness-125 px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none disabled:opacity-50"
                  >Réessayer</button>
                </template>
                <button
                  v-else
                  @click="doPublish(p, c)"
                  :disabled="busy === key(p._id!, c.id)"
                  class="text-[9px] font-mono font-semibold text-[#0d1117] bg-[#e6a817] hover:brightness-110 px-2 py-0.5 rounded cursor-pointer border-none disabled:opacity-50"
                >{{ busy === key(p._id!, c.id) ? '…' : 'Publier' }}</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
