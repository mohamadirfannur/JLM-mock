<script setup lang="ts">
import * as turf from "@turf/turf";
import maplibregl from "maplibre-gl";
import IcMapLayer from "~/assets/icons/ic-map-layer.svg";
import IcBasemap from "~/assets/icons/ic-basemap.svg";
import IcInfo from "~/assets/icons/ic-info.svg";
import IcChart from "~/assets/icons/ic-chart.svg";
import IcConnection from "~/assets/icons/ic-connection.svg";
import IcDrawFree from "~/assets/icons/ic-draw-free.svg";
import IcPole from "~/assets/icons/ic-pole.svg";
import IcTools from "~/assets/icons/ic-tools.svg";
import { CABLE_COLORS, JLM_POPS } from "~/utils/jlmSites";
import { PRICE } from "~/utils/ftthEngine";

useHead({ title: "FTTH Auto-Design · JLM Map Planner" });
const route = useRoute();
const geo = useGeoData();
const { map, setData, addLayer, removeSource, setVisible, fitTo } = useMap();
const layers = useLayers();
const draw = useDraw();
const ftth = useFtthStore();
const asset = useAssetStore();
const handoff = useHandoffStore();
const toast = useToast();

const EXTENT: [number, number, number, number] = [107.67, -6.975, 107.72, -6.935];
const showProject = ref(true);
const showLayers = ref(false);
const showLegend = ref(false);
const right = ref<"" | "result" | "info">("result");
const loadingId = ref<string | null>(null);
const wizardOpen = ref(false);
const wizardPreset = ref<any>(null);
const drawnAoi = ref<any>(null);
const pickedOlt = ref<[number, number] | null>(null);
const drawing = ref<null | "aoi" | "olt">(null);
const layerVis = reactive<Record<string, boolean>>({});
const generating = ref<{ name: string; step: number } | null>(null);
const GEN_STEPS = ["Membaca footprint rumah di AOI", "Snap rumah ke jaringan jalan", "Clustering ODP (≤16 rumah, ≤250 m)", "Grouping ODC (24C / 48C)", "Menentukan OLT & routing feeder", "Routing kabel distribusi", "Penempatan tiang (≤60 m), coil & JC", "Penomoran aset & BOQ/BOM"];

const LKEYS = ["boundary", "homes", "drops", "cables", "poles", "odp", "odc", "olt", "jc", "coils"];
const lid = (pid: string, k: string) => `f-${pid}-${k}`;

