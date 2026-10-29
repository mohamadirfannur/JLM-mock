<script setup lang="ts">
import IcLocation from "~/assets/icons/ic-location.svg";
import IcExpand from "~/assets/icons/ic-expand.svg";
const props = defineProps<{ extent?: [number, number, number, number] }>();
const { map, zoom, fitTo } = useMap();
const btn = "bg-transparent hover:bg-gradient-to-r hover:from-blue-100 hover:to-blue-600 p-2 hover:text-white rounded-xs text-grey-900";
</script>
<template>
  <div class="z-20 absolute bottom-8 right-6">
    <div class="flex gap-2 bg-white/60 backdrop-blur rounded-xs p-2 items-center">
      <button :class="btn" title="Zoom to extent" @click="props.extent && fitTo(props.extent, 60)"><IcExpand class="w-5 h-5" :font-controlled="false" /></button>
      <button :class="btn" title="Lokasi saya" @click="map?.flyTo({ center: [107.695, -6.955], zoom: 15 })"><IcLocation class="w-5 h-5" :font-controlled="false" /></button>
      <button :class="btn" @click="map?.zoomOut()"><UIcon name="i-heroicons-minus" class="w-5 h-5" /></button>
      <input :value="zoom.toFixed(2)" disabled class="w-14 h-9 text-center text-xs rounded-xxs bg-white/70 border border-grey-300" />
      <button :class="btn" @click="map?.zoomIn()"><UIcon name="i-heroicons-plus" class="w-5 h-5" /></button>
    </div>
  </div>
</template>
