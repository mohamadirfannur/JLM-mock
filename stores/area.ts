import { defineStore } from "pinia";
import * as turf from "@turf/turf";

export interface AreaSel {
  id: string;
  name: string;
  level: "RW / Cluster" | "Kelurahan" | "Kecamatan" | "Custom";
  feature: any;
}
const defs: Record<string, any> = {};

/** Working area chosen in "Filter Lokasi" — kept separately for each module. */
export function useAreaStore(mod?: string) {
  const id = mod || moduleOfPath(useRoute().path)?.id || "asset";
  defs[id] ||= makeStore(id);
  return defs[id]();
}

function makeStore(mod: string) {
  const KEY = `jlm-area-${mod}-v1`;
  return defineStore(`area-${mod}`, () => {
  const areas = ref<AreaSel[]>([]);
  const showAll = ref(false);
  const chosen = ref(false);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      areas.value = j.areas || [];
      showAll.value = !!j.showAll;
      chosen.value = true;
    }
  } catch {}
  function set(a: AreaSel[], all = false) {
    areas.value = a;
    showAll.value = all;
    chosen.value = true;
    try {
      localStorage.setItem(KEY, JSON.stringify({ areas: a, showAll: all }));
    } catch {}
  }
  const bbox = computed<[number, number, number, number] | null>(() => (areas.value.length ? (turf.bbox(turf.featureCollection(areas.value.map((a) => a.feature))) as any) : null));
  const label = computed(() => (showAll.value || !areas.value.length ? "Semua area" : areas.value.length === 1 ? areas.value[0].name : `${areas.value.length} area dipilih`));
  return { areas, showAll, chosen, set, bbox, label };
  });
}
