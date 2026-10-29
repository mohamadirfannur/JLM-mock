<script setup lang="ts">
defineProps<{ label: string; value: string | number; unit?: string; tone?: "brand" | "green" | "white" }>();
</script>
<template>
  <div class="rounded-[8px] p-3" :class="tone === 'white' ? 'bg-white border border-j-line' : tone === 'green' ? 'bg-j-aqua/[0.10]' : 'bg-j-bg border border-j-line'">
    <p class="text-[10px] uppercase tracking-wide text-j-sub font-display font-bold leading-tight">{{ label }}</p>
    <p class="font-display font-bold text-[18px] text-j-ink mt-1 leading-none">{{ value }} <span v-if="unit" class="text-[11px] text-j-sub font-sans font-normal">{{ unit }}</span></p>
  </div>
</template>
