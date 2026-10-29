import { defineStore } from "pinia";
import { runFtthDesign, DEFAULT_PARAMS, type FtthResult } from "~/utils/ftthEngine";
import { JLM_POPS, nearestPop } from "~/utils/jlmSites";
import * as turf from "@turf/turf";

export type Status = "Installed" | "Planned" | "Maintenance";

export interface Port {
  no: number;
  status: "Used" | "Idle" | "Reserved";
  to?: string; // customer / cable core
}
export interface Asset {
  id: string;
  siteId: string;
  category: "Pasif" | "Aktif";
  type: string;
  name: string;
  code: string;
  serial?: string;
  rfid?: string;
  tagId?: string;
  brand?: string;
  description?: string;
  installDate?: string;
  purchaseDate?: string;
  serviceDate?: string;
  maintenanceBy?: string;
  inspectedBy?: string;
  ports?: Port[];
  attachments?: { label: string; file: string }[];
  extra?: Record<string, string>;
}
export interface SitePoint {
  id: string;
  code: string;
  name: string;
  type: string;
  owner: string;
  status: Status;
  coord: [number, number];
  address?: string;
  kelurahan?: string;
  project?: string;
  poleType?: string;
  createdAt: string;
  updatedAt: string;
}
export interface Cable {
  id: string;
  code: string;
  label: string;
  type: string; // Backbone / Feeder / Sub Feeder / Distribusi / Drop
  cores: number;
  tubes: number;
  install: "Aerial" | "Underground";
  status: Status;
  coords: [number, number][];
  length: number;
  from?: string;
  to?: string;
  project?: string;
  coreUsage?: Record<number, string>;
}
export interface Activity {
  id: string;
  at: string;
  user: string;
  action: "Create" | "Update" | "Move" | "Delete" | "Import" | "Sync";
  target: string;
  detail: string;
}

const KEY = "jlm-assets-v3";
const id = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

/** Convert an FTTH design into asset records. */
export function designToAssets(r: FtthResult, project: string, status: Status, seedDays = 0) {
  const sites: SitePoint[] = [];
  const assets: Asset[] = [];
  const cables: Cable[] = [];
  const now = nowStr();
  const install = status === "Installed" ? daysAgo(seedDays || 200) : "";
  const mk = (type: string, code: string, coord: [number, number], extra: Partial<SitePoint> = {}) => {
    const s: SitePoint = { id: id("sp"), code, name: code, type, owner: "JLM", status, coord, project, createdAt: now, updatedAt: now, ...extra };
    sites.push(s);
    return s;
  };
  const ports = (n: number, used: number): Port[] => Array.from({ length: n }, (_, i) => ({ no: i + 1, status: i < used ? "Used" : "Idle", to: i < used ? `ONT-${String(i + 1).padStart(3, "0")}` : undefined }));

  r.layers.odc.features.forEach((f: any) => {
    const s = mk("ODC", f.properties.code, f.geometry.coordinates);
    const cap = f.properties.capacity;
    assets.push({ id: id("as"), siteId: s.id, category: "Pasif", type: "ODC", name: f.properties.type, code: f.properties.code, serial: "ODC" + Math.floor(Math.random() * 9e6), brand: "FiberHome", installDate: install, ports: ports(cap, f.properties.odpCount), description: `Kabinet ${f.properties.type} · ${f.properties.odpCount}/${cap} ODP` });
    assets.push({ id: id("as"), siteId: s.id, category: "Pasif", type: "SS (Splitter)", name: "Splitter 1:8", code: f.properties.code + "-SPL", installDate: install, ports: ports(8, Math.min(8, f.properties.odpCount)) });
  });
  r.layers.odp.features.forEach((f: any) => {
    const s = mk("ODP", f.properties.code, f.geometry.coordinates);
    assets.push({ id: id("as"), siteId: s.id, category: "Pasif", type: "ODP", name: "ODP 16 Port Pole Mounted", code: f.properties.code, brand: "Furukawa", installDate: install, ports: ports(16, status === "Installed" ? Math.round(f.properties.used * 0.35) : 0), description: `Homepass ${f.properties.used} rumah · ${f.properties.odc}`, extra: { Homepass: String(f.properties.used), "Max drop (m)": String(f.properties.maxDrop) } });
  });
  r.layers.poles.features.forEach((f: any) => mk("Pole", f.properties.code, f.geometry.coordinates, { poleType: f.properties.type }));
  r.layers.jc.features.forEach((f: any) => {
    const s = mk("JC", f.properties.code, f.geometry.coordinates);
    assets.push({ id: id("as"), siteId: s.id, category: "Pasif", type: "JC", name: "Joint Closure 96C", code: f.properties.code, installDate: install, description: f.properties.reason });
  });
  r.layers.cables.features.forEach((f: any, i: number) => {
    const p = f.properties;
    cables.push({ id: id("cb"), code: `CBL-${p.kind === "feeder" ? "F" : "D"}-${String(i + 1).padStart(3, "0")}`, label: p.label, type: p.type, cores: p.cores, tubes: Math.max(1, p.cores / 12), install: p.install, status, coords: f.geometry.coordinates, length: p.length, from: p.owner, project });
  });
  return { sites, assets, cables };
}

