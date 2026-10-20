<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/utils/format'
import { useCategoriesStore } from '@/stores/categories'

// À personnaliser avec vos coordonnées réelles :
const CONTACT_EMAIL = 'contact@fissapieceauto.fr'
const CONTACT_TEL = '' // ex: '+33600000000' (laisser vide pour masquer le bouton Appeler)

const route = useRoute()
const cats = useCategoriesStore()
const loading = ref(true)
const piece = ref<Record<string, unknown> | null>(null)

async function load() {
  const { data } = await supabase
    .from('pieces')
    .select('id, ref, name, cat, vehicle, oem, price, photo, etat, compat, supplier, donor')
    .eq('id', route.params.id as string)
    .eq('publishable', true)
    .eq('archived', false)
    .gt('qty', 0)
    .maybeSingle()
  piece.value = (data as Record<string, unknown>) ?? null
  loading.value = false
}
onMounted(() => { void load(); if (!cats.loaded) void cats.fetchAll() })

const catInfo = computed(() => {
  const c = (piece.value?.cat as string | null) ?? ''
  return c ? cats.info(c) : null
})

const mailtoHref = computed(() => {
  if (!piece.value) return '#'
  const subject = encodeURIComponent(`Demande — ${piece.value.ref} ${piece.value.name}`)
  const body = encodeURIComponent(
    `Bonjour,\n\nJe suis intéressé(e) par la pièce ${piece.value.ref} (${piece.value.name}).\nEst-elle toujours disponible ?\n\nMerci.`,
  )
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
})
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-5 py-6">
    <router-link to="/boutique" class="text-gray-500 hover:text-amber-700 text-xs transition-colors">
      ← Retour au catalogue
    </router-link>

    <div v-if="loading" class="text-center py-16 text-gray-500 text-sm">Chargement…</div>

    <div v-else-if="!piece" class="text-center py-16">
      <div class="text-gray-900 text-sm mb-2">Cette pièce n'est plus disponible.</div>
      <router-link to="/boutique" class="text-amber-600 text-xs">Voir les autres pièces →</router-link>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <!-- Photo -->
      <div class="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden aspect-square flex items-center justify-center">
        <img
          v-if="piece.photo"
          :src="(piece.photo as string)"
          :alt="(piece.name as string)"
          class="w-full h-full object-cover"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        >
        <span v-else class="text-6xl opacity-30"></span>
      </div>

      <!-- Details -->
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="badge-ref">{{ piece.ref }}</span>
          <span v-if="catInfo && piece.cat" class="text-[11px]" :class="catInfo.textClass">{{ catInfo.icon }} {{ catInfo.label }}</span>
        </div>
        <h1 class="text-gray-900 text-xl font-semibold leading-snug">{{ piece.name }}</h1>
        <div class="text-green-600 text-2xl font-bold mt-2">{{ formatPrice(Number(piece.price)) }}</div>

        <dl class="mt-4 space-y-1.5 text-xs">
          <div v-if="piece.vehicle" class="flex gap-2">
            <dt class="text-gray-500 w-28 shrink-0">Véhicule</dt><dd class="text-gray-900">{{ piece.vehicle }}</dd>
          </div>
          <div v-if="piece.etat" class="flex gap-2">
            <dt class="text-gray-500 w-28 shrink-0">État</dt><dd class="text-gray-900">{{ piece.etat }}</dd>
          </div>
          <div v-if="piece.oem" class="flex gap-2">
            <dt class="text-gray-500 w-28 shrink-0">Réf. constructeur</dt><dd class="text-gray-900">{{ piece.oem }}</dd>
          </div>
          <div v-if="piece.compat" class="flex gap-2">
            <dt class="text-gray-500 w-28 shrink-0">Compatibilités</dt><dd class="text-gray-900">{{ piece.compat }}</dd>
          </div>
        </dl>

        <!-- Contact CTA -->
        <div class="mt-6 flex flex-wrap gap-2">
          <a
            :href="mailtoHref"
            class="btn btn-primary"
          >Demander cette pièce</a>
          <a
            v-if="CONTACT_TEL"
            :href="`tel:${CONTACT_TEL}`"
            class="btn btn-secondary"
          >Appeler</a>
        </div>
        <p class="text-[10px] text-gray-500 mt-2">Réservation sous réserve de disponibilité. Retrait en magasin ou expédition.</p>
      </div>
    </div>
  </div>
</template>