function layerSpecs(pid: string) {
  const s = (k: string) => `fs-${pid}-${k}`;
  const label = (field: string, min: number, size = 10, color = "#fff", halo = "#011641") => ({ "text-field": ["get", field], "text-font": ["Noto Sans Bold"], "text-size": size, "text-offset": [0, 1.2], "text-anchor": "top", "text-allow-overlap": false, minzoom: min, _paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": 1.4 } });
  const cableColor = ["match", ["get", "type"], ...Object.entries(CABLE_COLORS).flat(), "#00D075"];
  const L: Record<string, any[]> = {
    boundary: [
      { id: lid(pid, "boundary") + "-fill", type: "fill", source: s("boundary"), paint: { "fill-color": "#22D3EE", "fill-opacity": 0.06 } },
      { id: lid(pid, "boundary"), type: "line", source: s("boundary"), paint: { "line-color": "#22D3EE", "line-width": 2.5, "line-dasharray": [3, 2] } },
    ],
    drops: [{ id: lid(pid, "drops"), type: "line", source: s("drops"), minzoom: 16, paint: { "line-color": "#06B6D4", "line-width": 0.8, "line-opacity": 0.7 } }],
    homes: [{ id: lid(pid, "homes"), type: "circle", source: s("homes"), minzoom: 14.5, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 15, 1.8, 18, 4], "circle-color": ["case", ["==", ["get", "phase"], "Build"], "#00D075", "#ffffff"], "circle-stroke-color": "#011641", "circle-stroke-width": 0.5 } }],
    cables: [
      { id: lid(pid, "cables") + "-casing", type: "line", source: s("cables"), layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#011641", "line-width": ["interpolate", ["linear"], ["get", "cores"], 12, 4, 96, 7, 288, 9], "line-opacity": 0.6 } },
      { id: lid(pid, "cables"), type: "line", source: s("cables"), filter: ["==", ["get", "install"], "Aerial"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": cableColor, "line-width": ["interpolate", ["linear"], ["get", "cores"], 12, 2.2, 96, 4.5, 288, 6] } },
      { id: lid(pid, "cables") + "-ug", type: "line", source: s("cables"), filter: ["==", ["get", "install"], "Underground"], paint: { "line-color": cableColor, "line-width": 4, "line-dasharray": [1.2, 1] } },
    ],
    poles: [{ id: lid(pid, "poles"), type: "circle", source: s("poles"), minzoom: 14.5, paint: { "circle-radius": ["match", ["get", "type"], "T9 2-Stage", 4.5, "T7 2-Stage", 3.6, 3], "circle-color": ["match", ["get", "type"], "T9 2-Stage", "#1E1D1E", "T7 2-Stage", "#626264", "#AFAEAF"], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } }],
    coils: [{ id: lid(pid, "coils"), type: "circle", source: s("coils"), minzoom: 14, paint: { "circle-radius": 6, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#FDE68A", "circle-stroke-width": 2.5 } }],
    jc: [{ id: lid(pid, "jc"), type: "circle", source: s("jc"), paint: { "circle-radius": 6, "circle-color": "#F59E0B", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } }],
    odp: [
      { id: lid(pid, "odp"), type: "circle", source: s("odp"), paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 3, 17, 7], "circle-color": "#3672F9", "circle-stroke-color": "#fff", "circle-stroke-width": 1.8 } },
      { id: lid(pid, "odp") + "-label", type: "symbol", source: s("odp"), ...label("code", 16.3, 10) },
    ],
    odc: [
      { id: lid(pid, "odc"), type: "circle", source: s("odc"), paint: { "circle-radius": 9, "circle-color": "#7C3AED", "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } },
      { id: lid(pid, "odc") + "-label", type: "symbol", source: s("odc"), ...label("code", 13.5, 11) },
    ],
    olt: [
      { id: lid(pid, "olt"), type: "circle", source: s("olt"), paint: { "circle-radius": 11, "circle-color": "#C0353E", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } },
      { id: lid(pid, "olt") + "-label", type: "symbol", source: s("olt"), ...label("code", 12, 12) },
    ],
  };
  Object.values(L).flat().forEach((l: any) => {
    if (l._paint) {
      l.paint = l._paint;
      delete l._paint;
      l.layout = { "text-field": l["text-field"], "text-font": l["text-font"], "text-size": l["text-size"], "text-offset": l["text-offset"], "text-anchor": l["text-anchor"] };
      ["text-field", "text-font", "text-size", "text-offset", "text-anchor", "text-allow-overlap"].forEach((k) => delete l[k]);
    }
  });
  return L;
}
const ORDER = ["boundary", "drops", "homes", "cables", "coils", "poles", "jc", "odp", "odc", "olt"];

function drawProject(pid: string) {
  const r = ftth.results[pid];
  if (!r) return;
  const specs = layerSpecs(pid);
  ORDER.forEach((k) => {
    setData(`fs-${pid}-${k}`, r.layers[k]);
    specs[k].forEach((l) => addLayer(l));
  });
  ORDER.forEach((k) => setVisible(specs[k].map((l) => l.id), layerVis[k] !== false));
  registerLegend();
}
function clearProject(pid: string) {
  ORDER.forEach((k) => removeSource(`fs-${pid}-${k}`));
}
function registerLegend() {
  const G = "FTTH Design";
  layers.unregisterGroup(G);
  const ids = (k: string) => ftth.active.flatMap((pid) => layerSpecs(pid)[k].map((l) => l.id));
  const sum = (k: string) => ftth.active.reduce((a, pid) => a + (ftth.results[pid]?.layers[k]?.features.length || 0), 0);
  const defs: [string, string, string, any, any?][] = [
    ["olt", "OLT / POP", "#C0353E", "circle"],
    ["odc", "ODC", "#7C3AED", "circle"],
    ["odp", "ODP", "#3672F9", "circle"],
    ["jc", "Joint Closure", "#F59E0B", "circle"],
    ["coils", "Coil / Slack", "#FDE68A", "circle"],
    ["poles", "Tiang", "#626264", "circle", [{ label: "T9 2-Stage (crossing)", color: "#1E1D1E" }, { label: "T7 2-Stage (feeder)", color: "#626264" }, { label: "T7 1-Stage", color: "#AFAEAF" }]],
    ["cables", "Kabel", "#F97316", "line", Object.entries(CABLE_COLORS).filter(([k]) => k !== "Drop").map(([label, color]) => ({ label, color }))],
    ["homes", "Homepass", "#00D075", "circle", [{ label: "Build phase", color: "#00D075" }, { label: "Plan (future)", color: "#ffffff" }]],
    ["drops", "Kabel Drop", "#06B6D4", "line"],
    ["boundary", "Batas AOI", "#22D3EE", "line"],
  ];
  defs.forEach(([k, l, c, kind, legend]) => layers.register({ id: "ftth-" + k, label: l, group: G, color: c, kind, mapLayers: ids(k), visible: layerVis[k] !== false, count: sum(k), legend }));
}
function toggleLayerKey(k: string) {
  layerVis[k] = layerVis[k] === false;
  ftth.active.forEach((pid) => setVisible(layerSpecs(pid)[k].map((l) => l.id), layerVis[k]));
  layers.toggle("ftth-" + k, layerVis[k]);
}

async function addToMap(pid: string, zoom = true) {
  const p = ftth.byId(pid);
  if (!p) return;
  loadingId.value = pid;
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  ftth.compute(p, geo);
  if (!ftth.active.includes(pid)) ftth.active.push(pid);
  drawProject(pid);
  ftth.focusId = pid;
  loadingId.value = null;
  right.value = "result";
  if (zoom) fitTo(turf.bbox(ftth.results[pid].layers.boundary) as any, 120);
}
function toggleProject(pid: string) {
  if (ftth.active.includes(pid)) {
    clearProject(pid);
    ftth.active = ftth.active.filter((x) => x !== pid);
    if (ftth.focusId === pid) ftth.focusId = ftth.active[0] || null;
    registerLegend();
  } else addToMap(pid);
}
function focus(pid: string) {
  ftth.focusId = pid;
  right.value = "result";
  const r = ftth.results[pid];
  if (r) fitTo(turf.bbox(r.layers.boundary) as any, 120);
}
async function rerun(pid: string) {
  clearProject(pid);
  await addToMap(pid, false);
  toast.add({ title: "Design re-generated", icon: "i-heroicons-arrow-path" });
}
function deleteProject(pid: string) {
  if (!confirm("Hapus project ini?")) return;
  clearProject(pid);
  ftth.remove(pid);
  registerLegend();
}
async function setPenetration(v: number) {
  const pid = ftth.focusId;
  if (!pid) return;
  const p = ftth.byId(pid)!;
  ftth.update(pid, { params: { ...p.params, penetration: v } });
  ftth.compute(ftth.byId(pid)!, geo);
  drawProject(pid);
}

// ---------- map ----------
async function onReady() {
  layers.reset();
  await geo.load();
  ftth.ensureSeed(geo);
  setData("ftth-preview", EMPTY_FC);
  addLayer({ id: "ftth-preview-fill", type: "fill", source: "ftth-preview", paint: { "fill-color": "#00D075", "fill-opacity": 0.1 } });
  addLayer({ id: "ftth-preview-line", type: "line", source: "ftth-preview", paint: { "line-color": "#00D075", "line-width": 2.5, "line-dasharray": [2, 1] } });
  // existing JLM POPs
  setData("pops", { type: "FeatureCollection", features: JLM_POPS.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: p.coord }, properties: { code: p.code, name: p.name, olt: p.olt } })) });
  addLayer({ id: "pops", type: "circle", source: "pops", paint: { "circle-radius": 8, "circle-color": "#fff", "circle-stroke-color": "#C0353E", "circle-stroke-width": 3 } });
  addLayer({ id: "pops-label", type: "symbol", source: "pops", layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 1.3], "text-anchor": "top" }, paint: { "text-color": "#fff", "text-halo-color": "#C0353E", "text-halo-width": 1.5 } });
  setData("bld-ftth", geo.data.buildings);
  addLayer({ id: "bld-ftth", type: "fill", source: "bld-ftth", minzoom: 15, paint: { "fill-color": "#ffffff", "fill-opacity": 0.18 } }, "ftth-preview-fill");
  layers.register({ id: "pops", label: "POP / OLT existing JLM", group: "Existing", color: "#C0353E", kind: "circle", mapLayers: ["pops", "pops-label"], visible: true, count: JLM_POPS.length });
  layers.register({ id: "bld-ftth", label: "Building Footprint", group: "Existing", color: "#ffffff", kind: "fill", mapLayers: ["bld-ftth"], visible: true, count: geo.data.buildings!.features.length });

  const m = map.value!;
  m.on("click", onMapClick);
  m.on("mousemove", (e) => {
    if (draw.active.value || moving.value) return;
    const hit = m.queryRenderedFeatures(e.point, { layers: clickable() }).length;
    m.getCanvas().style.cursor = hit ? "pointer" : "";
  });

  if (route.query.from === "market" && handoff.ftthAoi) {
    wizardPreset.value = handoff.ftthAoi;
    setData("ftth-preview", handoff.ftthAoi.feature);
    fitTo(turf.bbox(handoff.ftthAoi.feature) as any, 140);
    handoff.ftthAoi = null;
    wizardOpen.value = true;
  } else {
    const ids = ftth.active.length ? [...ftth.active] : [ftth.projects[0]?.id].filter(Boolean);
    ftth.active = [];
    for (const id of ids) await addToMap(id as string, id === ids[ids.length - 1]);
  }
}
const clickable = () => ftth.active.flatMap((pid) => ["olt", "odc", "odp", "jc", "poles", "coils", "cables"].map((k) => lid(pid, k))).filter((id) => map.value?.getLayer(id)).concat(["pops"]);

