<script setup lang="ts">
defineProps<{ kind: string; color: string; dashed?: boolean }>();
</script>
<template>
  <span v-if="kind === 'line'" class="w-4 h-0 border-t-2 shrink-0" :class="dashed ? 'border-dashed' : ''" :style="{ borderColor: color }" />
  <span v-else-if="kind === 'diamond'" class="w-2.5 h-2.5 rotate-45 shrink-0" :style="{ background: color }" />
  <span v-else-if="kind === 'square' || kind === 'fill'" class="w-2.5 h-2.5 rounded-[2px] shrink-0" :style="{ background: color }" />
  <span v-else class="w-2 h-2 rounded-full shrink-0" :style="{ background: color }" />
</template>
