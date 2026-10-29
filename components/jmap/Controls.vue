<script setup lang="ts">
const props = defineProps<{ extent?: [number, number, number, number] }>();
const { map, basemap, setBasemap, fitTo } = useMap();
const order: any[] = ["streets", "light", "satellite", "hybrid"];
const next = () => setBasemap(order[(order.indexOf(basemap.value) + 1) % order.length]);
const labels: Record<string, string> = { streets: "Streets", light: "Light", satellite: "Satelit", hybrid: "Hybrid", topo: "Topo" };
</script>
<template>
  <div class="flex flex-col gap-3 items-end">
    <div class="bg-white border border-j-line rounded-[10px] shadow-[0_2px_8px_rgba(16,32,29,0.06)] flex flex-col w-11">
      <button class="h-11 flex items-center justify-center hover:text-j-cyan" title="Zoom in" @click="map?.zoomIn()"><UIcon name="i-lucide-plus" class="w-5 h-5" /></button>
      <div class="mx-2 border-t border-j-line" />
      <button class="h-11 flex items-center justify-center hover:text-j-cyan" title="Zoom out" @click="map?.zoomOut()"><UIcon name="i-lucide-minus" class="w-5 h-5" /></button>
    </div>
    <UTooltip :text="`Basemap: ${labels[basemap]}`" :popper="{ placement: 'left' }"><button class="j-icon-btn" @click="next"><UIcon name="i-lucide-image" class="w-5 h-5" /></button></UTooltip>
    <UTooltip text="Tampilkan seluruh area" :popper="{ placement: 'left' }"><button class="j-icon-btn" @click="props.extent && fitTo(props.extent, 60)"><UIcon name="i-lucide-map" class="w-5 h-5" /></button></UTooltip>
    <UTooltip text="Pusatkan ke Bandung Timur" :popper="{ placement: 'left' }"><button class="j-icon-btn" @click="map?.flyTo({ center: [107.693, -6.955], zoom: 15 })"><UIcon name="i-lucide-map-pin" class="w-5 h-5" /></button></UTooltip>
    <UTooltip text="Reset arah utara" :popper="{ placement: 'left' }"><button class="j-icon-btn" @click="map?.easeTo({ bearing: 0, pitch: 0 })"><UIcon name="i-lucide-compass" class="w-5 h-5" /></button></UTooltip>
  </div>
</template>
