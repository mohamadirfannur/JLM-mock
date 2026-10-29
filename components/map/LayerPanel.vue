<script setup lang="ts">
defineEmits<{ (e: "close"): void }>();
const { groups, toggle } = useLayers();
const filter = ref("");
const open = ref<Record<string, boolean>>({});
const shown = computed(() => {
  const out: Record<string, any[]> = {};
  Object.entries(groups.value).forEach(([g, ls]) => {
    const f = ls.filter((l) => l.label.toLowerCase().includes(filter.value.toLowerCase()));
    if (f.length) out[g] = f;
  });
  return out;
});
</script>
<template>
  <div class="flex flex-col h-full">
    <div class="p-3 flex items-start justify-between">
      <div>
        <h2 class="text-md text-black">Layer Management</h2>
        <p class="text-[10px] text-grey-700">Atur visibilitas layer di peta</p>
      </div>
      <button class="text-grey-400 hover:text-grey-700" @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-4 h-4" /></button>
    </div>
    <div class="px-3"><UInput v-model="filter" size="sm" placeholder="Filter layers..." icon="i-heroicons-magnifying-glass" /></div>
    <div class="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
      <div v-for="(ls, g) in shown" :key="g" class="border border-grey-200 rounded-xxs">
        <button class="w-full flex items-center justify-between p-2 text-xs font-semibold text-grey-900" @click="open[g] = open[g] === false">
          <span>{{ g }}</span>
          <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 transition-transform" :class="open[g] === false ? '-rotate-90' : ''" />
        </button>
        <div v-show="open[g] !== false" class="border-t border-grey-200 p-1">
          <div v-for="l in ls" :key="l.id" class="flex items-center gap-2 p-1.5 rounded-xxs hover:bg-grey-100">
            <span
              class="w-3 h-3 shrink-0"
              :class="l.kind === 'circle' || l.kind === 'symbol' ? 'rounded-full' : l.kind === 'line' ? 'h-1 rounded-full' : 'rounded-[2px]'"
              :style="{ background: l.color }"
            />
            <span class="text-xs text-grey-800 flex-1 truncate">{{ l.label }}</span>
            <span v-if="l.count !== undefined" class="text-[10px] text-grey-500">{{ l.count.toLocaleString("id-ID") }}</span>
            <UToggle :model-value="l.visible" size="xs" @update:model-value="toggle(l.id, $event)" />
          </div>
        </div>
      </div>
      <p v-if="!Object.keys(shown).length" class="text-xs text-grey-500 text-center py-6">No layers</p>
    </div>
  </div>
</template>