function popSite(pop: (typeof JLM_POPS)[number]) {
  const now = nowStr();
  const s: SitePoint = { id: id("sp"), code: pop.code, name: pop.name, type: "POP", owner: "JLM", status: "Installed", coord: pop.coord, address: "Kota Bandung", createdAt: now, updatedAt: now };
  const d = daysAgo(420);
  const a = (category: "Pasif" | "Aktif", type: string, name: string, code: string, extra: Partial<Asset> = {}): Asset => ({ id: id("as"), siteId: s.id, category, type, name, code, installDate: d, purchaseDate: daysAgo(450), maintenanceBy: "PT Mitra Teknik", inspectedBy: "Asep S.", ...extra });
  const assets = [
    a("Aktif", "Rack Server", "Rack 42U", pop.code + "-RCK01"),
    a("Aktif", "OLT", "OLT GPON ZTE C620 · 16 PON", pop.olt, { serial: "ZTEC620" + Math.floor(Math.random() * 1e6), brand: "ZTE", ports: Array.from({ length: 16 }, (_, i) => ({ no: i + 1, status: i < 9 ? "Used" : "Idle", to: i < 9 ? `PON-${i + 1}` : undefined })) }),
    a("Aktif", "Mikrotik", "Mikrotik CCR2004", pop.code + "-RTR01", { brand: "Mikrotik", serial: "CCR" + Math.floor(Math.random() * 1e6) }),
    a("Aktif", "Switch", "Switch Aggregation 24p 10G", pop.code + "-SW01", { brand: "Huawei" }),
    a("Aktif", "Juniper", "Juniper MX204 (upstream)", pop.code + "-JNP01", { brand: "Juniper" }),
    a("Aktif", "Inverter", "Inverter / UPS 6 kVA", pop.code + "-INV01"),
    a("Pasif", "OTB", "OTB 96 Core", pop.code + "-OTB01", { ports: Array.from({ length: 96 }, (_, i) => ({ no: i + 1, status: i < 40 ? "Used" : "Idle" })) }),
  ];
  return { site: s, assets };
}

