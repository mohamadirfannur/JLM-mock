<script setup lang="ts">
defineProps<{ title?: string; items: { label: string; color: string; kind: string; dashed?: boolean }[] }>();
const open = ref(true);
</script>
<template>
  <div class="j-panel w-[220px] p-3">
    <button class="flex items-center justify-between w-full" @click="open = !open">
      <span class="j-title text-[13px]">{{ title || "Legenda Jaringan" }}</span>
      <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'" class="w-4 h-4 text-j-sub" />
    </button>
    <div v-show="open" class="mt-2 space-y-1.5">
      <div v-for="i in items" :key="i.label" class="flex items-center gap-2.5 text-[11px] text-j-sub"><span class="w-4 flex justify-center"><JmapMarker :kind="i.kind" :color="i.color" :dashed="i.dashed" /></span>{{ i.label }}</div>
    </div>
  </div>
</template>
