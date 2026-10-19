<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  value: string | number
  label: string
  /** Icône (nom AppIcon) affichée dans une pastille colorée */
  icon?: string
  /** Teinte de la pastille : amber | green | blue | violet | red | gray */
  tone?: 'amber' | 'green' | 'blue' | 'violet' | 'red' | 'gray' | 'orange'
  /** Compatibilité : classe de couleur de l'ancienne version (ignorée si `tone` est fourni) */
  color?: string
}>()

const TONES: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-green-50 text-green-600',
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-orange-600',
  gray: 'bg-gray-100 text-gray-600',
}

const toneClass = computed(() => {
  if (props.tone) return TONES[props.tone]
  const c = props.color || ''
  if (c.includes('e6a817') || c.includes('amber')) return TONES.amber
  if (c.includes('3fb950') || c.includes('green')) return TONES.green
  if (c.includes('58a6ff') || c.includes('blue')) return TONES.blue
  if (c.includes('bc8cff') || c.includes('violet') || c.includes('purple')) return TONES.violet
  if (c.includes('red')) return TONES.red
  if (c.includes('f0883e') || c.includes('orange')) return TONES.orange
  return TONES.gray
})
</script>

<template>
  <div class="card p-4 flex items-center gap-3 min-w-0">
    <span v-if="icon" class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" :class="toneClass">
      <AppIcon :name="icon" class="w-5 h-5" />
    </span>
    <div class="min-w-0">
      <strong class="text-lg sm:text-xl font-bold text-gray-900 block leading-tight break-words">{{ value }}</strong>
      <span class="text-[12px] text-gray-500 block mt-0.5 leading-snug">{{ label }}</span>
    </div>
  </div>
</template>
