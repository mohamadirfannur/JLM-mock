// FTTH auto-design (mock engine, runs in the browser).
// Bottom-up: homes -> ODP groups -> ODC groups -> OLT, cables routed on the real road graph.
// Defaults follow the standards JLM gave in the onboarding questionnaire.

export interface FtthParams {
  odpCapacity: number; // homes per ODP (JLM: 16)
  odpMaxDist: number; // m, ODP -> home (JLM: 250)
  poleSpacing: number; // m (JLM: max 60)
  odcMaxDist: number; // m, ODC -> ODP (JLM: 1000)
  odcType: "auto" | "24C" | "48C"; // JLM: 24C=16 ODP, 48C=36 ODP
  penetration: number; // % build phase (plan is always 100%)
  installation: "aerial" | "mixed";
  coilFeeder: number; // m (JLM: 350)
  coilBackbone: number; // m (JLM: 500)
  jcInterval: number; // m (JLM: 3500)
  cityCode: string; // BDG
  areaCode: string; // GDB
  includeCommercial: boolean;
}

export const DEFAULT_PARAMS: FtthParams = {
  odpCapacity: 16,
  odpMaxDist: 250,
  poleSpacing: 60,
  odcMaxDist: 1000,
  odcType: "auto",
  penetration: 30,
  installation: "mixed",
  coilFeeder: 350,
  coilBackbone: 500,
  jcInterval: 3500,
  cityCode: "BDG",
  areaCode: "GDB",
  includeCommercial: true,
};

type P = [number, number];
const KX = 110574 * Math.cos((6.955 * Math.PI) / 180);
const KY = 110574;
const dist = (a: P, b: P) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);
const nk = (p: P) => p[0].toFixed(6) + "," + p[1].toFixed(6);

// ---------------- graph ----------------
interface Graph {
  nodes: P[];
  cls: string[]; // best road class touching node
  adj: { to: number; w: number; cls: string }[][];
  index: Map<string, number[]>;
}
const RANK: Record<string, number> = { primary: 5, secondary: 4, tertiary: 3, residential: 2, service: 1 };

function buildGraph(roads: any[]): Graph {
  const ids = new Map<string, number>();
  const nodes: P[] = [];
  const cls: string[] = [];
  const adj: Graph["adj"] = [];
  const node = (p: P, c: string) => {
    const k = nk(p);
    let i = ids.get(k);
    if (i === undefined) {
      i = nodes.length;
      ids.set(k, i);
      nodes.push(p);
      cls.push(c);
      adj.push([]);
    } else if ((RANK[c] || 0) > (RANK[cls[i]] || 0)) cls[i] = c;
    return i;
  };
  for (const r of roads) {
    const c = r.properties.cls;
    const co: P[] = r.geometry.coordinates;
    for (let i = 0; i < co.length - 1; i++) {
      const a = co[i], b = co[i + 1];
      const d = dist(a, b);
      const n = Math.max(1, Math.ceil(d / 30)); // densify so ODPs can sit mid-block
      let prev = node(a, c);
      for (let s = 1; s <= n; s++) {
        const p: P = s === n ? b : [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n];
        const cur = node(p, c);
        const w = d / n;
        if (cur !== prev) {
          adj[prev].push({ to: cur, w, cls: c });
          adj[cur].push({ to: prev, w, cls: c });
        }
        prev = cur;
      }
    }
  }
  const index = new Map<string, number[]>();
  nodes.forEach((p, i) => {
    const k = Math.floor(p[0] / 0.001) + ":" + Math.floor(p[1] / 0.001);
    if (!index.has(k)) index.set(k, []);
    index.get(k)!.push(i);
  });
  return { nodes, cls, adj, index };
}

function nearestNode(g: Graph, p: P, comp?: Int32Array, compId?: number): number {
  const gx = Math.floor(p[0] / 0.001), gy = Math.floor(p[1] / 0.001);
  for (let r = 1; r < 12; r++) {
    let best = -1, bd = Infinity;
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        const list = g.index.get(gx + dx + ":" + (gy + dy));
        if (!list) continue;
        for (const i of list) {
          if (comp && comp[i] !== compId) continue;
          const d = dist(p, g.nodes[i]);
          if (d < bd) (bd = d), (best = i);
        }
      }
    if (best >= 0) return best;
  }
  return 0;
}

