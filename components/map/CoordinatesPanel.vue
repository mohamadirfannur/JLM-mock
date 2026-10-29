<script setup lang="ts">
const { cursor } = useMap();
</script>
<template>
  <div class="absolute bottom-0 left-0 right-0 h-6 bg-white/70 backdrop-blur z-10 flex items-center justify-between px-24 text-[10px] text-grey-700">
    <span>{{ cursor ? `${cursor[1].toFixed(6)}, ${cursor[0].toFixed(6)}` : "-" }}</span>
    <span>Data dummy untuk demo · Basemap © MapTiler © OpenStreetMap contributors</span>
  </div>
</template>
