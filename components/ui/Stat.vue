<script setup lang="ts">
defineProps<{ label: string; value: string | number; unit?: string; tone?: "brand" | "green" | "white" }>();
</script>
<template>
  <div class="rounded-xxs p-3 text-center" :class="tone === 'white' ? 'bg-white border border-grey-200' : tone === 'green' ? 'bg-green-50' : 'bg-brand-50'">
    <p class="text-[11px] uppercase text-grey-600 font-semibold leading-tight">{{ label }}</p>
    <p class="text-xl font-bold text-[#1a237e] mt-0.5">{{ value }} <span v-if="unit" class="text-xs text-grey-500 font-semibold">{{ unit }}</span></p>
  </div>
</template>
