<script setup lang="ts">
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
        class="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <div
          class="bg-[#161b22] border border-[#30363d] rounded-xl p-5 w-full relative max-h-[92vh] overflow-y-auto"
          :style="{ maxWidth: maxWidth || '520px' }"
        >
          <div class="font-mono text-sm font-bold text-[#e6a817] mb-3.5">{{ title }}</div>
          <button
            @click="emit('close')"
            class="absolute top-3.5 right-3.5 bg-transparent border-none text-[#8b949e] text-lg cursor-pointer hover:text-white"
          >
            ✕
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
