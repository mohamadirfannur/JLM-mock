import { defineStore } from "pinia";
import { runFtthDesign, DEFAULT_PARAMS, type FtthParams, type FtthResult } from "~/utils/ftthEngine";
import { JLM_POPS, nearestPop } from "~/utils/jlmSites";
import * as turf from "@turf/turf";

export interface FtthEdit {
  layer: string;
  code: string;
  op: "move" | "delete" | "add";
  coord?: [number, number];
}
export interface FtthProject {
  id: string;
  name: string;
  description: string;
  kecamatan: string;
  kelurahan: string;
  aoi: any;
  params: FtthParams;
  oltMode: "site" | "input" | "auto";
  olt: [number, number] | null;
  oltLabel: string;
  status: "Draft" | "Designed" | "Sent to Asset" | "As-built";
  homes: number;
  edits: FtthEdit[];
  createdAt: string;
  updatedAt: string;
  source: string;
}

const KEY = "jlm-ftth-projects-v1";
const JKEY = "jlm-ftth-jobs-v1";

export interface FtthJob {
  id: string;
  projectId: string;
  source: string; // KMZ Import / Excel/GIS Import / Gambar Poligon / Market Potential / Sample
  file: string;
  user: string;
  role: string;
  createdAt: string;
  progress: number;
  phase: string;
  status: "processing" | "paused" | "completed" | "inserted";
  homes: number;
  rw: string;
}
export const JOB_PHASES = ["Parsing & validating nodes", "Snap rumah ke jaringan jalan", "Clustering ODP (≤16 HP, ≤250 m)", "Grouping ODC 24C / 48C", "Routing feeder dari OLT", "Generating cable & ODP layout", "Penempatan tiang, coil & JC", "Penomoran aset & BOQ/BOM"];

