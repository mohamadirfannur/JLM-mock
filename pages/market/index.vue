<script setup lang="ts">
import * as turf from "@turf/turf";
import { analyzeAoi, ANALYSIS_LAYERS, CLASS_COLORS, LEVEL_COLORS, POI_COLORS, ISP_COLORS } from "~/utils/marketAnalysis";
import { routeAlongRoads, metersBetween } from "~/utils/ftthEngine";
import { JLM_POPS } from "~/utils/jlmSites";
import type { AreaSel } from "~/stores/area";

definePageMeta({ layout: "app" });
useHead({ title: "Planning Market · JLM" });
const { boot, geo } = useBoot();
const { map, setData, addLayer, fitTo, removeSource } = useMap();
const layers = useLayers();
const draw = useDraw();
const store = useMarketStore();
const area = useAreaStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const leftOpen = ref(true);
const right = ref<"" | "analysis" | "summary" | "history" | "insight" | "routeRes">("analysis");
const tool = ref<string | null>(null);
const filterOpen = ref(false);
const filterRef = ref<any>(null);
const busy = ref(false);
const ready = ref(false);

async function onReady() {
  layers.reset();
  await boot();
  const d = geo.data;
  ready.value = true;
  setData("kel", d.kelurahan);
  setData("hex", d.hex);
  setData("bld", d.buildings);
  setData("poi", d.poi);
  setData("sample-aoi", d.aoi);
  setData("aoi-results", EMPTY_FC);
  setData("aoi-bld", EMPTY_FC);
  setData("mk-preview", EMPTY_FC);
  const lc = ["match", ["get", "level"], ...Object.entries(LEVEL_COLORS).flat(), "#eee"];
  addLayer({ id: "hex-fill", type: "fill", source: "hex", paint: { "fill-color": lc as any, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.55, 16.5, 0.12] } });
  addLayer({ id: "hex-line", type: "line", source: "hex", paint: { "line-color": "#ffffff", "line-width": 0.8 } });
  addLayer({ id: "bld-fill", type: "fill", source: "bld", minzoom: 14.5, paint: { "fill-color": ["case", ["==", ["get", "t"], "res"], ["match", ["get", "cls"], "A", CLASS_COLORS.A, "B", CLASS_COLORS.B, "C", CLASS_COLORS.C, CLASS_COLORS.D], "#B8C4C1"] as any, "fill-opacity": 0.7 } });
  addLayer({ id: "bld-isp", type: "fill", source: "bld", minzoom: 14.5, layout: { visibility: "none" }, paint: { "fill-color": ["match", ["get", "isp"], ...Object.entries(ISP_COLORS).flat(), "#ccc"] as any, "fill-opacity": 0.8 } });
  addLayer({ id: "kel-line", type: "line", source: "kel", paint: { "line-color": "#0E66C4", "line-width": 1.4, "line-dasharray": [3, 2], "line-opacity": 0.7 } });
  addLayer({ id: "kel-label", type: "symbol", source: "kel", maxzoom: 15, layout: { "text-field": ["upcase", ["get", "name"]], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-letter-spacing": 0.08 }, paint: { "text-color": "#0E66C4", "text-halo-color": "#fff", "text-halo-width": 2 } });
  addLayer({ id: "sample-line", type: "line", source: "sample-aoi", paint: { "line-color": "#00AACC", "line-width": 1.6, "line-dasharray": [1.5, 1.5] } });
  addLayer({ id: "sample-label", type: "symbol", source: "sample-aoi", minzoom: 14, layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 10 }, paint: { "text-color": "#00AACC", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  addLayer({ id: "poi", type: "circle", source: "poi", paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 17, 6], "circle-color": ["match", ["get", "cat"], ...Object.entries(POI_COLORS).flat(), "#999"] as any, "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } });
  addLayer({ id: "aoi-fill", type: "fill", source: "aoi-results", paint: { "fill-color": "#7B2FFF", "fill-opacity": ["case", ["get", "active"], 0.08, 0.03] } });
  addLayer({ id: "aoi-line", type: "line", source: "aoi-results", paint: { "line-color": ["case", ["get", "active"], "#7B2FFF", "#A78BFA"], "line-width": ["case", ["get", "active"], 3, 1.8] } });
  addLayer({ id: "aoi-bld", type: "line", source: "aoi-bld", paint: { "line-color": "#10201D", "line-width": 0.6, "line-opacity": 0.6 } });
  addLayer({ id: "aoi-label", type: "symbol", source: "aoi-results", layout: { "text-field": ["concat", ["get", "name"], "\n", ["get", "homes"], " rumah"], "text-font": ["Noto Sans Bold"], "text-size": 12 }, paint: { "text-color": "#7B2FFF", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  addLayer({ id: "mk-preview", type: "line", source: "mk-preview", paint: { "line-color": "#00D4FF", "line-width": 2.5 } });
  setData("mk-insight", EMPTY_FC);
  addLayer({ id: "mk-route", type: "line", source: "mk-insight", filter: ["==", "$type", "LineString"], layout: { "line-cap": "round" }, paint: { "line-color": "#7B2FFF", "line-width": 3, "line-opacity": 0.85 } });
  addLayer({ id: "mk-poi", type: "circle", source: "mk-insight", filter: ["==", "$type", "Point"], paint: { "circle-radius": ["case", ["==", ["get", "k"], "hub"], 7, 6], "circle-color": ["case", ["==", ["get", "k"], "hub"], "#00D4FF", ["coalesce", ["get", "color"], "#7B2FFF"]], "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

  const R = (id: string, label: string, group: string, color: string, kind: any, mapLayers: string[], cat: any, extra: any = {}) => layers.register({ id, label, group, color, kind, mapLayers, visible: true, cat, ...extra });
  R("aoi", "AOI dianalisis", "Analisis", "#7B2FFF", "line", ["aoi-fill", "aoi-line", "aoi-label", "aoi-bld"], "Area");
  R("hex", "Grid potensi pasar", "Analisis", LEVEL_COLORS.High, "fill", ["hex-fill", "hex-line"], "Area", { count: d.hex!.features.length, legend: Object.entries(LEVEL_COLORS).map(([label, color]) => ({ label, color })) });
  R("bld", "Footprint · kelas rumah", "Footprint", CLASS_COLORS.B, "fill", ["bld-fill"], "Pasif", { count: d.buildings!.features.length });
  R("bld-isp", "Footprint · kompetitor ISP", "Footprint", ISP_COLORS.IndiHome, "fill", ["bld-isp"], "Pasif", { visible: false });
  R("poi", "Point of Interest", "POI & Batas", POI_COLORS.Sekolah, "circle", ["poi"], "Aktif", { count: d.poi!.features.length });
  R("sample", "Batas RW / Cluster", "POI & Batas", "#00AACC", "line", ["sample-line", "sample-label"], "Area", { count: d.aoi!.features.length, dashed: true });
  R("kel", "Batas Kelurahan", "POI & Batas", "#0E66C4", "line", ["kel-line", "kel-label"], "Area", { count: d.kelurahan!.features.length, dashed: true });
  layers.toggle("bld-isp", false);

  const m = map.value!;
  m.on("click", (e) => {
    if (draw.active.value) return;
    if (tool.value === "select") return pickArea(e);
    const f = m.queryRenderedFeatures(e.point, { layers: ["poi", "bld-fill", "hex-fill"].filter((l) => m.getLayer(l)) })[0];
    if (!f) return (pop.value = null);
    const p: any = f.properties;
    const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    if (f.layer.id === "poi") pop.value = { coord: c, tag: p.cat, title: p.name, rows: [["Kategori", p.sub]] };
    else if (f.layer.id === "bld-fill") pop.value = { coord: c, tag: p.t === "res" ? `Kelas ${p.cls}` : "Non-residensial", title: p.t === "res" ? "Rumah tinggal" : "Bangunan komersial", rows: [["Luas", `${p.ar} m²`], ["Estimasi harga", p.pr ? `${fmt(+p.pr)} jt` : "-"], ["Daya listrik", p.va ? `${p.va} VA` : "-"], ["Carport", +p.cp ? "Ada" : "Tidak"], ["ISP saat ini", p.isp || "Belum ada"], ["Kelurahan", p.kel]] };
    else pop.value = { coord: c, tag: p.level, title: "Grid potensi", rows: [["Rumah", fmt(+p.homes)], ["Kompetitor", `${p.compPct}%`], ["Harga rata-rata", `${fmt(+p.avgPrice)} jt`]] };
  });
  refreshAoi();
  if (store.active) fitTo(turf.bbox(store.active.feature) as any, 120);
  else if (!area.chosen) filterOpen.value = true;
  else if (area.areas.length && !area.showAll) analyzeAreas(area.areas);
}
const pop = ref<{ coord: [number, number]; tag: string; title: string; rows: [string, any][] } | null>(null);

function refreshAoi() {
  setData("aoi-results", { type: "FeatureCollection", features: store.aois.map((a) => ({ ...a.feature, properties: { name: a.name, homes: fmt(a.result.homes), active: a.id === store.activeId } })) });
  setData("aoi-bld", store.active ? { type: "FeatureCollection", features: geo.buildingsIn(store.active.feature) } : EMPTY_FC);
}
watch(() => [store.activeId, store.aois.length], () => ready.value && refreshAoi());

// ---------- analysis ----------
const selLayers = ref<string[]>(["House Class", "House Price", "Carport", "Energy"]);
async function analyze(feature: any, name: string, source: any, quiet = false) {
  busy.value = true;
  await new Promise((r) => setTimeout(r, 450));
  const result = analyzeAoi(feature, geo.buildingsIn(feature), geo.poiIn(feature), geo.data.hex!.features, store.params);
  const ex = store.aois.find((a) => a.name === name);
  if (ex) store.remove(ex.id);
  store.add({ id: uid("aoi"), name, source, feature: { type: "Feature", properties: {}, geometry: feature.geometry }, layers: [...selLayers.value], result, createdAt: nowStr() });
  busy.value = false;
  right.value = "analysis";
  tool.value = null;
  setData("mk-preview", EMPTY_FC);
  if (!quiet) {
    fitTo(turf.bbox(feature) as any, 120);
    toast.add({ title: "Analisis selesai", description: `${fmt(result.homes)} rumah · ${fmt(result.homepass)} homepass potensial di ${name}`, icon: "i-lucide-circle-check-big", color: "green" });
  }
}
async function analyzeAreas(a: AreaSel[]) {
  for (const x of a) await analyze(x.feature, x.name, x.level === "Kelurahan" ? "Kelurahan" : x.level === "Custom" ? "Upload" : "Sample", true);
  if (a.length) {
    fitTo(turf.bbox(turf.featureCollection(a.map((x) => x.feature))) as any, 110);
    const tot = store.aois.filter((s) => a.some((x) => x.name === s.name)).reduce((t, s) => t + s.result.homes, 0);
    toast.add({ title: "Analisis area selesai", description: `${fmt(tot)} rumah di ${a.length} area terpilih`, icon: "i-lucide-circle-check-big", color: "green" });
  }
}
function applyArea(a: AreaSel[], all: boolean) {
  area.set(a, all);
  filterOpen.value = false;
  if (all && !a.length) return fitTo(EXTENT, 40);
  analyzeAreas(a);
}

// tools
const aoiName = ref("");
const drawn = ref<any>(null);
async function startDraw() {
  tool.value = "draw";
  drawn.value = null;
  const f = await draw.start("polygon");
  if (f) (drawn.value = f), setData("mk-preview", f);
}
const drawnHomes = computed(() => (drawn.value ? geo.buildingsIn(drawn.value).filter((b) => b.properties.t === "res").length : 0));
const upErr = ref("");
const uploaded = ref<any>(null);
async function onFile(e: Event) {
  upErr.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const poly = firstPolygon(await parseGeoFile(file));
    if (!poly) throw new Error("File tidak berisi polygon");
    uploaded.value = { name: poly.properties?.name || file.name.replace(/\.[^.]+$/, ""), feature: poly };
    setData("mk-preview", poly);
    fitTo(turf.bbox(poly) as any, 140);
  } catch (x: any) {
    upErr.value = x.message;
  }
}
const radius = ref(500);
const center = ref<[number, number] | null>(null);
async function pickCenter() {
  const f = await draw.start("point");
  if (!f) return;
  center.value = f.geometry.coordinates;
  setData("mk-preview", turf.circle(center.value!, radius.value, { units: "meters" }));
}
watch(radius, () => center.value && setData("mk-preview", turf.circle(center.value, radius.value, { units: "meters" })));
function pickArea(e: any) {
  const c = [e.lngLat.lng, e.lngLat.lat];
  const s = (geo.data.aoi?.features || []).find((a: any) => turf.booleanPointInPolygon(c, a));
  const k = (geo.data.kelurahan?.features || []).find((a: any) => turf.booleanPointInPolygon(c, a));
  const f = s || k;
  if (!f) return;
  analyze(f, s ? s.properties.name.replace(" – ", " · ") : `Kel. ${k.properties.name}`, s ? "Sample" : "Kelurahan");
}
const spec = reactive({ attr: "House Class", val: "A" });
const SPEC: Record<string, { key: string; values: any[] }> = { "House Class": { key: "cls", values: ["A", "B", "C", "D"] }, "Kompetitor ISP": { key: "isp", values: ["", "IndiHome", "MyRepublic", "Biznet", "First Media", "CBN"] }, "Daya listrik": { key: "va", values: [900, 1300, 2200, 3500, 5500] }, Carport: { key: "cp", values: [1, 0] } };
const specCount = computed(() => (geo.loaded.value ? (geo.data.buildings?.features || []).filter((f: any) => f.properties.t === "res" && String(f.properties[SPEC[spec.attr].key]) === String(spec.val)).length : 0));
watch(() => spec.attr, () => (spec.val = String(SPEC[spec.attr].values[0])));
function applySpec() {
  const o = SPEC[spec.attr];
  const v = o.key === "va" || o.key === "cp" ? Number(spec.val) : spec.val;
  map.value?.setFilter("bld-fill", ["all", ["==", ["get", "t"], "res"], ["==", ["get", o.key], v]] as any);
}
function resetSpec() {
  map.value?.setFilter("bld-fill", null);
}
const ranking = computed(() => {
  if (!geo.loaded.value) return [];
  const LV = ["Very Low", "Low", "Mid", "High", "Very High"];
  return (geo.data.aoi?.features || [])
    .map((a: any) => {
      const hx = (geo.data.hex?.features || []).filter((h: any) => turf.booleanIntersects(h, a));
      const avg = hx.length ? hx.reduce((s: number, h: any) => s + LV.indexOf(h.properties.level), 0) / hx.length : 0;
      const comp = hx.length ? Math.round(hx.reduce((s: number, h: any) => s + h.properties.compPct, 0) / hx.length) : 0;
      return { f: a, name: a.properties.name.replace(" – ", " · "), homes: a.properties.homes, level: LV[Math.round(avg)], comp, score: avg * 25 + a.properties.homes / 20 - comp / 4 };
    })
    .sort((a: any, b: any) => b.score - a.score);
});
const TOOLS = [
  { id: "draw", icon: "i-lucide-pentagon", tip: "Gambar AOI" },
  { id: "upload", icon: "i-lucide-upload", tip: "Upload AOI (KML/KMZ/SHP)" },
  { id: "buffer", icon: "i-lucide-circle-dashed", tip: "Buffer radius" },
  { id: "select", icon: "i-lucide-mouse-pointer-click", tip: "Pilih RW / Kelurahan di peta" },
  { id: "spec", icon: "i-lucide-sliders-horizontal", tip: "Filter atribut rumah" },
  { id: "rank", icon: "i-lucide-trophy", tip: "Ranking potensi area" },
  { id: "poi", icon: "i-lucide-map-pin", tip: "POI Insight" },
  { id: "route", icon: "i-lucide-route", tip: "Route Analysis" },
];
function openTool(id: string) {
  closeTool();
  if (id === "draw") return startDraw();
  tool.value = id;
}
function closeTool() {
  draw.cancel();
  if (tool.value === "spec") resetSpec();
  tool.value = null;
  drawn.value = null;
  uploaded.value = null;
  center.value = null;
  setData("mk-preview", EMPTY_FC);
}

// ---------- POI insight (surge: Insight Analysis → POI Insight) ----------
const pi = reactive({ src: "", cats: ["Sekolah", "Kesehatan", "Komersial", "Perkantoran"] as string[], name: "" });
const activeInsight = ref<any>(null);
function runPoi() {
  const aoi = store.aois.find((a) => a.id === (pi.src || store.activeId));
  if (!aoi) return toast.add({ title: "Pilih AOI dulu", description: "Hitung AOI terlebih dahulu (gambar / upload / pilih RW).", color: "orange" });
  const pois = geo.poiIn(aoi.feature).filter((f: any) => pi.cats.includes(f.properties.cat));
  const byCat: Record<string, number> = {};
  pois.forEach((f: any) => (byCat[f.properties.cat] = (byCat[f.properties.cat] || 0) + 1));
  const ins = { id: uid("poi"), name: pi.name || `POI Insight · ${aoi.name}`, aoi: aoi.name, aoiId: aoi.id, cats: [...pi.cats], total: pois.length, footprint: aoi.result.totalBuildings, byCat, pois: pois.map((f: any) => ({ name: f.properties.name, cat: f.properties.cat, sub: f.properties.sub, c: f.geometry.coordinates })), createdAt: nowStr(), routes: null as any };
  store.insights.unshift(ins);
  activeInsight.value = ins;
  showInsight(ins);
  right.value = "insight";
  tool.value = null;
}
function showInsight(ins: any) {
  setData("mk-insight", { type: "FeatureCollection", features: [...(ins.routes?.list || []).map((r: any) => turf.lineString(r.coords)), ...ins.pois.map((p: any) => turf.point(p.c, { color: POI_COLORS[p.cat] })), ...(ins.routes?.list || []).map((r: any) => turf.point(r.hubC, { k: "hub" }))] });
  const a = store.aois.find((x) => x.id === ins.aoiId);
  if (a) fitTo(turf.bbox(a.feature) as any, 120);
}
function exportInsight(ins: any, kind: string) {
  const base = ins.name.replace(/[^A-Za-z0-9]+/g, "_");
  if (kind === "xlsx") exportXLSX(`${base}.xlsx`, { POI: ins.pois.map((p: any) => ({ Nama: p.name, Kategori: p.cat, Jenis: p.sub, Lat: p.c[1], Lng: p.c[0] })), ...(ins.routes ? { Rute: ins.routes.list.map((r: any) => ({ POI: r.poi, Kategori: r.cat, "Titik jaringan": r.hub, "Jarak rute (m)": r.len })) } : {}) });
  else download(`${base}.kml`, toKML(ins.name, [{ name: "POI", color: "purple", features: ins.pois.map((p: any) => turf.point(p.c, { name: p.name, cat: p.cat })) }, ...(ins.routes ? [{ name: "Rute", color: "blue", features: ins.routes.list.map((r: any) => turf.lineString(r.coords, { name: `${r.poi} → ${r.hub}` })) }] : [])]), "application/vnd.google-earth.kml+xml");
}

// ---------- route analysis (surge: Route Analysis from POI insight) ----------
const ra = reactive({ ref: "", busy: false });
const asset = useAssetStore();
async function runRoutes() {
  const ins = store.insights.find((x) => x.id === ra.ref);
  if (!ins) return;
  ra.busy = true;
  await new Promise((r) => setTimeout(r, 50));
  const hubs = [...JLM_POPS.map((p) => ({ code: p.code, c: p.coord })), ...asset.sites.filter((x) => x.status === "Installed" && (x.type === "ODC" || x.type === "ODP")).map((x) => ({ code: x.code, c: x.coord }))];
  const list = ins.pois.slice(0, 30).map((p: any) => {
    const h = [...hubs].sort((a, b) => metersBetween(a.c, p.c) - metersBetween(b.c, p.c))[0];
    const roads = geo.roadsNear(turf.buffer(turf.lineString([p.c, h.c]), 300, { units: "meters" })!, 150);
    const r = routeAlongRoads(roads, p.c, h.c);
    return { poi: p.name, cat: p.cat, hub: h.code, hubC: h.c, len: Math.round(r.length), coords: r.coords };
  });
  const total = list.reduce((a: number, r: any) => a + r.len, 0);
  ins.routes = { list, total, avg: list.length ? Math.round(total / list.length) : 0, near: list.filter((r: any) => r.len <= 250).length, createdAt: nowStr() };
  activeInsight.value = ins;
  ra.busy = false;
  showInsight(ins);
  right.value = "routeRes";
  tool.value = null;
  toast.add({ title: "Route analysis selesai", description: `${list.length} rute · total ${fmt(total)} m ke jaringan JLM terdekat`, icon: "i-lucide-circle-check-big", color: "green" });
}

// ---------- stats ----------
const stat = computed(() => {
  const ids = store.aois.filter((a) => area.areas.some((x) => x.name === a.name) || a.id === store.activeId);
  const list = ids.length ? ids : store.active ? [store.active] : [];
  const s = (k: string) => list.reduce((t, a: any) => t + a.result[k], 0);
  return { n: list.length, homes: s("homes"), hp: s("homepass"), comp: list.length ? Math.round(list.reduce((t, a) => t + a.result.competitorPct, 0) / list.length) : 0, poi: s("poiTotal"), subs: s("estSubscribers") };
});

function exportAoi(id: string, kind: string) {
  const a = store.aois.find((x) => x.id === id);
  if (!a) return;
  const base = a.name.replace(/[^A-Za-z0-9]+/g, "_");
  const r = a.result;
  if (kind === "csv") {
    const rows: any[] = [];
    const push = (cat: string, o: Record<string, number>) => Object.entries(o).forEach(([k, v]) => rows.push({ kategori: cat, item: k, jumlah: v }));
    rows.push({ kategori: "Ringkasan", item: "Total rumah", jumlah: r.homes }, { kategori: "Ringkasan", item: "Homepass", jumlah: r.homepass });
    push("Kelas rumah", r.byClass);
    push("Harga", r.byPrice);
    push("Daya", r.energy);
    push("ISP", r.isp);
    push("Kelurahan", r.byKelurahan);
    download(`${base}_statistik.csv`, toCSV(rows), "text/csv");
  } else if (kind === "xlsx") exportXLSX(`${base}_rumah.xlsx`, { Rumah: geo.buildingsIn(a.feature).map((f) => ({ jenis: f.properties.t, kelas: f.properties.cls, luas_m2: f.properties.ar, harga_juta: f.properties.pr, daya_va: f.properties.va, isp: f.properties.isp, kelurahan: f.properties.kel, lat: f.properties.cy.toFixed(6), lng: f.properties.cx.toFixed(6) })) });
  else download(`${base}.kml`, toKML(a.name, [{ name: "AOI", color: "purple", features: [{ ...a.feature, properties: { name: a.name } }] }, { name: "Rumah", color: "blue", features: geo.buildingsIn(a.feature).map((f) => turf.point([f.properties.cx, f.properties.cy], { name: `${f.properties.t}-${f.properties.cls}` })) }]), "application/vnd.google-earth.kml+xml");
}
function zoomTo(f: any) {
  if (f.geometry.type === "Point") map.value?.flyTo({ center: f.geometry.coordinates, zoom: 17 });
  else fitTo(turf.bbox(f) as any, 120);
}
watch([leftOpen, right], () => nextTick(() => setTimeout(() => map.value?.resize(), 10)));
onBeforeUnmount(() => {
  closeTool();
  layers.reset();
});
const legend = computed(() => [
  ...Object.entries(LEVEL_COLORS).reverse().map(([l, c]) => ({ label: `Potensi ${l}`, color: c, kind: "square" })),
  { label: "Rumah kelas A / B / C / D", color: CLASS_COLORS.B, kind: "square" },
  { label: "Point of Interest", color: POI_COLORS.Sekolah, kind: "circle" },
  { label: "AOI dianalisis", color: "#7B2FFF", kind: "line" },
  { label: "Batas RW / Cluster", color: "#00AACC", kind: "line", dashed: true },
]);
</script>

<template>
  <div class="absolute inset-0 flex flex-col">
    <div class="h-12 bg-white border-b border-j-line flex items-center px-4 gap-4 shrink-0 z-20">
      <span class="j-tag-teal font-display font-bold !h-6">MARKET POTENTIAL</span>
      <button class="j-chip !h-7" @click="filterOpen = true"><UIcon name="i-lucide-filter" class="w-3.5 h-3.5" />{{ area.label }}</button>
      <div class="flex items-center gap-4 text-[13px] overflow-x-auto hide-scrollbar">
        <span class="whitespace-nowrap">Rumah <b class="text-j-blue">{{ fmt(stat.homes) }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="whitespace-nowrap">Homepass potensial <b class="text-j-blue">{{ fmt(stat.hp) }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="whitespace-nowrap">Kompetitor <b class="text-j-red">{{ stat.comp }}%</b></span><span class="w-px h-4 bg-j-line" />
        <span class="whitespace-nowrap">Est. pelanggan <b class="text-j-teal">{{ fmt(stat.subs) }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="whitespace-nowrap">POI <b>{{ fmt(stat.poi) }}</b></span>
      </div>
      <div class="flex-1" />
      <button class="j-btn-outline j-btn-sm font-sans font-medium" @click="openTool('upload')"><UIcon name="i-lucide-upload" class="w-3.5 h-3.5" />Upload AOI</button>
      <button class="j-btn-primary j-btn-sm" @click="openTool('draw')"><UIcon name="i-lucide-pentagon" class="w-3.5 h-3.5" />Gambar AOI</button>
    </div>

    <div class="flex-1 flex min-h-0 relative">
      <aside v-if="leftOpen" class="w-[272px] bg-white border-r border-j-line shrink-0 z-10"><JmapContent @close="leftOpen = false" /></aside>
      <div class="flex-1 relative min-w-0">
        <MapBaseMap :center="[107.695, -6.955]" :zoom="13.8" @ready="onReady" />
        <button v-if="!leftOpen" class="j-icon-btn absolute top-4 left-4 z-10" @click="leftOpen = true"><UIcon name="i-lucide-layers" class="w-5 h-5" /></button>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <div class="j-panel flex items-center gap-1 p-1.5">
            <UTooltip v-for="t in TOOLS" :key="t.id" :text="t.tip" :popper="{ placement: 'bottom' }">
              <button class="w-9 h-9 rounded-[8px] flex items-center justify-center" :class="tool === t.id ? 'bg-j-cyan text-white' : 'text-j-ink hover:bg-j-bg'" @click="tool === t.id ? closeTool() : openTool(t.id)"><UIcon :name="t.icon" class="w-[18px] h-[18px]" /></button>
            </UTooltip>
          </div>
          <span v-if="tool" class="h-7 px-3 rounded-full bg-j-cyan text-white text-[12px] font-display font-bold flex items-center shadow">{{ TOOLS.find((x) => x.id === tool)?.tip }}</span>
        </div>
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-3">
          <UTooltip text="Analisis area" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'analysis' && 'j-icon-btn-on'" @click="right = right === 'analysis' ? '' : 'analysis'"><UIcon name="i-lucide-chart-column" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Ringkasan wilayah (POI / AOI / Footprint)" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'summary' && 'j-icon-btn-on'" @click="right = right === 'summary' ? '' : 'summary'"><UIcon name="i-lucide-chart-pie" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Riwayat analisis" :popper="{ placement: 'left' }"><button class="j-icon-btn relative" :class="right === 'history' && 'j-icon-btn-on'" @click="right = right === 'history' ? '' : 'history'"><UIcon name="i-lucide-history" class="w-5 h-5" /><span v-if="store.aois.length" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-j-purple text-white text-[9px] font-bold flex items-center justify-center">{{ store.aois.length }}</span></button></UTooltip>
        </div>
        <div class="absolute bottom-10 right-4 z-10"><JmapControls :extent="EXTENT" /></div>
        <div class="absolute bottom-10 left-4 z-10"><JmapLegend title="Legenda Potensi" :items="legend" /></div>
        <div class="absolute bottom-2 right-4 z-10"><JmapCoords /></div>

        <!-- tool cards -->
        <div v-if="tool && tool !== 'select'" class="absolute top-[84px] left-1/2 -translate-x-1/2 z-20 j-panel w-[380px] p-4 fade-up">
          <template v-if="tool === 'draw'">
            <p class="j-title text-[14px]">Gambar AOI</p>
            <p class="text-[12px] text-j-sub mt-1">Klik untuk menambah titik batas, double-click / Enter untuk menutup polygon.</p>
            <input v-model="aoiName" class="j-input mt-3" placeholder="Nama area (mis. RW 05 Cisaranten Kidul)" />
            <div v-if="drawn" class="mt-3 rounded-[8px] bg-j-aqua/[0.1] p-3 text-[12px] text-j-teal">Preview: <b>{{ fmt(drawnHomes) }}</b> rumah · {{ m2(turf.area(drawn)) }}</div>
            <div v-else class="mt-3 rounded-[8px] bg-j-bg p-3 text-[12px] text-j-sub">{{ draw.active.value ? `Menggambar… ${draw.vertexCount.value} titik` : "Mulai gambar di peta" }}</div>
          </template>
          <template v-else-if="tool === 'upload'">
            <p class="j-title text-[14px]">Upload AOI</p>
            <label class="mt-3 block border-2 border-dashed border-j-line hover:border-j-cyan rounded-[10px] p-5 text-center cursor-pointer">
              <UIcon name="i-lucide-cloud-upload" class="w-8 h-8 text-j-cyan mx-auto mb-1" />
              <p class="font-display font-bold text-[13px]">{{ uploaded ? uploaded.name : "Pilih file batas area" }}</p>
              <p class="text-[11px] text-j-sub">KML · KMZ · GeoJSON · SHP (.zip)</p>
              <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip" @change="onFile" />
            </label>
            <p v-if="upErr" class="text-[12px] text-j-red mt-2">{{ upErr }}</p>
            <p v-if="uploaded" class="mt-2 text-[12px] text-j-teal">± {{ fmt(geo.buildingsIn(uploaded.feature).filter((b) => b.properties.t === "res").length) }} rumah · {{ m2(turf.area(uploaded.feature)) }}</p>
            <p class="text-[11px] text-j-sub mt-2">Contoh file: <a href="/samples/AOI_RW_07_Cipamokolan.kml" download class="text-j-blue underline">RW 07 Cipamokolan.kml</a></p>
          </template>
          <template v-else-if="tool === 'buffer'">
            <p class="j-title text-[14px]">Buffer Radius</p>
            <p class="text-[12px] text-j-sub mt-1">Hitung rumah di sekitar titik (mis. calon OLT / POP).</p>
            <button class="j-btn-outline w-full mt-3 font-sans font-medium" @click="pickCenter"><UIcon name="i-lucide-map-pin" class="w-4 h-4" />{{ center ? `${center[1].toFixed(5)}, ${center[0].toFixed(5)}` : "Pilih titik di peta" }}</button>
            <div class="flex justify-between text-[12px] mt-3"><span class="text-j-sub">Radius</span><b>{{ radius }} m</b></div>
            <input v-model.number="radius" type="range" min="100" max="1500" step="50" class="w-full accent-[#00D4FF]" />
          </template>
          <template v-else-if="tool === 'spec'">
            <p class="j-title text-[14px]">Filter Atribut Rumah</p>
            <div class="grid grid-cols-2 gap-2 mt-3">
              <select v-model="spec.attr" class="j-select"><option v-for="k in Object.keys(SPEC)" :key="k">{{ k }}</option></select>
              <select v-model="spec.val" class="j-select"><option v-for="v in SPEC[spec.attr].values" :key="v" :value="String(v)">{{ v === "" ? "Belum ada ISP" : spec.attr === "Carport" ? (v ? "Ada" : "Tidak") : v }}</option></select>
            </div>
            <p class="mt-3 text-[12px]"><b>{{ fmt(specCount) }}</b> rumah sesuai filter</p>
          </template>
          <template v-else-if="tool === 'poi'">
            <p class="j-title text-[14px]">POI Insight</p>
            <p class="text-[12px] text-j-sub mt-1">Analisis POI per kategori di dalam AOI yang sudah dihitung.</p>
            <label class="j-field-label mt-3">Apply analysis from (AOI)</label>
            <select v-model="pi.src" class="j-select"><option value="">{{ store.active ? `AOI aktif · ${store.active.name}` : "Pilih AOI" }}</option><option v-for="a in store.aois" :key="a.id" :value="a.id">{{ a.name }}</option></select>
            <label class="j-field-label mt-3">Kategori POI</label>
            <div class="flex flex-wrap gap-1.5"><button v-for="c in Object.keys(POI_COLORS)" :key="c" class="h-6 px-2 rounded-[4px] text-[11px] border flex items-center gap-1.5" :class="pi.cats.includes(c) ? 'border-j-cyan text-j-ink bg-j-cyan/[0.08]' : 'border-j-line text-j-sub'" @click="pi.cats = pi.cats.includes(c) ? pi.cats.filter((x) => x !== c) : [...pi.cats, c]"><span class="w-2 h-2 rounded-full" :style="{ background: POI_COLORS[c] }" />{{ c }}</button></div>
            <input v-model="pi.name" class="j-input mt-3" placeholder="Nama analisis (opsional)" />
          </template>
          <template v-else-if="tool === 'route'">
            <p class="j-title text-[14px]">Route Analysis</p>
            <p class="text-[12px] text-j-sub mt-1">Rute jalan dari setiap POI ke titik jaringan JLM terdekat (POP / ODC / ODP terpasang).</p>
            <label class="j-field-label mt-3">Reference POI Insight</label>
            <select v-model="ra.ref" class="j-select"><option value="">Pilih POI insight</option><option v-for="x in store.insights" :key="x.id" :value="x.id">{{ x.name }} · {{ x.total }} POI</option></select>
            <p v-if="!store.insights.length" class="text-[12px] text-j-amber mt-2">Jalankan POI Insight terlebih dahulu.</p>
          </template>
          <template v-else-if="tool === 'rank'">
            <p class="j-title text-[14px]">Ranking Potensi RW / Cluster</p>
            <p class="text-[12px] text-j-sub">Kombinasi grid potensi, jumlah rumah, dan penetrasi kompetitor.</p>
            <div class="mt-3 max-h-[320px] overflow-y-auto thin-scrollbar divide-y divide-j-line border border-j-line rounded-[8px]">
              <div v-for="(r, i) in ranking" :key="r.name" class="flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-j-bg">
                <span class="w-5 text-j-sub">{{ i + 1 }}</span>
                <button class="flex-1 text-left truncate" @click="zoomTo(r.f)">{{ r.name }}</button>
                <span class="text-j-sub">{{ fmt(r.homes) }}</span>
                <span class="j-tag !h-5" :style="{ background: LEVEL_COLORS[r.level] + '33', color: r.level === 'Very High' ? '#7B2FFF' : '#007F99' }">{{ r.level }}</span>
                <button class="j-btn-teal j-btn-sm !h-6 !px-2 !text-[11px]" @click="analyze(r.f, r.name, 'Sample')">Analisis</button>
              </div>
            </div>
          </template>
          <div v-if="!['rank', 'poi', 'route'].includes(tool)" class="flex flex-wrap gap-1.5 mt-3">
            <button v-for="l in ANALYSIS_LAYERS" :key="l" class="h-6 px-2 rounded-[4px] text-[11px] border" :class="selLayers.includes(l) ? 'border-j-cyan text-j-cyan bg-j-cyan/[0.08]' : 'border-j-line text-j-sub'" @click="selLayers = selLayers.includes(l) ? selLayers.filter((x) => x !== l) : [...selLayers, l]">{{ l }}</button>
          </div>
          <div class="grid grid-cols-2 gap-2 mt-4">
            <button class="j-btn-outline" @click="closeTool">Batal</button>
            <button v-if="tool === 'draw'" class="j-btn-primary" :disabled="!drawn || busy" @click="analyze(drawn, aoiName || `AOI ${store.aois.length + 1}`, 'Digitize')">{{ busy ? "Menghitung…" : "Hitung Rumah" }}</button>
            <button v-else-if="tool === 'upload'" class="j-btn-primary" :disabled="!uploaded || busy" @click="analyze(uploaded.feature, uploaded.name, 'Upload')">Hitung Rumah</button>
            <button v-else-if="tool === 'buffer'" class="j-btn-primary" :disabled="!center || busy" @click="analyze(turf.circle(center!, radius, { units: 'meters', steps: 64 }), `Radius ${radius} m`, 'Buffer')">Hitung Rumah</button>
            <button v-else-if="tool === 'spec'" class="j-btn-primary" @click="applySpec">Terapkan</button>
            <button v-else-if="tool === 'poi'" class="j-btn-primary" :disabled="!pi.cats.length || (!pi.src && !store.active)" @click="runPoi">Apply Analysis</button>
            <button v-else-if="tool === 'route'" class="j-btn-primary" :disabled="!ra.ref || ra.busy" @click="runRoutes">{{ ra.busy ? "Menghitung…" : "Apply Analysis" }}</button>
            <button v-else class="j-btn-primary" @click="closeTool">Tutup</button>
          </div>
        </div>
        <div v-if="tool === 'select'" class="absolute top-[84px] left-1/2 -translate-x-1/2 z-20 j-panel px-4 py-2.5 text-[13px] flex items-center gap-3">
          <UIcon name="i-lucide-mouse-pointer-click" class="w-4 h-4 text-j-cyan" />Klik batas RW / cluster atau kelurahan di peta
          <UIcon v-if="busy" name="i-lucide-loader-circle" class="w-4 h-4 animate-spin text-j-cyan" />
          <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="closeTool">Selesai</button>
        </div>
        <JmapFeatureCard v-if="pop" :coord="pop.coord">
          <div class="flex items-center justify-between"><span class="j-tag-cyan">{{ pop.tag }}</span><button class="text-j-sub" @click="pop = null"><UIcon name="i-lucide-x" class="w-4 h-4" /></button></div>
          <p class="font-display font-bold text-[15px] mt-2">{{ pop.title }}</p>
          <div class="mt-2 space-y-1.5"><div v-for="r in pop.rows" :key="r[0]" class="flex justify-between gap-3 text-[12px]"><span class="text-j-sub">{{ r[0] }}</span><b class="font-medium">{{ r[1] }}</b></div></div>
        </JmapFeatureCard>
      </div>

      <aside v-if="right" class="w-[380px] shrink-0 p-3 pl-0 z-10">
        <MarketAnalysisPanel v-if="right === 'analysis'" @close="right = ''" @zoom="zoomTo" @remove="store.remove" @export="exportAoi" />
        <MarketSummaryPanel v-else-if="right === 'summary'" @close="right = ''" @zoom="zoomTo" />
        <UiSidePanel v-else-if="right === 'insight' || right === 'routeRes'" :title="right === 'insight' ? 'POI Insight Analysis' : 'Route Insight Analysis'" :subtitle="activeInsight?.name" @close="(right = ''), setData('mk-insight', EMPTY_FC)">
          <template #actions>
            <UDropdown v-if="activeInsight" :items="[[{ label: 'Download Excel', icon: 'i-lucide-file-spreadsheet', click: () => exportInsight(activeInsight, 'xlsx') }, { label: 'Download KML', icon: 'i-lucide-map', click: () => exportInsight(activeInsight, 'kml') }]]"><button class="w-7 h-7 rounded-full border border-j-line flex items-center justify-center text-j-sub"><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /></button></UDropdown>
          </template>
          <div v-if="!activeInsight" class="text-center py-12 text-[12px] text-j-sub">Belum ada insight.</div>
          <div v-else-if="right === 'insight'" class="space-y-3">
            <div class="grid grid-cols-2 gap-2"><UiStat label="Total POI" :value="fmt(activeInsight.total)" /><UiStat label="Total Footprint" :value="fmt(activeInsight.footprint)" /></div>
            <div class="space-y-1.5">
              <div v-for="(v, k) in activeInsight.byCat" :key="k" class="flex items-center gap-2 text-[12px]"><span class="w-2 h-2 rounded-full" :style="{ background: POI_COLORS[k] }" /><span class="flex-1">{{ k }}</span><b>{{ v }}</b><div class="w-24 h-1.5 bg-j-soft rounded-full overflow-hidden"><div class="h-full rounded-full" :style="{ width: (v / Math.max(activeInsight.total, 1)) * 100 + '%', background: POI_COLORS[k] }" /></div></div>
            </div>
            <p class="j-label text-j-sub pt-2">POI Details</p>
            <div class="border border-j-line rounded-[10px] divide-y divide-j-line max-h-[320px] overflow-y-auto thin-scrollbar">
              <button v-for="(p, i) in activeInsight.pois" :key="i" class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-j-bg" @click="map?.flyTo({ center: p.c, zoom: 17.5 })"><span class="w-2 h-2 rounded-full shrink-0" :style="{ background: POI_COLORS[p.cat] }" /><span class="flex-1 text-[12px] truncate">{{ p.name }}</span><span class="text-[11px] text-j-sub shrink-0">{{ p.sub }}</span></button>
            </div>
            <button class="j-btn-teal w-full" @click="(ra.ref = activeInsight.id), openTool('route')"><UIcon name="i-lucide-route" class="w-4 h-4" />Route Analysis dari insight ini</button>
          </div>
          <div v-else-if="activeInsight.routes" class="space-y-3">
            <div class="grid grid-cols-2 gap-2"><UiStat label="Routes" :value="activeInsight.routes.list.length" /><UiStat label="Total kabel" :value="fmt(activeInsight.routes.total)" unit="m" /><UiStat label="Rata-rata jarak" :value="fmt(activeInsight.routes.avg)" unit="m" /><UiStat label="POI ≤ 250 m" :value="activeInsight.routes.near" /></div>
            <p class="j-label text-j-sub pt-2">Route Details</p>
            <div class="border border-j-line rounded-[10px] divide-y divide-j-line max-h-[360px] overflow-y-auto thin-scrollbar">
              <button v-for="(r, i) in activeInsight.routes.list" :key="i" class="w-full px-3 py-2 text-left hover:bg-j-bg" @click="fitTo(turf.bbox(turf.lineString(r.coords)) as any, 120)">
                <div class="flex justify-between gap-2 text-[12px]"><span class="truncate">{{ r.poi }}</span><b :class="r.len <= 250 ? 'text-j-teal' : r.len <= 1000 ? 'text-j-blue' : 'text-j-amber'">{{ fmt(r.len) }} m</b></div>
                <p class="text-[11px] text-j-sub">{{ r.cat }} → {{ r.hub }}</p>
              </button>
            </div>
          </div>
        </UiSidePanel>
        <UiSidePanel v-else title="Riwayat Analisis" subtitle="AOI & POI insight" @close="right = ''">
          <div v-if="store.insights.length" class="mb-4">
            <p class="j-label text-j-sub mb-2">POI Insight</p>
            <button v-for="x in store.insights" :key="x.id" class="w-full text-left border border-j-line rounded-[10px] p-3 mb-2 hover:border-j-cyan" @click="(activeInsight = x), showInsight(x), (right = x.routes ? 'routeRes' : 'insight')"><p class="font-display font-bold text-[13px] truncate">{{ x.name }}</p><p class="text-[11px] text-j-sub">{{ x.total }} POI{{ x.routes ? ` · ${x.routes.list.length} rute` : "" }} · {{ x.createdAt }}</p></button>
            <p class="j-label text-j-sub mb-2 mt-3">AOI</p>
          </div>
          <div v-if="!store.aois.length" class="text-center py-12 text-[12px] text-j-sub">Belum ada analisis.</div>
          <div class="space-y-2">
            <button v-for="a in store.aois" :key="a.id" class="w-full text-left border rounded-[10px] p-3 transition-colors" :class="a.id === store.activeId ? 'border-j-purple bg-j-purple/[0.04]' : 'border-j-line hover:border-j-cyan'" @click="(store.activeId = a.id), (right = 'analysis'), zoomTo(a.feature)">
              <div class="flex justify-between gap-2"><p class="font-display font-bold text-[13px] truncate">{{ a.name }}</p><span class="j-tag-purple shrink-0">{{ a.result.grade }}</span></div>
              <p class="text-[11px] text-j-sub">{{ a.source }} · {{ a.createdAt }}</p>
              <div class="grid grid-cols-3 gap-2 mt-2 text-center">
                <div class="bg-j-bg rounded-[6px] py-1.5"><p class="text-[13px] font-bold">{{ fmt(a.result.homes) }}</p><p class="text-[10px] text-j-sub">Rumah</p></div>
                <div class="bg-j-bg rounded-[6px] py-1.5"><p class="text-[13px] font-bold">{{ fmt(a.result.homepass) }}</p><p class="text-[10px] text-j-sub">Homepass</p></div>
                <div class="bg-j-bg rounded-[6px] py-1.5"><p class="text-[13px] font-bold">{{ a.result.competitorPct }}%</p><p class="text-[10px] text-j-sub">Kompetitor</p></div>
              </div>
            </button>
          </div>
        </UiSidePanel>
      </aside>
    </div>
    <JmapLocationFilter ref="filterRef" :open="filterOpen" context="Pilih RW / Cluster yang ingin dihitung potensi pasarnya" @close="filterOpen = false" @apply="applyArea" @preview="(a) => (setData('mk-preview', { type: 'FeatureCollection', features: a.map((x) => x.feature) }), (filterOpen = false), fitTo(turf.bbox(turf.featureCollection(a.map((x) => x.feature))) as any, 110))" @draw="(filterOpen = false), openTool('draw')" @coord="() => {}" />
  </div>
</template>