// ---------- edit mode ----------
const editingId = ref<string | null>(null);
const selected = ref<{ pid: string; layer: string; props: any; coord: [number, number] } | null>(null);
const moving = ref(false);

function onMapClick(e: any) {
  if (draw.active.value) return;
  const m = map.value!;
  if (moving.value && selected.value) {
    const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    ftth.addEdit(selected.value.pid, { layer: selected.value.layer, code: selected.value.props.code, op: "move", coord: c });
    moving.value = false;
    m.getCanvas().style.cursor = "";
    rerunQuiet(selected.value.pid);
    toast.add({ title: "Posisi diperbarui", description: `${selected.value.props.code} dipindah`, icon: "i-heroicons-arrows-pointing-out" });
    selected.value = null;
    return;
  }
  const f = m.queryRenderedFeatures(e.point, { layers: clickable() })[0];
  if (!f) return;
  const p: any = f.properties;
  const layerId = f.layer.id;
  const pid = layerId.startsWith("f-") ? layerId.split("-").slice(1, -1).join("-") : "";
  const layer = layerId.split("-").pop()!;
  if (editingId.value && pid === editingId.value && ["odp", "odc", "poles", "jc", "olt", "coils"].includes(layer)) {
    selected.value = { pid, layer, props: p, coord: (f.geometry as any).coordinates };
    return;
  }
  const rows = Object.entries(p)
    .filter(([k]) => !["color"].includes(k))
    .map(([k, v]) => `<tr><td class="pr-3 text-grey-500 align-top">${k}</td><td class="font-medium">${v}</td></tr>`)
    .join("");
  new maplibregl.Popup({ maxWidth: "320px" })
    .setLngLat(e.lngLat)
    .setHTML(`<p class="text-xs font-semibold mb-1">${p.code || p.label || p.name || layer.toUpperCase()}</p><table class="text-[11px]">${rows}</table>`)
    .addTo(m);
}
function rerunQuiet(pid: string) {
  ftth.compute(ftth.byId(pid)!, geo);
  drawProject(pid);
}
function startMove() {
  moving.value = true;
  map.value!.getCanvas().style.cursor = "crosshair";
}
function deleteSelected() {
  if (!selected.value) return;
  ftth.addEdit(selected.value.pid, { layer: selected.value.layer, code: selected.value.props.code, op: "delete" });
  toast.add({ title: "Aset dihapus dari desain", description: selected.value.props.code, icon: "i-heroicons-trash", color: "red" });
  rerunQuiet(selected.value.pid);
  selected.value = null;
}
function toggleEdit(pid: string) {
  editingId.value = editingId.value === pid ? null : pid;
  selected.value = null;
  moving.value = false;
  if (editingId.value) toast.add({ title: "Edit mode aktif", description: "Klik ODP / ODC / tiang / JC di peta untuk pindah atau hapus." });
}
function undoEdits(pid: string) {
  ftth.update(pid, { edits: [] });
  rerunQuiet(pid);
}

