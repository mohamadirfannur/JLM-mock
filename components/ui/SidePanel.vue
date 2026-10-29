<script setup lang="ts">
defineProps<{ title: string; subtitle?: string; width?: string }>();
defineEmits<{ (e: "close"): void }>();
</script>
<template>
  <div :class="[width || 'w-[360px]', 'j-panel flex flex-col overflow-hidden fade-up h-full']">
    <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3 shrink-0">
      <div class="min-w-0">
        <h2 class="j-title text-[16px] leading-tight">{{ title }}</h2>
        <p v-if="subtitle" class="text-[12px] text-j-sub mt-0.5 truncate">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <slot name="actions" />
        <button class="w-7 h-7 rounded-full border border-j-line flex items-center justify-center text-j-sub hover:text-j-ink" @click="$emit('close')"><UIcon name="i-lucide-x" class="w-3.5 h-3.5" /></button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto thin-scrollbar px-4 pb-4"><slot /></div>
    <div v-if="$slots.footer" class="border-t border-j-line p-3 shrink-0"><slot name="footer" /></div>
  </div>
</template>
