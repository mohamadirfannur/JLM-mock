<script setup lang="ts">
import * as turf from "@turf/turf";
import { PRICE } from "~/utils/ftthEngine";
import type { AreaSel } from "~/stores/area";

definePageMeta({ layout: "app" });
useHead({ title: "FTTH Auto-Design · JLM" });
const route = useRoute();
const { boot, geo } = useBoot();
const { map, setData, addLayer, removeSource, setVisible, fitTo } = useMap();
const layers = useLayers();
const draw = useDraw();
const ftth = useFtthStore();
const asset = useAssetStore(); // read-only: existing network as design context
const area = useAreaStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const leftOpen = ref(true);
const leftTab = ref<"layer" | "proyek">("proyek");
const right = ref<"" | "queue" | "result" | "standar">("queue");
const queueTab = ref<"process" | "done">("process");
const filterOpen = ref(false);
const filterRef = ref<any>(null);
const wizardOpen = ref(false);
const wizardPreset = ref<any>(null);
const drawnAoi = ref<any>(null);
const pickedOlt = ref<[number, number] | null>(null);
const drawing = ref<null | "aoi" | "olt">(null);
const layerVis = reactive<Record<string, boolean>>({});
const ready = ref(false);

// ---------- design layers ----------
const ORDER = ["boundary", "drops", "homes", "cables", "coils", "poles", "jc", "odp", "odc", "olt"];
const lid = (pid: string, k: string) => `f-${pid}-${k}`;
function specs(pid: string): Record<string, any[]> {
  const s = (k: string) => `fs-${pid}-${k}`;
  const lab = (field: string, min: number, size = 10) => ({ layout: { "text-field": ["get", field], "text-font": ["Noto Sans Bold"], "text-size": size, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true }, minzoom: min, paint: { "text-color": "#7B2FFF", "text-halo-color": "#ffffff", "text-halo-width": 2.4 } });
  const width = ["interpolate", ["linear"], ["get", "cores"], 12, 2.2, 96, 4, 288, 5.5];
  return {
    boundary: [
      { id: lid(pid, "boundary") + "-fill", type: "fill", source: s("boundary"), paint: { "fill-color": "#00D4FF", "fill-opacity": 0.05 } },
      { id: lid(pid, "boundary"), type: "line", source: s("boundary"), paint: { "line-color": "#00AACC", "line-width": 2, "line-dasharray": [3, 2] } },
    ],
    drops: [{ id: lid(pid, "drops"), type: "line", source: s("drops"), minzoom: 16, paint: { "line-color": "#A78BFA", "line-width": 0.7, "line-opacity": 0.6 } }],
    homes: [{ id: lid(pid, "homes"), type: "circle", source: s("homes"), minzoom: 14.5, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.6, 18, 3.6], "circle-color": ["case", ["==", ["get", "phase"], "Build"], "#00D4FF", "#B8C4C1"] } }],
    cables: [
      { id: lid(pid, "cables"), type: "line", source: s("cables"), filter: ["==", ["get", "install"], "Aerial"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["match", ["get", "kind"], "feeder", "#7B2FFF", "#A78BFA"], "line-width": width } },
      { id: lid(pid, "cables") + "-ug", type: "line", source: s("cables"), filter: ["==", ["get", "install"], "Underground"], paint: { "line-color": "#F59E0B", "line-width": 3.5, "line-dasharray": [1.4, 1] } },
    ],
    coils: [{ id: lid(pid, "coils"), type: "circle", source: s("coils"), minzoom: 14, paint: { "circle-radius": 5, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#F59E0B", "circle-stroke-width": 2 } }],
    poles: [{ id: lid(pid, "poles"), type: "symbol", source: s("poles"), minzoom: 14.5, layout: { "icon-image": "square-amber", "icon-allow-overlap": true, "icon-size": ["match", ["get", "type"], "T9 2-Stage", 1.15, "T7 2-Stage", 0.95, 0.8] } }],
    jc: [{ id: lid(pid, "jc"), type: "circle", source: s("jc"), paint: { "circle-radius": 5, "circle-color": "#F59E0B", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
    odp: [
      { id: lid(pid, "odp"), type: "circle", source: s("odp"), paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 6], "circle-color": "#ffffff", "circle-stroke-color": "#7B2FFF", "circle-stroke-width": 2.4 } },
      { id: lid(pid, "odp") + "-label", type: "symbol", source: s("odp"), ...lab("code", 16.4) },
    ],
    odc: [
      { id: lid(pid, "odc"), type: "circle", source: s("odc"), paint: { "circle-radius": 8, "circle-color": "#7B2FFF", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } },
      { id: lid(pid, "odc") + "-label", type: "symbol", source: s("odc"), ...lab("code", 13.5, 11) },
    ],
    olt: [
      { id: lid(pid, "olt"), type: "symbol", source: s("olt"), layout: { "icon-image": "diamond-cyan", "icon-allow-overlap": true, "icon-size": 1.15 } },
      { id: lid(pid, "olt") + "-label", type: "symbol", source: s("olt"), ...lab("code", 12, 11) },
    ],
  };
}
function drawProject(pid: string) {
  const r = ftth.results[pid];
  if (!r) return;
  const sp = specs(pid);
  ORDER.forEach((k) => {
    setData(`fs-${pid}-${k}`, r.layers[k]);
    sp[k].forEach((l) => addLayer(l));
    setVisible(sp[k].map((l) => l.id), layerVis[k] !== false);
  });
  registerLayers();
}
function clearProject(pid: string) {
  ORDER.forEach((k) => removeSource(`fs-${pid}-${k}`));
}
function registerLayers() {
  const G = "Desain FTTH (Planned)";
  layers.unregisterGroup(G);
  const ids = (k: string) => ftth.active.flatMap((pid) => specs(pid)[k].map((l) => l.id));
  const cnt = (k: string) => ftth.active.reduce((a, pid) => a + (ftth.results[pid]?.layers[k]?.features.length || 0), 0);
  const D: [string, string, string, any, any][] = [
    ["olt", "OLT (existing — prioritized)", "#00D4FF", "diamond", "Aktif"],
    ["odc", "ODC (planned)", "#7B2FFF", "circle", "Pasif"],
    ["odp", "ODP (planned)", "#7B2FFF", "circle", "Pasif"],
    ["poles", "Tiang (planned)", "#F59E0B", "square", "Pasif"],
    ["jc", "Joint Closure", "#F59E0B", "circle", "Pasif"],
    ["coils", "Coil / Slack", "#F59E0B", "circle", "Pasif"],
    ["cables", "Planned route (confirm reqd.)", "#7B2FFF", "line", "Rute"],
    ["drops", "Kabel drop", "#A78BFA", "line", "Rute"],
    ["homes", "Homepass", "#00D4FF", "circle", "Area"],
    ["boundary", "Batas RW / Cluster", "#00AACC", "line", "Area"],
  ];
  D.forEach(([k, l, c, kind, cat]) => layers.register({ id: "ftth-" + k, label: l, group: G, color: c, kind, cat, mapLayers: ids(k), visible: layerVis[k] !== false, count: cnt(k), dashed: k === "boundary" }));
}
function toggleLayerKey(k: string) {
  layerVis[k] = layerVis[k] === false;
  ftth.active.forEach((pid) => setVisible(specs(pid)[k].map((l) => l.id), layerVis[k]));
  layers.toggle("ftth-" + k, layerVis[k]);
}
async function addToMap(pid: string, zoom = true) {
  const p = ftth.byId(pid);
  if (!p) return;
  ftth.compute(p, geo);
  if (!ftth.active.includes(pid)) ftth.active.push(pid);
  drawProject(pid);
  ftth.focusId = pid;
  if (zoom) fitTo(turf.bbox(ftth.results[pid].layers.boundary) as any, 120);
}
function hideProject(pid: string) {
  clearProject(pid);
  ftth.active = ftth.active.filter((x) => x !== pid);
  if (ftth.focusId === pid) ftth.focusId = ftth.active[0] || null;
  registerLayers();
}
async function setPenetration(v: number) {
  const pid = ftth.focusId;
  if (!pid) return;
  const p = ftth.byId(pid)!;
  ftth.update(pid, { params: { ...p.params, penetration: v } });
  ftth.compute(ftth.byId(pid)!, geo);
  drawProject(pid);
}

// existing network context
function existingFC() {
  return {
    type: "FeatureCollection",
    features: asset.cables.filter((c) => c.status === "Installed").map((c) => turf.lineString(c.coords, { type: c.type })),
  };
}
function existingPts() {
  return { type: "FeatureCollection", features: asset.sites.filter((s) => s.status === "Installed" && (s.type === "ODP" || s.type === "POP")).map((s) => turf.point(s.coord, { type: s.type, code: s.code })) };
}

async function onReady() {
  layers.reset();
  await boot();
  const m = map.value!;
  addShapeImages(m);
  ready.value = true;
  setData("ex-cables", existingFC());
  setData("ex-pts", existingPts());
  setData("ftth-preview", EMPTY_FC);
  setData("bld-ftth", geo.data.buildings);
  addLayer({ id: "bld-ftth", type: "fill", source: "bld-ftth", minzoom: 15, paint: { "fill-color": "#61718B", "fill-opacity": 0.08 } });
  addLayer({ id: "ex-cables", type: "line", source: "ex-cables", paint: { "line-color": "#00D4FF", "line-width": 1.8, "line-opacity": 0.55 } });
  addLayer({ id: "ex-odp", type: "circle", source: "ex-pts", filter: ["==", ["get", "type"], "ODP"], paint: { "circle-radius": 3, "circle-color": "#00D4FF", "circle-opacity": 0.6 } });
  addLayer({ id: "ex-pop", type: "symbol", source: "ex-pts", filter: ["==", ["get", "type"], "POP"], layout: { "icon-image": "diamond-cyan", "icon-allow-overlap": true, "text-field": ["get", "code"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top" }, paint: { "text-color": "#00AACC", "text-halo-color": "#fff", "text-halo-width": 2.4 } });
  addLayer({ id: "ftth-preview-fill", type: "fill", source: "ftth-preview", paint: { "fill-color": "#7B2FFF", "fill-opacity": 0.06 } });
  addLayer({ id: "ftth-preview-line", type: "line", source: "ftth-preview", paint: { "line-color": "#7B2FFF", "line-width": 2.2, "line-dasharray": [2, 1.4] } });
  const GE = "Jaringan Existing";
  layers.register({ id: "ex-cables", label: "Existing aerial fiber", group: GE, color: "#00D4FF", kind: "line", cat: "Rute", mapLayers: ["ex-cables"], visible: true, count: asset.cables.filter((c) => c.status === "Installed").length });
  layers.register({ id: "ex-odp", label: "ODP existing", group: GE, color: "#00D4FF", kind: "circle", cat: "Pasif", mapLayers: ["ex-odp"], visible: true });
  layers.register({ id: "ex-pop", label: "OLT / POP existing", group: GE, color: "#00D4FF", kind: "diamond", cat: "Aktif", mapLayers: ["ex-pop"], visible: true });
  layers.register({ id: "bld-ftth", label: "Footprint bangunan", group: GE, color: "#61718B", kind: "fill", cat: "Area", mapLayers: ["bld-ftth"], visible: true, count: geo.data.buildings!.features.length });

  m.on("click", onMapClick);
  m.on("mousemove", (e) => {
    if (draw.active.value || moving.value) return;
    m.getCanvas().style.cursor = m.queryRenderedFeatures(e.point, { layers: clickable() }).length ? "pointer" : "";
  });

  // entry flow
  if (route.query.new) openWizard();
  const inserted = ftth.jobs.filter((j) => j.status === "inserted").map((j) => j.projectId);
  const want = route.query.project ? [String(route.query.project)] : [];
  const ids = [...new Set([...ftth.active.filter((x) => inserted.includes(x)), ...inserted.slice(0, 1), ...want])].filter((id) => ftth.byId(id));
  ftth.active = [];
  for (const id of ids) {
    if (!inserted.includes(id)) continue;
    await addToMap(id, id === ids[ids.length - 1] && !wizardOpen.value);
  }
  if (want[0] && !inserted.includes(want[0])) focusJob(want[0]);
  else if (want[0]) right.value = "result";
  if (!ids.length && area.bbox && !area.showAll) fitTo(area.bbox, 100);
}
const clickable = () => ftth.active.flatMap((pid) => ["olt", "odc", "odp", "jc", "poles", "cables"].map((k) => lid(pid, k))).filter((id) => map.value?.getLayer(id));

// ---------- popup / edit ----------
const editing = ref<string | null>(null);
const selected = ref<{ pid: string; layer: string; props: any; coord: [number, number] } | null>(null);
const moving = ref(false);
const addMode = ref<"" | "odp" | "poles" | "jc">("");
const pop = ref<{ coord: [number, number]; title: string; rows: [string, any][] } | null>(null);
function onMapClick(e: any) {
  if (draw.active.value) return;
  const m = map.value!;
  if (moving.value && selected.value) {
    ftth.addEdit(selected.value.pid, { layer: selected.value.layer, code: selected.value.props.code, op: "move", coord: [e.lngLat.lng, e.lngLat.lat] });
    moving.value = false;
    rerun(selected.value.pid);
    toast.add({ title: "Posisi diperbarui", description: selected.value.props.code, icon: "i-lucide-move" });
    selected.value = null;
    return;
  }
  if (addMode.value && editing.value) {
    const pid = editing.value;
    const p = ftth.byId(pid)!;
    const n = p.edits.filter((x) => x.op === "add" && x.layer === addMode.value).length + 1;
    const code = addMode.value === "odp" ? `ODP-${p.params.areaCode}-M${String(n).padStart(2, "0")}` : addMode.value === "poles" ? `TP-${p.params.areaCode}-M${String(n).padStart(3, "0")}` : `JC-${p.params.areaCode}-M${n}`;
    ftth.addEdit(pid, { layer: addMode.value, code, op: "add", coord: [e.lngLat.lng, e.lngLat.lat] });
    rerun(pid);
    toast.add({ title: "Ditambahkan ke desain", description: code, icon: "i-lucide-plus" });
    return;
  }
  const f = m.queryRenderedFeatures(e.point, { layers: clickable() })[0];
  if (!f) return (pop.value = null);
  const p: any = f.properties;
  const pid = f.layer.id.split("-").slice(1, -1).join("-");
  const layer = f.layer.id.split("-").pop()!;
  if (editing.value === pid && layer !== "cables") {
    selected.value = { pid, layer, props: p, coord: (f.geometry as any).coordinates };
    return;
  }
  const NAMES: Record<string, string> = { odp: "ODP (planned)", odc: "ODC (planned)", olt: "OLT", jc: "Joint Closure", poles: "Tiang", cables: "Segmen kabel" };
  const rows: [string, any][] =
    layer === "odp"
      ? [["ODC induk", p.odc], ["Kapasitas", "16 port · splitter 1:16"], ["Homepass", `${p.used} rumah`], ["Port idle", p.idle], ["Drop terjauh", `${p.maxDrop} m`]]
      : layer === "odc"
        ? [["Tipe", p.type], ["ODP terhubung", `${p.odpCount} / ${p.capacity}`], ["OLT", p.olt]]
        : layer === "cables"
          ? [["Kelas", `${p.type} ${p.cores}C`], ["Panjang", `${fmt(p.length)} m`], ["Instalasi", p.install], ["Dari", p.owner]]
          : layer === "olt"
            ? [["PON port", p.ponPorts], ["Mode", p.mode]]
            : layer === "poles"
              ? [["Tipe", p.type]]
              : [["Keterangan", p.reason || "-"]];
  pop.value = { coord: e.lngLat ? [e.lngLat.lng, e.lngLat.lat] : (f.geometry as any).coordinates, title: layer === "cables" ? p.label : p.code, rows: [["Layer", NAMES[layer]], ...rows] };
}
function rerun(pid: string) {
  ftth.compute(ftth.byId(pid)!, geo);
  drawProject(pid);
}
function deleteSelected() {
  const s = selected.value!;
  ftth.addEdit(s.pid, { layer: s.layer, code: s.props.code, op: "delete" });
  toast.add({ title: "Dihapus dari desain", description: s.props.code, icon: "i-lucide-trash-2", color: "red" });
  rerun(s.pid);
  selected.value = null;
}
function toggleEdit(pid: string) {
  addMode.value = "";
  editing.value = editing.value === pid ? null : pid;
  selected.value = null;
  moving.value = false;
}

// ---------- wizard / queue ----------
function openWizard() {
  wizardPreset.value = null;
  drawnAoi.value = null;
  pickedOlt.value = null;
  wizardOpen.value = true;
}
async function requestDraw() {
  wizardOpen.value = false;
  drawing.value = "aoi";
  const f = await draw.start("polygon");
  drawing.value = null;
  if (f) (drawnAoi.value = f), setData("ftth-preview", f);
  wizardOpen.value = true;
}
async function requestOlt() {
  wizardOpen.value = false;
  drawing.value = "olt";
  const f = await draw.start("point");
  drawing.value = null;
  if (f) pickedOlt.value = f.geometry.coordinates;
  wizardOpen.value = true;
}
function onPreview(f: any) {
  setData("ftth-preview", f);
  fitTo(turf.bbox(f) as any, 140);
}
function onGenerate(payload: any) {
  wizardOpen.value = false;
  const p = ftth.create(payload);
  const src = payload.source?.startsWith("Upload") ? (payload.source.includes("XLSX") || payload.source.includes("CSV") ? "Excel/GIS Import" : "KMZ Import") : payload.source === "Digambar di peta" ? "Gambar Poligon" : payload.source === "Market Potential" ? "Market Potential" : "RW / Cluster";
  const file = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${payload.name.replace(/[^A-Za-z0-9]+/g, "-")}.${src === "KMZ Import" ? "kmz" : src === "Excel/GIS Import" ? "xlsx" : "geojson"}`;
  ftth.enqueue(p, src, file);
  right.value = "queue";
  queueTab.value = "process";
  toast.add({ title: "Desain masuk antrean", description: `${payload.name} sedang diproses`, icon: "i-lucide-loader-circle" });
}
async function insertJob(j: any) {
  j.status = "inserted";
  ftth.update(j.projectId, { status: "Designed" });
  setData("ftth-preview", EMPTY_FC);
  await addToMap(j.projectId);
  right.value = "result";
  const s = ftth.results[j.projectId].summary;
  toast.add({ title: "Desain di-insert ke peta", description: `${fmt(s.homes)} homepass · ${s.odp} ODP · ${s.odc} ODC · ${fmt(s.cableTotal / 1000, 2)} km kabel`, icon: "i-lucide-circle-check-big", color: "green" });
}
function focusJob(pid: string) {
  const p = ftth.byId(pid);
  if (!p) return;
  setData("ftth-preview", p.aoi);
  fitTo(turf.bbox(p.aoi) as any, 140);
}
function openResult(pid: string) {
  if (!ftth.active.includes(pid)) addToMap(pid);
  else (ftth.focusId = pid), fitTo(turf.bbox(ftth.results[pid].layers.boundary) as any, 120);
  right.value = "result";
}
const processing = computed(() => ftth.jobs.filter((j) => j.status === "processing" || j.status === "paused" || j.status === "completed"));
const done = computed(() => ftth.jobs.filter((j) => j.status === "inserted"));
const SRC_TAG: Record<string, string> = { "KMZ Import": "j-tag-amber", "Excel/GIS Import": "j-tag-purple", "Gambar Poligon": "j-tag-cyan", "Market Potential": "j-tag-teal", "RW / Cluster": "j-tag-blue" };
const estMin = (j: any) => Math.max(1, Math.round(((100 - j.progress) / 100) * (j.homes / 40)));

// ---------- stats ----------
const stat = computed(() => {
  const rs = ftth.active.map((id) => ftth.results[id]).filter(Boolean);
  return {
    hp: ftth.projects.reduce((a, p) => a + (p.homes || 0), 0),
    odp: rs.reduce((a, r) => a + r.summary.odp, 0),
    odc: rs.reduce((a, r) => a + r.summary.odc, 0),
    km: rs.reduce((a, r) => a + r.summary.cableTotal, 0) / 1000,
    jobs: ftth.jobs.filter((j) => j.status === "processing").length,
  };
});

// ---------- filter lokasi -> new design ----------
function applyArea(a: AreaSel[], all: boolean) {
  area.set(a, all);
  filterOpen.value = false;
  if (a.length) {
    const f = a.length === 1 ? a[0].feature : turf.union(turf.featureCollection(a.map((x) => x.feature)) as any) || a[0].feature;
    const homes = geo.buildingsIn(f).length;
    wizardPreset.value = { name: a.map((x) => x.name).join(" + "), feature: f.geometry.type === "Polygon" ? f : a[0].feature, homes };
    setData("ftth-preview", wizardPreset.value.feature);
    fitTo(turf.bbox(f) as any, 120);
    wizardOpen.value = true;
  }
}

// ---------- export / send ----------
function exportFocused(kind: string) {
  const pid = ftth.focusId;
  if (!pid) return;
  const p = ftth.byId(pid)!;
  const r = ftth.results[pid];
  const base = p.name.replace(/[^A-Za-z0-9]+/g, "_");
  const L = r.layers;
  if (kind === "kml")
    download(`${base}_FTTH.kml`, toKML(p.name, [
      { name: "Batas AOI", color: "cyan", features: L.boundary.features },
      { name: "OLT", color: "red", features: L.olt.features },
      { name: "ODC", color: "purple", features: L.odc.features },
      { name: "ODP", color: "blue", features: L.odp.features },
      { name: "Kabel Feeder", color: "orange", features: L.cables.features.filter((f: any) => f.properties.kind === "feeder"), label: (x) => x.label },
      { name: "Kabel Distribusi", color: "green", features: L.cables.features.filter((f: any) => f.properties.kind === "dist"), label: (x) => x.label },
      { name: "Tiang", color: "grey", features: L.poles.features },
      { name: "Joint Closure", color: "yellow", features: L.jc.features },
    ]), "application/vnd.google-earth.kml+xml");
  else if (kind === "dxf") {
    download(`${base}_FTTH.dxf`, toDXF([
      { name: "AOI", color: 4, features: L.boundary.features },
      { name: "KABEL_FEEDER", color: 30, features: L.cables.features.filter((f: any) => f.properties.kind === "feeder") },
      { name: "KABEL_DISTRIBUSI", color: 3, features: L.cables.features.filter((f: any) => f.properties.kind === "dist") },
      { name: "OLT", color: 1, features: L.olt.features },
      { name: "ODC", color: 6, features: L.odc.features },
      { name: "ODP", color: 5, features: L.odp.features },
      { name: "TIANG", color: 8, features: L.poles.features },
      { name: "JC", color: 2, features: L.jc.features },
    ]), "application/dxf");
    toast.add({ title: "File CAD diekspor", description: "Format DXF — buka di AutoCAD lalu Save As .dwg." });
  } else if (kind === "xlsx") {
    const boq = r.boq.flatMap((g) => g.items.map((i) => ({ Kategori: g.category, Grup: g.group, Item: i.item, Satuan: i.unit, "Qty Plan 100%": i.qtyPlan, [`Qty Build ${r.params.penetration}%`]: i.qty, "Harga Satuan (IDR)": i.price, "Total (IDR)": i.total })));
    exportXLSX(`${base}_BOQ_BOM.xlsx`, {
      "BOQ-BOM": boq,
      ODP: L.odp.features.map((f: any) => ({ Kode: f.properties.code, ODC: f.properties.odc, Homepass: f.properties.used, "Max drop (m)": f.properties.maxDrop, Lat: f.geometry.coordinates[1], Lng: f.geometry.coordinates[0] })),
      ODC: L.odc.features.map((f: any) => ({ Kode: f.properties.code, Tipe: f.properties.type, "Jumlah ODP": f.properties.odpCount })),
      Kabel: L.cables.features.map((f: any) => ({ Label: f.properties.label, Tipe: f.properties.type, Core: f.properties.cores, "Panjang (m)": f.properties.length, Instalasi: f.properties.install })),
      Tiang: L.poles.features.map((f: any) => ({ Kode: f.properties.code, Tipe: f.properties.type, Lat: f.geometry.coordinates[1], Lng: f.geometry.coordinates[0] })),
      "Harga Satuan": Object.values(PRICE).map((x) => ({ Item: x.item, Satuan: x.unit, Harga: x.price })),
    });
  } else if (kind === "geojson") download(`${base}_FTTH.geojson`, JSON.stringify({ type: "FeatureCollection", features: ORDER.flatMap((k) => L[k].features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: k } }))) }), "application/geo+json");
  else if (kind === "csv") download(`${base}_homepass.csv`, toCSV(L.homes.features.map((f: any, i: number) => ({ no: i + 1, odp: f.properties.odp, fase: f.properties.phase, lat: f.geometry.coordinates[1].toFixed(6), lng: f.geometry.coordinates[0].toFixed(6) }))), "text/csv");
  else if (kind === "pdf") exportPdf(p, r);
}
async function exportPdf(p: any, r: any) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(15);
  doc.text("Laporan Desain FTTH — Jala Lintas Media", 14, 18);
  doc.setFontSize(10);
  doc.text(`${p.name} · Kec. ${p.kecamatan} · ${nowStr()}`, 14, 25);
  try {
    doc.addImage(map.value!.getCanvas().toDataURL("image/jpeg", 0.8), "JPEG", 14, 30, 182, 100);
  } catch {}
  const s = r.summary;
  autoTable(doc, { startY: 135, head: [["Ringkasan", "Nilai"]], body: [["Homepass (plan 100%)", fmt(s.homes)], [`Build ${s.penetration}%`, fmt(s.buildHomes)], ["ODC (24C / 48C)", `${s.odc} (${s.odc24} / ${s.odc48})`], ["ODP", fmt(s.odp)], ["Tiang", fmt(s.poles)], ["Total kabel", `${fmt(s.cableTotal)} m`], ["Total estimasi biaya", idr(r.totalCost)]], theme: "grid", headStyles: { fillColor: [0, 24, 73] }, styles: { fontSize: 8 } });
  autoTable(doc, { head: [["Grup", "Item", "Qty", "Satuan", "Harga", "Total"]], body: r.boq.flatMap((g: any) => g.items.map((i: any) => [g.group, i.item, fmt(i.qty), i.unit, fmt(i.price), fmt(i.total)])), theme: "striped", headStyles: { fillColor: [0, 170, 204] }, styles: { fontSize: 7 } });
  doc.save(`${p.name.replace(/[^A-Za-z0-9]+/g, "_")}_Laporan.pdf`);
}
function finalize() {
  const pid = ftth.focusId;
  if (!pid) return;
  const p = ftth.byId(pid)!;
  ftth.update(pid, { status: "As-built" });
  toast.add({ title: "Desain difinalisasi", description: `${p.name} ditandai As-built · siap untuk pelaksanaan`, icon: "i-lucide-badge-check", color: "green" });
}
watch([leftOpen, right], () => nextTick(() => setTimeout(() => map.value?.resize(), 10)));
onBeforeUnmount(() => {
  draw.cancel();
  layers.reset();
});
const legend = [
  { label: "Existing aerial fiber", color: "#00D4FF", kind: "line" },
  { label: "Planned route (confirm reqd.)", color: "#7B2FFF", kind: "line" },
  { label: "Distribusi (planned)", color: "#A78BFA", kind: "line" },
  { label: "Underground: review manual", color: "#F59E0B", kind: "line", dashed: true },
  { label: "ODP (existing)", color: "#00D4FF", kind: "circle" },
  { label: "ODP / ODC (planned)", color: "#7B2FFF", kind: "circle" },
  { label: "OLT (existing — prioritized)", color: "#00D4FF", kind: "diamond" },
  { label: "Tiang (planned)", color: "#F59E0B", kind: "square" },
];
const statusTag: Record<string, string> = { Draft: "j-tag-grey", Designed: "j-tag-purple", "Sent to Asset": "j-tag-cyan", "As-built": "j-tag-teal" };
const statusLbl: Record<string, string> = { Draft: "Diproses", Designed: "Desain", "Sent to Asset": "Di inventaris", "As-built": "As-built" };
</script>

<template>
  <div class="absolute inset-0 flex flex-col">
    <div class="h-12 bg-white border-b border-j-line flex items-center px-4 gap-4 shrink-0 z-20">
      <span class="j-tag-cyan font-display font-bold !h-6">FTTH MAPPING · AUTO-DESIGN</span>
      <div class="flex items-center gap-4 text-[13px] overflow-x-auto hide-scrollbar">
        <span class="whitespace-nowrap">Homepass masterplan <b class="text-j-blue">{{ fmt(stat.hp) }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 rounded-full border-2 border-j-purple" />ODP rencana <b class="text-j-purple">{{ fmt(stat.odp) }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-2 h-2 rounded-full bg-j-purple" />ODC <b class="text-j-purple">{{ stat.odc }}</b></span><span class="w-px h-4 bg-j-line" />
        <span class="flex items-center gap-2 whitespace-nowrap"><span class="w-3 h-0.5 bg-j-purple" />Kabel rencana <b>{{ fmt(stat.km, 1) }} km</b></span>
        <span v-if="stat.jobs" class="j-tag-amber whitespace-nowrap"><UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin mr-1" />{{ stat.jobs }} job diproses</span>
      </div>
      <div class="flex-1" />
      <button class="j-btn-outline j-btn-sm font-sans font-medium" @click="filterOpen = true"><UIcon name="i-lucide-filter" class="w-3.5 h-3.5" />Pilih RW / Cluster</button>
      <button class="j-btn-grad j-btn-sm" @click="openWizard"><UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />Desain Baru</button>
    </div>

    <div class="flex-1 flex min-h-0 relative">
      <aside v-if="leftOpen" class="w-[290px] bg-white border-r border-j-line shrink-0 z-10 flex flex-col">
        <div class="px-4 pt-3"><div class="flex bg-j-bg rounded-[8px] p-1"><button v-for="t in [['proyek', 'Proyek Desain'], ['layer', 'Map Content']]" :key="t[0]" class="flex-1 h-7 text-[12px] rounded-[6px] font-display font-bold" :class="leftTab === t[0] ? 'bg-white shadow-sm text-j-ink' : 'text-j-sub'" @click="leftTab = t[0] as any">{{ t[1] }}</button></div></div>
        <div v-if="leftTab === 'layer'" class="flex-1 min-h-0"><JmapContent @close="leftOpen = false" /></div>
        <template v-else>
          <div class="px-4 pt-4 pb-2 flex items-start justify-between"><div><h2 class="j-title text-[16px]">Proyek Desain</h2><p class="text-[12px] text-j-sub">Masterplan per RW / cluster</p></div><button class="w-6 h-6 rounded-[6px] border border-j-line flex items-center justify-center text-j-sub" @click="leftOpen = false"><UIcon name="i-lucide-arrow-left-to-line" class="w-3.5 h-3.5" /></button></div>
          <div class="flex-1 overflow-y-auto thin-scrollbar px-4 pb-3 space-y-2">
            <div v-for="p in ftth.projects" :key="p.id" class="border rounded-[10px] p-3 transition-colors" :class="ftth.focusId === p.id && ftth.active.includes(p.id) ? 'border-j-cyan bg-j-cyan/[0.04]' : 'border-j-line'">
              <div class="flex items-start justify-between gap-2">
                <button class="text-left min-w-0" @click="ftth.active.includes(p.id) ? openResult(p.id) : focusJob(p.id)"><p class="font-display font-bold text-[13px] leading-tight">{{ p.name }}</p><p class="text-[11px] text-j-sub mt-0.5">Kec. {{ p.kecamatan }} · {{ fmt(p.homes) }} HP</p></button>
                <span :class="ftth.jobs.find((j) => j.projectId === p.id)?.status === 'completed' && p.status === 'Draft' ? 'j-tag-cyan' : statusTag[p.status]" class="shrink-0">{{ ftth.jobs.find((j) => j.projectId === p.id)?.status === "completed" && p.status === "Draft" ? "Siap" : statusLbl[p.status] }}</span>
              </div>
              <div class="flex items-center gap-1.5 mt-2">
                <template v-if="ftth.active.includes(p.id)">
                  <button class="j-btn-outline j-btn-sm !h-6 !px-2 font-sans font-normal !text-[11px]" @click="openResult(p.id)"><UIcon name="i-lucide-chart-column" class="w-3 h-3" />Hasil</button>
                  <button class="j-btn-outline j-btn-sm !h-6 !px-2 font-sans font-normal !text-[11px]" :class="editing === p.id && '!border-j-cyan !text-j-cyan'" @click="toggleEdit(p.id)"><UIcon name="i-lucide-square-pen" class="w-3 h-3" />Edit</button>
                  <button class="j-btn-outline j-btn-sm !h-6 !px-2 font-sans font-normal !text-[11px]" @click="hideProject(p.id)"><UIcon name="i-lucide-eye-off" class="w-3 h-3" /></button>
                </template>
                <button v-else-if="ftth.jobs.find((j) => j.projectId === p.id)?.status === 'inserted' || p.status !== 'Draft'" class="j-btn-teal j-btn-sm !h-6 !px-2 font-sans font-normal !text-[11px]" @click="openResult(p.id)">Tampilkan di peta</button>
                <button v-else-if="ftth.jobs.find((j) => j.projectId === p.id)?.status === 'completed'" class="j-btn-primary j-btn-sm !h-6 !px-2 !text-[11px]" @click="insertJob(ftth.jobs.find((j) => j.projectId === p.id))">Generate & Insert ke peta</button>
                <span v-else class="text-[11px] text-j-sub flex items-center gap-1"><UIcon name="i-lucide-loader-circle" class="w-3 h-3 animate-spin text-j-amber" />Dalam antrean · {{ Math.round(ftth.jobs.find((j) => j.projectId === p.id)?.progress || 0) }}%</span>
              </div>
            </div>
          </div>
          <div class="p-4 border-t border-j-line"><button class="j-btn-grad w-full h-10" @click="openWizard"><UIcon name="i-lucide-plus" class="w-4 h-4" />Desain Baru</button></div>
        </template>
      </aside>

      <div class="flex-1 relative min-w-0">
        <MapBaseMap :center="[107.69, -6.955]" :zoom="14" @ready="onReady" />
        <button v-if="!leftOpen" class="j-icon-btn absolute top-4 left-4 z-10" @click="leftOpen = true"><UIcon name="i-lucide-layers" class="w-5 h-5" /></button>
        <div class="absolute top-4 right-4 z-10 flex flex-col gap-3">
          <UTooltip text="Hasil desain & BOQ" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'result' && 'j-icon-btn-on'" @click="right = right === 'result' ? '' : 'result'"><UIcon name="i-lucide-chart-column" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Standar desain JLM" :popper="{ placement: 'left' }"><button class="j-icon-btn" :class="right === 'standar' && 'j-icon-btn-on'" @click="right = right === 'standar' ? '' : 'standar'"><UIcon name="i-lucide-ruler" class="w-5 h-5" /></button></UTooltip>
          <UTooltip text="Processing queue" :popper="{ placement: 'left' }"><button class="j-icon-btn relative" :class="right === 'queue' && 'j-icon-btn-on'" @click="right = right === 'queue' ? '' : 'queue'"><UIcon name="i-lucide-list-checks" class="w-5 h-5" /><span v-if="stat.jobs" class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-j-amber text-white text-[9px] font-bold flex items-center justify-center">{{ stat.jobs }}</span></button></UTooltip>
        </div>
        <div class="absolute bottom-10 right-4 z-10"><JmapControls :extent="EXTENT" /></div>
        <div class="absolute bottom-10 left-4 z-10"><JmapLegend :items="legend" /></div>
        <div class="absolute bottom-2 right-4 z-10"><JmapCoords /></div>

        <div v-if="drawing" class="absolute top-4 left-1/2 -translate-x-1/2 z-20 j-panel px-4 py-2.5 flex items-center gap-3 text-[13px]">
          <UIcon name="i-lucide-pen-line" class="w-4 h-4 text-j-cyan" />{{ drawing === "aoi" ? `Gambar batas RW / cluster · ${draw.vertexCount.value} titik` : "Klik lokasi OLT baru di peta" }}
          <button v-if="drawing === 'aoi'" class="j-btn-primary j-btn-sm" :disabled="draw.vertexCount.value < 3" @click="draw.finishNow()">Selesai</button>
          <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="draw.cancel(), (drawing = null), (wizardOpen = true)">Batal</button>
        </div>
        <div v-if="editing" class="absolute top-4 left-1/2 -translate-x-1/2 z-20 j-panel px-4 py-2.5 flex items-center gap-3 text-[13px]">
          <UIcon name="i-lucide-square-pen" class="w-4 h-4 text-j-cyan" />
          <span v-if="!selected && !addMode">Edit desain — klik ODP / ODC / tiang / JC, atau tambah manual:</span>
          <span v-else-if="addMode" class="text-j-cyan font-medium">Klik peta untuk menambah {{ addMode === "odp" ? "ODP" : addMode === "poles" ? "tiang" : "JC" }}</span>
          <template v-if="!selected">
            <button v-for="a in [['odp', 'ODP'], ['poles', 'Tiang'], ['jc', 'JC']]" :key="a[0]" class="j-btn-sm j-btn" :class="addMode === a[0] ? 'bg-j-cyan text-white' : 'bg-j-bg text-j-ink'" @click="addMode = addMode === a[0] ? '' : (a[0] as any)"><UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />{{ a[1] }}</button>
          </template>
          <template v-else>
            <b>{{ selected.props.code }}</b>
            <button class="j-btn-primary j-btn-sm" @click="moving = true"><UIcon name="i-lucide-move" class="w-3.5 h-3.5" />{{ moving ? "Klik lokasi baru…" : "Pindah" }}</button>
            <button class="j-btn-danger j-btn-sm" @click="deleteSelected"><UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />Hapus</button>
          </template>
          <button v-if="ftth.byId(editing)?.edits.length" class="j-btn-outline j-btn-sm font-sans font-normal" @click="ftth.update(editing!, { edits: [] }), rerun(editing!)">Reset {{ ftth.byId(editing)?.edits.length }} edit</button>
          <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="toggleEdit(editing!)">Selesai</button>
        </div>
        <JmapFeatureCard v-if="pop" :coord="pop.coord">
          <div class="flex items-center justify-between"><span class="flex items-center gap-2 font-display font-bold text-[13px] text-j-purple"><span class="w-2 h-2 rounded-full bg-j-purple" />RENCANA</span><button class="text-j-sub" @click="pop = null"><UIcon name="i-lucide-x" class="w-4 h-4" /></button></div>
          <p class="font-display font-bold text-[15px] mt-2 break-all leading-tight">{{ pop.title }}</p>
          <div class="mt-3 space-y-1.5"><div v-for="r in pop.rows" :key="r[0]" class="flex justify-between gap-3 text-[12px]"><span class="text-j-sub">{{ r[0] }}</span><b class="font-medium text-right">{{ r[1] }}</b></div></div>
        </JmapFeatureCard>
      </div>

      <aside v-if="right" class="w-[372px] shrink-0 p-3 pl-0 z-10">
        <!-- Processing queue -->
        <UiSidePanel v-if="right === 'queue'" title="FTTH Auto-Design" subtitle="Processing queue · job management" @close="right = ''">
          <template #actions><span class="j-tag-teal">Processing Queue</span></template>
          <div class="grid grid-cols-2 gap-1 bg-j-bg rounded-[8px] p-1 mb-3">
            <button class="h-8 rounded-[6px] text-[12px] font-display font-bold flex items-center justify-center gap-1.5" :class="queueTab === 'process' ? 'bg-j-cyan text-white' : 'text-j-sub'" @click="queueTab = 'process'"><UIcon name="i-lucide-loader" class="w-3.5 h-3.5" />On Process ({{ processing.length }})</button>
            <button class="h-8 rounded-[6px] text-[12px] font-display font-bold flex items-center justify-center gap-1.5" :class="queueTab === 'done' ? 'bg-j-cyan text-white' : 'text-j-sub'" @click="queueTab = 'done'"><UIcon name="i-lucide-circle-check" class="w-3.5 h-3.5" />Completed ({{ done.length }})</button>
          </div>
          <div class="rounded-[8px] border border-j-amber/40 bg-j-amber/[0.06] p-3 mb-3">
            <p class="j-label !text-[10px] text-[#B45309]">System Notice</p>
            <p class="text-[11px] text-j-sub mt-1">Desain dioptimalkan untuk kabel aerial. Kabel underground memerlukan tinjauan manual. Penempatan OLT baru menunggu konfirmasi tim — tidak diaktifkan otomatis.</p>
          </div>
          <div class="space-y-3">
            <div v-for="j in queueTab === 'process' ? processing : done" :key="j.id" class="border border-j-line rounded-[10px] p-3">
              <div class="flex items-center gap-2"><span :class="SRC_TAG[j.source] || 'j-tag-grey'">{{ j.source }}</span><span class="flex-1" /><UDropdown :items="[[{ label: 'Hapus job', icon: 'i-lucide-trash-2', click: () => (ftth.jobs = ftth.jobs.filter((x) => x.id !== j.id)) }]]"><button class="text-j-sub"><UIcon name="i-lucide-more-vertical" class="w-4 h-4" /></button></UDropdown></div>
              <p class="text-[11px] text-j-sub mt-2">Queue ID</p>
              <p class="font-display font-bold text-[13px] break-all">{{ j.file }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span class="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4FF] to-[#7B2FFF] text-white text-[11px] font-bold flex items-center justify-center">{{ j.user.split(" ").map((w: string) => w[0]).join("").slice(0, 2) }}</span>
                <div><p class="text-[12px] font-medium">{{ j.user }}</p><p class="text-[11px] text-j-sub">{{ j.role }} · {{ j.createdAt }}</p></div>
              </div>
              <div class="flex justify-between text-[11px] mt-3"><span class="text-j-sub">{{ j.phase }}</span><b class="text-j-cyan">{{ Math.round(j.progress) }}%</b></div>
              <div class="h-1.5 bg-j-soft rounded-full mt-1 overflow-hidden"><div class="h-full rounded-full transition-all duration-500" :class="j.status === 'paused' ? 'bg-j-amber' : 'bg-gradient-to-r from-[#00D4FF] to-[#7B2FFF]'" :style="{ width: j.progress + '%' }" /></div>
              <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-if="j.status === 'processing'" class="j-tag-teal">Processing</span>
                <span v-else-if="j.status === 'paused'" class="j-tag-amber">Paused</span>
                <button v-else-if="j.status === 'completed'" class="j-tag-cyan !h-6 !px-2.5 font-display font-bold hover:bg-j-cyan hover:text-white" @click="insertJob(j)">Generate & Insert to Cable</button>
                <span v-else class="j-tag-cyan">Inserted</span>
                <span class="j-tag-grey">{{ j.rw }} · Aerial</span>
              </div>
              <div class="grid grid-cols-3 gap-2 mt-3">
                <div class="bg-j-bg rounded-[6px] p-2"><p class="text-[10px] text-j-sub">Est. Sites</p><p class="text-[13px] font-bold">~{{ fmt(Math.round(j.homes / 16 + j.homes / 6)) }}</p></div>
                <div class="bg-j-bg rounded-[6px] p-2"><p class="text-[10px] text-j-sub">Est. Time</p><p class="text-[13px] font-bold">{{ j.status === "processing" ? `~${estMin(j)} min` : "Selesai" }}</p></div>
                <div class="bg-j-bg rounded-[6px] p-2"><p class="text-[10px] text-j-sub">Homepass</p><p class="text-[13px] font-bold">{{ fmt(j.homes) }}</p></div>
              </div>
              <div class="grid grid-cols-2 gap-2 mt-3">
                <button class="j-btn-outline j-btn-sm font-sans font-normal" @click="j.status === 'inserted' ? openResult(j.projectId) : focusJob(j.projectId)">Detail</button>
                <button v-if="j.status === 'processing'" class="j-btn j-btn-sm bg-j-amber/10 text-[#B45309]" @click="j.status = 'paused'">Pause</button>
                <button v-else-if="j.status === 'paused'" class="j-btn j-btn-sm bg-j-cyan/10 text-j-cyan" @click="(j.status = 'processing'), ftth.runQueue()">Resume</button>
                <button v-else-if="j.status === 'completed'" class="j-btn j-btn-sm bg-j-purple/10 text-j-purple" @click="insertJob(j)">Review</button>
                <button v-else class="j-btn j-btn-sm bg-j-purple/10 text-j-purple" @click="navigateTo({ path: '/ftth/boq-bom', query: { project: j.projectId } })">BOQ & BOM</button>
              </div>
            </div>
            <p v-if="!(queueTab === 'process' ? processing : done).length" class="text-center text-[12px] text-j-sub py-8">Tidak ada job.</p>
          </div>
        </UiSidePanel>
        <FtthResultPanel v-else-if="right === 'result'" :project-id="ftth.focusId" :layer-vis="layerVis" @close="right = ''" @toggle-layer="toggleLayerKey" @export="exportFocused" @send="finalize" @penetration="setPenetration" @zoom="ftth.focusId && fitTo(turf.bbox(ftth.results[ftth.focusId].layers.boundary) as any, 120)" />
        <UiSidePanel v-else title="Standar Desain JLM" subtitle="Parameter default · dapat diubah per proyek" @close="right = ''">
          <div class="border border-j-line rounded-[10px] divide-y divide-j-line text-[12px]">
            <div v-for="row in [['Area proyek', 'Per RW & per cluster (KML/KMZ/SHP/gambar)'], ['ODP → rumah', 'Maks 250 m'], ['Kapasitas ODP', '16 rumah · splitter 1:16'], ['Jarak antar tiang', 'Maks 60 m'], ['Tiang', 'T7 1-Stage lingkungan · T7 2-Stage jalan utama · T9 2-Stage crossing'], ['ODC', '24C → 16 ODP · 48C → 36 ODP'], ['ODP → ODC', 'Maks 1.000 m sekali tarikan'], ['Kabel', 'Backbone 96–288C · Feeder 48–96C · Sub Feeder 24–48C · Distribusi 12–24C'], ['Instalasi', 'Aerial + underground (review manual)'], ['Coil / JC', 'Coil 350 m feeder · 500 m backbone · JC per 3.500 m'], ['Skenario', 'Plan 100% · build awal 30% / 50%'], ['Output', 'KML, DWG, PDF, Excel BOQ/BOM'], ['Kode aset', 'BDG-F4599.48 (Feed GENOVA SUMMARECON BANDUNG_350M)']]" :key="row[0]" class="p-2.5 grid grid-cols-[6.5rem_1fr] gap-2"><span class="text-j-sub">{{ row[0] }}</span><span class="font-medium">{{ row[1] }}</span></div>
          </div>
        </UiSidePanel>
      </aside>
    </div>

    <FtthNewProjectWizard :visible="wizardOpen" :drawn-aoi="drawnAoi" :picked-olt="pickedOlt" :preset="wizardPreset" @close="(wizardOpen = false), setData('ftth-preview', EMPTY_FC)" @request-draw="requestDraw" @request-olt="requestOlt" @preview="onPreview" @generate="onGenerate" />
    <JmapLocationFilter ref="filterRef" :open="filterOpen" context="Pilih RW / Cluster yang akan didesain jaringan FTTH-nya" @close="filterOpen = false" @apply="applyArea" @preview="(a) => onPreview(a[0].feature)" @draw="(filterOpen = false), requestDraw()" @coord="() => {}" />
  </div>
</template>