function components(g: Graph): { comp: Int32Array; largest: number } {
  const comp = new Int32Array(g.nodes.length).fill(-1);
  let id = 0, largest = 0, largestSize = 0;
  for (let s = 0; s < g.nodes.length; s++) {
    if (comp[s] >= 0) continue;
    const stack = [s];
    comp[s] = id;
    let size = 0;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (const e of g.adj[u]) if (comp[e.to] < 0) (comp[e.to] = id), stack.push(e.to);
    }
    if (size > largestSize) (largestSize = size), (largest = id);
    id++;
  }
  return { comp, largest };
}

function dijkstra(g: Graph, src: number) {
  const n = g.nodes.length;
  const d = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [];
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  d[src] = 0;
  push([0, src]);
  while (heap.length) {
    const [du, u] = pop();
    if (du > d[u]) continue;
    for (const e of g.adj[u]) {
      const nd = du + e.w;
      if (nd < d[e.to]) {
        d[e.to] = nd;
        prev[e.to] = u;
        push([nd, e.to]);
      }
    }
  }
  return { d, prev };
}

function pathTo(prev: Int32Array, target: number): number[] {
  const out: number[] = [];
  let u = target;
  let guard = 0;
  while (u >= 0 && guard++ < 100000) {
    out.push(u);
    u = prev[u];
  }
  return out.reverse();
}

// ---------------- grouping ----------------
function medoid(g: Graph, nodeIds: number[]): number {
  const uniq = [...new Set(nodeIds)];
  if (uniq.length <= 1) return uniq[0];
  // centroid then nearest candidate (fast approx of medoid)
  let cx = 0, cy = 0;
  nodeIds.forEach((i) => ((cx += g.nodes[i][0]), (cy += g.nodes[i][1])));
  const c: P = [cx / nodeIds.length, cy / nodeIds.length];
  let best = uniq[0], bd = Infinity;
  for (const i of uniq) {
    const d = dist(c, g.nodes[i]);
    if (d < bd) (bd = d), (best = i);
  }
  return best;
}

/** Capacity-aware recursive bisection. Splits on the longer axis, keeping full groups where possible. */
function bisect<T>(items: T[], pos: (t: T) => P, cap: number, maxR: number, center: (items: T[]) => P): T[][] {
  const out: T[][] = [];
  const rec = (arr: T[]) => {
    if (!arr.length) return;
    const c = center(arr);
    const r = Math.max(...arr.map((t) => dist(pos(t), c)));
    if (arr.length <= cap && (r <= maxR || arr.length === 1)) return void out.push(arr);
    const xs = arr.map((t) => pos(t)[0]), ys = arr.map((t) => pos(t)[1]);
    const ex = (Math.max(...xs) - Math.min(...xs)) * KX, ey = (Math.max(...ys) - Math.min(...ys)) * KY;
    const axis = ex >= ey ? 0 : 1;
    const sorted = [...arr].sort((a, b) => pos(a)[axis] - pos(b)[axis]);
    let cut = arr.length <= cap ? Math.ceil(arr.length / 2) : Math.ceil(arr.length / cap / 2) * cap;
    if (cut >= arr.length) cut = Math.ceil(arr.length / 2);
    rec(sorted.slice(0, cut));
    rec(sorted.slice(cut));
  };
  rec(items);
  return out;
}

// ---------------- helpers ----------------
function cableSpec(kind: "dist" | "feeder", load: number) {
  if (kind === "dist") {
    if (load <= 12) return { cores: 12, type: "Distribusi" };
    if (load <= 24) return { cores: 24, type: "Distribusi" };
    return { cores: 48, type: "Sub Feeder" };
  }
  if (load <= 24) return { cores: 24, type: "Sub Feeder" };
  if (load <= 48) return { cores: 48, type: "Feeder" };
  if (load <= 96) return { cores: 96, type: "Feeder" };
  if (load <= 144) return { cores: 144, type: "Backbone" };
  return { cores: 288, type: "Backbone" };
}

const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26)));
const pad = (n: number, l = 2) => String(n).padStart(l, "0");
const pt = (c: P, props: any) => ({ type: "Feature", geometry: { type: "Point", coordinates: c }, properties: props });
const ln = (c: P[], props: any) => ({ type: "Feature", geometry: { type: "LineString", coordinates: c }, properties: props });
const lineLen = (c: P[]) => c.reduce((a, p, i) => (i ? a + dist(c[i - 1], p) : 0), 0);

