<script setup lang="ts">
import * as turf from "@turf/turf";
import * as XLSX from "xlsx";
import IcMapLayer from "~/assets/icons/ic-map-layer.svg";
import IcBasemap from "~/assets/icons/ic-basemap.svg";
import IcInfo from "~/assets/icons/ic-info.svg";
import IcChart from "~/assets/icons/ic-chart.svg";
import IcAddData from "~/assets/icons/ic-layer-plus.svg";
import IcAsset from "~/assets/icons/ic-assets.svg";
import IcAttribute from "~/assets/icons/ic-attribute.svg";
import IcCable from "~/assets/icons/ic-cable.svg";
import IcRoute from "~/assets/icons/ic-route.svg";
import IcCore from "~/assets/icons/ic-core.svg";
import IcPole from "~/assets/icons/ic-pole.svg";
import IcTrash from "~/assets/icons/ic-trash.svg";
import IcTime from "~/assets/icons/ic-time.svg";
import IcList from "~/assets/icons/ic-rectangle-list.svg";
import IcCloud from "~/assets/icons/ic-cloud-upload.svg";
import IcTools from "~/assets/icons/ic-tools.svg";
import { SITE_COLORS, CABLE_COLORS, SITE_TYPES } from "~/utils/jlmSites";
import { routeAlongRoads, polesAlong, metersBetween } from "~/utils/ftthEngine";

useHead({ title: "Asset Management · JLM Map Planner" });
const route = useRoute();
const geo = useGeoData();
const { map, setData, addLayer, fitTo } = useMap();
const layers = useLayers();
const draw = useDraw();
const store = useAssetStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const showLayers = ref(false);
const showLegend = ref(false);
const showActivity = ref(false);
const showTable = ref(false);
const tableFull = ref(false);
const right = ref<"" | "summary" | "detail">("summary");
const selSite = ref<string | null>(null);
const selCable = ref<string | null>(null);
const tool = ref<string | null>(null);
const assetModal = ref<{ siteId: string; assetId?: string } | null>(null);
const ready = ref(false);

// ---------------- data -> map ----------------
function sitesFC() {
  return {
    type: "FeatureCollection",
    features: store.sites.map((s) => ({ type: "Feature", id: undefined, geometry: { type: "Point", coordinates: s.coord }, properties: { id: s.id, code: s.code, type: s.type, status: s.status, poleType: s.poleType || "", n: store.assetsOf(s.id).length } })),
  };
}
function cablesFC() {
  return { type: "FeatureCollection", features: store.cables.map((c) => ({ type: "Feature", geometry: { type: "LineString", coordinates: c.coords }, properties: { id: c.id, code: c.code, label: c.label, type: c.type, cores: c.cores, status: c.status, install: c.install } })) };
}
let refreshT: any = null;
function refresh() {
  if (!ready.value) return;
  clearTimeout(refreshT);
  refreshT = setTimeout(() => {
    setData("as-sites", sitesFC());
    setData("as-cables", cablesFC());
    SITE_TYPES.forEach((t) => layers.setCount("site-" + t, store.sites.filter((s) => s.type === t).length));
    Object.keys(CABLE_COLORS).forEach((t) => layers.setCount("cable-" + t, store.cables.filter((c) => c.type === t).length));
    highlight();
  }, 60);
}
watch(() => [store.sites, store.cables, store.assets], refresh, { deep: true });

function highlight() {
  const f: any[] = [];
  const s = selSite.value && store.siteById(selSite.value);
  if (s) f.push({ type: "Feature", geometry: { type: "Point", coordinates: s.coord }, properties: {} });
  const c = selCable.value && store.cables.find((x) => x.id === selCable.value);
  if (c) f.push({ type: "Feature", geometry: { type: "LineString", coordinates: c.coords }, properties: {} });
  setData("as-sel", { type: "FeatureCollection", features: [...f, ...previewFeatures.value] });
}
const previewFeatures = ref<any[]>([]);
watch([selSite, selCable, previewFeatures], highlight);

