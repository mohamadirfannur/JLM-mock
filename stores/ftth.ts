import { defineStore } from "pinia";
import { runFtthDesign, DEFAULT_PARAMS, type FtthParams, type FtthResult } from "~/utils/ftthEngine";
import { JLM_POPS, nearestPop } from "~/utils/jlmSites";
import * as turf from "@turf/turf";

export interface FtthEdit {
  layer: string;
  code: string;
  op: "move" | "delete";
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

export const useFtthStore = defineStore("ftth", () => {
  const projects = ref<FtthProject[]>([]);
  const active = ref<string[]>([]); // project ids shown on map
  const focusId = ref<string | null>(null);
  const results = shallowRef<Record<string, FtthResult>>({});
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
        source: "Sample AOI",
      });
    });
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
    const proj: FtthProject = { ...p, id: uid("prj"), createdAt: nowStr(), updatedAt: nowStr(), edits: [], status: "Designed" };
    projects.value.unshift(proj);
    return proj;
  }
  function update(pid: string, patch: Partial<FtthProject>) {
    const p = projects.value.find((x) => x.id === pid);
    if (p) Object.assign(p, patch, { updatedAt: nowStr() });
  }
  function remove(pid: string) {
    projects.value = projects.value.filter((p) => p.id !== pid);
    active.value = active.value.filter((x) => x !== pid);
    if (focusId.value === pid) focusId.value = null;
  }
  function addEdit(pid: string, e: FtthEdit) {
    const p = projects.value.find((x) => x.id === pid);
    if (!p) return;
    p.edits = [...p.edits.filter((x) => !(x.code === e.code && x.layer === e.layer && x.op === e.op)), e];
    p.updatedAt = nowStr();
  }
  const byId = (pid: string) => projects.value.find((p) => p.id === pid);
  return { projects, active, focusId, results, ensureSeed, compute, create, update, remove, addEdit, byId, JLM_POPS };
});
