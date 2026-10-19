<script setup lang="ts">
defineProps<{ compact?: boolean; dark?: boolean }>()
</script>

<template>
  <div class="leading-none select-none" :class="dark ? 'text-gray-900' : 'text-brand'">
    <div
      class="font-black italic tracking-tight"
      :class="compact ? 'text-xl' : 'text-[26px]'"
      style="letter-spacing: -0.02em;"
    >FISSA</div>
    <div
      class="font-bold tracking-[0.22em] uppercase"
      :class="compact ? 'text-[8px] mt-0.5' : 'text-[10px] mt-1'"
    >Pièce Auto</div>
  </div>
</template>