async function onReady() {
  layers.reset();
  await geo.load();
  store.ensureSeed(geo);
  ready.value = true;
  setData("as-sites", sitesFC());
  setData("as-cables", cablesFC());
  setData("as-sel", EMPTY_FC);
  setData("bld-as", geo.data.buildings);
  addLayer({ id: "bld-as", type: "fill", source: "bld-as", minzoom: 15, layout: { visibility: "none" }, paint: { "fill-color": "#ffffff", "fill-opacity": 0.15 } });

  const cableColor = ["match", ["get", "type"], ...Object.entries(CABLE_COLORS).flat(), "#00D075"];
  addLayer({ id: "as-sel-line", type: "line", source: "as-sel", filter: ["==", "$type", "LineString"], paint: { "line-color": "#22D3EE", "line-width": 10, "line-opacity": 0.5 } });
  Object.keys(CABLE_COLORS).forEach((t) => {
    addLayer({ id: `cable-${t}`, type: "line", source: "as-cables", filter: ["all", ["==", ["get", "type"], t], ["==", ["get", "install"], "Aerial"], ["!=", ["get", "status"], "Planned"]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": cableColor, "line-width": ["interpolate", ["linear"], ["get", "cores"], 12, 2.4, 96, 4.5, 288, 6] } });
    addLayer({ id: `cable-${t}-dash`, type: "line", source: "as-cables", filter: ["all", ["==", ["get", "type"], t], ["any", ["==", ["get", "install"], "Underground"], ["==", ["get", "status"], "Planned"]]], paint: { "line-color": cableColor, "line-width": 3.5, "line-dasharray": [1.5, 1.2] } });
  });
  const statusStroke = ["match", ["get", "status"], "Planned", "#FBBF24", "Maintenance", "#C0353E", "#ffffff"];
  const R: Record<string, number> = { POP: 10, ODC: 8, ODP: 5.5, JC: 5.5, Customer: 4.5, Tower: 8, Pole: 3 };
  SITE_TYPES.forEach((t) => {
    addLayer({
      id: `site-${t}`,
      type: "circle",
      source: "as-sites",
      minzoom: t === "Pole" ? 15 : t === "Customer" ? 15.5 : 0,
      filter: ["==", ["get", "type"], t],
      paint: { "circle-radius": t === "Pole" ? ["match", ["get", "poleType"], "T9 2-Stage", 4.2, "T7 2-Stage", 3.4, 2.8] : R[t], "circle-color": t === "Pole" ? ["match", ["get", "poleType"], "T9 2-Stage", "#1E1D1E", "T7 2-Stage", "#626264", "#AFAEAF"] : SITE_COLORS[t], "circle-stroke-color": statusStroke as any, "circle-stroke-width": ["match", ["get", "status"], "Installed", 1.5, 3] },
    });
  });
  addLayer({ id: "site-label", type: "symbol", source: "as-sites", filter: ["in", ["get", "type"], ["literal", ["POP", "ODC", "ODP", "JC", "Tower"]]], layout: { "text-field": ["get", "code"], "text-font": ["Noto Sans Bold"], "text-size": ["match", ["get", "type"], "POP", 12, "ODC", 11, 10], "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#fff", "text-halo-color": "#011641", "text-halo-width": 1.4, "text-opacity": ["step", ["zoom"], ["match", ["get", "type"], "POP", 1, "ODC", 1, 0], 16, 1] } });
  addLayer({ id: "as-sel-pt", type: "circle", source: "as-sel", filter: ["==", "$type", "Point"], paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#22D3EE", "circle-stroke-width": 3 } });

  SITE_TYPES.forEach((t) => layers.register({ id: "site-" + t, label: t === "POP" ? "POP / OLT Site" : t, group: "Site Point", color: SITE_COLORS[t], kind: "circle", mapLayers: [`site-${t}`], visible: true, count: store.sites.filter((s) => s.type === t).length }));
  layers.register({ id: "site-label", label: "Label kode aset", group: "Site Point", color: "#011641", kind: "symbol", mapLayers: ["site-label"], visible: true });
  Object.keys(CABLE_COLORS).forEach((t) => layers.register({ id: "cable-" + t, label: "Kabel " + t, group: "Kabel", color: CABLE_COLORS[t], kind: "line", mapLayers: [`cable-${t}`, `cable-${t}-dash`], visible: true, count: store.cables.filter((c) => c.type === t).length }));
  layers.register({ id: "status", label: "Status ring", group: "Keterangan", color: "#FBBF24", kind: "circle", mapLayers: [], visible: true, legend: [{ label: "Installed (putih)", color: "#ffffff" }, { label: "Planned (kuning, kabel putus-putus)", color: "#FBBF24" }, { label: "Maintenance (merah)", color: "#C0353E" }] });
  layers.register({ id: "bld-as", label: "Building Footprint", group: "Referensi", color: "#ffffff", kind: "fill", mapLayers: ["bld-as"], visible: false });

  const m = map.value!;
  const clickable = () => [...SITE_TYPES.map((t) => `site-${t}`), ...Object.keys(CABLE_COLORS).flatMap((t) => [`cable-${t}`, `cable-${t}-dash`])].filter((l) => m.getLayer(l));
  m.on("mousemove", (e) => {
    if (draw.active.value || moveState.value) return;
    m.getCanvas().style.cursor = m.queryRenderedFeatures(e.point, { layers: clickable() }).length ? "pointer" : picking.value ? "crosshair" : "";
  });
  m.on("click", (e) => {
    if (draw.active.value) return;
    if (moveState.value) return onMoveClick(e);
    const bbox: any = [
      [e.point.x - 4, e.point.y - 4],
      [e.point.x + 4, e.point.y + 4],
    ];
    const f = m.queryRenderedFeatures(bbox, { layers: clickable() })[0];
    const kind = f ? (f.layer.id.startsWith("site-") ? "site" : "cable") : null;
    const id = f?.properties?.id as string | undefined;
    if (picking.value) {
      if (kind && (picking.value.want === "any" || picking.value.want === kind)) {
        const res = picking.value.resolve;
        picking.value = null;
        res({ kind, id });
      } else if (picking.value.want === "point") {
        const res = picking.value.resolve;
        picking.value = null;
        res({ kind: "point", coord: [e.lngLat.lng, e.lngLat.lat] });
      }
      return;
    }
    if (!kind || !id) return;
    if (tool.value === "delete") return askDelete(kind, id);
    select(kind, id);
  });

  const all = store.sites.filter((s) => s.type === "POP" || s.type === "ODC");
  if (all.length && !route.query.project) fitTo(turf.bbox(turf.featureCollection(all.map((s) => turf.point(s.coord)))) as any, { top: 120, bottom: 120, left: 80, right: 560 } as any, 16);
  if (route.query.project) {
    const ps = store.sites.filter((s) => s.project === route.query.project && s.status === "Planned");
    if (ps.length) {
      fitTo(turf.bbox(turf.featureCollection(ps.map((s) => turf.point(s.coord)))) as any, 100);
      toast.add({ title: "Aset Planned dari FTTH", description: `${ps.length} site point "${route.query.project}" (ring kuning, kabel putus-putus)`, icon: "i-heroicons-information-circle", timeout: 8000 });
    }
  }
}

function select(kind: "site" | "cable", id: string, zoom = false) {
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

// ---------------- picking ----------------
const picking = ref<null | { want: "site" | "cable" | "any" | "point"; label: string; resolve: (v: any) => void }>(null);
function pick(want: "site" | "cable" | "any" | "point", label: string): Promise<any> {
  return new Promise((resolve) => (picking.value = { want, label, resolve }));
}

// ---------------- move ----------------
const moveState = ref<{ siteId: string; coord?: [number, number] } | null>(null);
function startMove(siteId: string) {
  moveState.value = { siteId };
  tool.value = "edit_site";
  map.value!.getCanvas().style.cursor = "crosshair";
}
function onMoveClick(e: any) {
  if (!moveState.value) return;
  moveState.value.coord = [e.lngLat.lng, e.lngLat.lat];
  previewFeatures.value = [{ type: "Feature", geometry: { type: "Point", coordinates: moveState.value.coord }, properties: {} }];
}
function saveMove() {
  const mv = moveState.value;
  if (!mv?.coord) return;
  const s = store.siteById(mv.siteId)!;
  const old = s.coord;
  store.updateSite(mv.siteId, { coord: mv.coord });
  // drag connected cable end-points
  store.cables.forEach((c) => {
    const co = c.coords;
    const near = (p: number[]) => metersBetween(p as any, old) < 1.5;
    if (near(co[0])) co[0] = mv.coord!;
    if (near(co[co.length - 1])) co[co.length - 1] = mv.coord!;
  });
  toast.add({ title: "Site point moved", description: s.code, icon: "i-heroicons-arrows-pointing-out", color: "green" });
  cancelMove();
}
function cancelMove() {
  moveState.value = null;
  previewFeatures.value = [];
  if (tool.value === "edit_site") tool.value = null;
  if (map.value) map.value.getCanvas().style.cursor = "";
}
async function editSiteTool() {
  tool.value = "edit_site";
  const r = await pick("site", "Klik site point yang akan dipindah");
  if (r?.id) {
    select("site", r.id);
    startMove(r.id);
  }
}

// ---------------- delete ----------------
const confirmDel = ref<null | { kind: string; id: string; label: string }>(null);
function askDelete(kind: string, id: string) {
  const label = kind === "site" ? store.siteById(id)?.code : store.cables.find((c) => c.id === id)?.label;
  confirmDel.value = { kind, id, label: label || id };
}
function doDelete() {
  const c = confirmDel.value!;
  if (c.kind === "site") store.deleteSite(c.id);
  else store.deleteCable(c.id);
  if (selSite.value === c.id || selCable.value === c.id) (selSite.value = null), (selCable.value = null);
  toast.add({ title: "Deleted", description: c.label, icon: "i-heroicons-trash", color: "red" });
  confirmDel.value = null;
}

// ---------------- add site point ----------------
const newSite = reactive({ type: "ODP", owner: "JLM", status: "Installed" as any, name: "", lat: "", lng: "", poleType: "T7 1-Stage" });
const nextCode = (type: string) => {
  const prefix: Record<string, string> = { POP: "POP-BDG", ODC: "ODC-GDB", ODP: "ODP-GDB-N", Pole: "TP-GDB-N", JC: "JC-GDB-N", Customer: "CUST", Tower: "TWR-BDG" };
  const n = store.sites.filter((s) => s.type === type).length + 1;
  return `${prefix[type]}-${String(n).padStart(type === "Pole" ? 4 : 3, "0")}`;
};
async function pickSiteCoord() {
  const r = await pick("point", "Klik lokasi site point di peta");
  if (r?.coord) {
    newSite.lng = r.coord[0].toFixed(6);
    newSite.lat = r.coord[1].toFixed(6);
    previewFeatures.value = [{ type: "Feature", geometry: { type: "Point", coordinates: r.coord }, properties: {} }];
  }
}
function addSite() {
  const lat = parseFloat(newSite.lat), lng = parseFloat(newSite.lng);
  if (isNaN(lat) || isNaN(lng)) return toast.add({ title: "Koordinat belum diisi", color: "red" });
  const code = nextCode(newSite.type);
  const s = store.addSite({ code, name: newSite.name || code, type: newSite.type, owner: newSite.owner, status: newSite.status, coord: [lng, lat], poleType: newSite.type === "Pole" ? newSite.poleType : undefined });
  previewFeatures.value = [];
  newSite.lat = newSite.lng = newSite.name = "";
  toast.add({ title: "Site point added", description: code, icon: "i-heroicons-check-circle", color: "green" });
  select("site", s.id);
}

// ---------------- bulk import ----------------
const importType = ref("ODP");
const importMsg = ref("");
async function onImport(e: Event) {
  importMsg.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    let pts: { name: string; coord: [number, number]; props: any }[] = [];
    let lines: { name: string; coords: [number, number][] }[] = [];
    if (/\.(xlsx|xls|csv)$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      pts = rows
        .map((r) => {
          const k = (n: string) => Object.keys(r).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === n);
          const lat = parseFloat(r[k("lat") || k("latitude") || ""]), lng = parseFloat(r[k("lng") || k("lon") || k("longitude") || ""]);
          return { name: r[k("nama") || k("name") || k("kode") || k("code") || ""] || "", coord: [lng, lat] as [number, number], props: r };
        })
        .filter((p) => !isNaN(p.coord[0]) && !isNaN(p.coord[1]));
    } else {
      const fc = await parseGeoFile(file);
      fc.features.forEach((f: any) => {
        if (f.geometry?.type === "Point") pts.push({ name: f.properties?.name || "", coord: f.geometry.coordinates.slice(0, 2), props: f.properties });
        if (f.geometry?.type === "LineString") lines.push({ name: f.properties?.name || "", coords: f.geometry.coordinates.map((c: number[]) => [c[0], c[1]]) });
      });
    }
    pts.forEach((p) => {
      const code = p.name || nextCode(importType.value);
      store.sites.push({ id: uid("sp"), code, name: code, type: importType.value, owner: "JLM", status: "Installed", coord: p.coord, createdAt: nowStr(), updatedAt: nowStr() });
    });
    lines.forEach((l, i) => {
      const len = turf.length(turf.lineString(l.coords), { units: "meters" });
      store.cables.push({ id: uid("cb"), code: `CBL-IMP-${i + 1}`, label: l.name || `Imported cable ${i + 1}`, type: "Distribusi", cores: 24, tubes: 2, install: "Aerial", status: "Installed", coords: l.coords, length: Math.round(len) });
    });
    store.log("Import", file.name, `${pts.length} site point (${importType.value}) dan ${lines.length} kabel diimport`);
    importMsg.value = `Berhasil import ${pts.length} titik & ${lines.length} garis dari ${file.name}`;
    const all = [...pts.map((p) => turf.point(p.coord)), ...lines.map((l) => turf.lineString(l.coords))];
    if (all.length) fitTo(turf.bbox(turf.featureCollection(all as any)) as any, 120);
  } catch (err: any) {
    importMsg.value = "Gagal: " + err.message;
  }
}
function downloadTemplate() {
  exportXLSX("Template_Import_Aset_JLM.xlsx", { SitePoint: [{ Kode: "ODP-GDB-N-101", Tipe: "ODP", Lat: -6.9551, Lng: 107.6952, Keterangan: "contoh" }] });
}

// ---------------- add asset ----------------
const assetSite = ref<string | null>(null);
const siteSearch = ref("");
const siteOptions = computed(() => store.sites.filter((s) => s.type !== "Pole" && s.code.toLowerCase().includes(siteSearch.value.toLowerCase())).slice(0, 8));
async function pickAssetSite() {
  const r = await pick("site", "Klik site point tujuan");
  if (r?.id) assetSite.value = r.id;
}

// ---------------- edit attribute (excel) ----------------
const attrMsg = ref("");
async function onAttrFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const wb = XLSX.read(await file.arrayBuffer());
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  let n = 0;
  rows.forEach((r) => {
    const code = r.Kode || r.Code || r.kode;
    const a = store.assets.find((x) => x.code === code);
    if (a) {
      store.updateAsset(a.id, { serial: r.Serial ?? a.serial, brand: r.Brand ?? a.brand, description: r.Keterangan ?? a.description, inspectedBy: r.Inspector ?? a.inspectedBy });
      n++;
    }
    const s = store.sites.find((x) => x.code === code);
    if (s && r.Status) (store.updateSite(s.id, { status: r.Status }), n++);
  });
  attrMsg.value = `${n} record diperbarui dari ${rows.length} baris.`;
}
function downloadAttrTemplate() {
  exportXLSX("Template_Update_Atribut.xlsx", { Atribut: store.assets.slice(0, 20).map((a) => ({ Kode: a.code, Serial: a.serial || "", Brand: a.brand || "", Inspector: a.inspectedBy || "", Keterangan: a.description || "", Status: "" })) });
}

// ---------------- add cable ----------------
const cab = reactive({ from: "" as string, to: "" as string, type: "Distribusi", cores: 24, install: "Aerial" as "Aerial" | "Underground", coords: [] as [number, number][], length: 0 });
async function pickCableEnd(which: "from" | "to") {
  const r = await pick("site", which === "from" ? "Klik site point awal" : "Klik site point akhir");
  if (r?.id) cab[which] = r.id;
}
function autoRoute() {
  const a = store.siteById(cab.from), b = store.siteById(cab.to);
  if (!a || !b) return;
  const line = turf.lineString([a.coord, b.coord]);
  const r = routeAlongRoads(geo.roadsNear(turf.buffer(line, 200, { units: "meters" }), 200), a.coord, b.coord);
  cab.coords = r.coords;
  cab.length = Math.round(r.length);
  previewFeatures.value = [{ type: "Feature", geometry: { type: "LineString", coordinates: r.coords }, properties: {} }];
}
async function drawRoute() {
  const f = await draw.start("line");
  if (!f) return;
  const a = store.siteById(cab.from), b = store.siteById(cab.to);
  const coords = [...(a ? [a.coord] : []), ...f.geometry.coordinates, ...(b ? [b.coord] : [])];
  cab.coords = coords;
  cab.length = Math.round(turf.length(turf.lineString(coords), { units: "meters" }));
  previewFeatures.value = [{ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} }];
}
const cabLabel = computed(() => {
  const a = store.siteById(cab.from), b = store.siteById(cab.to);
  const k = cab.type === "Feeder" || cab.type === "Backbone" ? "F" : cab.type === "Sub Feeder" ? "S" : "D";
  return `BDG-${k}${4600 + store.cables.length}.${cab.cores} (${cab.type === "Distribusi" ? "Dist" : "Feed"} ${(a?.code || "A")}-${(b?.code || "B")}_${cab.length}M)`;
});
function addCable() {
  if (cab.coords.length < 2) return toast.add({ title: "Route belum dibuat", color: "red" });
  const c = store.addCable({ code: `CBL-N-${String(store.cables.length + 1).padStart(3, "0")}`, label: cabLabel.value, type: cab.type, cores: cab.cores, tubes: Math.max(1, cab.cores / 12), install: cab.install, status: "Installed", coords: cab.coords, length: cab.length, from: store.siteById(cab.from)?.code, to: store.siteById(cab.to)?.code });
  Object.assign(cab, { from: "", to: "", coords: [], length: 0 });
  previewFeatures.value = [];
  select("cable", c.id);
  toast.add({ title: "Cable added", description: c.label, icon: "i-heroicons-check-circle", color: "green" });
}

// ---------------- generate pole ----------------
const pole = reactive({ cable: "" as string, spacing: 60, type: "T7 1-Stage", preview: [] as [number, number][] });
async function pickPoleCable() {
  const r = await pick("cable", "Klik kabel di peta");
  if (r?.id) {
    pole.cable = r.id;
    previewPoles();
  }
}
function previewPoles() {
  const c = store.cables.find((x) => x.id === pole.cable);
  if (!c) return;
  if (c.type === "Feeder" || c.type === "Backbone") pole.type = "T7 2-Stage";
  pole.preview = polesAlong(c.coords as any, pole.spacing).filter((p) => !store.sites.some((s) => s.type === "Pole" && metersBetween(s.coord, p) < 8));
  previewFeatures.value = pole.preview.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: p }, properties: {} }));
}
watch(() => pole.spacing, previewPoles);
function generatePoles() {
  const c = store.cables.find((x) => x.id === pole.cable);
  if (!c) return;
  const base = store.sites.filter((s) => s.type === "Pole").length;
  pole.preview.forEach((p, i) => store.sites.push({ id: uid("sp"), code: `TP-GDB-N-${String(base + i + 1).padStart(4, "0")}`, name: "Tiang", type: "Pole", poleType: pole.type, owner: "JLM", status: c.status, coord: p, createdAt: nowStr(), updatedAt: nowStr() }));
  store.log("Create", c.code, `${pole.preview.length} tiang ${pole.type} digenerate (jarak ${pole.spacing} m)`);
  toast.add({ title: "Poles generated", description: `${pole.preview.length} tiang di sepanjang ${c.code}`, icon: "i-heroicons-check-circle", color: "green" });
  pole.preview = [];
  previewFeatures.value = [];
}
function polesFromDetail(cableId: string) {
  closeTool();
  tool.value = "generate_pole";
  pole.cable = cableId;
  previewPoles();
}