export const useFtthStore = defineStore("ftth", () => {
  const projects = ref<FtthProject[]>([]);
  const active = ref<string[]>([]); // project ids shown on map
  const focusId = ref<string | null>(null);
  const results = shallowRef<Record<string, FtthResult>>({});
  const jobs = ref<FtthJob[]>([]);
  try {
    const rj = localStorage.getItem(JKEY);
    if (rj) jobs.value = JSON.parse(rj);
  } catch {}
  watch(jobs, (v) => {
    try {
      localStorage.setItem(JKEY, JSON.stringify(v));
    } catch {}
  }, { deep: true });
  let timer: any = null;
  function tick() {
    let any = false;
    jobs.value.forEach((j) => {
      if (j.status !== "processing") return;
      any = true;
      j.progress = Math.min(100, j.progress + 3 + Math.random() * 5);
      j.phase = JOB_PHASES[Math.min(JOB_PHASES.length - 1, Math.floor((j.progress / 100) * JOB_PHASES.length))];
      if (j.progress >= 100) {
        j.status = "completed";
        j.phase = "Selesai · siap insert ke kabel";
        useToast().add({ title: "Desain FTTH selesai", description: `${j.file} siap di-generate ke peta`, icon: "i-lucide-circle-check-big", color: "green" });
      }
    });
    if (!any) (clearInterval(timer), (timer = null));
  }
  function runQueue() {
    if (!timer) timer = setInterval(tick, 700);
  }
  function enqueue(p: FtthProject, source: string, file: string) {
    const auth = useAuthStore();
    const j: FtthJob = { id: `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${p.params.areaCode}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, projectId: p.id, source, file, user: auth.user?.name || "Network Planner", role: auth.user?.role || "Network Planner", createdAt: nowStr(), progress: 2, phase: JOB_PHASES[0], status: "processing", homes: p.homes, rw: p.kelurahan || p.kecamatan };
    jobs.value.unshift(j);
    runQueue();
    return j;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) projects.value = JSON.parse(raw);
  } catch {}
  watch(
    projects,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v));
      } catch {}
    },
    { deep: true },
  );

  function ensureSeed(geo: ReturnType<typeof useGeoData>) {
    if (jobs.value.some((j) => j.status === "processing")) runQueue();
    if (projects.value.length) return;
    const aois = geo.data.aoi!.features;
    const picks = [aois[0], aois[5]];
    picks.forEach((aoi: any, i: number) => {
      const c = turf.centroid(aoi).geometry.coordinates as [number, number];
      const pop = nearestPop(c);
      projects.value.push({
        id: `prj-seed-${i + 1}`,
        name: aoi.properties.name,
        description: i === 0 ? "Plan 100% cluster, build awal penetrasi 30%" : "Ekspansi RW — target homepass Q1 2027",
        kecamatan: i === 0 ? "Rancasari" : "Gedebage",
        kelurahan: aoi.properties.kel,
        aoi: { type: "Feature", properties: {}, geometry: aoi.geometry },
        params: { ...DEFAULT_PARAMS, areaCode: i === 0 ? "CSE" : "CSW" },
        oltMode: "site",
        olt: pop.coord,
        oltLabel: pop.name,
        status: "Designed",
        homes: aoi.properties.homes,
        edits: [],
        createdAt: nowStr(),
        updatedAt: nowStr(),
        source: i === 0 ? "KMZ Import" : "Excel/GIS Import",
      });
      jobs.value.push({ id: `20261027-${i === 0 ? "CSE" : "CSW"}-0${i + 1}`, projectId: `prj-seed-${i + 1}`, source: i === 0 ? "KMZ Import" : "Excel/GIS Import", file: i === 0 ? "Cluster-A-CisarantenEndah.kmz" : "RW06-CisarantenWetan.xlsx", user: i === 0 ? "Adit Pradana" : "Rudi Hartono", role: "Network Planner", createdAt: i === 0 ? "27 Okt 2026, 19.33" : "28 Okt 2026, 08.14", progress: 100, phase: "Selesai · siap insert ke kabel", status: i === 0 ? "inserted" : "completed", homes: aoi.properties.homes, rw: aoi.properties.kel });
    });
    // one design still running when the planner opens the module
    const third = aois[3];
    if (third) {
      const pop = nearestPop(turf.centroid(third).geometry.coordinates as [number, number]);
      const p: FtthProject = { id: "prj-seed-3", name: third.properties.name, description: "Import batas RW dari tim survei", kecamatan: "Rancasari", kelurahan: third.properties.kel, aoi: { type: "Feature", properties: {}, geometry: third.geometry }, params: { ...DEFAULT_PARAMS, areaCode: "CPM" }, oltMode: "site", olt: pop.coord, oltLabel: pop.name, status: "Draft", homes: third.properties.homes, edits: [], createdAt: nowStr(), updatedAt: nowStr(), source: "Excel/GIS Import" };
      projects.value.push(p);
      jobs.value.unshift({ id: "20261029-CPM-07", projectId: p.id, source: "Excel/GIS Import", file: "20261029-RW07-Cipamokolan.xlsx", user: "Wade Warren", role: "Network Planner", createdAt: nowStr(), progress: 42, phase: JOB_PHASES[3], status: "processing", homes: p.homes, rw: third.properties.kel });
      runQueue();
    }
  }

  function compute(p: FtthProject, geo: ReturnType<typeof useGeoData>): FtthResult {
    const r = runFtthDesign({ name: p.name, aoi: p.aoi, homes: geo.buildingsIn(p.aoi), roads: geo.roadsNear(p.aoi, 400, p.olt), olt: p.olt, params: p.params });
    applyEdits(r, p.edits);
    results.value = { ...results.value, [p.id]: r };
    return r;
  }

  function applyEdits(r: FtthResult, edits: FtthEdit[]) {
    for (const e of edits) {
      const fc = r.layers[e.layer];
      if (!fc) continue;
      if (e.op === "add" && e.coord) {
        const near = (L: string) => [...r.layers[L].features].sort((a: any, b: any) => Math.hypot(a.geometry.coordinates[0] - e.coord![0], a.geometry.coordinates[1] - e.coord![1]) - Math.hypot(b.geometry.coordinates[0] - e.coord![0], b.geometry.coordinates[1] - e.coord![1]))[0];
        const props = e.layer === "odp" ? { code: e.code, odc: near("odc")?.properties.code, capacity: 16, used: 0, idle: 16, maxDrop: 0, splitter: "1:16", manual: true } : e.layer === "poles" ? { code: e.code, type: "T7 1-Stage", manual: true } : { code: e.code, reason: "Tambahan manual", manual: true };
        fc.features.push({ type: "Feature", geometry: { type: "Point", coordinates: e.coord }, properties: props });
        continue;
      }
      if (e.op === "delete") fc.features = fc.features.filter((f: any) => f.properties.code !== e.code);
      if (e.op === "move" && e.coord) {
        const f = fc.features.find((x: any) => x.properties.code === e.code);
        if (f) {
          const old = f.geometry.coordinates;
          f.geometry.coordinates = e.coord;
          // drag connected drops / cable end-points along
          if (e.layer === "odp") r.layers.drops.features.forEach((d: any) => d.properties.odp === e.code && (d.geometry.coordinates[0] = e.coord));
          r.layers.cables.features.forEach((c: any) => {
            const co = c.geometry.coordinates;
            if (co[0][0] === old[0] && co[0][1] === old[1]) co[0] = e.coord;
            const l = co.length - 1;
            if (co[l][0] === old[0] && co[l][1] === old[1]) co[l] = e.coord;
          });
        }
      }
    }
    if (edits.length) {
      r.summary.poles = r.layers.poles.features.length;
      const pb: Record<string, number> = {};
      r.layers.poles.features.forEach((p: any) => (pb[p.properties.type] = (pb[p.properties.type] || 0) + 1));
      r.summary.poleBy = pb;
      r.summary.odp = r.layers.odp.features.length;
      r.summary.jc = r.layers.jc.features.length;
    }
  }

  function create(p: Omit<FtthProject, "id" | "createdAt" | "updatedAt" | "edits" | "status">) {
    const proj: FtthProject = { ...p, id: uid("prj"), createdAt: nowStr(), updatedAt: nowStr(), edits: [], status: "Draft" };
    projects.value.unshift(proj);
    return proj;
  }
  function update(pid: string, patch: Partial<FtthProject>) {
    const p = projects.value.find((x) => x.id === pid);
    if (p) Object.assign(p, patch, { updatedAt: nowStr() });
  }
  function remove(pid: string) {
    projects.value = projects.value.filter((p) => p.id !== pid);
    jobs.value = jobs.value.filter((j) => j.projectId !== pid);
    active.value = active.value.filter((x) => x !== pid);
    if (focusId.value === pid) focusId.value = null;
  }
  function addEdit(pid: string, e: FtthEdit) {
    const p = projects.value.find((x) => x.id === pid);
    if (!p) return;
    p.edits = e.op === "add" ? [...p.edits, e] : [...p.edits.filter((x) => !(x.code === e.code && x.layer === e.layer && x.op === e.op)), e];
    p.updatedAt = nowStr();
  }
  const byId = (pid: string) => projects.value.find((p) => p.id === pid);
  return { projects, active, focusId, results, jobs, enqueue, runQueue, ensureSeed, compute, create, update, remove, addEdit, byId, JLM_POPS };
});
