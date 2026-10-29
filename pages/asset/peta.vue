<script setup lang="ts">
import * as turf from "@turf/turf";
import * as XLSX from "xlsx";
import { SITE_COLORS, CABLE_COLORS, SITE_TYPES, SITE_LABEL } from "~/utils/jlmSites";
import { routeAlongRoads, polesAlong, metersBetween, routeOptions, PRICE } from "~/utils/ftthEngine";
import type { AreaSel } from "~/stores/area";

definePageMeta({ layout: "app" });
useHead({ title: "Peta Jaringan · Asset Management · JLM" });
const route = useRoute();
const { boot, geo } = useBoot();
const { map, setData, addLayer, fitTo, mapReady } = useMap();
const layers = useLayers();
const draw = useDraw();
const store = useAssetStore();
const area = useAreaStore();
const auth = useAuthStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const leftOpen = ref(true);
const right = ref<"" | "summary" | "detail" | "activity" | "add_site" | "add_cable" | "import" | "edit_attr" | "generate_pole" | "move" | "sites" | "routes" | "buffer" | "boq" | "split" | "reroute">("");
const showTable = ref(false);
const filterOpen = ref(false);
const selSite = ref<string | null>(null);
const selCable = ref<string | null>(null);
const card = ref<{ id: string; coord: [number, number] } | null>(null);
const assetModal = ref<{ siteId: string; assetId?: string } | null>(null);
const ready = ref(false);
const deleteMode = ref(false);
const confirmDel = ref<null | { kind: string; id: string; label: string }>(null);
const filterRef = ref<any>(null);

// ---------- area filter ----------
const inArea = computed(() => {
  if (area.showAll || !area.areas.length) return null;
  const polys = area.areas.map((a) => turf.buffer(a.feature, 60, { units: "meters" })!);
  return (c: [number, number]) => polys.some((p) => turf.booleanPointInPolygon(c, p));
});
const vSites = computed(() => (inArea.value ? store.sites.filter((s) => inArea.value!(s.coord) || s.type === "POP") : store.sites));
const vCables = computed(() => (inArea.value ? store.cables.filter((c) => c.coords.some((p) => inArea.value!(p as any))) : store.cables));

// ---------- stats ----------
const stat = computed(() => {
  const ids = new Set(vSites.value.map((s) => s.id));
  const a = store.assets.filter((x) => ids.has(x.siteId));
  return {
    odp: vSites.value.filter((s) => s.type === "ODP" && s.status !== "Planned").length,
    olt: a.filter((x) => x.type === "OLT").length,
    pole: vSites.value.filter((s) => s.type === "Pole").length,
    sw: a.filter((x) => x.type === "Switch" || x.type === "Mikrotik").length,
    backbone: vCables.value.filter((c) => c.type === "Backbone" || c.type === "Feeder").reduce((t, c) => t + c.length, 0) / 1000,
    ug: vCables.value.filter((c) => c.install === "Underground").length,
  };
});

// ---------- map data ----------
function sitesFC() {
  return { type: "FeatureCollection", features: vSites.value.map((s) => ({ type: "Feature", geometry: { type: "Point", coordinates: s.coord }, properties: { id: s.id, code: s.code, type: s.type, status: s.status, poleType: s.poleType || "" } })) };
}
function cablesFC() {
  return { type: "FeatureCollection", features: vCables.value.map((c) => ({ type: "Feature", geometry: { type: "LineString", coordinates: c.coords }, properties: { id: c.id, code: c.code, type: c.type, cores: c.cores, status: c.status, install: c.install } })) };
}
function clustersFC() {
  const g = new Map<string, [number, number][]>();
  vSites.value.forEach((s) => s.project && s.type !== "POP" && (g.get(s.project) || g.set(s.project, []).get(s.project)!).push(s.coord));
  const f: any[] = [];
  g.forEach((pts, name) => {
    if (pts.length < 3) return;
    const hull = turf.convex(turf.featureCollection(pts.map((p) => turf.point(p))));
    if (!hull) return;
    const b = turf.buffer(hull, 30, { units: "meters" })!;
    const planned = store.sites.filter((s) => s.project === name).every((s) => s.status === "Planned");
    f.push({ ...b, properties: { name: name.replace(" – ", " · ").toUpperCase(), planned } });
  });
  return { type: "FeatureCollection", features: f };
}
function areaFC() {
  return { type: "FeatureCollection", features: area.showAll ? [] : area.areas.map((a) => ({ ...a.feature, properties: { name: a.name } })) };
}
let t: any = null;
function refresh() {
  if (!ready.value) return;
  clearTimeout(t);
  t = setTimeout(() => {
    setData("as-sites", sitesFC());
    setData("as-cables", cablesFC());
    setData("as-clusters", clustersFC());
    setData("as-area", areaFC());
    SITE_TYPES.forEach((ty) => layers.setCount("site-" + ty, vSites.value.filter((s) => s.type === ty).length));
    Object.keys(CABLE_COLORS).forEach((ty) => layers.setCount("cable-" + ty, vCables.value.filter((c) => c.type === ty).length));
    layers.setCount("cable-ug", vCables.value.filter((c) => c.install === "Underground").length);
    highlight();
  }, 50);
}
watch(() => [store.sites, store.cables, store.assets, area.areas, area.showAll], refresh, { deep: true });
const preview = ref<any[]>([]);
function highlight() {
  const f: any[] = [];
  const s = selSite.value && store.siteById(selSite.value);
  if (s) f.push(turf.point(s.coord));
  const c = selCable.value && store.cables.find((x) => x.id === selCable.value);
  if (c) f.push(turf.lineString(c.coords));
  setData("as-sel", { type: "FeatureCollection", features: [...f, ...preview.value] });
}
watch([selSite, selCable, preview], highlight);

