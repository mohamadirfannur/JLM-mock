<script setup lang="ts">
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
const props = defineProps<{ points: [number, number][]; lines?: [number, number][][]; origin?: [number, number] | null; dest?: [number, number] | null }>();
const el = ref<HTMLDivElement>();
let m: maplibregl.Map | null = null;
onMounted(() => {
  const key = useRuntimeConfig().public.maptilerKey;
  const all = [...props.points, ...(props.lines || []).flat(), ...(props.origin ? [props.origin] : []), ...(props.dest ? [props.dest] : [])];
  if (!all.length) return;
  const bb = turf.bbox(turf.multiPoint(all)) as [number, number, number, number];
  m = new maplibregl.Map({ container: el.value!, interactive: false, attributionControl: false, bounds: bb, fitBoundsOptions: { padding: 28, maxZoom: 16.5 }, style: { version: 8, sources: { b: { type: "raster", tiles: [`https://api.maptiler.com/maps/dataviz/256/{z}/{x}/{y}.png?key=${key}`], tileSize: 256 } }, layers: [{ id: "b", type: "raster", source: "b" }] } });
  m.on("load", () => {
    m!.addSource("l", { type: "geojson", data: turf.featureCollection((props.lines || []).map((c) => turf.lineString(c))) as any });
    m!.addLayer({ id: "l", type: "line", source: "l", paint: { "line-color": "#00D4FF", "line-width": 2.5 } });
    m!.addSource("p", { type: "geojson", data: turf.featureCollection(props.points.map((c) => turf.point(c))) as any });
    m!.addLayer({ id: "p", type: "circle", source: "p", paint: { "circle-radius": 2.5, "circle-color": "#00D4FF" } });
    const ends: any[] = [];
    if (props.origin) ends.push(turf.point(props.origin, { k: "o" }));
    if (props.dest) ends.push(turf.point(props.dest, { k: "d" }));
    m!.addSource("e", { type: "geojson", data: turf.featureCollection(ends) as any });
    m!.addLayer({ id: "e", type: "circle", source: "e", paint: { "circle-radius": 6, "circle-color": "#fff", "circle-stroke-width": 3.5, "circle-stroke-color": ["match", ["get", "k"], "o", "#00D4FF", "#7B2FFF"] } });
  });
});
onBeforeUnmount(() => m?.remove());
</script>
<template><div ref="el" class="w-full h-full" /></template>