export interface FtthResult {
  layers: Record<string, any>;
  summary: any;
  boq: BoqGroup[];
  totalCost: number;
  params: FtthParams;
}

// ---------------- main ----------------
export function runFtthDesign(opts: {
  name: string;
  aoi: any;
  homes: any[]; // building features
  roads: any[];
  olt?: P | null;
  params: FtthParams;
}): FtthResult {
  const { params } = opts;
  const homesSrc = opts.homes.filter((h) => h.properties.t === "res" || (params.includeCommercial && h.properties.t === "com"));
  const g = buildGraph(opts.roads);
  const { comp, largest } = components(g);
  const A = params.areaCode;

  // 1) homes snapped to road graph
  const homes = homesSrc.map((h) => {
    const c: P = [h.properties.cx, h.properties.cy];
    const n = nearestNode(g, c, comp, largest);
    return { f: h, c, n };
  });

  // 2) ODP groups
  const odpGroups = bisect(homes, (h) => h.c, params.odpCapacity, params.odpMaxDist * 0.8, (arr) => g.nodes[medoid(g, arr.map((h) => h.n))]);
  const odps = odpGroups.map((grp) => ({ node: medoid(g, grp.map((h) => h.n)), homes: grp, code: "", odc: -1 }));

  // 3) ODC groups
  const odcCap = params.odcType === "24C" ? 16 : 36;
  const odcGroups = bisect(odps, (o) => g.nodes[o.node], odcCap, params.odcMaxDist * 0.75, (arr) => g.nodes[medoid(g, arr.map((o) => o.node))]);
  const odcs = odcGroups.map((grp, i) => {
    const type = params.odcType === "auto" ? (grp.length <= 16 ? "24C" : "48C") : params.odcType;
    return { node: medoid(g, grp.map((o) => o.node)), odps: grp, type, code: `ODC-${A}-${letter(i)}`, letter: letter(i) };
  });
  odcs.forEach((odc, i) => odc.odps.forEach((o, j) => ((o.code = `ODP-${A}-${odc.letter}${pad(j + 1)}`), (o.odc = i))));

  // 4) OLT (bottom-up when not provided)
  const oltNode = opts.olt ? nearestNode(g, opts.olt, comp, largest) : medoid(g, odcs.map((o) => o.node));
  const oltCode = `OLT-${params.cityCode}-${A}-01`;

  // 5) routing
  type EdgeAcc = { a: number; b: number; load: number; kind: "dist" | "feeder"; owner: string; cls: string };
  const distEdges = new Map<string, EdgeAcc>();
  const feedEdges = new Map<string, EdgeAcc>();
  const edgeCls = (a: number, b: number) => g.adj[a].find((e) => e.to === b)?.cls || "residential";
  const addPath = (map: Map<string, EdgeAcc>, path: number[], load: number, kind: "dist" | "feeder", owner: string) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      const k = a + ">" + b;
      const e = map.get(k);
      if (e) e.load += load;
      else map.set(k, { a, b, load, kind, owner, cls: edgeCls(a, b) });
    }
  };
  for (const odc of odcs) {
    const { prev } = dijkstra(g, odc.node);
    for (const o of odc.odps) addPath(distEdges, pathTo(prev, o.node), 1, "dist", odc.code);
  }
  {
    const { prev } = dijkstra(g, oltNode);
    for (const odc of odcs) addPath(feedEdges, pathTo(prev, odc.node), odc.type === "24C" ? 24 : 48, "feeder", oltCode);
  }

  // 6) merge edges into cable segments (break where load changes or tree branches)
  const segments: { coords: P[]; load: number; kind: "dist" | "feeder"; owner: string; cls: string; nodes: number[] }[] = [];
  const toSegments = (map: Map<string, EdgeAcc>) => {
    const out = new Map<number, EdgeAcc[]>();
    const indeg = new Map<number, number>();
    map.forEach((e) => {
      if (!out.has(e.a)) out.set(e.a, []);
      out.get(e.a)!.push(e);
      indeg.set(e.b, (indeg.get(e.b) || 0) + 1);
    });
    const used = new Set<string>();
    const starts = [...out.keys()].filter((n) => !indeg.has(n) || (out.get(n)!.length > 1) || indeg.get(n)! > 1);
    const walk = (e0: EdgeAcc) => {
      const nodes = [e0.a, e0.b];
      used.add(e0.a + ">" + e0.b);
      let cur = e0;
      for (;;) {
        const nx = out.get(cur.b);
        if (!nx || nx.length !== 1) break;
        const n = nx[0];
        if (used.has(n.a + ">" + n.b) || n.load !== cur.load || n.owner !== cur.owner || (indeg.get(n.a) || 0) > 1) break;
        used.add(n.a + ">" + n.b);
        nodes.push(n.b);
        cur = n;
      }
      segments.push({ coords: nodes.map((i) => g.nodes[i]), load: e0.load, kind: e0.kind, owner: e0.owner, cls: e0.cls, nodes });
    };
    for (const s of starts) for (const e of out.get(s) || []) if (!used.has(e.a + ">" + e.b)) walk(e);
    map.forEach((e) => !used.has(e.a + ">" + e.b) && walk(e));
  };
  toSegments(feedEdges);
  toSegments(distEdges);

  const mainRoad = (c: string) => c === "primary" || c === "secondary";
  let fIdx = 4590, dIdx: Record<string, number> = {};
  const cables = segments
    .filter((s) => s.coords.length > 1)
    .map((s) => {
      const spec = cableSpec(s.kind, s.load);
      const len = lineLen(s.coords);
      const underground = params.installation === "mixed" && s.kind === "feeder" && mainRoad(s.cls);
      let label: string;
      if (s.kind === "feeder") label = `${params.cityCode}-F${fIdx++}.${spec.cores} (Feed ${opts.name.toUpperCase()}_${Math.round(len)}M)`;
      else {
        const L = s.owner.split("-").pop()!;
        dIdx[L] = (dIdx[L] || 0) + 1;
        label = `${params.cityCode}-D${L}${pad(dIdx[L])}.${spec.cores} (Dist ${s.owner}_${Math.round(len)}M)`;
      }
      return ln(s.coords, { kind: s.kind, type: spec.type, cores: spec.cores, load: s.load, length: Math.round(len), label, install: underground ? "Underground" : "Aerial", owner: s.owner, roadCls: s.cls });
    });

  // 7) poles along aerial cables (dedupe across overlapping cables)
  const poleGrid = new Map<string, any>();
  const poles: any[] = [];
  const feederNodes = new Set<string>();
  cables.filter((c) => c.properties.kind === "feeder").forEach((c) => c.geometry.coordinates.forEach((p: P) => feederNodes.add(nk(p))));
  const addPole = (p: P, onFeeder: boolean, crossing: boolean) => {
    const k = Math.round(p[0] / 0.00007) + ":" + Math.round(p[1] / 0.00007);
    if (poleGrid.has(k)) return;
    const type = crossing ? "T9 2-Stage" : onFeeder ? "T7 2-Stage" : "T7 1-Stage";
    const f = pt(p, { type, code: "" });
    poleGrid.set(k, f);
    poles.push(f);
  };
  for (const c of cables) {
    if (c.properties.install !== "Aerial") continue;
    const co: P[] = c.geometry.coordinates;
    const onFeeder = c.properties.kind === "feeder";
    let acc = 0;
    addPole(co[0], onFeeder, false);
    for (let i = 1; i < co.length; i++) {
      const d = dist(co[i - 1], co[i]);
      acc += d;
      const last = i === co.length - 1;
      let turn = false;
      if (!last) {
        const a1 = Math.atan2(co[i][1] - co[i - 1][1], co[i][0] - co[i - 1][0]);
        const a2 = Math.atan2(co[i + 1][1] - co[i][1], co[i + 1][0] - co[i][0]);
        let da = Math.abs(a1 - a2);
        if (da > Math.PI) da = 2 * Math.PI - da;
        turn = da > 0.45;
      }
      if (acc >= params.poleSpacing * 0.92 || turn || last) {
        const crossing = turn && g.adj[nearestNode(g, co[i])]?.some((e) => mainRoad(e.cls));
        addPole(co[i], onFeeder || feederNodes.has(nk(co[i])), !!crossing);
        acc = 0;
      }
    }
  }
  poles.forEach((p, i) => (p.properties.code = `TP-${A}-${pad(i + 1, 4)}`));

  // 8) coils + joint closures along feeder
  const coils: any[] = [];
  const jcs: any[] = [];
  for (const c of cables.filter((x) => x.properties.kind === "feeder")) {
    const co: P[] = c.geometry.coordinates;
    const step = c.properties.type === "Backbone" ? params.coilBackbone : params.coilFeeder;
    let acc = 0, accJ = 0;
    for (let i = 1; i < co.length; i++) {
      const d = dist(co[i - 1], co[i]);
      acc += d;
      accJ += d;
      if (acc >= step) {
        coils.push(pt(co[i], { code: `CL-${A}-${pad(coils.length + 1, 3)}`, slack: 20, cable: c.properties.label }));
        acc = 0;
      }
      if (accJ >= params.jcInterval) {
        jcs.push(pt(co[i], { code: `JC-${A}-${pad(jcs.length + 1)}`, reason: "Interval 3.500 m", cores: c.properties.cores }));
        accJ = 0;
      }
    }
  }
  // JC at feeder branch points
  {
    const deg = new Map<string, number>();
    cables.filter((x) => x.properties.kind === "feeder").forEach((c) => {
      const co = c.geometry.coordinates;
      [co[0], co[co.length - 1]].forEach((p: P) => deg.set(nk(p), (deg.get(nk(p)) || 0) + 1));
    });
    const oltK = nk(g.nodes[oltNode]);
    const odcK = new Set(odcs.map((o) => nk(g.nodes[o.node])));
    deg.forEach((d, k) => {
      if (d >= 3 && k !== oltK && !odcK.has(k)) {
        const [x, y] = k.split(",").map(Number);
        jcs.push(pt([x, y], { code: `JC-${A}-${pad(jcs.length + 1)}`, reason: "Percabangan feeder", cores: 0 }));
      }
    });
  }

  // 9) features
  const pen = params.penetration / 100;
  const homeFeatures: any[] = [];
  const dropFeatures: any[] = [];
  let dropLen = 0;
  const odpFeatures = odps.map((o) => {
    const c = g.nodes[o.node];
    o.homes.forEach((h, idx) => {
      const d = dist(h.c, c);
      dropLen += d * 1.15 + 8;
      const active = idx < Math.ceil(o.homes.length * pen);
      homeFeatures.push(pt(h.c, { odp: o.code, phase: active ? "Build" : "Plan", cls: h.f.properties.cls, t: h.f.properties.t }));
      dropFeatures.push(ln([c, h.c], { odp: o.code, length: Math.round(d * 1.15 + 8), phase: active ? "Build" : "Plan" }));
    });
    const maxD = Math.max(...o.homes.map((h) => dist(h.c, c)));
    return pt(c, { code: o.code, odc: odcs[o.odc].code, capacity: 16, used: o.homes.length, idle: 16 - o.homes.length, maxDrop: Math.round(maxD), splitter: "1:16" });
  });
  const odcFeatures = odcs.map((o) => pt(g.nodes[o.node], { code: o.code, type: `ODC ${o.type}`, odpCount: o.odps.length, capacity: o.type === "24C" ? 16 : 36, olt: oltCode }));
  const oltFeatures = [pt(g.nodes[oltNode], { code: oltCode, ponPorts: Math.max(4, Math.ceil(homes.length / 64)), mode: opts.olt ? "Existing / dipilih" : "Auto (bottom-up)" })];

  // 10) summary
  const byType: Record<string, number> = {};
  const byCore: Record<string, number> = {};
  cables.forEach((c) => {
    byType[c.properties.type] = (byType[c.properties.type] || 0) + c.properties.length;
    const k = `${c.properties.type} ${c.properties.cores}C`;
    byCore[k] = (byCore[k] || 0) + c.properties.length;
  });
  const poleBy: Record<string, number> = {};
  poles.forEach((p) => (poleBy[p.properties.type] = (poleBy[p.properties.type] || 0) + 1));
  const undergroundLen = cables.filter((c) => c.properties.install === "Underground").reduce((a, c) => a + c.properties.length, 0);
  const cableTotal = cables.reduce((a, c) => a + c.properties.length, 0);
  const odpBuild = odps.filter((o) => o.homes.length * pen >= 1).length;
  const summary = {
    homes: homes.length,
    homepass: homes.length,
    buildHomes: Math.ceil(homes.length * pen),
    odp: odps.length,
    odpBuild,
    odc: odcs.length,
    odc24: odcs.filter((o) => o.type === "24C").length,
    odc48: odcs.filter((o) => o.type === "48C").length,
    olt: 1,
    ponPorts: oltFeatures[0].properties.ponPorts,
    poles: poles.length,
    poleBy,
    jc: jcs.length,
    coils: coils.length,
    cableTotal: Math.round(cableTotal),
    cableByType: byType,
    cableByCore: byCore,
    undergroundLen: Math.round(undergroundLen),
    dropLen: Math.round(dropLen),
    dropBuild: Math.round(dropLen * pen),
    avgOdpUtil: Math.round((homes.length / (odps.length * 16)) * 100),
    maxDrop: Math.max(0, ...odpFeatures.map((f) => f.properties.maxDrop)),
    penetration: params.penetration,
  };

  const boq = buildBoq(summary, pen);
  const totalCost = boq.reduce((a, g) => a + g.total, 0);

  const fc = (features: any[]) => ({ type: "FeatureCollection", features });
  return {
    params,
    summary,
    boq,
    totalCost,
    layers: {
      boundary: fc([{ ...opts.aoi, properties: { name: opts.name } }]),
      homes: fc(homeFeatures),
      drops: fc(dropFeatures),
      cables: fc(cables),
      poles: fc(poles),
      odp: fc(odpFeatures),
      odc: fc(odcFeatures),
      olt: fc(oltFeatures),
      jc: fc(jcs),
      coils: fc(coils),
    },
  };
}

