<script setup lang="ts">
const props = defineProps<{ items: { label: string; value: number; color: string }[]; size?: number; stroke?: number; center?: string; caption?: string }>();
const S = computed(() => props.size || 150);
const W = computed(() => props.stroke || 26);
const R = computed(() => (S.value - W.value) / 2);
const C = computed(() => 2 * Math.PI * R.value);
const total = computed(() => props.items.reduce((a, b) => a + b.value, 0) || 1);
const arcs = computed(() => {
  let off = 0;
  return props.items.map((i) => {
    const len = (i.value / total.value) * C.value;
    const a = { ...i, dash: `${Math.max(len - 2, 0)} ${C.value}`, off: -off };
    off += len;
    return a;
  });
});
</script>
<template>
  <div class="relative" :style="{ width: S + 'px', height: S + 'px' }">
    <svg :width="S" :height="S" class="-rotate-90">
      <circle :cx="S / 2" :cy="S / 2" :r="R" fill="none" stroke="#EFF5FA" :stroke-width="W" />
      <circle v-for="a in arcs" :key="a.label" :cx="S / 2" :cy="S / 2" :r="R" fill="none" :stroke="a.color" :stroke-width="W" :stroke-dasharray="a.dash" :stroke-dashoffset="a.off" />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <p class="font-display font-bold text-[22px] text-j-ink leading-none">{{ center }}</p>
      <p v-if="caption" class="text-[11px] text-j-sub mt-1">{{ caption }}</p>
    </div>
  </div>
</template>
