<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{
  title: string
  open: boolean
  maxWidth?: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 bg-gray-900/50 backdrop-blur-[2px] z-[1000] flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-white border border-gray-200 rounded-xl shadow-xl p-5 w-full relative max-h-[92vh] overflow-y-auto"
          :style="{ maxWidth: maxWidth || '520px' }"
        >
          <div class="text-base font-semibold text-gray-900 mb-4 pr-8">{{ title }}</div>
          <button
            @click="emit('close')"
            class="icon-btn absolute top-3.5 right-3.5"
            aria-label="Fermer"
          >
            <AppIcon name="x" class="w-4 h-4" />
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
