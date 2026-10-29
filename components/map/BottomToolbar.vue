<script setup lang="ts">
import * as turf from "@turf/turf";
import IcRuler from "~/assets/icons/ic-ruler.svg";
import IcRulerCorner from "~/assets/icons/ic-ruler-corner.svg";
import IcMapFlat from "~/assets/icons/ic-map-flat.svg";

const { basemap, setBasemap, setData, addLayer, removeSource } = useMap();
const draw = useDraw();
const measure = ref<null | "length" | "area">(null);
const result = ref("");

async function startMeasure(kind: "length" | "area") {
  measure.value = kind;
  result.value = "";
  removeSource("measure");
  const f = await draw.start(kind === "length" ? "line" : "polygon");
  if (!f) return;
  setData("measure", { type: "FeatureCollection", features: [f] });
  addLayer({ id: "measure-fill", type: "fill", source: "measure", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#F59E0B", "fill-opacity": 0.2 } });
  addLayer({ id: "measure-line", type: "line", source: "measure", paint: { "line-color": "#F59E0B", "line-width": 3 } });
  if (kind === "length") {
    const m = turf.length(f, { units: "meters" });
    result.value = m > 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
  } else {
    const a = turf.area(f);
    result.value = a > 1e6 ? `${(a / 1e6).toFixed(3)} km²` : `${a.toFixed(0)} m² (${(a / 10000).toFixed(2)} ha)`;
  }
}
function closeMeasure() {
  draw.cancel();
  removeSource("measure");
  measure.value = null;
}
</script>

<template>
  <div class="z-20 absolute bottom-8 left-1/2 -translate-x-1/2">
    <div class="flex items-center gap-2 bg-white ring-1 ring-grey-700 rounded-xs p-2 shadow-lg">
      <slot />
      <div class="border-l border-grey-700 h-8" />
      <MapToolDropdown
        label="Measurement"
        :icon="IcRuler"
        title="Measurement"
        description="Draw on Map and add to layer"
        :items="[
          { id: 'length', label: 'Length', icon: IcRuler },
          { id: 'area', label: 'Area', icon: IcRulerCorner },
        ]"
        @select="(id) => startMeasure(id as any)"
      />
      <MapToolDropdown label="Basemap" :icon="IcMapFlat" title="Basemap" description="Change basemap" width="w-72">
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="b in BASEMAPS"
            :key="b.id"
            class="flex flex-col items-center gap-1 p-1 rounded-xxs text-[10px]"
            :class="basemap === b.id ? 'ring-2 ring-blue-500 text-blue-600' : 'hover:bg-grey-100 text-grey-800'"
            @click="setBasemap(b.id)"
          >
            <span class="w-full h-10 rounded-xxs border border-grey-200" :style="{ background: b.thumb }" />
            {{ b.label }}
          </button>
        </div>
      </MapToolDropdown>
    </div>
  </div>
  <MapToolCard v-if="measure" :label="measure === 'length' ? 'Length Measurement Tool' : 'Area Measurement Tool'" :icon="measure === 'length' ? IcRuler : IcRulerCorner" @close="closeMeasure">
    <div class="p-3 space-y-2">
      <p class="text-2xs text-grey-500">Klik di peta untuk menambah titik, double-click / Enter untuk selesai.</p>
      <div class="bg-brand-50 rounded-xxs p-3 text-center">
        <p class="text-[11px] uppercase text-grey-600 font-semibold">{{ measure === "length" ? "Total Length" : "Total Area" }}</p>
        <p class="text-xl font-bold text-brand-500">{{ result || "—" }}</p>
      </div>
      <UButton block size="xs" @click="startMeasure(measure!)">Measure Again</UButton>
    </div>
  </MapToolCard>
</template>