// ---------- wizard ----------
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
  if (f) {
    drawnAoi.value = f;
    setData("ftth-preview", f);
  }
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
async function onGenerate(payload: any) {
  wizardOpen.value = false;
  generating.value = { name: payload.name, step: 0 };
  for (let i = 0; i < GEN_STEPS.length; i++) {
    generating.value.step = i;
    await new Promise((r) => setTimeout(r, 380 + Math.random() * 300));
  }
  const p = ftth.create(payload);
  setData("ftth-preview", EMPTY_FC);
  await addToMap(p.id);
  generating.value = null;
  const s = ftth.results[p.id].summary;
  toast.add({ title: "FTTH network generated", description: `${fmt(s.homes)} homepass · ${s.odp} ODP · ${s.odc} ODC · ${fmt(s.cableTotal / 1000, 2)} km kabel`, icon: "i-heroicons-check-circle", color: "green", timeout: 7000 });
}

// ---------- export / send ----------
function exportFocused(kind: string) {
  const pid = ftth.focusId;
  if (!pid) return;
  const p = ftth.byId(pid)!;
  const r = ftth.results[pid];
  const base = p.name.replace(/[^A-Za-z0-9]+/g, "_");
  const L = r.layers;
  if (kind === "kml") {
    download(
      `${base}_FTTH.kml`,
      toKML(p.name, [
        { name: "Batas AOI", color: "cyan", features: L.boundary.features },
        { name: "OLT", color: "red", features: L.olt.features },
        { name: "ODC", color: "purple", features: L.odc.features },
        { name: "ODP", color: "blue", features: L.odp.features },
        { name: "Kabel Feeder", color: "orange", features: L.cables.features.filter((f: any) => f.properties.kind === "feeder"), label: (x) => x.label },
        { name: "Kabel Distribusi", color: "green", features: L.cables.features.filter((f: any) => f.properties.kind === "dist"), label: (x) => x.label },
        { name: "Tiang", color: "grey", features: L.poles.features },
        { name: "Joint Closure", color: "yellow", features: L.jc.features },
      ]),
      "application/vnd.google-earth.kml+xml",
    );
  } else if (kind === "dxf") {
    download(
      `${base}_FTTH.dxf`,
      toDXF([
        { name: "AOI", color: 4, features: L.boundary.features },
        { name: "KABEL_FEEDER", color: 30, features: L.cables.features.filter((f: any) => f.properties.kind === "feeder") },
        { name: "KABEL_DISTRIBUSI", color: 3, features: L.cables.features.filter((f: any) => f.properties.kind === "dist") },
        { name: "OLT", color: 1, features: L.olt.features },
        { name: "ODC", color: 6, features: L.odc.features },
        { name: "ODP", color: 5, features: L.odp.features },
        { name: "TIANG", color: 8, features: L.poles.features },
        { name: "JC", color: 2, features: L.jc.features },
      ]),
      "application/dxf",
    );
    toast.add({ title: "DXF exported", description: "Buka di AutoCAD lalu Save As .dwg (layer per jenis aset sudah terpisah)." });
  } else if (kind === "xlsx") {
    const boqRows = r.boq.flatMap((g) => g.items.map((i) => ({ Kategori: g.category, Grup: g.group, Item: i.item, Satuan: i.unit, "Qty Plan 100%": i.qtyPlan, [`Qty Build ${r.params.penetration}%`]: i.qty, "Harga Satuan (IDR)": i.price, "Total (IDR)": i.total })));
    boqRows.push({ Kategori: "", Grup: "", Item: "TOTAL", Satuan: "", "Qty Plan 100%": "" as any, [`Qty Build ${r.params.penetration}%`]: "" as any, "Harga Satuan (IDR)": "" as any, "Total (IDR)": r.totalCost });
    exportXLSX(`${base}_BOQ_BOM.xlsx`, {
      "BOQ-BOM": boqRows,
      ODP: L.odp.features.map((f: any) => ({ Kode: f.properties.code, ODC: f.properties.odc, Homepass: f.properties.used, Kapasitas: 16, "Max drop (m)": f.properties.maxDrop, Lat: f.geometry.coordinates[1], Lng: f.geometry.coordinates[0] })),
      ODC: L.odc.features.map((f: any) => ({ Kode: f.properties.code, Tipe: f.properties.type, "Jumlah ODP": f.properties.odpCount, Lat: f.geometry.coordinates[1], Lng: f.geometry.coordinates[0] })),
      Kabel: L.cables.features.map((f: any) => ({ Label: f.properties.label, Tipe: f.properties.type, Core: f.properties.cores, "Panjang (m)": f.properties.length, Instalasi: f.properties.install })),
      Tiang: L.poles.features.map((f: any) => ({ Kode: f.properties.code, Tipe: f.properties.type, Lat: f.geometry.coordinates[1], Lng: f.geometry.coordinates[0] })),
      "Harga Satuan": Object.values(PRICE).map((x) => ({ Item: x.item, Satuan: x.unit, Harga: x.price })),
    });
  } else if (kind === "geojson") {
    const all = { type: "FeatureCollection", features: ORDER.flatMap((k) => L[k].features.map((f: any) => ({ ...f, properties: { ...f.properties, layer: k } }))) };
    download(`${base}_FTTH.geojson`, JSON.stringify(all), "application/geo+json");
  } else if (kind === "csv") {
    download(`${base}_homepass.csv`, toCSV(L.homes.features.map((f: any, i: number) => ({ no: i + 1, odp: f.properties.odp, fase: f.properties.phase, kelas: f.properties.cls, lat: f.geometry.coordinates[1].toFixed(6), lng: f.geometry.coordinates[0].toFixed(6) }))), "text/csv");
  } else if (kind === "pdf") exportPdf(p, r);
}
async function exportPdf(p: any, r: any) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.text("FTTH Design Report", 14, 18);
  doc.setFontSize(10);
  doc.text(`${p.name}  ·  ${p.kecamatan}  ·  ${nowStr()}`, 14, 25);
  try {
    const img = map.value!.getCanvas().toDataURL("image/jpeg", 0.8);
    doc.addImage(img, "JPEG", 14, 30, 182, 100);
  } catch {}
  const s = r.summary;
  autoTable(doc, {
    startY: 135,
    head: [["Ringkasan", "Nilai"]],
    body: [
      ["Homepass (plan 100%)", fmt(s.homes)],
      [`Build ${s.penetration}%`, fmt(s.buildHomes)],
      ["OLT / PON port", `${s.olt} / ${s.ponPorts}`],
      ["ODC (24C / 48C)", `${s.odc} (${s.odc24} / ${s.odc48})`],
      ["ODP", fmt(s.odp)],
      ["Tiang (T7-1 / T7-2 / T9-2)", `${s.poles} (${s.poleBy["T7 1-Stage"] || 0} / ${s.poleBy["T7 2-Stage"] || 0} / ${s.poleBy["T9 2-Stage"] || 0})`],
      ["Total kabel", `${fmt(s.cableTotal)} m`],
      ["Coil / JC", `${s.coils} / ${s.jc}`],
      ["Total estimasi biaya", idr(r.totalCost)],
    ],
    theme: "grid",
    headStyles: { fillColor: [1, 22, 65] },
    styles: { fontSize: 8 },
  });
  autoTable(doc, {
    head: [["Grup", "Item", "Qty", "Satuan", "Harga", "Total"]],
    body: r.boq.flatMap((g: any) => g.items.map((i: any) => [g.group, i.item, fmt(i.qty), i.unit, fmt(i.price), fmt(i.total)])),
    theme: "striped",
    headStyles: { fillColor: [15, 71, 179] },
    styles: { fontSize: 7 },
  });
  doc.save(`${p.name.replace(/[^A-Za-z0-9]+/g, "_")}_Report.pdf`);
}
function sendToAsset() {
  const pid = ftth.focusId;
  if (!pid) return;
  asset.ensureSeed(geo);
  const p = ftth.byId(pid)!;
  const d = asset.importDesign(ftth.results[pid], p.name);
  ftth.update(pid, { status: "Sent to Asset" });
  toast.add({
    title: "Terkirim ke Asset Management",
    description: `${d.sites.length} site point, ${d.assets.length} aset, ${d.cables.length} kabel (status Planned)`,
    icon: "i-heroicons-server-stack",
    color: "green",
    timeout: 8000,
    actions: [{ label: "Buka Asset Management", click: () => navigateTo("/map/asset-management?project=" + encodeURIComponent(p.name)) }],
  });
}

