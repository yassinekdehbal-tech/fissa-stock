<script setup lang="ts">
import BaseModal from '@/components/ui/BaseModal.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import type { Piece } from '@/types'
import { formatRef } from '@/utils/format'

/**
 * Marquage manuel : la référence à recopier au marqueur sur la pièce,
 * affichée en grand, avec les conseils qui rendent la lecture (humaine et
 * par le scanner en mode « Réf. écrite ») la plus fiable possible.
 */
defineProps<{ piece: Piece | null; open: boolean }>()
const emit = defineEmits<{ close: []; print: [] }>()
</script>

<template>
  <BaseModal title="Référence à écrire sur la pièce" :open="open" @close="emit('close')">
    <div v-if="piece" class="space-y-4">
      <div class="rounded-xl bg-sidebar text-white p-4 text-center">
        <div class="text-[11px] uppercase tracking-wider text-gray-400">Écrire au marqueur, en majuscules</div>
        <div class="font-mono font-bold text-3xl sm:text-4xl tracking-[0.18em] text-brand mt-2 break-all select-all">{{ formatRef(piece.ref) }}</div>
        <div class="text-[13px] text-gray-300 mt-2 truncate">{{ piece.name }}</div>
        <div v-if="piece.zone" class="text-[12px] text-gray-400 mt-0.5">Zone : {{ piece.zone }}</div>
      </div>

      <ul class="text-[13px] text-gray-700 space-y-1.5">
        <li class="flex gap-2"><AppIcon name="check" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" /><span>Marqueur indélébile, sur une surface propre et sèche.</span></li>
        <li class="flex gap-2"><AppIcon name="check" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" /><span>Lettres <strong>majuscules</strong>, bien séparées, de même hauteur.</span></li>
        <li class="flex gap-2"><AppIcon name="check" class="w-4 h-4 text-green-600 shrink-0 mt-0.5" /><span>Barrez le zéro (Ø) et le Z, mettez un empattement au 1 : le scanner et vos collègues ne confondront pas O/0, I/1, Z/2.</span></li>
        <li class="flex gap-2"><AppIcon name="info" class="w-4 h-4 text-blue-600 shrink-0 mt-0.5" /><span>Au scanner, choisissez <strong>Réf. écrite</strong> et photographiez l'inscription : la pièce s'affiche, ou les pièces les plus proches sont proposées en cas de doute.</span></li>
      </ul>

      <div class="flex flex-col sm:flex-row gap-2">
        <button class="btn btn-secondary flex-1" @click="emit('print')"><AppIcon name="printer" class="w-4 h-4" /> Imprimer une étiquette quand même</button>
        <button class="btn btn-primary flex-1" @click="emit('close')"><AppIcon name="check" class="w-4 h-4" /> C'est écrit</button>
      </div>
    </div>
  </BaseModal>
</template>
