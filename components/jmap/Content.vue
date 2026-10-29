<script setup lang="ts">
defineProps<{ title?: string; subtitle?: string }>();
defineEmits<{ (e: "close"): void }>();
const { groups, toggle, toggleGroup } = useLayers();
const chip = ref("Semua");
const closed = ref<Record<string, boolean>>({});
const shown = computed(() => {
  const out: Record<string, any[]> = {};
  Object.entries(groups.value).forEach(([g, ls]) => {
    const f = ls.filter((l) => chip.value === "Semua" || l.cat === chip.value);
    if (f.length) out[g] = f;
  });
  return out;
});
const chips = computed(() => ["Semua", ...new Set(Object.values(groups.value).flat().map((l) => l.cat).filter(Boolean) as string[])]);
const anyOn = (ls: any[]) => ls.some((l) => l.visible);
</script>
<template>
  <div class="flex flex-col h-full">
    <div class="px-4 pt-4 pb-3 flex items-start justify-between">
      <div><h2 class="j-title text-[16px]">{{ title || "Map Content" }}</h2><p class="text-[12px] text-j-sub">{{ subtitle || "Layer Management" }}</p></div>
      <button class="w-6 h-6 rounded-[6px] border border-j-line flex items-center justify-center text-j-sub hover:text-j-ink" title="Tutup panel" @click="$emit('close')"><UIcon name="i-lucide-arrow-left-to-line" class="w-3.5 h-3.5" /></button>
    </div>
    <div class="px-4 flex flex-wrap gap-1.5"><button v-for="c in chips" :key="c" class="j-chip !h-6 !px-2.5 !text-[11px]" :class="chip === c && 'j-chip-on'" @click="chip = c">{{ c }}</button></div>
    <div class="flex-1 overflow-y-auto thin-scrollbar px-4 py-3 space-y-3">
      <div v-for="(ls, g) in shown" :key="g" class="border border-j-line rounded-[10px] p-2">
        <div class="flex items-center gap-2 px-1 py-1">
          <button class="text-j-ink" @click="closed[g] = !closed[g]"><UIcon :name="closed[g] ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" class="w-4 h-4" /></button>
          <UIcon name="i-lucide-folder" class="w-4 h-4 text-j-sub" />
          <span class="text-[13px] font-display font-bold flex-1">{{ g }}</span>
          <button class="w-6 h-6 rounded-full bg-j-bg flex items-center justify-center" :class="anyOn(ls) ? 'text-j-sub' : 'text-j-mute'" @click="toggleGroup(g as string, !anyOn(ls))"><UIcon :name="anyOn(ls) ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="w-3.5 h-3.5" /></button>
        </div>
        <div v-show="!closed[g]" class="space-y-1.5 mt-1">
          <div v-for="l in ls" :key="l.id" class="flex items-center gap-2.5 border border-j-line rounded-[6px] px-2.5 h-8" :class="!l.visible && 'opacity-60'">
            <JmapMarker :kind="l.kind" :color="l.color" :dashed="l.dashed" />
            <span class="text-[12px] flex-1 truncate" :class="l.visible ? 'text-j-ink font-medium' : 'text-j-sub'">{{ l.label }}</span>
            <span v-if="l.count" class="text-[10px] px-1.5 rounded-[4px]" :style="{ background: l.color + '1A', color: l.color === '#FFFFFF' ? '#51625E' : l.color }">{{ fmt(l.count) }}</span>
            <button class="w-6 h-6 rounded-full bg-j-bg flex items-center justify-center text-j-sub" @click="toggle(l.id)"><UIcon :name="l.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="$slots.footer" class="p-4 border-t border-j-line"><slot name="footer" /></div>
  </div>
</template>