// core config
async function coreConfigTool() {
  tool.value = "core_config";
  const r = await pick("cable", "Klik kabel untuk konfigurasi core");
  if (r?.id) {
    select("cable", r.id);
    tool.value = null;
  }
}

function openTool(id: string) {
  closeTool();
  if (id === "edit_site") return editSiteTool();
  if (id === "core_config") return coreConfigTool();
  if (id === "table") return (showTable.value = true);
  tool.value = id;
  if (id === "delete") toast.add({ title: "Delete mode", description: "Klik site point / kabel yang ingin dihapus." });
}
function closeTool() {
  draw.cancel();
  picking.value = null;
  previewFeatures.value = [];
  if (moveState.value) cancelMove();
  tool.value = null;
}
const TOOL_ITEMS = [
  { id: "add_site", label: "Add Sitepoint", icon: IcAddData },
  { id: "add_assets", label: "Add Assets", icon: IcAsset },
  { id: "edit_attr", label: "Edit Attribute Asset", icon: IcAttribute },
  { id: "add_cable", label: "Add Cable / Route", icon: IcCable },
  { id: "edit_site", label: "Edit Site Point (Move)", icon: IcRoute },
  { id: "delete", label: "Delete Site Point / Cable", icon: IcTrash, danger: true },
  { id: "core_config", label: "Core Config", icon: IcCore },
  { id: "generate_pole", label: "Generate Pole", icon: IcPole },
  { id: "import", label: "Import Data (KML / Excel)", icon: IcCloud },
  { id: "table", label: "Asset Table", icon: IcList },
];
const TOOL_LABEL = computed(() => TOOL_ITEMS.find((t) => t.id === tool.value)?.label || "");

