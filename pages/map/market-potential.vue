<script setup lang="ts">
import * as turf from "@turf/turf";
import maplibregl from "maplibre-gl";
import IcChart from "~/assets/icons/ic-chart.svg";
import IcDrawFree from "~/assets/icons/ic-draw-free.svg";
import IcDrawSquare from "~/assets/icons/ic-draw-square.svg";
import IcMapLayerB from "~/assets/icons/ic-map-layer-b.svg";
import IcIntersect from "~/assets/icons/ic-intersect.svg";
import IcConnection from "~/assets/icons/ic-connection.svg";
import IcCloud from "~/assets/icons/ic-cloud-upload.svg";
import IcInsight from "~/assets/icons/ic-insight.svg";
import IcInfo from "~/assets/icons/ic-info.svg";
import IcList from "~/assets/icons/ic-list-A.svg";
import IcMapLayer from "~/assets/icons/ic-map-layer.svg";
import IcBasemap from "~/assets/icons/ic-basemap.svg";
import IcPin from "~/assets/icons/ic-location-filter.svg";
import { analyzeAoi, ANALYSIS_LAYERS, CLASS_COLORS, LEVEL_COLORS, POI_COLORS, ISP_COLORS } from "~/utils/marketAnalysis";

useHead({ title: "Market Potential · JLM Map Planner" });

const geo = useGeoData();
const { map, setData, addLayer, fitTo, removeSource } = useMap();
const layers = useLayers();
const draw = useDraw();
const store = useMarketStore();
const handoff = useHandoffStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const showLayers = ref(false);
const showLegend = ref(false);
const right = ref<"" | "summary" | "analysis" | "list">("summary");
const tool = ref<string | null>(null);
const busy = ref(false);
const loadingData = ref(true);

