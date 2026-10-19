<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import AppIcon from '@/components/ui/AppIcon.vue'

const { toastMessage, toastVisible, toastError } = useToast()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-2"
  >
    <div
      v-if="toastVisible"
      class="fixed bottom-5 right-5 px-4 py-3 rounded-lg text-sm font-medium z-[2000] max-w-[320px] shadow-lg flex items-center gap-2 text-white"
      :class="toastError ? 'bg-red-600' : 'bg-gray-900'"
      style="margin-bottom: env(safe-area-inset-bottom);"
    >
      <AppIcon :name="toastError ? 'alert' : 'check-circle'" class="w-4 h-4 shrink-0" :class="toastError ? '' : 'text-green-400'" />
      <span>{{ toastMessage }}</span>
    </div>
  </Transition>
</template>
