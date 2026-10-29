<script setup lang="ts">
defineEmits<{ (e: "close"): void }>();
const { layers } = useLayers();
const visible = computed(() => layers.value.filter((l) => l.visible));
</script>
<template>
  <div class="flex flex-col max-h-full">
    <div class="p-3 flex items-center justify-between">
      <h2 class="text-md text-black">Legend</h2>
      <button class="text-grey-400 hover:text-grey-700" @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-4 h-4" /></button>
    </div>
    <div class="overflow-y-auto thin-scrollbar px-3 pb-3 space-y-3">
      <div v-for="l in visible" :key="l.id">
        <p class="text-[11px] font-semibold text-grey-800 mb-1">{{ l.label }}</p>
        <div v-if="l.legend" class="space-y-1">
          <div v-for="i in l.legend" :key="i.label" class="flex items-center gap-2 text-[11px] text-grey-700">
            <span class="w-3 h-3 rounded-[2px] shrink-0" :class="l.kind === 'circle' ? 'rounded-full' : ''" :style="{ background: i.color }" />{{ i.label }}
          </div>
        </div>
        <div v-else class="flex items-center gap-2 text-[11px] text-grey-700">
          <span class="w-3 h-3 shrink-0" :class="l.kind === 'circle' ? 'rounded-full' : l.kind === 'line' ? 'h-1 rounded-full' : 'rounded-[2px]'" :style="{ background: l.color }" />{{ l.label }}
        </div>
      </div>
      <p v-if="!visible.length" class="text-xs text-grey-500">No Legend Items</p>
    </div>
  </div>
</template>