async function onReady() {
  layers.reset();
  await boot();
  const m = map.value!;
  addShapeImages(m);
  ready.value = true;
  ["as-sites", "as-cables", "as-clusters", "as-area", "as-sel"].forEach((id) => setData(id, EMPTY_FC));
  addLayer({ id: "as-area-fill", type: "fill", source: "as-area", paint: { "fill-color": "#00D4FF", "fill-opacity": 0.04 } });
  addLayer({ id: "as-area-line", type: "line", source: "as-area", paint: { "line-color": "#0E66C4", "line-width": 1.6, "line-dasharray": [3, 2] } });
  addLayer({ id: "as-cl-fill", type: "fill", source: "as-clusters", paint: { "fill-color": ["case", ["get", "planned"], "#7B2FFF", "#00D4FF"], "fill-opacity": 0.07 } });
  addLayer({ id: "as-cl-line", type: "line", source: "as-clusters", paint: { "line-color": ["case", ["get", "planned"], "#7B2FFF", "#00D4FF"], "line-width": 1.2, "line-dasharray": ["literal", [2, 2]] as any } });
  addLayer({ id: "as-cl-label", type: "symbol", source: "as-clusters", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 10, "text-letter-spacing": 0.03 }, paint: { "text-color": "#00AACC", "text-halo-color": "#ffffff", "text-halo-width": 2.5 } });
  addLayer({ id: "as-sel-fill", type: "fill", source: "as-sel", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#7B2FFF", "fill-opacity": 0.1 } });
  addLayer({ id: "as-sel-pline", type: "line", source: "as-sel", filter: ["==", "$type", "Polygon"], paint: { "line-color": "#7B2FFF", "line-width": 2, "line-dasharray": [2, 1.5] } });
  addLayer({ id: "as-sel-line", type: "line", source: "as-sel", filter: ["==", "$type", "LineString"], paint: { "line-color": ["case", ["==", ["get", "alt"], true], "#B8C4C1", "#00D4FF"], "line-width": ["case", ["==", ["get", "alt"], true], 4, 9], "line-opacity": ["case", ["==", ["get", "alt"], true], 0.9, 0.35] } });
  const cableColor = ["match", ["get", "type"], ...Object.entries(CABLE_COLORS).flat(), "#A78BFA"];
  const width = ["interpolate", ["linear"], ["get", "cores"], 12, 2, 96, 3.5, 288, 5];
  Object.keys(CABLE_COLORS).forEach((ty) => {
    addLayer({ id: `cable-${ty}`, type: "line", source: "as-cables", filter: ["all", ["==", ["get", "type"], ty], ["==", ["get", "install"], "Aerial"], ["!=", ["get", "status"], "Planned"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": cableColor, "line-width": width } });
    addLayer({ id: `cable-${ty}-plan`, type: "line", source: "as-cables", filter: ["all", ["==", ["get", "type"], ty], ["==", ["get", "status"], "Planned"], ["==", ["get", "install"], "Aerial"]], paint: { "line-color": cableColor, "line-width": 2.2, "line-dasharray": [2, 1.6], "line-opacity": 0.85 } });
  });
  addLayer({ id: "cable-ug", type: "line", source: "as-cables", filter: ["==", ["get", "install"], "Underground"], paint: { "line-color": "#F59E0B", "line-width": 3, "line-dasharray": [1.6, 1.2] } });
  const stroke = ["match", ["get", "status"], "Planned", "#FBBF24", "Maintenance", "#EF4444", "#ffffff"];
  addLayer({ id: "site-Customer", type: "symbol", source: "as-sites", minzoom: 15, filter: ["==", ["get", "type"], "Customer"], layout: { "icon-image": "square-slate", "icon-allow-overlap": true } });
  addLayer({ id: "site-Pole", type: "symbol", source: "as-sites", minzoom: 14.5, filter: ["==", ["get", "type"], "Pole"], layout: { "icon-image": ["case", ["==", ["get", "status"], "Planned"], "square-amber-plan", "square-amber"], "icon-allow-overlap": true, "icon-size": ["match", ["get", "poleType"], "T9 2-Stage", 1.2, "T7 2-Stage", 1, 0.85] } });
  ["ODP", "JC", "ODC", "Tower"].forEach((ty) =>
    addLayer({ id: `site-${ty}`, type: "circle", source: "as-sites", filter: ["==", ["get", "type"], ty], paint: { "circle-radius": ty === "ODC" ? 7 : ty === "ODP" ? ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 5.5] : 5, "circle-color": SITE_COLORS[ty], "circle-stroke-color": stroke as any, "circle-stroke-width": ["match", ["get", "status"], "Installed", 1.5, 2.5] } }),
  );
  addLayer({ id: "site-POP", type: "symbol", source: "as-sites", filter: ["==", ["get", "type"], "POP"], layout: { "icon-image": ["case", ["==", ["get", "status"], "Planned"], "diamond-cyan-plan", "diamond-cyan"], "icon-allow-overlap": true } });
  addLayer({ id: "site-label", type: "symbol", source: "as-sites", filter: ["in", ["get", "type"], ["literal", ["POP", "ODC", "ODP"]]], layout: { "text-field": ["get", "code"], "text-font": ["Noto Sans Bold"], "text-size": ["match", ["get", "type"], "POP", 11, 10], "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#00AACC", "text-halo-color": "#ffffff", "text-halo-width": 2.5, "text-opacity": ["step", ["zoom"], ["match", ["get", "type"], "POP", 1, 0], 15, ["match", ["get", "type"], "ODP", 0, 1], 16.5, 1] } });
  addLayer({ id: "as-sel-pt", type: "circle", source: "as-sel", filter: ["==", "$type", "Point"], paint: { "circle-radius": 13, "circle-color": "rgba(0,212,255,0.12)", "circle-stroke-color": "#00D4FF", "circle-stroke-width": 2 } });

  const G1 = "Site Points", G2 = "Kabel & Rute", G3 = "Area";
  const L = (id: string, label: string, group: string, color: string, kind: any, mapLayers: string[], cat: any, extra: any = {}) => layers.register({ id, label, group, color, kind, mapLayers, visible: true, cat, ...extra });
  L("site-Customer", "ONT / Pelanggan", G1, SITE_COLORS.Customer, "square", ["site-Customer"], "Pasif");
  L("site-ODP", "ODP", G1, SITE_COLORS.ODP, "circle", ["site-ODP"], "Pasif");
  L("site-POP", "OLT / POP", G1, SITE_COLORS.POP, "diamond", ["site-POP"], "Aktif");
  L("site-Pole", "POLE", G1, SITE_COLORS.Pole, "square", ["site-Pole"], "Pasif");
  L("site-ODC", "ODC", G1, SITE_COLORS.ODC, "circle", ["site-ODC"], "Pasif");
  L("site-JC", "OTB / SS / JC", G1, SITE_COLORS.JC, "circle", ["site-JC"], "Pasif");
  L("site-Tower", "Tower / Shelter", G1, SITE_COLORS.Tower, "circle", ["site-Tower"], "Aktif");
  L("cable-Backbone", "Backbone (96–288c)", G2, CABLE_COLORS.Backbone, "line", ["cable-Backbone", "cable-Backbone-plan"], "Rute");
  L("cable-Feeder", "Feeder (48–96c)", G2, CABLE_COLORS.Feeder, "line", ["cable-Feeder", "cable-Feeder-plan"], "Rute");
  L("cable-Sub Feeder", "Sub Feeder (24–48c)", G2, CABLE_COLORS["Sub Feeder"], "line", ["cable-Sub Feeder", "cable-Sub Feeder-plan"], "Rute");
  L("cable-Distribusi", "Distribusi (12–24c)", G2, CABLE_COLORS.Distribusi, "line", ["cable-Distribusi", "cable-Distribusi-plan"], "Rute");
  L("cable-ug", "Underground (review)", G2, "#F59E0B", "line", ["cable-ug"], "Rute", { dashed: true });
  L("clusters", "Cluster FTTH", G3, "#00D4FF", "fill", ["as-cl-fill", "as-cl-line", "as-cl-label"], "Area");
  L("site-label", "Label kode aset", G3, "#00AACC", "symbol", ["site-label"], "Area");
  L("area", "Area kerja (filter)", G3, "#0E66C4", "line", ["as-area-fill", "as-area-line"], "Area", { dashed: true });
  refresh();

  const clickable = () => [...SITE_TYPES.map((x) => `site-${x}`), ...Object.keys(CABLE_COLORS).flatMap((x) => [`cable-${x}`, `cable-${x}-plan`]), "cable-ug"].filter((l) => m.getLayer(l));
  m.on("mousemove", (e) => {
    if (draw.active.value || moving.value) return;
    const hit = m.queryRenderedFeatures([[e.point.x - 3, e.point.y - 3], [e.point.x + 3, e.point.y + 3]], { layers: clickable() }).length;
    m.getCanvas().style.cursor = hit ? "pointer" : picking.value ? "crosshair" : "";
  });
  m.on("click", (e) => {
    if (draw.active.value) return;
    if (moving.value) return onMoveClick(e);
    const f = m.queryRenderedFeatures([[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]], { layers: clickable() })[0];
    const kind = f ? (f.layer.id.startsWith("site-") ? "site" : "cable") : null;
    const id = f?.properties?.id as string | undefined;
    if (picking.value) {
      const p = picking.value;
      if (p.want === "point") (picking.value = null), p.resolve({ coord: [e.lngLat.lng, e.lngLat.lat] });
      else if (kind && (p.want === kind || p.want === "any")) (picking.value = null), p.resolve({ kind, id });
      return;
    }
    if (!kind || !id) {
      card.value = null;
      return;
    }
    if (deleteMode.value) return askDelete(kind, id);
    if (kind === "site") openCard(id);
    else select("cable", id);
  });

  // entry
  if (route.query.site) {
    const s = store.siteById(String(route.query.site));
    if (s) (m.jumpTo({ center: s.coord, zoom: 17.5 }), openCard(s.id));
  } else if (route.query.cable) {
    const c = store.cables.find((x) => x.id === route.query.cable);
    if (c) (fitTo(turf.bbox(turf.lineString(c.coords)) as any, 120), select("cable", c.id));
  } else if (route.query.project) {
    const ps = store.sites.filter((s) => s.project === route.query.project);
    if (ps.length) {
      area.set(area.areas, true);
      fitTo(turf.bbox(turf.featureCollection(ps.map((s) => turf.point(s.coord)))) as any, 120);
      const planned = ps.every((s) => s.status === "Planned");
      toast.add({ title: route.query.project as string, description: planned ? `${ps.length} aset rencana dari FTTH Auto-Design (garis putus-putus)` : `${ps.length} aset terpasang di cluster ini`, icon: "i-lucide-map-pinned" });
    }
  } else if (!area.chosen) filterOpen.value = true;
  else zoomArea();
  if (route.query.tool) openTool(String(route.query.tool));
}
function zoomArea() {
  if (area.bbox && !area.showAll) fitTo(area.bbox, 90);
  else {
    const all = store.sites.filter((s) => s.type === "POP" || s.type === "ODC");
    if (all.length) fitTo(turf.bbox(turf.featureCollection(all.map((s) => turf.point(s.coord)))) as any, 80, 16);
  }
}

// ---------- filter lokasi ----------
function applyArea(a: AreaSel[], all: boolean) {
  area.set(a, all);
  filterOpen.value = false;
  setData("as-preview", EMPTY_FC);
  nextTick(zoomArea);
  toast.add({ title: "Filter lokasi diterapkan", description: all ? "Menampilkan semua data jaringan" : `${a.map((x) => x.name).join(", ")}`, icon: "i-lucide-filter" });
}
function previewArea(a: AreaSel[]) {
  setData("as-preview", { type: "FeatureCollection", features: a.map((x) => x.feature) });
  if (!map.value?.getLayer("as-preview")) addLayer({ id: "as-preview", type: "line", source: "as-preview", paint: { "line-color": "#7B2FFF", "line-width": 2.5 } });
  filterOpen.value = false;
  fitTo(turf.bbox(turf.featureCollection(a.map((x) => x.feature))) as any, 100);
  toast.add({ title: "Pratinjau area", description: "Buka kembali Filter untuk menerapkan.", icon: "i-lucide-eye", actions: [{ label: "Terapkan", click: () => applyArea(a, false) }] });
}
async function filterDraw() {
  filterOpen.value = false;
  toast.add({ title: "Gambar batas area", description: "Klik titik batas di peta, double-click untuk selesai." });
  const f = await draw.start("polygon");
  if (f) filterRef.value?.addCustom(f, `Area manual ${area.areas.length + 1}`);
  filterOpen.value = true;
}
async function filterCoord() {
  const v = prompt("Masukkan koordinat (lat, long)", "-6.9551, 107.6952");
  if (!v) return;
  const [la, lo] = v.split(",").map((x) => parseFloat(x));
  if (isNaN(la) || isNaN(lo)) return;
  filterRef.value?.addCustom(turf.circle([lo, la], 500, { units: "meters" }), `Radius 500 m · ${la.toFixed(4)}, ${lo.toFixed(4)}`);
}

// ---------- selection / card ----------
function openCard(id: string) {
  const s = store.siteById(id);
  if (!s) return;
  selSite.value = id;
  selCable.value = null;
  card.value = { id, coord: s.coord };
}
function select(kind: "site" | "cable", id: string, zoom = false) {
  card.value = null;
  selSite.value = kind === "site" ? id : null;
  selCable.value = kind === "cable" ? id : null;
  right.value = "detail";
  if (zoom) {
    const s = kind === "site" ? store.siteById(id) : null;
    const c = kind === "cable" ? store.cables.find((x) => x.id === id) : null;
    if (s) map.value?.flyTo({ center: s.coord, zoom: 18 });
    if (c) fitTo(turf.bbox(turf.lineString(c.coords)) as any, 120);
  }
}
const cardSite = computed(() => (card.value ? store.siteById(card.value.id) : null));
const cardInfo = computed(() => {
  const s = cardSite.value;
  if (!s) return null;
  const as = store.assetsOf(s.id);
  const main = as.find((a) => a.ports?.length) || as[0];
  const used = main?.ports?.filter((p) => p.status === "Used").length || 0;
  const cap = main?.ports?.length || 0;
  const pop = store.sites.filter((x) => x.type === "POP").sort((a, b) => metersBetween(a.coord, s.coord) - metersBetween(b.coord, s.coord))[0];
  const cab = store.cables.find((c) => c.coords.some((p) => metersBetween(p as any, s.coord) < 2));
  const kel = (geo.data.kelurahan?.features || []).find((k: any) => turf.booleanPointInPolygon(s.coord, k))?.properties.name;
  return {
    status: s.status === "Installed" ? "AKTIF" : s.status === "Planned" ? "RENCANA" : "MAINTENANCE",
    tag: pop?.code.replace("POP", "OLT") || "-",
    addr: [s.project ? s.project.split(" – ")[0] : null, kel, "Kota Bandung"].filter(Boolean).join(", "),
    rows: [
      ["Tipe", SITE_LABEL[s.type] || s.type],
      ...(cap ? [["Kapasitas", `${cap} Port`], ["Terisi", `${used} / ${cap}`]] : []),
      ...(s.poleType ? [["Tipe tiang", s.poleType]] : []),
      ["Jarak ke OLT", pop ? `${fmt(metersBetween(pop.coord, s.coord))} m` : "-"],
      ["Kabel", cab ? `${cab.type} ${cab.cores}C · ${cab.install}` : "-"],
      ["Kondisi", s.status === "Maintenance" ? "Perlu cek" : "Baik"],
      ["Update terakhir", relTime(s.id)],
    ],
    util: cap ? Math.round((used / cap) * 100) : null,
  };
});

// ---------- picking ----------
const picking = ref<null | { want: "site" | "cable" | "any" | "point"; label: string; resolve: (v: any) => void }>(null);
const pick = (want: "site" | "cable" | "any" | "point", label: string): Promise<any> => new Promise((resolve) => (picking.value = { want, label, resolve }));

// ---------- move ----------
const moving = ref<{ siteId: string; coord?: [number, number] } | null>(null);
function startMove(id: string) {
  card.value = null;
  moving.value = { siteId: id };
  right.value = "move";
}
function onMoveClick(e: any) {
  moving.value!.coord = [e.lngLat.lng, e.lngLat.lat];
  preview.value = [turf.point(moving.value!.coord)];
}
function saveMove() {
  const mv = moving.value!;
  const s = store.siteById(mv.siteId)!;
  const old = s.coord;
  store.updateSite(mv.siteId, { coord: mv.coord });
  store.cables.forEach((c) => {
    if (metersBetween(c.coords[0] as any, old) < 1.5) c.coords[0] = mv.coord!;
    const l = c.coords.length - 1;
    if (metersBetween(c.coords[l] as any, old) < 1.5) c.coords[l] = mv.coord!;
  });
  toast.add({ title: "Posisi site point diperbarui", description: s.code, icon: "i-lucide-move" });
  moving.value = null;
  preview.value = [];
  right.value = "detail";
}

// ---------- delete ----------
function askDelete(kind: string, id: string) {
  const label = kind === "site" ? store.siteById(id)?.code : store.cables.find((c) => c.id === id)?.label;
  confirmDel.value = { kind, id, label: label || id };
}
function doDelete() {
  const c = confirmDel.value!;
  if (c.kind === "site") store.deleteSite(c.id);
  else store.deleteCable(c.id);
  if (selSite.value === c.id || selCable.value === c.id) (selSite.value = null), (selCable.value = null), (card.value = null);
  toast.add({ title: "Aset dihapus", description: c.label, icon: "i-lucide-trash-2", color: "red" });
  confirmDel.value = null;
}

// ---------- tambah sitepoint ----------
const sp = reactive({ cat: "Pasif" as "Pasif" | "Aktif", type: "ODP", poleType: "T7 1-Stage", code: "", rw: "", cluster: "", lng: "", lat: "", cap: 16, status: "Installed" as any, material: "", pic: "Team Asset JLM" });
const SP_CHIPS = computed(() => (sp.cat === "Pasif" ? [["ODP", "ODP"], ["JC", "OTB"], ["Pole:T7 1-Stage", "Pole 7m 1Stage"], ["Pole:T7 2-Stage", "Pole 7m 2Stage"], ["Pole:T9 2-Stage", "Pole 9m 2Stage"], ["ODC", "ODC"], ["Customer", "ONT"]] : [["POP", "OLT"], ["POP", "Switch / Mikrotik"], ["Tower", "Shelter / Rack"]]));
function chipSel(v: string) {
  const [t, p] = v.split(":");
  sp.type = t;
  if (p) sp.poleType = p;
  sp.cap = t === "ODP" ? 16 : t === "ODC" ? 48 : t === "POP" ? 16 : 0;
}
const codeHint = computed(() => {
  const n = store.sites.filter((s) => s.type === sp.type).length + 1;
  const pre: Record<string, string> = { ODP: `ODP-GDB-${(sp.rw || "RW01").replace(/\s/g, "")}-${String(n).padStart(3, "0")}`, ODC: `ODC-GDB-${String.fromCharCode(64 + (n % 26 || 1))}`, Pole: `TP-GDB-${String(n).padStart(4, "0")}`, JC: `JC-GDB-${String(n).padStart(2, "0")}`, POP: `POP-BDG-${String(n).padStart(2, "0")}`, Customer: `ONT-${String(n).padStart(4, "0")}`, Tower: `SHL-BDG-${String(n).padStart(2, "0")}` };
  return pre[sp.type] || "SITE-" + n;
});
async function pickSpCoord() {
  const r = await pick("point", "Klik peta untuk penempatan sitepoint");
  if (!r?.coord) return;
  sp.lng = r.coord[0].toFixed(6);
  sp.lat = r.coord[1].toFixed(6);
  preview.value = [turf.point(r.coord)];
  const kel = (geo.data.kelurahan?.features || []).find((k: any) => turf.booleanPointInPolygon(r.coord, k));
  if (kel && !sp.cluster) sp.cluster = kel.properties.name;
}
function saveSite() {
  const lat = parseFloat(sp.lat), lng = parseFloat(sp.lng);
  if (isNaN(lat) || isNaN(lng)) return toast.add({ title: "Tentukan lokasi sitepoint", description: "Klik peta atau isi koordinat manual.", color: "orange", icon: "i-lucide-map-pin" });
  const code = sp.code || codeHint.value;
  const s = store.addSite({ code, name: code, type: sp.type, owner: "JLM", status: sp.status, coord: [lng, lat], poleType: sp.type === "Pole" ? sp.poleType : undefined, address: [sp.rw, sp.cluster].filter(Boolean).join(" · ") || undefined });
  if (sp.type !== "Pole") {
    const typ = sp.type === "POP" ? "OLT" : sp.type === "Customer" ? "ONT" : sp.type === "Tower" ? "Rack Server" : sp.type;
    store.addAsset({ siteId: s.id, category: ["OLT", "Rack Server"].includes(typ) ? "Aktif" : "Pasif", type: typ, name: typ === "ODP" ? "ODP 16 Port Pole Mounted" : typ, code, installDate: new Date().toISOString().slice(0, 10), ports: sp.cap ? Array.from({ length: sp.cap }, (_, i) => ({ no: i + 1, status: "Idle" as const })) : undefined, description: sp.material || undefined, maintenanceBy: sp.pic });
  }
  preview.value = [];
  Object.assign(sp, { code: "", lng: "", lat: "", material: "" });
  toast.add({ title: "Sitepoint tersimpan", description: code, icon: "i-lucide-check-circle-2", color: "green" });
  openCard(s.id);
  right.value = "";
}

// ---------- tambah kabel ----------
const cb = reactive({ a: "", b: "", label: "", kls: "Feeder", cores: 48, ctype: "G.652D", install: "Aerial" as "Aerial" | "Underground" | "Kombinasi", status: "Installed" as any, coords: [] as [number, number][], length: 0, pulled: 0 });
const KLS: Record<string, { c: number[]; hint: string }> = { Feeder: { c: [48, 96], hint: "Feeder: 48–96c" }, Backbone: { c: [96, 144, 288], hint: "Backbone: 96–288c" }, "Sub Feeder": { c: [24, 48], hint: "Sub-feeder: 24–48c" }, Distribusi: { c: [12, 24], hint: "Distribusi: 12–24c" } };
watch(() => cb.kls, (k) => (cb.cores = KLS[k].c[0]));
async function pickEnd(w: "a" | "b") {
  const r = await pick("site", w === "a" ? "Klik titik A (ODP / ODC / OLT)" : "Klik titik B (ODP / ODC / OLT)");
  if (!r?.id) return;
  cb[w] = r.id;
  if (cb.a && cb.b) autoRoute();
}
function autoRoute() {
  const A = store.siteById(cb.a), B = store.siteById(cb.b);
  if (!A || !B) return;
  const r = routeAlongRoads(geo.roadsNear(turf.buffer(turf.lineString([A.coord, B.coord]), 250, { units: "meters" })!, 150), A.coord, B.coord);
  cb.coords = r.coords;
  cb.length = Math.round(r.length);
  cb.pulled = cb.length;
  preview.value = [turf.lineString(r.coords)];
}
async function drawCable() {
  const f = await draw.start("line");
  if (!f) return;
  const A = store.siteById(cb.a), B = store.siteById(cb.b);
  cb.coords = [...(A ? [A.coord] : []), ...f.geometry.coordinates, ...(B ? [B.coord] : [])];
  cb.length = Math.round(turf.length(turf.lineString(cb.coords), { units: "meters" }));
  cb.pulled = cb.length;
  preview.value = [turf.lineString(cb.coords)];
}
const cbLabel = computed(() => cb.label || `BDG-${cb.kls === "Distribusi" ? "D" : "F"}${4600 + store.cables.length}.${cb.cores}`);
const cbValid = computed(() => {
  const max = cb.kls === "Distribusi" ? 1000 : cb.kls === "Backbone" ? 500 * 8 : 350 * 10;
  return cb.length > 0 && cb.length <= max;
});
function saveCable() {
  if (cb.coords.length < 2) return toast.add({ title: "Rute kabel belum dibuat", description: "Pilih titik A & B atau gambar rute manual.", color: "orange" });
  const A = store.siteById(cb.a), B = store.siteById(cb.b);
  const c = store.addCable({ code: `CBL-${cb.kls[0]}-${String(store.cables.length + 1).padStart(3, "0")}`, label: `${cbLabel.value} (${cb.kls === "Distribusi" ? "Dist" : "Feed"} ${A?.code || "A"}-${B?.code || "B"}_${cb.length}M)`, type: cb.kls, cores: cb.cores, tubes: Math.max(1, Math.ceil(cb.cores / 12)), install: cb.install === "Kombinasi" ? "Underground" : cb.install, status: cb.status, coords: cb.coords, length: cb.length, from: A?.code, to: B?.code });
  Object.assign(cb, { a: "", b: "", label: "", coords: [], length: 0, pulled: 0 });
  preview.value = [];
  toast.add({ title: "Segmen kabel tersimpan", description: c.label, icon: "i-lucide-check-circle-2", color: "green" });
  select("cable", c.id);
}

// ---------- generate pole ----------
const pole = reactive({ cable: "", spacing: 60, type: "T7 1-Stage", pts: [] as [number, number][] });
async function pickPoleCable() {
  const r = await pick("cable", "Klik segmen kabel di peta");
  if (r?.id) (pole.cable = r.id), previewPoles();
}
function previewPoles() {
  const c = store.cables.find((x) => x.id === pole.cable);
  if (!c) return;
  if (c.type === "Feeder" || c.type === "Backbone") pole.type = "T7 2-Stage";
  pole.pts = polesAlong(c.coords as any, pole.spacing).filter((p) => !store.sites.some((s) => s.type === "Pole" && metersBetween(s.coord, p) < 8));
  preview.value = pole.pts.map((p) => turf.point(p));
}
watch(() => pole.spacing, previewPoles);
function genPoles() {
  const c = store.cables.find((x) => x.id === pole.cable)!;
  const base = store.sites.filter((s) => s.type === "Pole").length;
  pole.pts.forEach((p, i) => store.sites.push({ id: uid("sp"), code: `TP-GDB-${String(base + i + 1).padStart(4, "0")}`, name: "Tiang", type: "Pole", poleType: pole.type, owner: "JLM", status: c.status, coord: p, createdAt: nowStr(), updatedAt: nowStr() }));
  store.log("Create", c.code, `${pole.pts.length} tiang ${pole.type} digenerate sepanjang ${fmt(c.length)} m (jarak ${pole.spacing} m)`);
  toast.add({ title: `${pole.pts.length} tiang ditambahkan`, description: c.label, icon: "i-lucide-check-circle-2", color: "green" });
  pole.pts = [];
  preview.value = [];
}

// ---------- import ----------
const imp = reactive({ type: "ODP", msg: "", ok: true });
async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    let pts: { name: string; coord: [number, number] }[] = [];
    const lines: { name: string; coords: [number, number][] }[] = [];
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      pts = rows
        .map((r) => {
          const k = (...n: string[]) => Object.keys(r).find((x) => n.includes(x.toLowerCase().replace(/[^a-z]/g, "")));
          return { name: String(r[k("kode", "code", "nama", "name") || ""] || ""), coord: [parseFloat(r[k("lng", "lon", "longitude", "long") || ""]), parseFloat(r[k("lat", "latitude") || ""])] as [number, number] };
        })
        .filter((p) => !isNaN(p.coord[0]) && !isNaN(p.coord[1]));
    } else {
      const fc = await parseGeoFile(file);
      fc.features.forEach((f: any) => {
        if (f.geometry?.type === "Point") pts.push({ name: f.properties?.name || "", coord: f.geometry.coordinates.slice(0, 2) });
        if (f.geometry?.type === "LineString") lines.push({ name: f.properties?.name || "", coords: f.geometry.coordinates.map((c: number[]) => [c[0], c[1]]) });
      });
    }
    pts.forEach((p, i) => store.sites.push({ id: uid("sp"), code: p.name || `${imp.type}-IMP-${String(i + 1).padStart(3, "0")}`, name: p.name || imp.type, type: imp.type, owner: "JLM", status: "Installed", coord: p.coord, createdAt: nowStr(), updatedAt: nowStr() }));
    lines.forEach((l, i) => store.cables.push({ id: uid("cb"), code: `CBL-IMP-${i + 1}`, label: l.name || `Segmen import ${i + 1}`, type: "Distribusi", cores: 24, tubes: 2, install: "Aerial", status: "Installed", coords: l.coords, length: Math.round(turf.length(turf.lineString(l.coords), { units: "meters" })) }));
    store.log("Import", file.name, `${pts.length} titik (${imp.type}) dan ${lines.length} segmen kabel diimport`);
    imp.ok = true;
    imp.msg = `${pts.length} titik & ${lines.length} segmen kabel berhasil diimport dari ${file.name}`;
    const all = [...pts.map((p) => turf.point(p.coord)), ...lines.map((l) => turf.lineString(l.coords))];
    if (all.length) (area.set(area.areas, true), fitTo(turf.bbox(turf.featureCollection(all as any)) as any, 120));
  } catch (x: any) {
    imp.ok = false;
    imp.msg = x.message;
  }
}
const attrMsg = ref("");
async function onAttr(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const wb = XLSX.read(await file.arrayBuffer());
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  let n = 0;
  rows.forEach((r) => {
    const a = store.assets.find((x) => x.code === (r.Kode || r.Code));
    if (a) (store.updateAsset(a.id, { serial: r.Serial ?? a.serial, brand: r.Brand ?? a.brand, inspectedBy: r.Inspector ?? a.inspectedBy, description: r.Keterangan ?? a.description }), n++);
  });
  attrMsg.value = `${n} aset diperbarui dari ${rows.length} baris.`;
}

// ---------- site points list (surge: Site Points panel) ----------
const spType = ref("POP");
const spQ = ref("");
const spOpen = ref<string | null>(null);
const spList = computed(() => vSites.value.filter((x) => (spType.value === "Semua" ? x.type !== "Pole" : x.type === spType.value) && (x.code + x.name).toLowerCase().includes(spQ.value.toLowerCase())).slice(0, 60));
const connected = (id: string) => {
  const x = store.siteById(id);
  return x ? store.cables.filter((c) => metersBetween(c.coords[0] as any, x.coord) < 2 || metersBetween(c.coords[c.coords.length - 1] as any, x.coord) < 2) : [];
};
function previewSite(id: string) {
  const cabs = connected(id);
  preview.value = cabs.map((c) => turf.lineString(c.coords));
  selSite.value = id;
  if (cabs.length) fitTo(turf.bbox(turf.featureCollection(preview.value)) as any, 100);
  else map.value?.flyTo({ center: store.siteById(id)!.coord, zoom: 17 });
}
// find routes between two site points (R1 recommended, R2/R3 alternatives)
const fr = reactive({ from: "", to: "", opts: [] as { coords: [number, number][]; length: number; via: string }[], sel: 0, boq: null as null | { items: any[]; total: number } });
async function findRoutes(id: string) {
  Object.assign(fr, { from: id, to: "", opts: [], sel: 0, boq: null });
  right.value = "routes";
  const r = await pick("site", "Klik sitepoint tujuan untuk mencari rute");
  if (!r?.id) return;
  fr.to = r.id;
  const A = store.siteById(fr.from)!, B = store.siteById(fr.to)!;
  const roads = geo.roadsNear(turf.buffer(turf.lineString([A.coord, B.coord]), 500, { units: "meters" })!, 200);
  fr.opts = routeOptions(roads, A.coord, B.coord, 3) as any;
  showRoutes();
}
function showRoutes() {
  preview.value = [...fr.opts.map((o, i) => (i === fr.sel ? null : turf.lineString(o.coords, { alt: true }))).filter(Boolean), fr.opts[fr.sel] && turf.lineString(fr.opts[fr.sel].coords)].filter(Boolean) as any;
  fr.boq = null;
  if (fr.opts.length) fitTo(turf.bbox(turf.featureCollection(fr.opts.map((o) => turf.lineString(o.coords)))) as any, 90);
}
const boqLine = (len: number, cores = 48) => {
  const it = (code: string, q: number) => ({ code, item: PRICE[code].item, unit: PRICE[code].unit, qty: Math.round(q), price: PRICE[code].price, total: Math.round(q) * PRICE[code].price });
  const items = [it(`C${cores}`, len * 1.05 + Math.floor(len / 350) * 20), it("T72", Math.ceil(len / 60) + 1), it("JC", Math.max(1, Math.floor(len / 3500)) + 1), it("COIL", Math.floor(len / 350)), it("ACC", Math.ceil(len / 60) + 1), it("J_TARIK", len * 1.05), it("J_TANAM", Math.ceil(len / 60) + 1), it("J_SPLICE", cores * 2)];
  return { items, total: items.reduce((a, b) => a + b.total, 0) };
};
function routeBoq() {
  const o = fr.opts[fr.sel];
  if (o) fr.boq = boqLine(o.length, 48);
}
function saveRoute() {
  const o = fr.opts[fr.sel];
  const A = store.siteById(fr.from)!, B = store.siteById(fr.to)!;
  const c = store.addCable({ code: `CBL-R-${String(store.cables.length + 1).padStart(3, "0")}`, label: `BDG-F${4600 + store.cables.length}.48 (Feed ${A.code}-${B.code}_${Math.round(o.length)}M)`, type: "Feeder", cores: 48, tubes: 4, install: "Aerial", status: "Planned", coords: o.coords, length: Math.round(o.length), from: A.code, to: B.code });
  toast.add({ title: `Rute R${fr.sel + 1} disimpan sebagai kabel rencana`, description: c.label, icon: "i-lucide-check-circle-2", color: "green" });
  preview.value = [];
  select("cable", c.id);
}
function exportBoq(name: string, items: any[], total: number) {
  exportXLSX(`BOQ_${name.replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`, { BOQ: [...items.map((i) => ({ Item: i.item, Qty: i.qty, Satuan: i.unit, "Harga Satuan": i.price, Total: i.total })), { Item: "TOTAL", Qty: "", Satuan: "", "Harga Satuan": "", Total: total }] });
}

// ---------- buffer kabel ----------
const bf = reactive({ cable: "", dist: 50, res: null as any });
async function pickBuf() {
  const r = await pick("cable", "Klik segmen kabel untuk buffer");
  if (r?.id) (bf.cable = r.id), runBuffer();
}
function runBuffer() {
  const c = store.cables.find((x) => x.id === bf.cable);
  if (!c) return;
  const poly = turf.buffer(turf.lineString(c.coords), bf.dist, { units: "meters" })!;
  const b = geo.buildingsIn(poly);
  const sites = store.sites.filter((x) => turf.booleanPointInPolygon(x.coord, poly));
  const byT: Record<string, number> = {};
  sites.forEach((x) => (byT[x.type] = (byT[x.type] || 0) + 1));
  bf.res = { area: turf.area(poly), homes: b.filter((x) => x.properties.t === "res").length, com: b.filter((x) => x.properties.t !== "res").length, poi: geo.poiIn(poly).length, byT, len: c.length };
  preview.value = [poly, turf.lineString(c.coords)];
}
watch(() => bf.dist, () => bf.cable && runBuffer());

// ---------- BOQ & BOM polygon ----------
const bq = reactive({ poly: null as any, items: [] as any[], total: 0, counts: {} as Record<string, number> });
async function drawBoq() {
  bq.poly = null;
  bq.items = [];
  const f = await draw.start("polygon");
  if (!f) return;
  bq.poly = f;
  preview.value = [f];
  const inside = (c: any) => turf.booleanPointInPolygon(c, f);
  const sites = store.sites.filter((x) => inside(x.coord));
  const ids = new Set(sites.map((x) => x.id));
  const as = store.assets.filter((a) => ids.has(a.siteId));
  const q: Record<string, number> = {};
  const add = (k: string, n: number) => (q[k] = (q[k] || 0) + n);
  as.forEach((a) => {
    if (a.type === "ODP") add("ODP", 1);
    else if (a.type === "ODC") add(a.name.includes("48") ? "ODC48" : "ODC24", 1);
    else if (a.type === "OLT") add("OLT", 1);
    else if (a.type === "ONT") add("ONT", 1);
    else if (a.type === "JC") add("JC", 1);
  });
  sites.filter((x) => x.type === "Pole").forEach((x) => add(x.poleType === "T9 2-Stage" ? "T92" : x.poleType === "T7 2-Stage" ? "T72" : "T71", 1));
  let cabLen = 0;
  store.cables.forEach((c) => {
    const n = c.coords.filter((p) => inside(p)).length;
    if (!n) return;
    const len = (c.length * n) / c.coords.length;
    cabLen += len;
    const code = `C${[12, 24, 48, 96, 144, 288].find((x) => x >= c.cores) || 288}`;
    add(code, len * 1.05);
  });
  if (cabLen) add("J_TARIK", cabLen * 1.05);
  const poles = (q.T71 || 0) + (q.T72 || 0) + (q.T92 || 0);
  if (poles) add("J_TANAM", poles);
  if (q.ODP) add("J_ODP", q.ODP);
  bq.items = Object.entries(q).filter(([k]) => PRICE[k]).map(([k, v]) => ({ code: k, item: PRICE[k].item, unit: PRICE[k].unit, qty: Math.round(v), price: PRICE[k].price, total: Math.round(v) * PRICE[k].price }));
  bq.total = bq.items.reduce((a, b) => a + b.total, 0);
  bq.counts = { "Site points": sites.length, Aset: as.length, "Segmen kabel": store.cables.filter((c) => c.coords.some((p) => inside(p))).length, "Panjang kabel (m)": Math.round(cabLen) };
}

// ---------- split kabel ----------
const sc = reactive({ cable: "", idx: -1, at: "" });
async function pickSplit() {
  Object.assign(sc, { cable: "", idx: -1, at: "" });
  const r = await pick("cable", "Langkah 1 · klik segmen kabel");
  if (!r?.id) return;
  sc.cable = r.id;
  const c = store.cables.find((x) => x.id === r.id)!;
  preview.value = [turf.lineString(c.coords)];
  const r2 = await pick("any", "Langkah 2 · klik sitepoint (tiang / JC) sebagai titik split");
  const s2 = r2?.kind === "site" ? store.siteById(r2.id) : null;
  if (!s2) return;
  let best = -1, bd = Infinity;
  c.coords.forEach((p, i) => {
    if (i === 0 || i === c.coords.length - 1) return;
    const d = metersBetween(p as any, s2.coord);
    if (d < bd) (bd = d), (best = i);
  });
  if (best < 0 || bd > 60) return toast.add({ title: "Titik split terlalu jauh dari kabel", description: "Pilih sitepoint yang berada di jalur kabel.", color: "orange" });
  sc.idx = best;
  sc.at = s2.code;
  preview.value = [turf.lineString(c.coords.slice(0, best + 1)), turf.lineString(c.coords.slice(best), { alt: true }), turf.point(c.coords[best])];
}
function doSplit() {
  const c = store.cables.find((x) => x.id === sc.cable)!;
  const a = c.coords.slice(0, sc.idx + 1), b = c.coords.slice(sc.idx);
  const la = Math.round(turf.length(turf.lineString(a), { units: "meters" })), lb = Math.round(turf.length(turf.lineString(b), { units: "meters" }));
  const base = c.label.split(" (")[0];
  store.updateCable(c.id, { coords: a, length: la, code: c.code + "-A", label: `${base}A (${c.from || ""}-${sc.at}_${la}M)`, to: sc.at });
  store.addCable({ ...c, id: undefined as any, code: c.code + "-B", label: `${base}B (${sc.at}-${c.to || ""}_${lb}M)`, coords: b, length: lb, from: sc.at });
  toast.add({ title: "Kabel di-split", description: `${la} m + ${lb} m di ${sc.at}`, icon: "i-lucide-scissors", color: "green" });
  Object.assign(sc, { cable: "", idx: -1, at: "" });
  preview.value = [];
}

// ---------- edit rute kabel ----------
const rr = reactive({ cable: "", len: 0 });
async function pickReroute() {
  const r = await pick("cable", "Klik segmen kabel yang akan diubah rutenya");
  if (!r?.id) return;
  rr.cable = r.id;
  const c = store.cables.find((x) => x.id === r.id)!;
  preview.value = [turf.lineString(c.coords, { alt: true })];
  toast.add({ title: "Gambar jalur baru", description: "Ujung awal & akhir terkunci ke sitepoint. Double-click untuk selesai." });
  const f = await draw.start("line");
  if (!f) return;
  const coords = [c.coords[0], ...f.geometry.coordinates, c.coords[c.coords.length - 1]] as [number, number][];
  rr.len = Math.round(turf.length(turf.lineString(coords), { units: "meters" }));
  store.updateCable(c.id, { coords, length: rr.len });
  preview.value = [turf.lineString(coords)];
  toast.add({ title: "Rute kabel diperbarui", description: `${c.code} · ${fmt(c.length)} m → ${fmt(rr.len)} m`, icon: "i-lucide-check-circle-2", color: "green" });
}

// ---------- tools ----------
const TOOLS = [
  { id: "add_site", icon: "i-lucide-map-pin-plus", tip: "Tambah Sitepoint" },
  { id: "add_cable", icon: "i-lucide-spline", tip: "Tambah Kabel / Rute" },
  { id: "move", icon: "i-lucide-move", tip: "Pindah Sitepoint" },
  { id: "edit_attr", icon: "i-lucide-table-properties", tip: "Edit Atribut (Excel)" },
  { id: "generate_pole", icon: "i-lucide-git-commit-vertical", tip: "Generate Tiang" },
  { id: "reroute", icon: "i-lucide-pen-line", tip: "Edit Rute Kabel" },
  { id: "split", icon: "i-lucide-scissors", tip: "Split Kabel" },
  { id: "core", icon: "i-lucide-cpu", tip: "Core Config" },
  { id: "buffer", icon: "i-lucide-circle-dashed", tip: "Buffer Kabel" },
  { id: "boq", icon: "i-lucide-calculator", tip: "BOQ & BOM Polygon" },
  { id: "import", icon: "i-lucide-upload", tip: "Import KML / Excel / GIS" },
  { id: "delete", icon: "i-lucide-trash-2", tip: "Hapus Aset" },
];
const TOOL_PANELS = ["add_site", "add_cable", "move", "edit_attr", "generate_pole", "import", "buffer", "boq", "split", "reroute"];
const activeTool = computed(() => (deleteMode.value ? "delete" : TOOL_PANELS.includes(right.value) ? right.value : ""));
async function openTool(id: string) {
  cancelTool();
  if (id === "delete") {
    deleteMode.value = true;
    return;
  }
  if (id === "core") {
    const r = await pick("cable", "Klik segmen kabel untuk konfigurasi core");
    if (r?.id) select("cable", r.id);
    return;
  }
  if (id === "split") return (right.value = "split"), pickSplit();
  if (id === "reroute") return (right.value = "reroute"), pickReroute();
  if (id === "boq") return (right.value = "boq"), drawBoq();
  if (id === "buffer") return (right.value = "buffer"), pickBuf();
  if (id === "move") {
    const r = await pick("site", "Klik sitepoint yang akan dipindah");
    if (r?.id) (selSite.value = r.id), startMove(r.id);
    return;
  }
  right.value = id as any;
}
function cancelTool() {
  draw.cancel();
  picking.value = null;
  preview.value = [];
  moving.value = null;
  deleteMode.value = false;
  if (TOOL_PANELS.includes(right.value) || right.value === "routes") right.value = "";
}
watch([leftOpen, right], () => nextTick(() => setTimeout(() => map.value?.resize(), 10)));
onBeforeUnmount(() => {
  cancelTool();
  layers.reset();
});
const legend = [
  { label: "Backbone (96–288c) · Aerial", color: CABLE_COLORS.Backbone, kind: "line" },
  { label: "Feeder (48–96c) · Aerial", color: CABLE_COLORS.Feeder, kind: "line" },
  { label: "Distribusi (12–24c)", color: CABLE_COLORS.Distribusi, kind: "line" },
  { label: "Underground (review)", color: "#F59E0B", kind: "line", dashed: true },
  { label: "Planned (belum bangun)", color: "#B8C4C1", kind: "line", dashed: true },
  { label: "OLT (dual-class, aktif)", color: "#00D4FF", kind: "diamond" },
  { label: "ODP (pasif, max 16 port)", color: "#00D4FF", kind: "circle" },
  { label: "POLE (7m 1s / 2s backbone)", color: "#F59E0B", kind: "square" },
  { label: "ODC / OTB / JC", color: "#7B2FFF", kind: "circle" },
];
const sitesForPick = computed(() => store.sites.filter((s) => s.type !== "Pole"));
</script>

<template>
  <div class="absolute inset-0 flex flex-col">
    <!-- stats bar -->
    <div class="h-12 bg-white border-b border-j-line flex items-center px-4 gap-4 shrink-0 z-20">
      <button class="j-chip !h-7" :title="'Filter lokasi'" @click="filterOpen = true"><UIcon name="i-lucide-filter" class="w-3.5 h-3.5" />{{ area.label }}</button>
      <div class="flex items-center gap-4 text-[13px] overflow-x-auto hide-scrollbar">
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-j-cyan" />ODP Aktif <b class="text-j-blue">{{ fmt(stat.odp) }}</b></span>
        <span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 rotate-45 bg-j-cyan" />OLT <b class="text-j-blue">{{ stat.olt }}</b></span>
        <span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 bg-j-amber" />POLE <b class="text-j-amber">{{ fmt(stat.pole) }}</b></span>
        <span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-j-purple" />Switch/Mikrotik <b class="text-j-purple">{{ stat.sw }}</b></span>
        <span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-3 h-0.5 bg-j-cyan" />Backbone/Feeder <b>{{ fmt(stat.backbone, 1) }} km</b></span>
        <span v-if="stat.ug" class="j-tag-amber whitespace-nowrap">Underground: {{ stat.ug }} segmen · review manual</span>
      </div>
      <div class="flex-1" />
      <button class="j-btn-outline j-btn-sm font-sans font-medium" @click="openTool('import')"><UIcon name="i-lucide-upload" class="w-3.5 h-3.5" />Import GIS</button>
      <button class="j-btn-primary j-btn-sm" @click="openTool('add_site')"><UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />Tambah Aset</button>
    </div>

    <div class="flex-1 flex min-h-0 relative">
      <aside v-if="leftOpen" class="w-[272px] bg-white border-r border-j-line shrink-0 z-10">
        <JmapContent @close="leftOpen = false">
          <template #footer><button class="j-btn-outline w-full h-10" @click="showTable = true">Kelola Dataset</button></template>
        </JmapContent>
      </aside>

      <div class="flex-1 relative min-w-0">
        <MapBaseMap :center="[107.695, -6.955]" :zoom="14" @ready="onReady" />
        <button v-if="!leftOpen" class="j-icon-btn absolute top-4 left-4 z-10" title="Map Content" @click="leftOpen = true"><UIcon name="i-lucide-layers" class="w-5 h-5" /></button>

        <!-- map tools -->
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
          <div class="j-panel flex items-center gap-1 p-1.5">
            <UTooltip v-for="t in TOOLS" :key="t.id" :text="t.tip" :popper="{ placement: 'bottom' }">
              <button class="w-9 h-9 rounded-[8px] flex items-center justify-center transition-colors" :class="activeTool === t.id ? (t.id === 'delete' ? 'bg-j-red text-white' : 'bg-j-cyan text-white') : t.id === 'delete' ? 'text-j-red hover:bg-j-red/10' : 'text-j-ink hover:bg-j-bg'" @click="activeTool === t.id ? cancelTool() : openTool(t.id)"><UIcon :name="t.icon" class="w-[18px] h-[18px]" /></button>
            </UTooltip>
          </div>
          <span v-if="picking" class="h-7 px-3 rounded-full bg-j-cyan text-white text-[12px] font-display font-bold flex items-center gap-2 shadow">{{ picking.label }}<button @click="picking = null"><UIcon name="i-lucide-x" class="w-3.5 h-3.5" /></button></span>
          <span v-else-if="deleteMode" class="h-7 px-3 rounded-full bg-j-red text-white text-[12px] font-display font-bold flex items-center gap-2 shadow">Mode hapus · klik aset / kabel<button @click="deleteMode = false"><UIcon name="i-lucide-x" class="w-3.5 h-3.5" /></button></span>
          <span v-else-if="activeTool" class="h-7 px-3 rounded-full bg-j-cyan text-white text-[12px] font-display font-bold flex items-center shadow">{{ TOOLS.find((x) => x.id === activeTool)?.tip }}</span>
        </div>

        <!-- rail -->
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-3">
          <UTooltip text="Ringkasan & laporan aset" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'summary' && 'j-icon-btn-on'" @click="right = right === 'summary' ? '' : 'summary'"><UIcon name="i-lucide-chart-column" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Detail aset terpilih" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'detail' && 'j-icon-btn-on'" @click="right = right === 'detail' ? '' : 'detail'"><UIcon name="i-lucide-chart-pie" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Site Points" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'sites' && 'j-icon-btn-on'" @click="right = right === 'sites' ? '' : 'sites'"><UIcon name="i-lucide-git-fork" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Tabel aset" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="showTable && 'j-icon-btn-on'" @click="showTable = !showTable"><UIcon name="i-lucide-chart-bar-big" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Activity log" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'activity' && 'j-icon-btn-on'" @click="right = right === 'activity' ? '' : 'activity'"><UIcon name="i-lucide-history" class="w-5 h-5" /></button></UTooltip>
        </div>
        <div class="absolute bottom-10 right-4 z-10"><JmapControls :extent="EXTENT" /></div>
        <div class="absolute bottom-10 left-4 z-10"><JmapLegend :items="legend" /></div>
        <div class="absolute bottom-2 right-4 z-10"><JmapCoords /></div>

        <!-- feature card -->
        <JmapFeatureCard v-if="card && cardInfo && cardSite" :coord="card.coord">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 font-display font-bold text-[13px]" :class="cardInfo.status === 'AKTIF' ? 'text-j-cyan' : cardInfo.status === 'RENCANA' ? 'text-j-purple' : 'text-j-amber'"><span class="w-2 h-2 rounded-full" :class="cardInfo.status === 'AKTIF' ? 'bg-j-cyan' : cardInfo.status === 'RENCANA' ? 'bg-j-purple' : 'bg-j-amber'" />{{ cardInfo.status }}</span>
            <span class="j-tag-cyan">{{ cardInfo.tag }}</span>
          </div>
          <p class="font-display font-bold text-[18px] mt-2 break-all leading-tight">{{ cardSite.code }}</p>
          <p class="text-[12px] text-j-sub">{{ cardInfo.addr }}</p>
          <div class="mt-3 space-y-1.5">
            <div v-for="r in cardInfo.rows" :key="r[0]" class="flex justify-between text-[12px] gap-3"><span class="text-j-sub">{{ r[0] }}</span><b class="font-medium text-right" :class="r[0] === 'Terisi' || r[0] === 'Kondisi' ? 'text-j-blue' : ''">{{ r[1] }}</b></div>
          </div>
          <template v-if="cardInfo.util !== null">
            <div class="flex justify-between text-[11px] text-j-sub mt-3 border-t border-j-line pt-2"><span>Utilisasi</span><span class="text-j-blue">{{ cardInfo.util }}%</span></div>
            <div class="h-1.5 bg-j-soft rounded-full mt-1 overflow-hidden"><div class="h-full bg-j-cyan rounded-full" :style="{ width: Math.max(cardInfo.util, 2) + '%' }" /></div>
          </template>
          <div class="grid grid-cols-2 gap-2 mt-4">
            <button class="j-btn-primary h-8" @click="select('site', cardSite.id)">Edit Aset</button>
            <button class="j-btn-outline h-8 font-sans font-normal" @click="card = null">Tutup</button>
          </div>
        </JmapFeatureCard>
      </div>

      <!-- right panel -->
      <aside v-if="right" class="w-[360px] shrink-0 p-3 pl-0 z-10 bg-transparent">
        <AssetReportPanel v-if="right === 'summary'" @close="right = ''" @select="(id) => select('site', id, true)" />
        <AssetDetailPanel v-else-if="right === 'detail'" :site-id="selSite" :cable-id="selCable" @close="right = ''" @add-asset="(sid) => (assetModal = { siteId: sid })" @edit-asset="(sid, aid) => (assetModal = { siteId: sid, assetId: aid })" @move="startMove" @deleted="(selSite = null), (selCable = null)" @zoom="(c) => map?.flyTo({ center: c, zoom: 18.5 })" @poles="(id) => ((pole.cable = id), (right = 'generate_pole'), previewPoles())" />
        <UiSidePanel v-else-if="right === 'activity'" title="Activity Log" subtitle="Riwayat aksi tim aset" @close="right = ''"><AssetActivityPanel embedded @close="right = ''" /></UiSidePanel>

        <UiSidePanel v-else-if="right === 'sites'" title="Site Points" subtitle="Daftar sitepoint · rute & BOQ" @close="right = ''">
          <div class="flex flex-wrap gap-1.5 mb-2"><button v-for="t in ['POP', 'ODC', 'ODP', 'JC', 'Semua']" :key="t" class="j-chip !h-6 !px-2.5 !text-[11px]" :class="spType === t && 'j-chip-on'" @click="spType = t">{{ t === "POP" ? "OLT / POP" : t }}</button></div>
          <input v-model="spQ" class="j-input mb-3" placeholder="Cari kode sitepoint..." />
          <div class="space-y-2">
            <div v-for="x in spList" :key="x.id" class="border rounded-[10px]" :class="spOpen === x.id ? 'border-j-cyan' : 'border-j-line'">
              <button class="w-full flex items-center gap-2 p-2.5 text-left" @click="spOpen = spOpen === x.id ? null : x.id">
                <JmapMarker :kind="x.type === 'POP' ? 'diamond' : 'circle'" :color="SITE_COLORS[x.type]" />
                <span class="flex-1 min-w-0"><p class="font-display font-bold text-[13px] truncate">{{ x.code }}</p><p class="text-[11px] text-j-sub truncate">{{ x.name !== x.code ? x.name + " · " : "" }}{{ connected(x.id).length }} kabel terhubung</p></span>
                <span :class="x.status === 'Installed' ? 'j-tag-teal' : x.status === 'Planned' ? 'j-tag-purple' : 'j-tag-amber'">{{ x.status === "Installed" ? "Aktif" : x.status === "Planned" ? "Rencana" : "Maint." }}</span>
              </button>
              <div v-if="spOpen === x.id" class="border-t border-j-line p-2.5 grid grid-cols-2 gap-1.5">
                <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="(map?.flyTo({ center: x.coord, zoom: 18 }), openCard(x.id))"><UIcon name="i-lucide-locate-fixed" class="w-3.5 h-3.5" />Jump to site</button>
                <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="previewSite(x.id)"><UIcon name="i-lucide-eye" class="w-3.5 h-3.5" />Preview</button>
                <button class="j-btn-teal j-btn-sm font-sans font-normal" @click="findRoutes(x.id)"><UIcon name="i-lucide-route" class="w-3.5 h-3.5" />Find Routes</button>
                <button class="j-btn-primary j-btn-sm" @click="(select('site', x.id), (right = 'detail'))"><UIcon name="i-lucide-info" class="w-3.5 h-3.5" />Detail</button>
              </div>
            </div>
            <p v-if="!spList.length" class="text-center text-[12px] text-j-sub py-6">Tidak ada sitepoint.</p>
          </div>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'routes'" title="Find Routes" :subtitle="`${store.siteById(fr.from)?.code || ''} → ${store.siteById(fr.to)?.code || 'pilih tujuan di peta'}`" @close="(right = 'sites'), (preview = [])">
          <div v-if="!fr.opts.length" class="text-center text-[13px] text-j-sub py-10"><UIcon name="i-lucide-mouse-pointer-click" class="w-8 h-8 text-j-cyan mb-2" /><br />Klik sitepoint tujuan di peta.</div>
          <div v-else class="space-y-2">
            <button v-for="(o, i) in fr.opts" :key="i" class="w-full text-left border rounded-[10px] p-3" :class="fr.sel === i ? 'border-j-cyan bg-j-cyan/[0.05]' : 'border-j-line'" @click="(fr.sel = i), showRoutes()">
              <div class="flex items-center gap-2"><span class="j-tag-cyan font-display font-bold">R{{ i + 1 }}</span><span v-if="i === 0" class="j-tag-teal">Recommended</span><span class="flex-1" /><b class="text-[14px]">{{ fmt(o.length) }} m</b></div>
              <p class="text-[11px] text-j-sub mt-1.5">{{ o.via }} · ± {{ Math.ceil(o.length / 60) + 1 }} tiang · {{ i ? `+${fmt(o.length - fr.opts[0].length)} m dari R1` : "jalur terpendek" }}</p>
            </button>
            <div class="grid grid-cols-2 gap-2 pt-1"><button class="j-btn-outline h-9" @click="routeBoq">Generate BOQ/BOM</button><button class="j-btn-primary h-9" @click="saveRoute">Simpan sebagai kabel</button></div>
            <div v-if="fr.boq" class="border border-j-line rounded-[10px] overflow-hidden mt-2">
              <div class="px-3 py-2 bg-j-bg flex justify-between text-[12px]"><b class="font-display">BOQ/BOM Rute R{{ fr.sel + 1 }}</b><b class="text-j-blue">{{ idr(fr.boq.total) }}</b></div>
              <div v-for="it in fr.boq.items" :key="it.code" class="flex justify-between gap-2 px-3 py-1.5 border-t border-j-line text-[11px]"><span class="text-j-sub">{{ it.item }}</span><span class="shrink-0">{{ fmt(it.qty) }} {{ it.unit }} · <b>{{ fmt(it.total) }}</b></span></div>
              <button class="w-full text-[12px] text-j-blue py-2 border-t border-j-line hover:bg-j-bg" @click="exportBoq(`Rute_${store.siteById(fr.from)?.code}_${store.siteById(fr.to)?.code}`, fr.boq.items, fr.boq.total)">Download Excel</button>
            </div>
          </div>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'buffer'" title="Buffer Kabel" subtitle="Analisis area di sepanjang jalur kabel" @close="cancelTool">
          <div class="space-y-3">
            <div><label class="j-field-label">Segmen kabel</label><div class="flex gap-2"><input :value="store.cables.find((c) => c.id === bf.cable)?.label || ''" readonly class="j-input bg-j-bg" placeholder="Pilih kabel di peta" /><button class="j-btn-outline !px-3" @click="pickBuf"><UIcon name="i-lucide-mouse-pointer-click" class="w-4 h-4" /></button></div></div>
            <div><div class="flex justify-between text-[12px]"><span class="text-j-sub">Jarak buffer</span><b>{{ bf.dist }} m</b></div><input v-model.number="bf.dist" type="range" min="10" max="300" step="10" class="w-full accent-[#00D4FF]" /></div>
            <template v-if="bf.res">
              <div class="grid grid-cols-2 gap-2">
                <UiStat label="Rumah dalam buffer" :value="fmt(bf.res.homes)" />
                <UiStat label="Non-residensial" :value="fmt(bf.res.com)" />
                <UiStat label="Panjang kabel" :value="fmt(bf.res.len)" unit="m" />
                <UiStat label="Luas buffer" :value="m2(bf.res.area)" />
              </div>
              <div class="border border-j-line rounded-[10px] divide-y divide-j-line text-[12px]">
                <div v-for="(v, k) in bf.res.byT" :key="k" class="flex justify-between px-3 py-2"><span class="text-j-sub">{{ SITE_LABEL[k] || k }}</span><b>{{ v }}</b></div>
                <div class="flex justify-between px-3 py-2"><span class="text-j-sub">POI</span><b>{{ bf.res.poi }}</b></div>
              </div>
              <p class="text-[11px] text-j-sub">Rumah dalam buffer berpotensi disambung dari kabel ini (drop ≤ {{ bf.dist }} m).</p>
            </template>
          </div>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'boq'" title="BOQ & BOM Polygon" subtitle="Gambar polygon untuk menghitung material terpasang" @close="cancelTool">
          <div class="space-y-3">
            <button class="j-btn-outline w-full font-sans font-medium" @click="draw.active.value ? draw.finishNow() : drawBoq()"><UIcon name="i-lucide-pentagon" class="w-4 h-4" />{{ draw.active.value ? `Selesai (${draw.vertexCount.value} titik)` : bq.poly ? "Gambar ulang polygon" : "Draw Polygon" }}</button>
            <template v-if="bq.poly">
              <div class="grid grid-cols-2 gap-2"><UiStat v-for="(v, k) in bq.counts" :key="k" :label="k" :value="fmt(v)" /></div>
              <div class="bg-j-cyan/[0.06] rounded-[8px] p-3"><p class="text-[11px] text-j-sub">Total estimasi (material + jasa)</p><p class="font-display font-bold text-[18px] text-j-ink">{{ idr(bq.total) }}</p></div>
              <div class="border border-j-line rounded-[10px] overflow-hidden">
                <div class="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 bg-j-bg text-[10px] font-display font-bold uppercase"><span>Item</span><span>Qty</span><span>Total</span></div>
                <div v-for="it in bq.items" :key="it.code" class="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 border-t border-j-line text-[11px]"><span class="text-j-sub">{{ it.item }}</span><span>{{ fmt(it.qty) }} {{ it.unit }}</span><b>{{ fmt(it.total) }}</b></div>
              </div>
              <button class="j-btn-primary w-full" @click="exportBoq('Polygon', bq.items, bq.total)"><UIcon name="i-lucide-download" class="w-4 h-4" />Download Excel</button>
            </template>
          </div>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'split'" title="Split Kabel" subtitle="Bagi satu segmen kabel menjadi dua" @close="cancelTool">
          <ol class="text-[12px] text-j-sub space-y-1.5 list-decimal ml-4"><li>Klik segmen kabel di peta.</li><li>Klik tiang / JC / sitepoint di jalur kabel sebagai titik split.</li><li>Konfirmasi split.</li></ol>
          <div class="mt-3 space-y-2 text-[12px]">
            <div class="rounded-[8px] bg-j-bg p-3"><p class="text-j-sub">Kabel</p><p class="font-medium break-all">{{ store.cables.find((c) => c.id === sc.cable)?.label || "–" }}</p></div>
            <div class="rounded-[8px] bg-j-bg p-3"><p class="text-j-sub">Split di</p><p class="font-medium">{{ sc.at || "–" }}</p></div>
          </div>
          <template #footer><div class="grid grid-cols-2 gap-2"><button class="j-btn-outline h-10" @click="pickSplit">Pilih ulang</button><button class="j-btn-primary h-10" :disabled="sc.idx < 0" @click="doSplit">Split Kabel</button></div></template>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'reroute'" title="Edit Rute Kabel" subtitle="Gambar ulang jalur kabel" @close="cancelTool">
          <ol class="text-[12px] text-j-sub space-y-1.5 list-decimal ml-4"><li>Klik kabel yang akan diubah.</li><li>Gambar jalur baru di peta — titik awal & akhir otomatis terkunci ke sitepoint.</li><li>Double-click untuk menyimpan.</li></ol>
          <div v-if="rr.cable" class="mt-3 rounded-[8px] bg-j-bg p-3 text-[12px]"><p class="text-j-sub">Kabel</p><p class="font-medium break-all">{{ store.cables.find((c) => c.id === rr.cable)?.label }}</p><p v-if="rr.len" class="mt-1">Panjang baru: <b>{{ fmt(rr.len) }} m</b></p></div>
          <template #footer><button class="j-btn-primary w-full h-10" @click="pickReroute">{{ rr.cable ? "Edit kabel lain" : "Pilih kabel" }}</button></template>
        </UiSidePanel>

        <!-- Tambah Sitepoint -->
        <UiSidePanel v-else-if="right === 'add_site'" title="Tambah Sitepoint" subtitle="Klik peta atau isi koordinat" @close="cancelTool">
          <div class="space-y-3">
            <div><p class="j-label text-j-cyan mb-2">Kategori Aset</p><div class="grid grid-cols-2 gap-2"><button v-for="c in ['Pasif', 'Aktif']" :key="c" class="j-btn h-9" :class="sp.cat === c ? 'bg-j-cyan text-white' : 'bg-j-bg text-j-sub'" @click="(sp.cat = c as any), chipSel(c === 'Pasif' ? 'ODP' : 'POP')">{{ c }}</button></div></div>
            <div>
              <label class="j-field-label">Tipe Sitepoint</label>
              <select v-model="sp.type" class="j-select"><option v-for="t in SITE_TYPES" :key="t" :value="t">{{ SITE_LABEL[t] }}</option></select>
              <div class="flex flex-wrap gap-1.5 mt-2"><button v-for="c in SP_CHIPS" :key="c[1]" class="h-6 px-2 rounded-[4px] text-[11px] border" :class="(c[0].split(':')[0] === sp.type && (!c[0].includes(':') || c[0].split(':')[1] === sp.poleType)) ? 'border-j-cyan text-j-cyan bg-j-cyan/[0.08]' : 'border-j-line text-j-sub'" @click="chipSel(c[0])">{{ c[1] }}</button></div>
            </div>
            <div><label class="j-field-label">Nama / Kode Aset</label><input v-model="sp.code" class="j-input" :placeholder="codeHint" /><p class="text-[10px] text-j-mute mt-1">Format: ODP-Region-Area-OdcLine-OdpNo · kosongkan untuk kode otomatis</p></div>
            <div><label class="j-field-label">Lokasi RW / Cluster</label><div class="grid grid-cols-2 gap-2"><input v-model="sp.rw" class="j-input" placeholder="RW 01" /><input v-model="sp.cluster" class="j-input" placeholder="Cluster / Area" /></div></div>
            <div><label class="j-field-label">Koordinat Manual</label><div class="grid grid-cols-2 gap-2"><input v-model="sp.lng" class="j-input" placeholder="Longitude" /><input v-model="sp.lat" class="j-input" placeholder="Latitude" /></div></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="j-field-label">Kapasitas (port)</label><input v-model.number="sp.cap" type="number" class="j-input" /></div>
              <div><label class="j-field-label">Status</label><select v-model="sp.status" class="j-select"><option value="Installed">Aktif</option><option value="Planned">Rencana</option><option value="Maintenance">Maintenance</option></select></div>
            </div>
            <div><label class="j-field-label">Material Terpasang</label><input v-model="sp.material" class="j-input" placeholder="Cth: Kabel G.652D · Splice closure" /></div>
            <div><label class="j-field-label">Team Asset (PIC)</label><select v-model="sp.pic" class="j-select"><option>Team Asset JLM</option><option>PT Mitra Teknik</option><option>{{ auth.user?.name }}</option></select></div>
            <button class="w-full h-10 rounded-[8px] border border-dashed font-display font-bold text-[13px] flex items-center justify-center gap-2" :class="sp.lat ? 'border-j-teal text-j-teal bg-j-aqua/[0.08]' : 'border-j-cyan text-j-cyan bg-j-cyan/[0.05]'" @click="pickSpCoord"><UIcon name="i-lucide-map-pin" class="w-4 h-4" />{{ sp.lat ? `${(+sp.lat).toFixed(5)}, ${(+sp.lng).toFixed(5)}` : "Klik Peta untuk Penempatan" }}</button>
          </div>
          <template #footer><div class="grid grid-cols-2 gap-2"><button class="j-btn-outline h-10" @click="cancelTool">Batal</button><button class="j-btn-grad h-10" @click="saveSite">Simpan</button></div></template>
        </UiSidePanel>

        <!-- Tambah Kabel -->
        <UiSidePanel v-else-if="right === 'add_cable'" title="Tambah Kabel" subtitle="Pilih 2 titik ODP/ODC untuk membuat segmen kabel" @close="cancelTool">
          <div class="space-y-3">
            <div>
              <p class="j-label text-j-sub mb-2">Titik Endpoint</p>
              <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button v-for="w in ['a', 'b']" :key="w" class="text-left rounded-[8px] border p-2 min-h-[54px]" :class="[(cb as any)[w] ? 'border-j-cyan bg-j-cyan/[0.05]' : 'border-dashed border-j-line', w === 'b' ? 'order-3' : '']" @click="pickEnd(w as any)">
                  <p class="text-[10px] font-display font-bold" :class="(cb as any)[w] ? 'text-j-cyan' : 'text-j-mute'">● TITIK {{ w.toUpperCase() }}</p>
                  <p class="text-[12px] font-medium truncate">{{ store.siteById((cb as any)[w])?.code || "Klik di peta" }}</p>
                </button>
                <UIcon name="i-lucide-arrow-right" class="w-4 h-4 text-j-sub order-2" />
              </div>
            </div>
            <div><p class="j-label text-j-sub mb-1.5">Label Segmen</p><input v-model="cb.label" class="j-input border-j-cyan" :placeholder="cbLabel" /><p class="text-[10px] text-j-mute mt-1">Contoh: BDG-F4599.48 (Feed GENOVA SUMMARECON BANDUNG_350M)</p></div>
            <div><p class="j-label text-j-sub mb-1.5">Kelas Kabel</p><div class="flex flex-wrap gap-1.5"><button v-for="k in Object.keys(KLS)" :key="k" class="h-7 px-2.5 rounded-[6px] border text-[12px]" :class="cb.kls === k ? 'border-j-purple text-j-purple bg-j-purple/[0.06] font-medium' : 'border-j-line text-j-sub'" @click="cb.kls = k">{{ k }}</button></div><p class="text-[10px] text-j-mute mt-1">Feeder: 48–96c · Sub-feeder: 24–48c · Distribusi: 12–24c · Backbone: 96–288c</p></div>
            <div class="grid grid-cols-2 gap-2">
              <div><p class="j-label text-j-sub mb-1.5">Jumlah Core</p><select v-model.number="cb.cores" class="j-select"><option v-for="c in [12, 24, 48, 96, 144, 288]" :key="c">{{ c }}</option></select></div>
              <div><p class="j-label text-j-sub mb-1.5">Tipe Kabel</p><select v-model="cb.ctype" class="j-select"><option>G.652D</option><option>G.657A2</option><option>ADSS G.652D</option></select></div>
            </div>
            <div>
              <p class="j-label text-j-sub mb-1.5">Metode Instalasi</p>
              <div class="flex gap-1.5"><button v-for="k in [['Aerial', 'Aerial (ADSS)'], ['Underground', 'Underground'], ['Kombinasi', 'Kombinasi']]" :key="k[0]" class="h-7 px-2.5 rounded-[6px] border text-[12px]" :class="cb.install === k[0] ? 'border-j-purple text-j-purple bg-j-purple/[0.06] font-medium' : 'border-j-line text-j-sub'" @click="cb.install = k[0] as any">{{ k[1] }}</button></div>
              <div v-if="cb.install !== 'Aerial'" class="mt-2 flex gap-2 rounded-[8px] border border-j-amber/50 bg-j-amber/[0.08] p-2 text-[11px] text-[#B45309]"><UIcon name="i-lucide-triangle-alert" class="w-4 h-4 shrink-0" />Underground memerlukan review manual; sistem tidak otomatis memvalidasi rute.</div>
            </div>
            <div><p class="j-label text-j-sub mb-1.5">Status Segmen</p><div class="flex gap-1.5"><button v-for="k in [['Planned', 'Planned'], ['Installed', 'Terpasang'], ['Maintenance', 'Sebagian']]" :key="k[0]" class="h-7 px-2.5 rounded-[6px] border text-[12px]" :class="cb.status === k[0] ? 'border-j-teal text-j-teal bg-j-aqua/[0.1] font-medium' : 'border-j-line text-j-sub'" @click="cb.status = k[0]">{{ k[1] }}</button></div></div>
            <div class="grid grid-cols-2 gap-2">
              <div><p class="j-label text-j-sub mb-1.5">Panjang Rute (m)</p><input :value="cb.length ? `Auto: ~${fmt(cb.length)} m` : 'Auto'" readonly class="j-input bg-j-bg" /><p class="text-[10px] text-j-mute mt-1">Mengikuti jalur jalan</p></div>
              <div><p class="j-label text-j-sub mb-1.5">Panjang Terpasang (m)</p><input v-model.number="cb.pulled" type="number" class="j-input border-j-cyan" /><p class="text-[10px] text-j-mute mt-1">Aktual material terpasang</p></div>
            </div>
            <div class="flex gap-2"><button class="j-btn-outline j-btn-sm flex-1 font-sans font-medium" :disabled="!cb.a || !cb.b" @click="autoRoute"><UIcon name="i-lucide-route" class="w-3.5 h-3.5" />Auto Route</button><button class="j-btn-outline j-btn-sm flex-1 font-sans font-medium" @click="draw.active.value ? draw.finishNow() : drawCable()"><UIcon name="i-lucide-pen-line" class="w-3.5 h-3.5" />{{ draw.active.value ? "Selesai gambar" : "Gambar Manual" }}</button></div>
            <div class="flex gap-2 rounded-[8px] border border-j-blue/30 bg-j-blue/[0.04] p-2 text-[11px] text-j-sub"><UIcon name="i-lucide-info" class="w-4 h-4 text-j-blue shrink-0" />Coil maks: 350 m (feeder) / 500 m (backbone). JC maks: 3.500 m. ODP maks: 250 m · 16 rumah. Tiang: 60 m.</div>
            <div v-if="cb.length" class="rounded-[8px] border p-2 text-[12px] flex items-center gap-2" :class="cbValid ? 'border-j-teal/40 bg-j-aqua/[0.08] text-j-teal' : 'border-j-amber/50 bg-j-amber/[0.08] text-[#B45309]'"><span class="w-1.5 h-1.5 rounded-full" :class="cbValid ? 'bg-j-teal' : 'bg-j-amber'" />{{ cb.kls }} {{ cb.cores }}c · {{ fmt(cb.length) }} m · {{ cbValid ? "dalam batas single pull · valid" : "melebihi batas tarikan — perlu JC" }}</div>
          </div>
          <template #footer><div class="grid grid-cols-2 gap-2"><button class="j-btn-outline h-10" @click="cancelTool">Batal</button><button class="j-btn-grad h-10" :disabled="cb.coords.length < 2" @click="saveCable">Simpan Segmen</button></div></template>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'move'" title="Pindah Sitepoint" :subtitle="moving ? store.siteById(moving.siteId)?.code : ''" @close="cancelTool">
          <ol class="text-[13px] text-j-sub space-y-2 list-decimal ml-4"><li>Klik lokasi baru di peta.</li><li>Ujung kabel yang terhubung ikut berpindah.</li><li>Klik <b>Simpan Posisi</b>.</li></ol>
          <div v-if="moving?.coord" class="mt-4 rounded-[8px] bg-j-bg p-3 text-[12px]">Posisi baru: <b>{{ moving.coord[1].toFixed(6) }}, {{ moving.coord[0].toFixed(6) }}</b></div>
          <template #footer><div class="grid grid-cols-2 gap-2"><button class="j-btn-outline h-10" @click="cancelTool">Batal</button><button class="j-btn-primary h-10" :disabled="!moving?.coord" @click="saveMove">Simpan Posisi</button></div></template>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'generate_pole'" title="Generate Tiang" subtitle="Penempatan tiang otomatis sepanjang kabel" @close="cancelTool">
          <div class="space-y-3">
            <div><label class="j-field-label">Segmen kabel</label><div class="flex gap-2"><input :value="store.cables.find((c) => c.id === pole.cable)?.label || ''" readonly class="j-input bg-j-bg" placeholder="Pilih kabel di peta" /><button class="j-btn-outline !px-3" @click="pickPoleCable"><UIcon name="i-lucide-mouse-pointer-click" class="w-4 h-4" /></button></div></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="j-field-label">Jarak antar tiang (m)</label><input v-model.number="pole.spacing" type="number" class="j-input" /><p class="text-[10px] text-j-mute mt-1">Standar JLM: maks 60 m</p></div>
              <div><label class="j-field-label">Tipe tiang</label><select v-model="pole.type" class="j-select"><option>T7 1-Stage</option><option>T7 2-Stage</option><option>T9 2-Stage</option></select></div>
            </div>
            <div v-if="pole.cable" class="rounded-[8px] bg-j-bg p-3 text-[13px]"><b>{{ pole.pts.length }}</b> tiang baru akan ditambahkan · tiang existing dalam 8 m dilewati</div>
          </div>
          <template #footer><div class="grid grid-cols-2 gap-2"><button class="j-btn-outline h-10" @click="cancelTool">Batal</button><button class="j-btn-primary h-10" :disabled="!pole.pts.length" @click="genPoles">Generate Tiang</button></div></template>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'import'" title="Import Data" subtitle="KML · KMZ · GeoJSON · SHP · Excel" @close="cancelTool">
          <div class="space-y-3">
            <p class="text-[13px] text-j-sub">Data aset dari spreadsheet, KMZ/KML, dan GIS dapat langsung dimasukkan. Titik menjadi sitepoint, garis menjadi segmen kabel.</p>
            <div><label class="j-field-label">Import titik sebagai</label><select v-model="imp.type" class="j-select"><option v-for="t in SITE_TYPES" :key="t" :value="t">{{ SITE_LABEL[t] }}</option></select></div>
            <label class="block border-2 border-dashed border-j-line hover:border-j-cyan rounded-[10px] p-6 text-center cursor-pointer">
              <UIcon name="i-lucide-cloud-upload" class="w-9 h-9 text-j-cyan mx-auto mb-2" />
              <p class="font-display font-bold text-[14px]">Pilih file</p>
              <p class="text-[12px] text-j-sub">.kml .kmz .geojson .zip (shp) .xlsx .csv</p>
              <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip,.xlsx,.xls,.csv" @change="onImport" />
            </label>
            <p v-if="imp.msg" class="text-[12px]" :class="imp.ok ? 'text-j-teal' : 'text-j-red'">{{ imp.msg }}</p>
            <button class="text-[12px] text-j-blue hover:underline" @click="exportXLSX('Template_Import_Aset_JLM.xlsx', { SitePoint: [{ Kode: 'ODP-GDB-RW05-101', Tipe: 'ODP', Lat: -6.9551, Lng: 107.6952, Keterangan: '' }] })">Unduh template Excel</button>
          </div>
        </UiSidePanel>

        <UiSidePanel v-else-if="right === 'edit_attr'" title="Edit Atribut Aset" subtitle="Update massal via Excel (kolom Kode)" @close="cancelTool">
          <div class="space-y-3">
            <p class="text-[13px] text-j-sub">Perbarui Serial, Brand, Inspector, dan Keterangan untuk banyak aset sekaligus.</p>
            <label class="block border-2 border-dashed border-j-line hover:border-j-cyan rounded-[10px] p-6 text-center cursor-pointer">
              <UIcon name="i-lucide-file-spreadsheet" class="w-9 h-9 text-j-cyan mx-auto mb-2" /><p class="font-display font-bold text-[14px]">Upload Excel</p>
              <input type="file" class="hidden" accept=".xlsx,.xls,.csv" @change="onAttr" />
            </label>
            <p v-if="attrMsg" class="text-[12px] text-j-teal">{{ attrMsg }}</p>
            <button class="text-[12px] text-j-blue hover:underline" @click="exportXLSX('Template_Update_Atribut.xlsx', { Atribut: store.assets.slice(0, 25).map((a) => ({ Kode: a.code, Serial: a.serial || '', Brand: a.brand || '', Inspector: a.inspectedBy || '', Keterangan: a.description || '' })) })">Unduh template (25 aset)</button>
          </div>
        </UiSidePanel>
      </aside>
    </div>

    <!-- table drawer -->
    <div v-if="showTable" class="absolute left-0 right-0 bottom-0 h-[46vh] bg-white border-t border-j-line z-30shadow-[0_-10px_30px_rgba(16,32,29,0.08)] fade-up">
      <AssetTable :full="false" @close="showTable = false" @fullscreen="() => {}" @select="(k, id) => ((showTable = false), select(k, id, true))" />
    </div>

    <JmapLocationFilter ref="filterRef" :open="filterOpen" @close="filterOpen = false" @apply="applyArea" @preview="previewArea" @draw="filterDraw" @coord="filterCoord" />
    <AssetFormModal :open="!!assetModal" :site-id="assetModal?.siteId || null" :asset="assetModal?.assetId ? store.assets.find((a) => a.id === assetModal!.assetId) : null" @close="assetModal = null" @saved="(a) => select('site', a.siteId)" />
    <UModal :model-value="!!confirmDel" @update:model-value="!$event && (confirmDel = null)">
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-j-red/10 flex items-center justify-center"><UIcon name="i-lucide-trash-2" class="w-5 h-5 text-j-red" /></div><div><p class="j-title text-[16px]">Hapus {{ confirmDel?.kind === "site" ? "sitepoint" : "segmen kabel" }}?</p><p class="text-[12px] text-j-sub break-all">{{ confirmDel?.label }}</p></div></div>
        <p class="text-[13px] text-j-sub">Aset yang terpasang pada sitepoint ini ikut terhapus. Perubahan tercatat di Activity Log.</p>
        <div class="flex justify-end gap-2"><button class="j-btn-outline" @click="confirmDel = null">Batal</button><button class="j-btn bg-j-red text-white" @click="doDelete">Hapus</button></div>
      </div>
    </UModal>
  </div>
</template>