// ---------------- BOQ / BOM ----------------
export interface BoqItem {
  code: string;
  item: string;
  unit: string;
  qtyPlan: number;
  qty: number;
  price: number;
  total: number;
}
export interface BoqGroup {
  group: string;
  category: "Material (BOM)" | "Jasa (BOQ)";
  items: BoqItem[];
  total: number;
}

export const PRICE: Record<string, { item: string; unit: string; price: number }> = {
  OLT: { item: "OLT GPON 16 PON (chassis + card)", unit: "unit", price: 145_000_000 },
  ODC24: { item: "ODC 24C pole/ground mounted + splitter 1:8", unit: "unit", price: 7_850_000 },
  ODC48: { item: "ODC 48C ground mounted + splitter 1:8", unit: "unit", price: 11_900_000 },
  ODP: { item: "ODP 16 port + splitter 1:16 (pole mounted)", unit: "unit", price: 1_375_000 },
  C288: { item: "Kabel Backbone 288C", unit: "m", price: 38_500 },
  C144: { item: "Kabel Backbone 144C", unit: "m", price: 26_500 },
  C96: { item: "Kabel Feeder 96C", unit: "m", price: 19_800 },
  C48: { item: "Kabel Feeder / Sub Feeder 48C", unit: "m", price: 13_600 },
  C24: { item: "Kabel Sub Feeder / Distribusi 24C", unit: "m", price: 9_900 },
  C12: { item: "Kabel Distribusi 12C", unit: "m", price: 7_250 },
  DROP: { item: "Kabel Drop 1C (precon)", unit: "m", price: 2_350 },
  T71: { item: "Tiang 7m 1-Stage (area lingkungan)", unit: "batang", price: 1_650_000 },
  T72: { item: "Tiang 7m 2-Stage (jalan utama backbone/feeder)", unit: "batang", price: 2_250_000 },
  T92: { item: "Tiang 9m 2-Stage (crossing jalan)", unit: "batang", price: 3_850_000 },
  JC: { item: "Joint Closure 96C", unit: "unit", price: 1_250_000 },
  COIL: { item: "Slack / Coil bracket (20 m)", unit: "set", price: 175_000 },
  HDPE: { item: "Pipa HDPE 40mm + galian (underground)", unit: "m", price: 145_000 },
  ONT: { item: "ONT GPON dual band", unit: "unit", price: 525_000 },
  ACC: { item: "Aksesoris tiang (clamp, bracket, strap)", unit: "set", price: 85_000 },
  J_TARIK: { item: "Jasa penarikan kabel udara", unit: "m", price: 4_500 },
  J_TANAM: { item: "Jasa penanaman tiang", unit: "batang", price: 450_000 },
  J_SPLICE: { item: "Jasa splicing per core", unit: "core", price: 25_000 },
  J_ODP: { item: "Jasa instalasi ODP", unit: "unit", price: 275_000 },
  J_ODC: { item: "Jasa instalasi ODC + pondasi", unit: "unit", price: 1_750_000 },
  J_OLT: { item: "Jasa instalasi & konfigurasi OLT", unit: "unit", price: 6_500_000 },
  J_DROP: { item: "Jasa tarik drop + aktivasi pelanggan", unit: "SL", price: 185_000 },
  J_COMM: { item: "Jasa commissioning & OTDR test", unit: "homepass", price: 15_000 },
  J_SURVEY: { item: "Survey, perizinan & as-built drawing", unit: "homepass", price: 12_500 },
};

