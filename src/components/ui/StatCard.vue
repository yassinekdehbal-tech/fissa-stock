<script setup lang="ts">
defineProps<{
  value: string | number
  label: string
  color?: string
}>()
</script>

<template>
  <div class="bg-[#161b22] border border-[#30363d] rounded-lg p-3.5">
    <strong
      class="text-[22px] font-mono block leading-tight"
      :class="color || 'text-[#e6edf3]'"
    >
      {{ value }}
    </strong>
    <span class="text-[#8b949e] text-[11px] mt-1 block">{{ label }}</span>
  </div>
</template>