function onTop(k: string) {
  if (k === "layers") showLayers.value = !showLayers.value;
  if (k === "project") showProject.value = !showProject.value;
  if (k === "legend") showLegend.value = !showLegend.value;
}
onBeforeUnmount(() => {
  draw.cancel();
  layers.reset();
});
const focusProject = computed(() => (ftth.focusId ? ftth.byId(ftth.focusId) : null));
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <MapBaseMap :center="[107.69, -6.955]" :zoom="14" @ready="onReady" />
    <LayoutTopBar
      title="FTTH Auto-Design"
      :toggles="[
        { key: 'layers', label: 'Layers', icon: IcMapLayer, active: showLayers },
        { key: 'project', label: 'Project', uicon: 'i-heroicons-folder', active: showProject },
        { key: 'legend', label: 'Legends', icon: IcBasemap, active: showLegend },
      ]"
      :actions="[{ key: 'boq', label: 'BOQ & BOM' }]"
      @toggle="onTop"
      @action="() => (right = 'result')"
      @search="(c) => map?.flyTo({ center: c, zoom: 16 })"
    />

    <div v-if="showProject" class="absolute z-20 top-[5.5rem] left-6 bg-white w-[19rem] rounded-xs h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up">
      <FtthProjectPanel :editing-id="editingId" :loading-id="loadingId" @close="showProject = false" @new="openWizard" @toggle="toggleProject" @focus="focus" @edit="toggleEdit" @delete="deleteProject" @rerun="rerun" />
    </div>
    <div v-if="showLayers" class="absolute z-20 top-[5.5rem] bg-white w-[18.5rem] rounded-xs h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up" :class="showProject ? 'left-[21rem]' : 'left-6'">
      <MapLayerPanel @close="showLayers = false" />
    </div>
    <div v-if="showLegend" class="absolute z-20 top-[5.5rem] bg-white w-[15.5rem] rounded-xs max-h-[calc(100%-12rem)] overflow-hidden shadow-lg fade-up flex flex-col" :class="showProject && showLayers ? 'left-[40.5rem]' : showProject || showLayers ? 'left-[21rem]' : 'left-6'">
      <MapLegendPanel @close="showLegend = false" />
    </div>

    <div class="z-20 absolute top-[5.5rem] flex flex-col gap-2 transition-all duration-300" :class="right ? 'right-[32.5rem]' : 'right-6'">
      <MapControlButton tip="Analysis Result" :active="right === 'result'" @click="right = right === 'result' ? '' : 'result'"><IcChart class="w-5 h-5" :font-controlled="false" /></MapControlButton>
      <MapControlButton tip="Standar Desain JLM" :active="right === 'info'" @click="right = right === 'info' ? '' : 'info'"><IcInfo class="w-5 h-5" :font-controlled="false" /></MapControlButton>
    </div>
    <div v-if="right" class="z-20 absolute top-[5.5rem] right-6 h-[calc(100%-12rem)] flex">
      <FtthResultPanel v-if="right === 'result'" :project-id="ftth.focusId" :layer-vis="layerVis" @close="right = ''" @toggle-layer="toggleLayerKey" @export="exportFocused" @send="sendToAsset" @penetration="setPenetration" @zoom="focus(ftth.focusId!)" />
      <UiSidePanel v-else title="Standar Desain JLM" subtitle="Parameter default dari kuesioner onboarding (bisa diubah per project)" @close="right = ''">
        <div class="border rounded-xxs divide-y text-xs">
          <div v-for="row in [
            ['Area proyek', 'Per RW & per cluster (KML/KMZ/SHP atau gambar di peta)'],
            ['ODP → rumah', 'Max 250 m'],
            ['Kapasitas ODP', '16 rumah (splitter 1:16)'],
            ['Jarak antar tiang', 'Max 60 m'],
            ['Tiang', 'T7 1-Stage (lingkungan) · T7 2-Stage (jalan utama backbone/feeder) · T9 2-Stage (crossing)'],
            ['ODC', '24C → 16 ODP · 48C → 36 ODP'],
            ['ODP → ODC', 'Max 1.000 m sekali tarikan distribusi'],
            ['Kabel', 'Backbone 96–288C · Feeder 48–96C · Sub Feeder 24–48C · Distribusi 12–24C'],
            ['Instalasi', 'Kombinasi aerial + underground'],
            ['Coil / JC', 'Coil 350 m (feeder), 500 m (backbone) · JC per 3.500 m'],
            ['Skenario', 'Plan 100% (kebutuhan core), build awal 30% / 50%'],
            ['Output', 'KML, DWG, PDF, Excel (BOQ/BOM)'],
            ['Kode aset', 'BDG-F4599.48 (Feed GENOVA SUMMARECON BANDUNG_350M)'],
          ]" :key="row[0]" class="p-2.5 grid grid-cols-[7rem_1fr] gap-2"><span class="text-grey-500">{{ row[0] }}</span><span class="font-medium text-grey-900">{{ row[1] }}</span></div>
        </div>
      </UiSidePanel>
    </div>

    <MapBottomToolbar>
      <MapToolDropdown
        label="FTTH Tools"
        :icon="IcConnection"
        title="FTTH Tools"
        description="Desain jaringan otomatis & edit manual."
        :items="[
          { id: 'new', label: 'New Project (Auto-Design)', icon: IcConnection },
          { id: 'draw', label: 'Draw AOI → New Project', icon: IcDrawFree },
          { id: 'edit', label: 'Edit Site Points (pindah / hapus)', icon: IcTools },
          { id: 'rerun', label: 'Re-generate project aktif', uicon: 'i-heroicons-arrow-path' },
          { id: 'boq', label: 'BOQ / BOM project aktif', icon: IcPole },
        ]"
        @select="
          (id) => {
            if (id === 'new') openWizard();
            else if (id === 'draw') (openWizard(), requestDraw());
            else if (id === 'edit' && ftth.focusId) toggleEdit(ftth.focusId);
            else if (id === 'rerun' && ftth.focusId) rerun(ftth.focusId);
            else if (id === 'boq') right = 'result';
          }
        "
      />
    </MapBottomToolbar>

    <!-- drawing helper -->
    <MapToolCard v-if="drawing" :label="drawing === 'aoi' ? 'Draw Area of Interest' : 'Select Start Point (OLT)'" :icon="IcDrawFree" @close="(draw.cancel(), (drawing = null), (wizardOpen = true))">
      <div class="p-3 space-y-2">
        <p class="text-xs text-grey-600">{{ drawing === "aoi" ? "Klik untuk menambah titik batas RW / cluster. Double-click atau Enter untuk selesai." : "Klik lokasi OLT di peta." }}</p>
        <div class="flex justify-between items-center text-xs">
          <span>{{ draw.vertexCount.value }} titik</span>
          <UButton v-if="drawing === 'aoi'" size="xs" color="green" :disabled="draw.vertexCount.value < 3" @click="draw.finishNow()">Polygon ready → Finish</UButton>
        </div>
      </div>
    </MapToolCard>

    <!-- edit card -->
    <div v-if="editingId" class="absolute z-30 top-[5.5rem] left-1/2 -translate-x-1/2 bg-white rounded-xs shadow-xl px-4 py-2 flex items-center gap-3 text-xs fade-up">
      <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-blue-600" />
      <span v-if="!selected">Edit mode — klik ODP / ODC / tiang / JC pada <b>{{ ftth.byId(editingId)?.name }}</b></span>
      <template v-else>
        <span><b>{{ selected.props.code }}</b> · {{ selected.layer.toUpperCase() }}</span>
        <UButton size="2xs" :color="moving ? 'green' : 'primary'" icon="i-heroicons-arrows-pointing-out" @click="startMove">{{ moving ? "Klik lokasi baru..." : "Pindah" }}</UButton>
        <UButton size="2xs" color="red" variant="soft" icon="i-heroicons-trash" @click="deleteSelected">Hapus</UButton>
        <UButton size="2xs" color="gray" variant="ghost" @click="selected = null">Batal</UButton>
      </template>
      <UButton v-if="ftth.byId(editingId)?.edits.length" size="2xs" color="gray" variant="soft" @click="undoEdits(editingId)">Reset {{ ftth.byId(editingId)?.edits.length }} edit</UButton>
      <UButton size="2xs" color="gray" @click="toggleEdit(editingId)">Selesai</UButton>
    </div>

    <FtthNewProjectWizard :visible="wizardOpen" :drawn-aoi="drawnAoi" :picked-olt="pickedOlt" :preset="wizardPreset" @close="(wizardOpen = false), setData('ftth-preview', EMPTY_FC)" @request-draw="requestDraw" @request-olt="requestOlt" @preview="onPreview" @generate="onGenerate" />

    <!-- generating overlay -->
    <div v-if="generating" class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div class="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl">
        <div class="flex items-center gap-3 mb-4">
          <UIcon name="i-heroicons-cpu-chip" class="w-7 h-7 text-brand-500 animate-pulse" />
          <div>
            <p class="font-semibold">Generating FTTH Network</p>
            <p class="text-xs text-grey-500">{{ generating.name }}</p>
          </div>
        </div>
        <UProgress :value="((generating.step + 1) / GEN_STEPS.length) * 100" class="mb-4" />
        <div class="space-y-1.5">
          <div v-for="(s, i) in GEN_STEPS" :key="s" class="flex items-center gap-2 text-xs" :class="i > generating.step ? 'text-grey-400' : 'text-grey-800'">
            <UIcon :name="i < generating.step ? 'i-heroicons-check-circle-solid' : i === generating.step ? 'i-heroicons-arrow-path' : 'i-heroicons-minus-circle'" class="w-4 h-4" :class="[i < generating.step ? 'text-green-600' : '', i === generating.step ? 'animate-spin text-blue-600' : '']" />{{ s }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="focusProject && !right" class="absolute z-20 top-[5.5rem] right-24 bg-white rounded-xs shadow px-3 py-2 text-xs">{{ focusProject.name }}</div>
    <MapControls :extent="EXTENT" />
    <MapCoordinatesPanel />
  </div>
</template>