function buildBoq(s: any, pen: number): BoqGroup[] {
  const it = (code: string, qtyPlan: number, qty = qtyPlan): BoqItem => {
    const p = PRICE[code];
    const q = Math.round(qty);
    return { code, item: p.item, unit: p.unit, qtyPlan: Math.round(qtyPlan), qty: q, price: p.price, total: q * p.price };
  };
  const core = (k: string) => Object.entries(s.cableByCore).filter(([n]) => n.endsWith(" " + k)).reduce((a, [, v]) => a + (v as number), 0) * 1.05;
  const coilM = s.coils * 20;
  const aerial = s.cableTotal - s.undergroundLen;
  const groups: BoqGroup[] = [
    { group: "Perangkat Aktif & Pasif", category: "Material (BOM)", items: [it("OLT", 1), it("ODC24", s.odc24), it("ODC48", s.odc48), it("ODP", s.odp, s.odpBuild), it("ONT", s.homes, s.homes * pen)], total: 0 },
    {
      group: "Kabel Fiber Optik",
      category: "Material (BOM)",
      items: [it("C288", core("288C")), it("C144", core("144C")), it("C96", core("96C") + coilM * 0.6), it("C48", core("48C") + coilM * 0.4), it("C24", core("24C")), it("C12", core("12C")), it("DROP", s.dropLen, s.dropBuild)].filter((x) => x.qtyPlan > 0),
      total: 0,
    },
    {
      group: "Tiang, Closure & Aksesoris",
      category: "Material (BOM)",
      items: [it("T71", s.poleBy["T7 1-Stage"] || 0), it("T72", s.poleBy["T7 2-Stage"] || 0), it("T92", s.poleBy["T9 2-Stage"] || 0), it("JC", s.jc), it("COIL", s.coils), it("HDPE", s.undergroundLen), it("ACC", s.poles)].filter((x) => x.qtyPlan > 0),
      total: 0,
    },
    {
      group: "Jasa Instalasi",
      category: "Jasa (BOQ)",
      items: [
        it("J_SURVEY", s.homes),
        it("J_TARIK", aerial * 1.05),
        it("J_TANAM", s.poles),
        it("J_SPLICE", s.odp * 2 + s.odc * 48 + s.jc * 48),
        it("J_ODP", s.odp, s.odpBuild),
        it("J_ODC", s.odc),
        it("J_OLT", 1),
        it("J_DROP", s.homes, s.homes * pen),
        it("J_COMM", s.homes),
      ],
      total: 0,
    },
  ];
  groups.forEach((g) => (g.total = g.items.reduce((a, b) => a + b.total, 0)));
  return groups;
}

/** Shortest road path between two points (used by Asset Management "Add Cable"). */
export function routeAlongRoads(roads: any[], a: P, b: P): { coords: P[]; length: number } {
  const g = buildGraph(roads);
  if (!g.nodes.length) return { coords: [a, b], length: dist(a, b) };
  const { comp, largest } = components(g);
  const na = nearestNode(g, a, comp, largest), nb = nearestNode(g, b, comp, largest);
  const { prev } = dijkstra(g, na);
  const path = pathTo(prev, nb);
  if (path[0] !== na) return { coords: [a, b], length: dist(a, b) };
  const coords: P[] = [a, ...path.map((i) => g.nodes[i]), b];
  return { coords, length: lineLen(coords) };
}

export function polesAlong(coords: P[], spacing: number): P[] {
  const out: P[] = [coords[0]];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    let a = coords[i - 1];
    const b = coords[i];
    let seg = dist(a, b);
    while (acc + seg >= spacing) {
      const t = (spacing - acc) / seg;
      const p: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(p);
      seg -= spacing - acc;
      a = p;
      acc = 0;
    }
    acc += seg;
  }
  out.push(coords[coords.length - 1]);
  return out;
}
export { dist as metersBetween };
