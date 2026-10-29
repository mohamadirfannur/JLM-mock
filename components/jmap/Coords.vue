<script setup lang="ts">
const { cursor, zoom } = useMap();
const scale = computed(() => {
  const m = (156543.03 * Math.cos((6.95 * Math.PI) / 180)) / Math.pow(2, zoom.value) * 100;
  return m >= 1000 ? `${Math.round(m / 100) / 10} km` : `${Math.round(m)} m`;
});
</script>
<template>
  <div class="flex items-center gap-4 bg-white/95 border border-j-line rounded-[6px] px-3 h-6 text-[11px] text-j-sub">
    <span>Lat <b class="text-j-ink font-medium">{{ cursor ? Math.abs(cursor[1]).toFixed(6) : "6.955000" }} °S</b></span>
    <span>Long <b class="text-j-ink font-medium">{{ cursor ? cursor[0].toFixed(6) : "107.695000" }} °E</b></span>
    <span class="flex items-center gap-2">{{ scale }}<span class="w-14 h-0.5 bg-j-cyan" /></span>
  </div>
</template>
