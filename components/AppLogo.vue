<script setup lang="ts">
defineProps<{ light?: boolean }>();
</script>
<template>
  <div class="flex items-center gap-2 select-none">
    <div class="h-8 w-8 rounded-xs bg-gradient-to-br from-blue-400 to-brand-500 flex items-center justify-center text-white">
      <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
    </div>
    <div class="leading-none">
      <p class="text-[13px] font-bold tracking-wide" :class="light ? 'text-white' : 'text-brand-500'">JLM</p>
      <p class="text-[9px] font-medium" :class="light ? 'text-white/80' : 'text-grey-600'">Map Planner</p>
    </div>
  </div>
</template>
