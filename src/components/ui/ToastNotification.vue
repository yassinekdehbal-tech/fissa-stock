<script setup lang="ts">
import { useToast } from '@/composables/useToast'

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
      class="fixed bottom-5 right-5 px-4 py-2.5 rounded-lg font-mono text-xs font-semibold z-[2000] max-w-[300px]"
      :class="toastError ? 'bg-red-500 text-white' : 'bg-green-500 text-black'"
    >
      {{ toastMessage }}
    </div>
  </Transition>
</template>