function onTop(k: string) {
  if (k === "layers") (showLayers.value = !showLayers.value), (showActivity.value = false);
  if (k === "legend") showLegend.value = !showLegend.value;
  if (k === "activity") (showActivity.value = !showActivity.value), (showLayers.value = false);
}
onBeforeUnmount(() => {
  closeTool();
  layers.reset();
});
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <MapBaseMap :center="[107.688, -6.958]" :zoom="14" @ready="onReady" />
    <LayoutTopBar
      title="Asset Management Map"
      :toggles="[
        { key: 'layers', label: 'Layers', icon: IcMapLayer, active: showLayers },
        { key: 'legend', label: 'Legends', icon: IcBasemap, active: showLegend },
        { key: 'activity', label: 'Activity Log', icon: IcTime, active: showActivity },
      ]"
      :actions="[
        { key: 'table', label: 'Asset Table', icon: 'i-heroicons-table-cells' },
        { key: 'import', label: 'Import', icon: 'i-heroicons-arrow-up-tray' },
      ]"
      @toggle="onTop"
      @action="(k) => (k === 'table' ? (showTable = !showTable) : openTool('import'))"
      @search="(c) => map?.flyTo({ center: c, zoom: 17 })"
    />

    <div v-if="showLayers" class="absolute z-20 top-[5.5rem] left-6 bg-white w-[18.5rem] rounded-xs h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up"><MapLayerPanel @close="showLayers = false" /></div>
    <div v-if="showActivity" class="absolute z-20 top-[5.5rem] left-6 bg-white w-[20rem] rounded-xs h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up"><AssetActivityPanel @close="showActivity = false" /></div>
    <div v-if="showLegend" class="absolute z-20 top-[5.5rem] bg-white w-[15.5rem] rounded-xs max-h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up flex flex-col" :class="showLayers || showActivity ? 'left-[22rem]' : 'left-6'"><MapLegendPanel @close="showLegend = false" /></div>

    <div class="z-20 absolute top-[5.5rem] flex flex-col gap-2 transition-all duration-300" :class="right ? 'right-[32.5rem]' : 'right-6'">
      <MapControlButton tip="Asset Summary / Laporan" :active="right === 'summary'" @click="right = right === 'summary' ? '' : 'summary'"><IcChart class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Detail Info" :active="right === 'detail'" @click="right = right === 'detail' ? '' : 'detail'"><IcInfo class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Asset Table" :active="showTable" @click="showTable = !showTable"><IcList class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Activity Log" :active="showActivity" @click="onTop('activity')"><IcTime class="w-5 h-5" :font-controlled="false" /></MapControlButton>
    </div>
    <div v-if="right" class="z-20 absolute top-[5.5rem] right-6 h-[calc(100%-12rem)] flex">
      <AssetReportPanel v-if="right === 'summary'" @close="right = ''" @select="(id) => select('site', id, true)" />
      <AssetDetailPanel v-else :site-id="selSite" :cable-id="selCable" @close="right = ''" @add-asset="(sid) => (assetModal = { siteId: sid })" @edit-asset="(sid, aid) => (assetModal = { siteId: sid, assetId: aid })" @move="startMove" @deleted="(selSite = null), (selCable = null)" @zoom="(c) => map?.flyTo({ center: c, zoom: 18.5 })" @poles="polesFromDetail" />
    </div>

    <div v-if="showTable" class="absolute z-30 left-6 bg-white rounded-xs shadow-xl fade-up overflow-hidden" :class="tableFull ? 'top-6 right-6 bottom-6' : 'bottom-24 right-[34rem] h-[42vh]'">
      <AssetTable :full="tableFull" @close="showTable = false" @fullscreen="tableFull = !tableFull" @select="(k, id) => select(k, id, true)" />
    </div>

    <MapBottomToolbar>
      <MapToolDropdown label="Tools" :icon="IcTools" title="Map Tools" description="Geospatial tools to add and manage asset data on the map." :items="TOOL_ITEMS" width="w-64" @select="openTool" />
    </MapBottomToolbar>

    <!-- picking hint -->
    <div v-if="picking" class="absolute z-30 top-[5.5rem] left-1/2 -translate-x-1/2 bg-brand-500 text-white rounded-xs shadow-xl px-4 py-2 text-xs flex items-center gap-3">
      <UIcon name="i-heroicons-cursor-arrow-rays" class="w-4 h-4" />{{ picking.label }}
      <button class="underline" @click="picking = null">Batal</button>
    </div>
    <div v-if="tool === 'delete'" class="absolute z-30 top-[5.5rem] left-1/2 -translate-x-1/2 bg-red-600 text-white rounded-xs shadow-xl px-4 py-2 text-xs flex items-center gap-3">
      <UIcon name="i-heroicons-trash" class="w-4 h-4" />Delete mode — klik site point / kabel yang akan dihapus
      <button class="underline" @click="tool = null">Selesai</button>
    </div>

    <!-- tool cards -->
    <MapToolCard v-if="tool === 'add_site'" label="Add Sitepoint" :icon="IcAddData" @close="closeTool">
      <div class="p-3 grid grid-cols-2 gap-2">
        <UFormGroup label="Site Type" size="xs"><USelect v-model="newSite.type" :options="[...SITE_TYPES]" size="xs" /></UFormGroup>
        <UFormGroup label="Owner" size="xs"><USelect v-model="newSite.owner" :options="['JLM', 'Mitra', 'Sewa (PLN/Telkom)']" size="xs" /></UFormGroup>
        <UFormGroup label="Status" size="xs"><USelect v-model="newSite.status" :options="['Installed', 'Planned', 'Maintenance']" size="xs" /></UFormGroup>
        <UFormGroup v-if="newSite.type === 'Pole'" label="Tipe Tiang" size="xs"><USelect v-model="newSite.poleType" :options="['T7 1-Stage', 'T7 2-Stage', 'T9 2-Stage']" size="xs" /></UFormGroup>
        <UFormGroup v-else label="Nama (opsional)" size="xs"><UInput v-model="newSite.name" size="xs" :placeholder="nextCode(newSite.type)" /></UFormGroup>
        <p class="col-span-2 text-[11px] text-grey-500">Kode otomatis: <b>{{ nextCode(newSite.type) }}</b></p>
        <UFormGroup label="Manual Coordinates" size="xs" class="col-span-2">
          <div class="flex gap-2"><UInput v-model="newSite.lat" size="xs" placeholder="Latitude" /><UInput v-model="newSite.lng" size="xs" placeholder="Longitude" /><UButton size="xs" variant="soft" icon="i-heroicons-map-pin" @click="pickSiteCoord">Pick</UButton></div>
        </UFormGroup>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" @click="(newSite.lat = ''), (newSite.lng = ''), (previewFeatures = [])">Reset</UButton>
        <UButton class="flex-1 justify-center" @click="addSite">Add Data</UButton>
      </div>
      <div class="p-3 border-t text-center text-[11px] text-grey-500">OR <button class="text-blue-600 underline" @click="tool = 'import'">Bulk Upload Site Points</button></div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'import'" label="Import Data (KML / KMZ / GeoJSON / Excel)" :icon="IcCloud" @close="closeTool">
      <div class="p-3 space-y-3">
        <p class="text-[11px] text-grey-500">JLM menyimpan data di Excel / spreadsheet, KMZ, KML dan GIS — semua bisa di-import. Titik → site point, garis → kabel.</p>
        <UFormGroup label="Import titik sebagai" size="xs"><USelect v-model="importType" :options="[...SITE_TYPES]" size="xs" /></UFormGroup>
        <label class="block border-2 border-dashed border-grey-300 hover:border-blue-500 rounded-xs p-5 text-center cursor-pointer">
          <UIcon name="i-heroicons-cloud-arrow-up" class="w-8 h-8 text-brand-500 mx-auto mb-1" />
          <p class="text-xs font-medium">Pilih file</p>
          <p class="text-[10px] text-grey-500">.kml .kmz .geojson .zip(shp) .xlsx .csv (kolom Lat, Lng)</p>
          <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip,.xlsx,.xls,.csv" @change="onImport" />
        </label>
        <p v-if="importMsg" class="text-xs" :class="importMsg.startsWith('Gagal') ? 'text-red-500' : 'text-green-700'">{{ importMsg }}</p>
        <button class="text-[11px] text-blue-600 underline" @click="downloadTemplate">Download template Excel</button>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'add_assets'" label="Add Assets" :icon="IcAsset" @close="closeTool">
      <div class="p-3 space-y-2">
        <p class="text-xs font-medium">Selected Site Point</p>
        <div class="flex gap-2">
          <UInput :model-value="assetSite ? store.siteById(assetSite)?.code : ''" readonly size="xs" placeholder="Klik di peta / cari" class="flex-1" />
          <UButton size="xs" variant="soft" icon="i-heroicons-cursor-arrow-rays" @click="pickAssetSite">Pick</UButton>
        </div>
        <UInput v-model="siteSearch" size="xs" placeholder="Cari kode site point..." icon="i-heroicons-magnifying-glass" />
        <div v-if="siteSearch" class="border rounded-xxs divide-y max-h-40 overflow-y-auto">
          <button v-for="s in siteOptions" :key="s.id" class="w-full text-left p-2 text-xs hover:bg-grey-100" @click="(assetSite = s.id), (siteSearch = ''), select('site', s.id, true)">{{ s.code }} <span class="text-grey-400">· {{ s.type }}</span></button>
        </div>
      </div>
      <div class="p-3 border-t"><UButton block class="justify-center" icon="i-heroicons-plus" :disabled="!assetSite" @click="assetModal = { siteId: assetSite! }">Add Asset</UButton></div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'edit_attr'" label="Edit Attribute Asset (Excel)" :icon="IcAttribute" @close="closeTool">
      <div class="p-3 space-y-3">
        <p class="text-[11px] text-grey-500">Update atribut massal (Serial, Brand, Inspector, Status) berdasarkan kolom <b>Kode</b>.</p>
        <label class="block border-2 border-dashed border-grey-300 hover:border-blue-500 rounded-xs p-5 text-center cursor-pointer">
          <UIcon name="i-heroicons-document-arrow-up" class="w-8 h-8 text-brand-500 mx-auto mb-1" />
          <p class="text-xs font-medium">Upload Excel File</p>
          <input type="file" class="hidden" accept=".xlsx,.xls,.csv" @change="onAttrFile" />
        </label>
        <p v-if="attrMsg" class="text-xs text-green-700">{{ attrMsg }}</p>
        <button class="text-[11px] text-blue-600 underline" @click="downloadAttrTemplate">Download template (20 aset)</button>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'add_cable'" label="Add Cable / Route" :icon="IcCable" @close="closeTool">
      <div class="p-3 space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <UFormGroup label="Dari site point" size="xs"><div class="flex gap-1"><UInput :model-value="store.siteById(cab.from)?.code || ''" readonly size="xs" placeholder="Pick" class="flex-1" /><UButton size="xs" variant="soft" icon="i-heroicons-cursor-arrow-rays" @click="pickCableEnd('from')" /></div></UFormGroup>
          <UFormGroup label="Ke site point" size="xs"><div class="flex gap-1"><UInput :model-value="store.siteById(cab.to)?.code || ''" readonly size="xs" placeholder="Pick" class="flex-1" /><UButton size="xs" variant="soft" icon="i-heroicons-cursor-arrow-rays" @click="pickCableEnd('to')" /></div></UFormGroup>
          <UFormGroup label="Cable Type" size="xs"><USelect v-model="cab.type" :options="['Backbone', 'Feeder', 'Sub Feeder', 'Distribusi', 'Drop']" size="xs" /></UFormGroup>
          <UFormGroup label="Core" size="xs"><USelect v-model.number="cab.cores" :options="[1, 12, 24, 48, 96, 144, 288]" size="xs" /></UFormGroup>
          <UFormGroup label="Instalasi" size="xs" class="col-span-2"><USelect v-model="cab.install" :options="['Aerial', 'Underground']" size="xs" /></UFormGroup>
        </div>
        <div class="flex gap-2">
          <UButton size="xs" class="flex-1 justify-center" variant="soft" :disabled="!cab.from || !cab.to" @click="autoRoute">Auto Generate Route</UButton>
          <UButton size="xs" class="flex-1 justify-center" variant="soft" @click="draw.active.value ? draw.finishNow() : drawRoute()">{{ draw.active.value ? "Finish drawing" : "Draw Route Manually" }}</UButton>
        </div>
        <div v-if="cab.length" class="bg-brand-50 rounded-xxs p-2 text-[11px]">Route Length: <b>{{ fmt(cab.length) }} meters</b><br />Label: <b class="break-all">{{ cabLabel }}</b></div>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" @click="(Object.assign(cab, { from: '', to: '', coords: [], length: 0 }), (previewFeatures = []))">Reset</UButton>
        <UButton class="flex-1 justify-center" :disabled="cab.coords.length < 2" @click="addCable">Add Cable</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'edit_site' && moveState" label="Edit Site Point" :icon="IcRoute" @close="cancelMove">
      <div class="p-3 space-y-2 text-xs">
        <p class="font-medium">Editing Site Point: <b>{{ store.siteById(moveState.siteId)?.code }}</b></p>
        <ol class="text-grey-600 list-decimal ml-4 text-[11px]"><li>Klik lokasi baru di peta</li><li>Klik Save untuk update posisi (ujung kabel ikut berpindah)</li></ol>
        <p v-if="moveState.coord">New Position: <b>{{ moveState.coord[1].toFixed(6) }}, {{ moveState.coord[0].toFixed(6) }}</b></p>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" @click="cancelMove">Reset</UButton>
        <UButton class="flex-1 justify-center" :disabled="!moveState.coord" @click="saveMove">Save</UButton>
      </div>
    </MapToolCard>

    <MapToolCard v-if="tool === 'generate_pole'" label="Generate Pole" :icon="IcPole" @close="closeTool">
      <div class="p-3 space-y-2">
        <div class="flex gap-2"><UInput :model-value="store.cables.find((c) => c.id === pole.cable)?.code || ''" readonly size="xs" placeholder="Select cable on map" class="flex-1" /><UButton size="xs" variant="soft" icon="i-heroicons-cursor-arrow-rays" @click="pickPoleCable">Pick</UButton></div>
        <div class="grid grid-cols-2 gap-2">
          <UFormGroup label="Spacing (m)" size="xs" help="Standar JLM max 60 m"><UInput v-model.number="pole.spacing" type="number" size="xs" /></UFormGroup>
          <UFormGroup label="Tipe Tiang" size="xs"><USelect v-model="pole.type" :options="['T7 1-Stage', 'T7 2-Stage', 'T9 2-Stage']" size="xs" /></UFormGroup>
        </div>
        <p v-if="pole.cable" class="text-xs bg-brand-50 rounded-xxs p-2">Preview: <b>{{ pole.preview.length }}</b> tiang baru (tiang existing dalam 8 m dilewati)</p>
      </div>
      <div class="p-3 flex gap-2 border-t border-grey-200">
        <UButton color="gray" class="flex-1 justify-center" @click="(pole.preview = []), (previewFeatures = [])">Reset</UButton>
        <UButton class="flex-1 justify-center" :disabled="!pole.preview.length" @click="generatePoles">Generate Poles</UButton>
      </div>
    </MapToolCard>

    <AssetFormModal :open="!!assetModal" :site-id="assetModal?.siteId || null" :asset="assetModal?.assetId ? store.assets.find((a) => a.id === assetModal!.assetId) : null" @close="assetModal = null" @saved="(a) => select('site', a.siteId)" />

    <UModal :model-value="!!confirmDel" @update:model-value="!$event && (confirmDel = null)">
      <div class="p-5 space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-600" /></div>
          <div><p class="font-semibold">Hapus {{ confirmDel?.kind === "site" ? "site point" : "kabel" }}?</p><p class="text-xs text-grey-500 break-all">{{ confirmDel?.label }}</p></div>
        </div>
        <div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="confirmDel = null">Cancel</UButton><UButton color="red" @click="doDelete">Delete</UButton></div>
      </div>
    </UModal>

    <div v-if="!ready" class="absolute inset-0 z-40 flex items-center justify-center bg-white/40 pointer-events-none">
      <div class="bg-white rounded-xs shadow-lg px-5 py-3 text-sm flex items-center gap-3"><UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5 text-blue-600" /> Loading asset data...</div>
    </div>
    <MapControls :extent="EXTENT" />
    <MapCoordinatesPanel />
  </div>
</template>