// ---------------- map layers ----------------
async function onReady() {
  layers.reset();
  await geo.load();
  loadingData.value = false;
  const d = geo.data;
  setData("kel", d.kelurahan);
  setData("hex", d.hex);
  setData("bld", d.buildings);
  setData("poi", d.poi);
  setData("sample-aoi", d.aoi);
  setData("aoi-results", EMPTY_FC);
  setData("aoi-bld", EMPTY_FC);

  const levelColor = ["match", ["get", "level"], ...Object.entries(LEVEL_COLORS).flat(), "#ccc"];
  addLayer({ id: "hex-fill", type: "fill", source: "hex", paint: { "fill-color": levelColor as any, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 16, 0.15] } });
  addLayer({ id: "hex-line", type: "line", source: "hex", paint: { "line-color": "#ffffff", "line-width": 0.6, "line-opacity": 0.6 } });
  addLayer({
    id: "bld-fill",
    type: "fill",
    source: "bld",
    minzoom: 14,
    paint: { "fill-color": ["case", ["==", ["get", "t"], "res"], ["match", ["get", "cls"], "A", CLASS_COLORS.A, "B", CLASS_COLORS.B, "C", CLASS_COLORS.C, CLASS_COLORS.D], "#79797B"] as any, "fill-opacity": 0.75 },
  });
  addLayer({ id: "bld-isp", type: "fill", source: "bld", minzoom: 14, layout: { visibility: "none" }, paint: { "fill-color": ["match", ["get", "isp"], ...Object.entries(ISP_COLORS).flat(), "#ccc"] as any, "fill-opacity": 0.85 } });
  addLayer({ id: "kel-line", type: "line", source: "kel", paint: { "line-color": "#ffffff", "line-width": 2, "line-dasharray": [3, 2] } });
  addLayer({ id: "kel-label", type: "symbol", source: "kel", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 13 }, paint: { "text-color": "#fff", "text-halo-color": "#011641", "text-halo-width": 1.6 } });
  addLayer({ id: "sample-aoi-line", type: "line", source: "sample-aoi", paint: { "line-color": "#FDE68A", "line-width": 2, "line-dasharray": [1, 1.5] } });
  addLayer({ id: "sample-aoi-label", type: "symbol", source: "sample-aoi", minzoom: 14, layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11 }, paint: { "text-color": "#FDE68A", "text-halo-color": "#000", "text-halo-width": 1.2 } });
  addLayer({ id: "poi-circle", type: "circle", source: "poi", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7], "circle-color": ["match", ["get", "cat"], ...Object.entries(POI_COLORS).flat(), "#999"] as any, "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } });
  addLayer({ id: "aoi-res-fill", type: "fill", source: "aoi-results", paint: { "fill-color": "#3672F9", "fill-opacity": ["case", ["==", ["get", "active"], true], 0.12, 0.05] } });
  addLayer({ id: "aoi-res-line", type: "line", source: "aoi-results", paint: { "line-color": ["case", ["==", ["get", "active"], true], "#00D075", "#7CABFF"], "line-width": ["case", ["==", ["get", "active"], true], 3.5, 2] } });
  addLayer({ id: "aoi-bld-line", type: "line", source: "aoi-bld", paint: { "line-color": "#ffffff", "line-width": 1.2 } });
  addLayer({ id: "aoi-res-label", type: "symbol", source: "aoi-results", layout: { "text-field": ["concat", ["get", "name"], "\n", ["get", "homes"], " rumah"], "text-font": ["Noto Sans Bold"], "text-size": 12 }, paint: { "text-color": "#fff", "text-halo-color": "#0F47B3", "text-halo-width": 2 } });

  const G = "Market Potential";
  layers.register({ id: "hex", label: "Market Potential Grid", group: G, color: LEVEL_COLORS.High, kind: "fill", mapLayers: ["hex-fill", "hex-line"], visible: true, count: d.hex!.features.length, legend: Object.entries(LEVEL_COLORS).map(([label, color]) => ({ label, color })) });
  layers.register({ id: "aoi-res", label: "AOI Analysis", group: G, color: "#00D075", kind: "line", mapLayers: ["aoi-res-fill", "aoi-res-line", "aoi-res-label", "aoi-bld-line"], visible: true });
  layers.register({ id: "sample-aoi", label: "Sample AOI (RW / Cluster)", group: G, color: "#FDE68A", kind: "line", mapLayers: ["sample-aoi-line", "sample-aoi-label"], visible: true, count: d.aoi!.features.length });
  const F = "Footprint";
  layers.register({ id: "bld", label: "Building Footprint (House Class)", group: F, color: CLASS_COLORS.B, kind: "fill", mapLayers: ["bld-fill"], visible: true, count: d.buildings!.features.length, legend: [...Object.entries(CLASS_COLORS).filter(([k]) => k !== "-").map(([k, c]) => ({ label: "Kelas " + k, color: c })), { label: "Non-residensial", color: "#79797B" }] });
  layers.register({ id: "bld-isp", label: "Footprint by Competitor ISP", group: F, color: ISP_COLORS.IndiHome, kind: "fill", mapLayers: ["bld-isp"], visible: false, legend: Object.entries(ISP_COLORS).map(([k, c]) => ({ label: k || "Belum ada ISP", color: c })) });
  const P = "POI & Boundary";
  layers.register({ id: "poi", label: "Point of Interest", group: P, color: POI_COLORS.Sekolah, kind: "circle", mapLayers: ["poi-circle"], visible: true, count: d.poi!.features.length, legend: Object.entries(POI_COLORS).map(([label, color]) => ({ label, color })) });
  layers.register({ id: "kel", label: "Batas Kelurahan", group: P, color: "#ffffff", kind: "line", mapLayers: ["kel-line", "kel-label"], visible: true, count: d.kelurahan!.features.length });

  const m = map.value!;
  ["bld-fill", "poi-circle", "hex-fill"].forEach((id) => {
    m.on("mouseenter", id, () => !draw.active.value && (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", id, () => !draw.active.value && (m.getCanvas().style.cursor = ""));
  });
  m.on("click", (e) => {
    if (draw.active.value || tool.value === "select_location") return;
    const f = m.queryRenderedFeatures(e.point, { layers: ["poi-circle", "bld-fill", "hex-fill"].filter((l) => m.getLayer(l)) })[0];
    if (!f) return;
    const p: any = f.properties;
    let html = "";
    if (f.layer.id === "poi-circle") html = `<p class="text-xs font-semibold">${p.name}</p><p class="text-[11px] text-grey-600">${p.cat} · ${p.sub}</p>`;
    else if (f.layer.id === "bld-fill")
      html = `<p class="text-xs font-semibold">${p.t === "res" ? "Rumah Tinggal · Kelas " + p.cls : "Bangunan non-residensial"}</p><table class="text-[11px] mt-1">${[
        ["Luas", p.ar + " m²"],
        ["Harga est.", p.pr ? fmt(p.pr) + " jt" : "-"],
        ["Daya", p.va ? p.va + " VA" : "-"],
        ["Carport", p.cp === 1 || p.cp === "1" ? "Ada" : "Tidak"],
        ["ISP", p.isp || "Belum ada"],
        ["Kelurahan", p.kel],
      ]
        .map(([k, v]) => `<tr><td class="pr-3 text-grey-500">${k}</td><td>${v}</td></tr>`)
        .join("")}</table>`;
    else html = `<p class="text-xs font-semibold">Grid Potensi · ${p.level}</p><p class="text-[11px]">${p.homes} rumah · kompetitor ${p.compPct}%<br/>Harga rata-rata ${fmt(+p.avgPrice)} jt</p>`;
    new maplibregl.Popup({ closeButton: true, maxWidth: "260px" }).setLngLat(e.lngLat).setHTML(html).addTo(m);
  });
  refreshAoiLayer();
  if (handoff.ftthAoi) handoff.ftthAoi = null;
}

function refreshAoiLayer() {
  setData("aoi-results", { type: "FeatureCollection", features: store.aois.map((a) => ({ ...a.feature, properties: { id: a.id, name: a.name, homes: fmt(a.result.homes), active: a.id === store.activeId } })) });
  const act = store.active;
  setData("aoi-bld", act ? { type: "FeatureCollection", features: geo.buildingsIn(act.feature) } : EMPTY_FC);
}
watch(() => [store.activeId, store.aois.length], refreshAoiLayer);

// ---------------- analysis ----------------
const selectedLayers = ref<string[]>(["House Class", "House Price", "Carport", "Energy"]);
function toggleLayerSel(l: string) {
  selectedLayers.value = selectedLayers.value.includes(l) ? selectedLayers.value.filter((x) => x !== l) : [...selectedLayers.value, l];
}

async function runAnalysis(feature: any, name: string, source: any) {
  busy.value = true;
  await new Promise((r) => setTimeout(r, 650)); // simulate processing
  const blds = geo.buildingsIn(feature);
  const pois = geo.poiIn(feature);
  const result = analyzeAoi(feature, blds, pois, geo.data.hex!.features, store.params);
  store.add({ id: uid("aoi"), name, source, feature: { type: "Feature", properties: {}, geometry: feature.geometry }, layers: [...selectedLayers.value], result, createdAt: nowStr() });
  busy.value = false;
  right.value = "analysis";
  tool.value = null;
  fitTo(turf.bbox(feature) as any, 120);
  toast.add({ title: "Analysis complete", description: `${fmt(result.homes)} rumah terhitung di ${name}`, icon: "i-heroicons-check-circle", color: "green" });
}

// digitize
const digitizeName = ref("");
const drawnFeature = ref<any>(null);
async function startDigitize() {
  drawnFeature.value = null;
  const f = await draw.start("polygon");
  if (f) {
    drawnFeature.value = f;
    setData("draw-preview", f);
    addLayer({ id: "draw-preview-line", type: "line", source: "draw-preview", paint: { "line-color": "#00D075", "line-width": 2.5 } });
  }
}
function clearPreview() {
  drawnFeature.value = null;
  removeSource("draw-preview");
}
const previewCount = computed(() => (drawnFeature.value ? geo.buildingsIn(drawnFeature.value).filter((b) => b.properties.t === "res").length : 0));

// upload
const uploadErr = ref("");
const uploaded = ref<{ name: string; feature: any } | null>(null);
async function onFile(e: Event) {
  uploadErr.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const fc = await parseGeoFile(file);
    const poly = firstPolygon(fc);
    if (!poly) throw new Error("Tidak ditemukan polygon di file");
    uploaded.value = { name: poly.properties?.name || file.name.replace(/\.[^.]+$/, ""), feature: poly };
    setData("draw-preview", poly);
    addLayer({ id: "draw-preview-line", type: "line", source: "draw-preview", paint: { "line-color": "#00D075", "line-width": 2.5 } });
    fitTo(turf.bbox(poly) as any, 140);
  } catch (err: any) {
    uploadErr.value = err.message;
  }
}

// buffer
const bufferRadius = ref(500);
const bufferCenter = ref<[number, number] | null>(null);
async function pickBufferCenter() {
  const f = await draw.start("point");
  if (!f) return;
  bufferCenter.value = f.geometry.coordinates;
  const circle = turf.circle(bufferCenter.value!, bufferRadius.value, { units: "meters", steps: 64 });
  setData("draw-preview", circle);
  addLayer({ id: "draw-preview-line", type: "line", source: "draw-preview", paint: { "line-color": "#00D075", "line-width": 2.5 } });
}
watch(bufferRadius, () => bufferCenter.value && setData("draw-preview", turf.circle(bufferCenter.value, bufferRadius.value, { units: "meters", steps: 64 })));

// select by location (kelurahan / sample aoi)
let selHandler: any = null;
function startSelect() {
  const m = map.value!;
  m.getCanvas().style.cursor = "pointer";
  selHandler = (e: any) => {
    const f = m.queryRenderedFeatures(e.point, { layers: ["sample-aoi-line"] })[0];
    const sample = (geo.data.aoi?.features || []).find((a: any) => turf.booleanPointInPolygon([e.lngLat.lng, e.lngLat.lat], a));
    const kel = (geo.data.kelurahan?.features || []).find((k: any) => turf.booleanPointInPolygon([e.lngLat.lng, e.lngLat.lat], k));
    const pickF = sample || kel;
    void f;
    if (!pickF) return;
    stopSelect();
    runAnalysis(pickF, sample ? sample.properties.name : `Kel. ${kel.properties.name}`, sample ? "Sample" : "Kelurahan");
  };
  m.on("click", selHandler);
}
function stopSelect() {
  if (selHandler) map.value?.off("click", selHandler);
  selHandler = null;
  if (map.value) map.value.getCanvas().style.cursor = "";
}

// specific layer (attribute filter)
const specLayer = ref("House Class");
const specValue = ref("A");
const SPEC_OPTIONS: Record<string, { key: string; values: (string | number)[] }> = {
  "House Class": { key: "cls", values: ["A", "B", "C", "D"] },
  "Competitor ISP": { key: "isp", values: ["", "IndiHome", "MyRepublic", "Biznet", "First Media", "CBN"] },
  Energy: { key: "va", values: [900, 1300, 2200, 3500, 5500] },
  Carport: { key: "cp", values: [1, 0] },
};
const specCount = computed(() => {
  const o = SPEC_OPTIONS[specLayer.value];
  return (geo.data.buildings?.features || []).filter((f: any) => f.properties.t === "res" && String(f.properties[o.key]) === String(specValue.value)).length;
});
function applySpecific() {
  const o = SPEC_OPTIONS[specLayer.value];
  const val = o.key === "va" || o.key === "cp" ? Number(specValue.value) : specValue.value;
  map.value?.setFilter("bld-fill", ["all", ["==", ["get", "t"], "res"], ["==", ["get", o.key], val]] as any);
  toast.add({ title: "Filter applied", description: `${fmt(specCount.value)} rumah dengan ${specLayer.value} = ${specValue.value || "Belum ada ISP"}` });
}
function resetSpecific() {
  map.value?.setFilter("bld-fill", null);
}
watch(specLayer, () => (specValue.value = String(SPEC_OPTIONS[specLayer.value].values[0])));

// intersect AOI x kelurahan
const intersectRows = computed(() => {
  if (!store.active) return [];
  return Object.entries(store.active.result.byKelurahan).sort((a, b) => b[1] - a[1]);
});

// potential analysis ranking
const ranking = computed(() =>
  [...(geo.data.aoi?.features || [])]
    .map((a: any) => {
      const hexIn = (geo.data.hex?.features || []).filter((h: any) => turf.booleanIntersects(h, a));
      const lv = ["Very Low", "Low", "Mid", "High", "Very High"];
      const avg = hexIn.length ? hexIn.reduce((s: number, h: any) => s + lv.indexOf(h.properties.level), 0) / hexIn.length : 0;
      const comp = hexIn.length ? hexIn.reduce((s: number, h: any) => s + h.properties.compPct, 0) / hexIn.length : 0;
      return { f: a, name: a.properties.name, homes: a.properties.homes, level: lv[Math.round(avg)], comp: Math.round(comp) };
    })
    .sort((x, y) => ["Very Low", "Low", "Mid", "High", "Very High"].indexOf(y.level) - ["Very Low", "Low", "Mid", "High", "Very High"].indexOf(x.level) || y.homes - x.homes),
);

function openTool(id: string) {
  closeTool();
  if (id === "ftth_analysis") {
    if (!store.active) return toast.add({ title: "Belum ada AOI", description: "Jalankan Digitize / Upload AOI dulu, lalu kirim ke FTTH.", color: "orange" });
    return sendToFtth(store.active.id);
  }
  tool.value = id;
  if (id === "select_location") startSelect();
}
function closeTool() {
  draw.cancel();
  stopSelect();
  clearPreview();
  uploaded.value = null;
  bufferCenter.value = null;
  tool.value = null;
}

function sendToFtth(id: string) {
  const a = store.aois.find((x) => x.id === id);
  if (!a) return;
  handoff.ftthAoi = { name: a.name, feature: a.feature, homes: a.result.homepass };
  navigateTo("/map/ftth?from=market");
}

function zoomTo(f: any) {
  if (f.geometry.type === "Point") map.value?.flyTo({ center: f.geometry.coordinates, zoom: 17 });
  else fitTo(turf.bbox(f) as any, 120);
}

function exportAoi(id: string, kind: string) {
  const a = store.aois.find((x) => x.id === id);
  if (!a) return;
  const r = a.result;
  const base = a.name.replace(/[^A-Za-z0-9]+/g, "_");
  if (kind === "csv") {
    const rows: any[] = [];
    const push = (cat: string, o: Record<string, number>) => Object.entries(o).forEach(([k, v]) => rows.push({ kategori: cat, item: k, jumlah: v }));
    rows.push({ kategori: "Ringkasan", item: "Total rumah", jumlah: r.homes }, { kategori: "Ringkasan", item: "Homepass", jumlah: r.homepass }, { kategori: "Ringkasan", item: "Luas (m2)", jumlah: Math.round(r.area) });
    push("House Class", r.byClass);
    push("House Price", r.byPrice);
    push("Carport", r.carport);
    push("Energy", r.energy);
    push("Road Type", r.roadType);
    push("ISP", r.isp);
    push("Kelurahan", r.byKelurahan);
    download(`${base}_statistik.csv`, toCSV(rows), "text/csv");
  } else if (kind === "xlsx") {
    const b = geo.buildingsIn(a.feature).map((f) => ({ id: f.properties.id, jenis: f.properties.t, kelas: f.properties.cls, luas_m2: f.properties.ar, harga_juta: f.properties.pr, carport: f.properties.cp, daya_va: f.properties.va, jalan: f.properties.rd, isp: f.properties.isp, kelurahan: f.properties.kel, lat: f.properties.cy.toFixed(6), lng: f.properties.cx.toFixed(6) }));
    exportXLSX(`${base}_rumah.xlsx`, { Rumah: b });
  } else {
    const b = geo.buildingsIn(a.feature).map((f) => ({ type: "Feature", geometry: { type: "Point", coordinates: [f.properties.cx, f.properties.cy] }, properties: { name: `${f.properties.t}-${f.properties.cls}`, kelas: f.properties.cls, isp: f.properties.isp } }));
    download(`${base}.kml`, toKML(a.name, [{ name: "AOI", color: "green", features: [{ ...a.feature, properties: { name: a.name } }] }, { name: "Rumah", color: "blue", features: b }]), "application/vnd.google-earth.kml+xml");
  }
}

// BOQ quick estimate modal
const boqOpen = ref(false);
const COST_PER_HP = 1_650_000;

function onTop(key: string) {
  if (key === "layers") showLayers.value = !showLayers.value;
  if (key === "legend") showLegend.value = !showLegend.value;
}
onBeforeUnmount(() => {
  closeTool();
  layers.reset();
});
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <MapBaseMap :center="[107.695, -6.955]" :zoom="13.6" @ready="onReady" />
    <LayoutTopBar
      title="Market Potential Analysis Map"
      :toggles="[
        { key: 'layers', label: 'Layers', icon: IcMapLayer, active: showLayers },
        { key: 'legend', label: 'Legends', icon: IcBasemap, active: showLegend },
      ]"
      :actions="[
        { key: 'filter', label: 'Filter', icon: 'i-heroicons-funnel' },
        { key: 'boq', label: 'BOQ & BOM' },
      ]"
      @toggle="onTop"
      @action="(k) => (k === 'boq' ? (boqOpen = true) : (right = 'summary'))"
      @search="(c) => map?.flyTo({ center: c, zoom: 16 })"
    />

    <!-- left panels -->
    <div v-if="showLayers" class="absolute z-20 top-[5.5rem] left-6 bg-white w-[18.5rem] rounded-xs h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up">
      <MapLayerPanel @close="showLayers = false" />
    </div>
    <div v-if="showLegend" class="absolute z-20 top-[5.5rem] bg-white w-[15.5rem] rounded-xs max-h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up flex flex-col" :class="showLayers ? 'left-[20.5rem]' : 'left-6'">
      <MapLegendPanel @close="showLegend = false" />
    </div>

    <!-- right rail -->
    <div class="z-20 absolute top-[5.5rem] flex flex-col gap-2 transition-all duration-300" :class="right ? 'right-[32.5rem]' : 'right-6'">
      <MapControlButton tip="Summary Data" :active="right === 'summary'" @click="right = right === 'summary' ? '' : 'summary'"><IcInfo class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Analysis Result" :active="right === 'analysis'" @click="right = right === 'analysis' ? '' : 'analysis'"><IcChart class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="AOI Request List" :active="right === 'list'" :badge="store.aois.length || undefined" @click="right = right === 'list' ? '' : 'list'"><IcList class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Layer Management" :active="showLayers" @click="showLayers = !showLayers"><IcMapLayerB class="w-5 h-5" :font-controlled="false" /></MapControlButton>
    </div>
    <div v-if="right" class="z-20 absolute top-[5.5rem] right-6 h-[calc(100%-12rem)] flex">
      <MarketSummaryPanel v-if="right === 'summary'" @close="right = ''" @zoom="zoomTo" />
      <MarketAnalysisPanel v-else-if="right === 'analysis'" @close="right = ''" @zoom="zoomTo" @ftth="sendToFtth" @remove="store.remove" @export="exportAoi" />
      <UiSidePanel v-else title="AOI Request List" subtitle="Riwayat analisis AOI" @close="right = ''">
        <div v-if="!store.aois.length" class="text-center py-12 text-xs text-grey-500">Belum ada AOI yang dianalisis.</div>
        <div class="space-y-2">
          <div v-for="a in store.aois" :key="a.id" class="border rounded-xxs p-3 cursor-pointer hover:border-blue-500" :class="a.id === store.activeId ? 'border-blue-500 bg-blue-50' : 'border-grey-200'" @click="(store.activeId = a.id), (right = 'analysis'), zoomTo(a.feature)">
            <div class="flex justify-between items-start gap-2">
              <div class="min-w-0">
                <p class="text-xs font-semibold truncate">{{ a.name }}</p>
                <p class="text-[10px] text-grey-500">{{ a.source }} · {{ a.createdAt }}</p>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-xxs text-white shrink-0" :style="{ background: LEVEL_COLORS[a.result.grade] }">{{ a.result.grade }}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 mt-2 text-center">
              <div><p class="text-sm font-bold text-brand-500">{{ fmt(a.result.homes) }}</p><p class="text-[10px] text-grey-500">Rumah</p></div>
              <div><p class="text-sm font-bold text-brand-500">{{ fmt(a.result.homepass) }}</p><p class="text-[10px] text-grey-500">Homepass</p></div>
              <div><p class="text-sm font-bold text-brand-500">{{ a.result.competitorPct }}%</p><p class="text-[10px] text-grey-500">Kompetitor</p></div>
            </div>
          </div>
        </div>
      </UiSidePanel>
    </div>

    <!-- bottom toolbar -->
    <MapBottomToolbar>
      <MapToolDropdown
        label="Analytic Tools"
        :icon="IcChart"
        title="Analytic Tools"
        description="Geospatial Analytic Tools to draw Insights from the Map."
        :items="[
          { id: 'digitize', label: 'Digitize', icon: IcDrawFree },
          { id: 'upload', label: 'Upload AOI', icon: IcCloud, hint: 'KML/KMZ/SHP' },
          { id: 'buffer', label: 'Buffer Area', icon: IcDrawSquare },
          { id: 'specific', label: 'Specific Layer', icon: IcMapLayerB },
          { id: 'select_location', label: 'Select By Location', icon: IcPin },
        ]"
        @select="openTool"
      />
      <MapToolDropdown
        label="Geoprocessing"
        :icon="IcMapLayerB"
        title="Geoprocessing Tools"
        description="Geospatial tools to draw insights and add data from the map."
        :items="[
          { id: 'intersect', label: 'Intersect (AOI × Kelurahan)', icon: IcIntersect },
          { id: 'ftth_analysis', label: 'FTTH Analysis', icon: IcConnection, hint: 'Next step' },
        ]"
        @select="openTool"
      />
      <MapToolDropdown
        label="Insight Analysis"
        :icon="IcInsight"
        title="Potential Analysis"
        description="Insight Analysis to draw insights and add data from the map."
        :items="[{ id: 'potential', label: 'Potential Analysis', icon: IcChart }]"
        @select="openTool"
      />
    </MapBottomToolbar>

    <!-- tool cards -->
    <MapToolCard v-if="tool === 'digitize'" label="Digitize AOI" :icon="IcDrawFree" @close="closeTool">
      <div class="p-3 flex flex-col gap-2">
        <h3 class="text-grey-800 text-2xs">Hitung rumah dari area yang digambar</h3>
        <p class="text-2xs text-grey-400">Klik untuk menambah titik, double-click / Enter untuk menutup polygon. Pilih layer atribut yang ingin dianalisis.</p>
        <UInput v-model="digitizeName" size="xs" placeholder="Nama AOI (mis. RW 05 Cisaranten Kidul)" />
        <div class="flex gap-2 items-center">
          <UInput :model-value="drawnFeature ? 'Polygon ready' : draw.active.value ? `Drawing... (${draw.vertexCount.value} titik)` : ''" readonly size="xs" placeholder="Select On Map" class="flex-1" />
          <UButton size="xs" :color="draw.active.value ? 'green' : 'primary'" @click="draw.active.value ? draw.finishNow() : startDigitize()">{{ draw.active.value ? "Finish" : drawnFeature ? "Redraw" : "Draw Polygon" }}</UButton>
        </div>
        <div v-if="drawnFeature" class="bg-green-50 border border-green-200 rounded-xxs p-2 text-xs text-green-700 flex justify-between">
          <span>Preview: <b>{{ fmt(previewCount) }}</b> rumah · {{ area(turf.area(drawnFeature)) }}</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-for="l in ANALYSIS_LAYERS" :key="l" class="px-2 py-1 rounded-xxs text-[10px] border" :class="selectedLayers.includes(l) ? 'bg-brand-400/30 border-brand-600 text-brand-500 font-medium' : 'bg-white border-grey-500 text-brand-500'" @click="toggleLayerSel(l)">{{ l }}</button>
        </div>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" :disabled="!drawnFeature" @click="clearPreview">Reset</UButton>
        <UButton class="flex-1 justify-center" :disabled="!drawnFeature" :loading="busy" @click="runAnalysis(drawnFeature, digitizeName || `AOI Digitize ${store.aois.length + 1}`, 'Digitize')">Apply</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'upload'" label="Upload AOI" :icon="IcCloud" @close="closeTool">
      <div class="p-3 space-y-3">
        <label class="block border-2 border-dashed border-grey-300 hover:border-blue-500 rounded-xs p-6 text-center cursor-pointer">
          <UIcon name="i-heroicons-cloud-arrow-up" class="w-10 h-10 text-brand-500 mx-auto mb-2" />
          <p class="text-sm font-medium">{{ uploaded ? uploaded.name : "Upload AOI File" }}</p>
          <p class="text-xs text-grey-500">KML, KMZ, GeoJSON, atau Shapefile (.zip)</p>
          <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip" @change="onFile" />
        </label>
        <p v-if="uploadErr" class="text-xs text-red-500">{{ uploadErr }}</p>
        <div v-if="uploaded" class="bg-green-50 border border-green-200 rounded-xxs p-2 text-xs text-green-700">Polygon terbaca · ± {{ fmt(geo.buildingsIn(uploaded.feature).filter((b) => b.properties.t === "res").length) }} rumah · {{ area(turf.area(uploaded.feature)) }}</div>
        <p class="text-[11px] text-grey-500">
          Belum punya file? Coba contoh:
          <a href="/samples/AOI_RW_07_Cipamokolan.kml" download class="text-blue-600 underline">RW 07 Cipamokolan.kml</a> ·
          <a href="/samples/AOI_Cluster_Perumahan_A_Cisaranten_Endah.kml" download class="text-blue-600 underline">Cluster A.kml</a>
        </p>
        <div class="flex flex-wrap gap-2">
          <button v-for="l in ANALYSIS_LAYERS" :key="l" class="px-2 py-1 rounded-xxs text-[10px] border" :class="selectedLayers.includes(l) ? 'bg-brand-400/30 border-brand-600 text-brand-500 font-medium' : 'bg-white border-grey-500 text-brand-500'" @click="toggleLayerSel(l)">{{ l }}</button>
        </div>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton class="flex-1 justify-center" :disabled="!uploaded" :loading="busy" @click="runAnalysis(uploaded!.feature, uploaded!.name, 'Upload')">Apply</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'buffer'" label="Buffer Area" :icon="IcDrawSquare" @close="closeTool">
      <div class="p-3 space-y-3">
        <p class="text-2xs text-grey-500">Klik titik pusat (mis. lokasi OLT / POP), atur radius untuk menghitung rumah di sekitarnya.</p>
        <div class="flex items-center gap-2">
          <UInput :model-value="bufferCenter ? `${bufferCenter[1].toFixed(5)}, ${bufferCenter[0].toFixed(5)}` : ''" readonly size="xs" placeholder="Select On Map" class="flex-1" />
          <UButton size="xs" @click="pickBufferCenter">Pick Point</UButton>
        </div>
        <div>
          <div class="flex justify-between text-xs mb-1"><span>Radius</span><b>{{ bufferRadius }} m</b></div>
          <URange v-model="bufferRadius" :min="100" :max="1500" :step="50" size="sm" />
        </div>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton class="flex-1 justify-center" :disabled="!bufferCenter" :loading="busy" @click="runAnalysis(turf.circle(bufferCenter!, bufferRadius, { units: 'meters', steps: 64 }), `Buffer ${bufferRadius} m`, 'Buffer')">Apply</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'select_location'" label="Select By Location" :icon="IcPin" @close="closeTool">
      <div class="p-3 space-y-2 text-xs text-grey-600">
        <p>Klik <b class="text-yellow-600">Sample AOI (garis kuning)</b> atau area <b>Kelurahan</b> di peta untuk langsung menganalisis jumlah rumah di dalamnya.</p>
        <p v-if="busy" class="text-blue-600 flex items-center gap-2"><UIcon name="i-heroicons-arrow-path" class="animate-spin" /> Running analysis...</p>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'specific'" label="Specific Layer" :icon="IcMapLayerB" @close="(resetSpecific(), closeTool())">
      <div class="p-3 space-y-3">
        <UFormGroup label="Attribute" size="xs"><USelect v-model="specLayer" :options="Object.keys(SPEC_OPTIONS)" size="xs" /></UFormGroup>
        <UFormGroup label="Value" size="xs">
          <USelect v-model="specValue" :options="SPEC_OPTIONS[specLayer].values.map((v) => ({ label: v === '' ? 'Belum ada ISP' : specLayer === 'Carport' ? (v ? 'Ada' : 'Tidak ada') : String(v), value: String(v) }))" size="xs" />
        </UFormGroup>
        <div class="bg-brand-50 rounded-xxs p-2 text-xs">Total match: <b>{{ fmt(specCount) }}</b> rumah</div>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" @click="resetSpecific">Reset</UButton>
        <UButton class="flex-1 justify-center" @click="applySpecific">Apply</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'intersect'" label="Intersect Tool — AOI × Kelurahan" :icon="IcIntersect" @close="closeTool">
      <div class="p-3 space-y-2">
        <p v-if="!store.active" class="text-xs text-grey-500">Pilih / buat AOI terlebih dahulu.</p>
        <template v-else>
          <p class="text-xs">AOI aktif: <b>{{ store.active.name }}</b></p>
          <div class="border rounded-xxs divide-y text-xs">
            <div v-for="[k, v] in intersectRows" :key="k" class="flex justify-between p-2"><span>{{ k }}</span><b>{{ fmt(v) }} bangunan</b></div>
          </div>
        </template>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'potential'" label="Potential Analysis" :icon="IcInsight" width="w-[30rem]" @close="closeTool">
      <div class="p-3 space-y-2">
        <div class="grid grid-cols-3 gap-2">
          <USelect size="xs" :options="['Jawa Barat']" model-value="Jawa Barat" />
          <USelect size="xs" :options="['Kota Bandung']" model-value="Kota Bandung" />
          <USelect size="xs" :options="['Gedebage & Rancasari']" model-value="Gedebage & Rancasari" />
        </div>
        <p class="text-[11px] text-grey-500">Ranking cluster / RW berdasarkan grid potensi, jumlah rumah, dan penetrasi kompetitor.</p>
        <div class="border rounded-xxs divide-y">
          <div v-for="(r, i) in ranking" :key="r.name" class="flex items-center gap-2 p-2 text-xs hover:bg-grey-100">
            <span class="w-5 text-grey-500">{{ i + 1 }}</span>
            <span class="flex-1 truncate cursor-pointer" @click="zoomTo(r.f)">{{ r.name }}</span>
            <span class="text-grey-500">{{ fmt(r.homes) }} rmh</span>
            <span class="px-1.5 py-0.5 rounded-xxs text-[10px] text-white" :style="{ background: LEVEL_COLORS[r.level] }">{{ r.level }}</span>
            <UButton size="2xs" variant="soft" @click="runAnalysis(r.f, r.name, 'Sample')">Analyze</UButton>
          </div>
        </div>
      </div>
    </MapToolCard>

    <!-- BOQ quick estimate -->
    <UModal v-model="boqOpen">
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">BOQ & BOM — Quick Estimate</h3>
          <button @click="boqOpen = false"><UIcon name="i-heroicons-x-mark" class="w-5 h-5" /></button>
        </div>
        <p class="text-xs text-grey-600">Estimasi cepat biaya per homepass ({{ idr(COST_PER_HP) }}/HP, benchmark area perumahan). Untuk BOQ/BOM detail per item, lanjutkan ke FTTH Auto-Design.</p>
        <div v-if="!store.aois.length" class="text-xs text-grey-500 py-6 text-center">Belum ada AOI.</div>
        <div class="border rounded-xxs divide-y text-xs">
          <div v-for="a in store.aois" :key="a.id" class="flex items-center gap-2 p-2">
            <span class="flex-1 truncate">{{ a.name }}</span>
            <span class="text-grey-500">{{ fmt(a.result.homepass) }} HP</span>
            <b class="w-32 text-right">{{ idrShort(a.result.homepass * COST_PER_HP) }}</b>
            <UButton size="2xs" variant="soft" @click="(boqOpen = false), sendToFtth(a.id)">Detail →</UButton>
          </div>
        </div>
      </div>
    </UModal>

    <div v-if="loadingData" class="absolute inset-0 z-40 flex items-center justify-center bg-white/40 pointer-events-none">
      <div class="bg-white rounded-xs shadow-lg px-5 py-3 text-sm flex items-center gap-3"><UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5 text-blue-600" /> Loading market data...</div>
    </div>
    <MapControls :extent="EXTENT" />
    <MapCoordinatesPanel />
  </div>
</template>