export const useAssetStore = defineStore("asset", () => {
  const sites = ref<SitePoint[]>([]);
  const assets = ref<Asset[]>([]);
  const cables = ref<Cable[]>([]);
  const activity = ref<Activity[]>([]);
  const seeded = ref(false);

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      sites.value = j.sites;
      assets.value = j.assets;
      cables.value = j.cables;
      activity.value = j.activity;
      seeded.value = true;
    }
  } catch {}

  let saveT: any = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ sites: sites.value, assets: assets.value, cables: cables.value, activity: activity.value }));
      } catch (e) {
        console.warn("asset persist failed", e);
      }
    }, 300);
  }
  watch([sites, assets, cables, activity], persist, { deep: true });

  function log(action: Activity["action"], target: string, detail: string) {
    const auth = useAuthStore();
    activity.value.unshift({ id: id("ac"), at: nowStr(), user: auth.user?.name || "Tim Asset", action, target, detail });
    if (activity.value.length > 300) activity.value.length = 300;
  }

  /** Builds the existing (installed) JLM network once, from real roads/buildings. */
  function ensureSeed(geo: ReturnType<typeof useGeoData>) {
    if (seeded.value) return;
    const pops = JLM_POPS.map(popSite);
    pops.forEach((p) => {
      sites.value.push(p.site);
      assets.value.push(...p.assets);
    });
    const aois = geo.data.aoi!.features;
    const picks = [2, 9, 7, 8, 10, 11, 12, 13].map((i) => aois[i]).filter(Boolean);
    picks.forEach((aoi: any, i: number) => {
      const c = turf.centroid(aoi).geometry.coordinates as [number, number];
      const pop = nearestPop(c);
      const r = runFtthDesign({ name: aoi.properties.name, aoi, homes: geo.buildingsIn(aoi), roads: geo.roadsNear(aoi, 400, pop.coord), olt: pop.coord, params: { ...DEFAULT_PARAMS, areaCode: ["CWT", "CSK", "RB5", "DRW", "RBK", "CMC", "MKM", "RB2"][i] || "GDB" } });
      const d = designToAssets(r, aoi.properties.name, "Installed", 420 - i * 45);
      sites.value.push(...d.sites);
      assets.value.push(...d.assets);
      cables.value.push(...d.cables);
    });
    // a few customers (ONT) + one site under maintenance for realism
    const odps = sites.value.filter((s) => s.type === "ODP").slice(0, 6);
    odps.forEach((o, i) => {
      const c: [number, number] = [o.coord[0] + 0.00025 * (i % 2 ? 1 : -1), o.coord[1] + 0.0002];
      const s: SitePoint = { id: id("sp"), code: `CUST-${String(i + 1).padStart(4, "0")}`, name: `Pelanggan ${i + 1}`, type: "Customer", owner: "JLM", status: "Installed", coord: c, createdAt: nowStr(), updatedAt: nowStr() };
      sites.value.push(s);
      assets.value.push({ id: id("as"), siteId: s.id, category: "Pasif", type: "ONT", name: "ONT ZTE F670L", code: `ONT-${String(i + 1).padStart(4, "0")}`, serial: "ZTEG" + Math.floor(Math.random() * 1e8), installDate: daysAgo(30 + i * 9), description: `Terhubung ke ${o.code}` });
    });
    const m = sites.value.find((s) => s.type === "ODC");
    if (m) m.status = "Maintenance";
    activity.value = [
      { id: id("ac"), at: nowStr(), user: "Sistem", action: "Import", target: "Data aset JLM", detail: `Import awal dari spreadsheet/KML: ${sites.value.length} site point, ${cables.value.length} segmen kabel` },
    ];
    seeded.value = true;
  }

  // ---- CRUD ----
  function addSite(s: Omit<SitePoint, "id" | "createdAt" | "updatedAt">) {
    const sp: SitePoint = { ...s, id: id("sp"), createdAt: nowStr(), updatedAt: nowStr() };
    sites.value.push(sp);
    log("Create", sp.code, `Site point ${sp.type} ditambahkan`);
    return sp;
  }
  function updateSite(sid: string, patch: Partial<SitePoint>) {
    const s = sites.value.find((x) => x.id === sid);
    if (!s) return;
    Object.assign(s, patch, { updatedAt: nowStr() });
    log(patch.coord ? "Move" : "Update", s.code, patch.coord ? `Dipindah ke ${patch.coord[1].toFixed(6)}, ${patch.coord[0].toFixed(6)}` : "Atribut site point diperbarui");
  }
  function deleteSite(sid: string) {
    const s = sites.value.find((x) => x.id === sid);
    if (!s) return;
    const n = assets.value.filter((a) => a.siteId === sid).length;
    assets.value = assets.value.filter((a) => a.siteId !== sid);
    sites.value = sites.value.filter((x) => x.id !== sid);
    log("Delete", s.code, `Site point ${s.type} dihapus${n ? ` beserta ${n} aset` : ""}`);
  }
  function addAsset(a: Omit<Asset, "id">) {
    const as: Asset = { ...a, id: id("as") };
    assets.value.push(as);
    log("Create", as.code, `Aset ${as.type} ditambahkan ke ${siteById(as.siteId)?.code}`);
    return as;
  }
  function updateAsset(aid: string, patch: Partial<Asset>) {
    const a = assets.value.find((x) => x.id === aid);
    if (!a) return;
    Object.assign(a, patch);
    log("Update", a.code, "Atribut aset diperbarui");
  }
  function deleteAsset(aid: string) {
    const a = assets.value.find((x) => x.id === aid);
    if (!a) return;
    assets.value = assets.value.filter((x) => x.id !== aid);
    log("Delete", a.code, `Aset ${a.type} dihapus`);
  }
  function addCable(c: Omit<Cable, "id">) {
    const cb: Cable = { ...c, id: id("cb") };
    cables.value.push(cb);
    log("Create", cb.code, `Kabel ${cb.type} ${cb.cores}C (${Math.round(cb.length)} m)`);
    return cb;
  }
  function updateCable(cid: string, patch: Partial<Cable>) {
    const c = cables.value.find((x) => x.id === cid);
    if (!c) return;
    Object.assign(c, patch);
    log("Update", c.code, "Atribut kabel diperbarui");
  }
  function deleteCable(cid: string) {
    const c = cables.value.find((x) => x.id === cid);
    if (!c) return;
    cables.value = cables.value.filter((x) => x.id !== cid);
    log("Delete", c.code, `Kabel ${c.type} dihapus`);
  }
  function importDesign(r: FtthResult, project: string) {
    // replace previous planned import of the same project
    const old = new Set(sites.value.filter((s) => s.project === project && s.status === "Planned").map((s) => s.id));
    sites.value = sites.value.filter((s) => !old.has(s.id));
    assets.value = assets.value.filter((a) => !old.has(a.siteId));
    cables.value = cables.value.filter((c) => !(c.project === project && c.status === "Planned"));
    const pop = JLM_POPS.find((p) => r.layers.olt.features[0]?.properties.code === p.olt);
    const d = designToAssets(r, project, "Planned");
    if (!pop) {
      const o = r.layers.olt.features[0];
      const s: SitePoint = { id: id("sp"), code: o.properties.code.replace("OLT", "POP"), name: "POP " + project, type: "POP", owner: "JLM", status: "Planned", coord: o.geometry.coordinates, project, createdAt: nowStr(), updatedAt: nowStr() };
      d.sites.push(s);
      d.assets.push({ id: id("as"), siteId: s.id, category: "Aktif", type: "OLT", name: "OLT GPON (planned)", code: o.properties.code, ports: Array.from({ length: 16 }, (_, i) => ({ no: i + 1, status: "Idle" as const })) });
    }
    sites.value.push(...d.sites);
    assets.value.push(...d.assets);
    cables.value.push(...d.cables);
    log("Sync", project, `Hasil desain FTTH dikirim: ${d.sites.length} site point, ${d.assets.length} aset, ${d.cables.length} kabel (status Planned)`);
    return d;
  }
  function markInstalled(project: string) {
    let n = 0;
    sites.value.forEach((s) => s.project === project && s.status === "Planned" && ((s.status = "Installed"), n++));
    cables.value.forEach((c) => c.project === project && c.status === "Planned" && (c.status = "Installed"));
    log("Update", project, `${n} site point diubah status menjadi Installed (as-built)`);
  }
  function resetAll() {
    sites.value = [];
    assets.value = [];
    cables.value = [];
    activity.value = [];
    seeded.value = false;
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  const siteById = (sid: string) => sites.value.find((s) => s.id === sid);
  const assetsOf = (sid: string) => assets.value.filter((a) => a.siteId === sid);

  return { sites, assets, cables, activity, seeded, ensureSeed, addSite, updateSite, deleteSite, addAsset, updateAsset, deleteAsset, addCable, updateCable, deleteCable, importDesign, markInstalled, resetAll, siteById, assetsOf, log, today };
});
