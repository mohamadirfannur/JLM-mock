<script setup lang="ts">
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const props = withDefaults(defineProps<{ center?: [number, number]; zoom?: number }>(), {
  center: () => [107.695, -6.955],
  zoom: 14,
});
const emit = defineEmits<{ (e: "ready", map: maplibregl.Map): void }>();

const el = ref<HTMLDivElement>();
const { map, mapReady, zoom, cursor, basemap } = useMap();
const key = useRuntimeConfig().public.maptilerKey;

onMounted(() => {
  mapReady.value = false;
  const m = new maplibregl.Map({
    container: el.value!,
    style: {
      version: 8,
      glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${key}`,
      sources: {
        basemap: { type: "raster", tiles: basemapTiles(basemap.value), tileSize: 256, maxzoom: 20, attribution: "© MapTiler © OpenStreetMap contributors" },
      },
      layers: [{ id: "basemap", type: "raster", source: "basemap" }],
    },
    center: props.center,
    zoom: props.zoom,
    attributionControl: false,
    maxPitch: 60,
    preserveDrawingBuffer: true,
  });
  map.value = markRaw(m);
  m.on("load", () => {
    mapReady.value = true;
    emit("ready", m);
  });
  m.on("zoom", () => (zoom.value = m.getZoom()));
  m.on("mousemove", (e) => (cursor.value = [e.lngLat.lng, e.lngLat.lat]));
  zoom.value = props.zoom;
});

onBeforeUnmount(() => {
  map.value?.remove();
  map.value = null;
  mapReady.value = false;
});
</script>

<template>
  <div class="absolute inset-0"><div ref="el" class="w-full h-full" /></div>
</template>
