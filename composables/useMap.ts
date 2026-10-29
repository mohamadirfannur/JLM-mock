import type { Map as MLMap, GeoJSONSource } from "maplibre-gl";

// One map instance per page. Kept outside Vue reactivity on purpose.
const mapRef = shallowRef<MLMap | null>(null);
const mapReady = ref(false);
const zoom = ref(12);
const cursor = ref<[number, number] | null>(null);

export type BasemapId = "hybrid" | "satellite" | "streets" | "light" | "topo";
export const BASEMAPS: { id: BasemapId; label: string; path: string; ext: string; thumb: string }[] = [
  { id: "hybrid", label: "Satellite Hybrid", path: "maps/hybrid", ext: "jpg", thumb: "#2b4a3a" },
  { id: "satellite", label: "Satellite", path: "maps/satellite", ext: "jpg", thumb: "#3d5a3d" },
  { id: "streets", label: "Streets", path: "maps/bright-v2", ext: "png", thumb: "#f2efe9" },
  { id: "light", label: "Light", path: "maps/streets-v2-light", ext: "png", thumb: "#f5f5f5" },
  { id: "topo", label: "Topo", path: "maps/topo-v2", ext: "png", thumb: "#e8eedd" },
];
const basemap = ref<BasemapId>("streets");

export function basemapTiles(id: BasemapId) {
  const key = useRuntimeConfig().public.maptilerKey;
  const b = BASEMAPS.find((x) => x.id === id)!;
  return [`https://api.maptiler.com/${b.path}/256/{z}/{x}/{y}.${b.ext}?key=${key}`];
}

export function useMap() {
  function setBasemap(id: BasemapId) {
    basemap.value = id;
    const m = mapRef.value;
    if (!m) return;
    const src = m.getSource("basemap") as any;
    if (src?.setTiles) src.setTiles(basemapTiles(id));
  }

  /** Add or replace a GeoJSON source. */
  function setData(id: string, data: any) {
    const m = mapRef.value;
    if (!m) return;
    const src = m.getSource(id) as GeoJSONSource | undefined;
    if (src) src.setData(data);
    else m.addSource(id, { type: "geojson", data });
  }

  function addLayer(layer: any, before?: string) {
    const m = mapRef.value;
    if (!m) return;
    if (m.getLayer(layer.id)) m.removeLayer(layer.id);
    m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
  }

  function removeLayers(ids: string[]) {
    const m = mapRef.value;
    if (!m) return;
    ids.forEach((id) => m.getLayer(id) && m.removeLayer(id));
  }

  function removeSource(id: string) {
    const m = mapRef.value;
    if (!m) return;
    const style = m.getStyle();
    style?.layers?.forEach((l: any) => l.source === id && m.removeLayer(l.id));
    if (m.getSource(id)) m.removeSource(id);
  }

  function setVisible(ids: string[], visible: boolean) {
    const m = mapRef.value;
    if (!m) return;
    ids.forEach((id) => m.getLayer(id) && m.setLayoutProperty(id, "visibility", visible ? "visible" : "none"));
  }

  function fitTo(bounds: [number, number, number, number], padding = 80, maxZoom = 17) {
    mapRef.value?.fitBounds(bounds, { padding, maxZoom, duration: 900 });
  }

  return { map: mapRef, mapReady, zoom, cursor, basemap, setBasemap, setData, addLayer, removeLayers, removeSource, setVisible, fitTo };
}

export const EMPTY_FC = { type: "FeatureCollection", features: [] } as any;
