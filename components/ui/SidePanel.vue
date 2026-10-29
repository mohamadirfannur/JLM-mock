<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; width?: string; side?: "left" | "right" }>();
defineEmits<{ (e: "close"): void }>();
</script>
<template>
  <div :class="[width || 'w-[30.5rem]', 'bg-white rounded-xs shadow-lg flex flex-col overflow-hidden fade-up']">
    <div class="p-4 pb-2 flex items-start justify-between gap-3 shrink-0">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-black leading-tight">{{ title }}</h2>
        <p v-if="subtitle" class="text-xs text-grey-700 mt-0.5">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <slot name="actions" />
        <button class="text-grey-500 hover:text-grey-900 p-1" @click="$emit('close')"><UIcon name="i-heroicons-chevron-double-right" class="w-4 h-4" /></button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto thin-scrollbar px-4 pb-4"><slot /></div>
    <div v-if="$slots.footer" class="border-t border-grey-200 p-3 shrink-0"><slot name="footer" /></div>
  </div>
</template>
