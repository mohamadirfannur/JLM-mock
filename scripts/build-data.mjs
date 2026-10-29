// Builds the static dummy datasets in public/data from raw OpenStreetMap extracts.
// Usage: node scripts/build-data.mjs <dir-with-roads.json,bld.json,poi.json>
// Attributes (house class, price, ISP, etc.) are synthetic — this is mock data.
import fs from "node:fs";
import path from "node:path";
import * as turf from "@turf/turf";

const RAW = process.argv[2];
if (!RAW) throw new Error("pass raw OSM dir");
const OUT = path.resolve("public/data");
const SAMPLES = path.resolve("public/samples");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SAMPLES, { recursive: true });

const BBOX = [107.67, -6.975, 107.72, -6.935];
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const rc = (c) => [r6(c[0]), r6(c[1])];

// deterministic random
let seed = 20261030;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr, weights) => {
  const t = weights.reduce((a, b) => a + b, 0);
  let x = rnd() * t;
  for (let i = 0; i < arr.length; i++) if ((x -= weights[i]) <= 0) return arr[i];
  return arr[arr.length - 1];
};

const load = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8")).elements;

// ---------------- roads ----------------
const CLS = { primary: "primary", secondary: "secondary", tertiary: "tertiary", unclassified: "residential", residential: "residential", living_street: "residential", service: "service" };
const roads = load("roads.json")
  .filter((w) => w.geometry && w.geometry.length > 1 && CLS[w.tags.highway])
  .filter((w) => !(w.tags.highway === "service" && /parking|driveway/.test(w.tags.service || "")))
  .map((w) => ({
    type: "Feature",
    properties: { id: w.id, cls: CLS[w.tags.highway], name: w.tags.name || "" },
    geometry: { type: "LineString", coordinates: w.geometry.map((g) => rc([g.lon, g.lat])) },
  }));
console.log("roads", roads.length);

// segment grid index for nearest-road lookups
const CELL = 0.0015;
const segIndex = new Map();
roads.forEach((r, ri) => {
  const c = r.geometry.coordinates;
  for (let i = 0; i < c.length - 1; i++) {
    const minx = Math.min(c[i][0], c[i + 1][0]), maxx = Math.max(c[i][0], c[i + 1][0]);
    const miny = Math.min(c[i][1], c[i + 1][1]), maxy = Math.max(c[i][1], c[i + 1][1]);
    for (let gx = Math.floor(minx / CELL); gx <= Math.floor(maxx / CELL); gx++)
      for (let gy = Math.floor(miny / CELL); gy <= Math.floor(maxy / CELL); gy++) {
        const k = gx + ":" + gy;
        if (!segIndex.has(k)) segIndex.set(k, []);
        segIndex.get(k).push([ri, i]);
      }
  }
});
const KX = 110574 * Math.cos((6.955 * Math.PI) / 180), KY = 110574;
function nearestRoad(p) {
  const gx = Math.floor(p[0] / CELL), gy = Math.floor(p[1] / CELL);
  let best = null, bd = Infinity;
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const list = segIndex.get(gx + dx + ":" + (gy + dy));
      if (!list) continue;
      for (const [ri, i] of list) {
        const a = roads[ri].geometry.coordinates[i], b = roads[ri].geometry.coordinates[i + 1];
        const ax = (a[0] - p[0]) * KX, ay = (a[1] - p[1]) * KY, bx = (b[0] - p[0]) * KX, by = (b[1] - p[1]) * KY;
        const vx = bx - ax, vy = by - ay;
        const t = Math.max(0, Math.min(1, -(ax * vx + ay * vy) / (vx * vx + vy * vy || 1)));
        const d = Math.hypot(ax + t * vx, ay + t * vy);
        if (d < bd) (bd = d), (best = roads[ri]);
      }
    }
  return { road: best, dist: bd };
}

// ---------------- kelurahan (synthetic boundaries) ----------------
const KEL = [
  ["Cisaranten Kidul", 107.688, -6.952],
  ["Rancabolang", 107.699, -6.958],
  ["Cimincrang", 107.709, -6.952],
  ["Derwati", 107.705, -6.968],
  ["Cipamokolan", 107.678, -6.962],
  ["Mekarmulya", 107.683, -6.970],
  ["Cisaranten Wetan", 107.695, -6.942],
  ["Cisaranten Endah", 107.677, -6.944],
  ["Sukamulya", 107.713, -6.940],
];
const vor = turf.voronoi(turf.featureCollection(KEL.map(([n, x, y]) => turf.point([x, y], { name: n }))), { bbox: BBOX });
const kelurahan = vor.features.map((f, i) => ({
  type: "Feature",
  properties: { name: KEL[i][0], kecamatan: i < 4 || i === 6 ? "Gedebage" : "Rancasari", kota: "Kota Bandung", provinsi: "Jawa Barat" },
  geometry: { type: "Polygon", coordinates: [f.geometry.coordinates[0].map(rc)] },
}));
const kelOf = (p) => kelurahan.find((k) => turf.booleanPointInPolygon(p, k))?.properties.name || "";

// ---------------- buildings ----------------
const NONRES = { commercial: "com", retail: "com", office: "off", school: "edu", university: "edu", mosque: "ibd", church: "ibd", hospital: "kes", industrial: "ind", warehouse: "ind", construction: "con", roof: "x", guardhouse: "x", hut: "x", shed: "x" };
// competitor pockets
const ISP_POCKETS = [
  { isp: "MyRepublic", c: [107.697, -6.955], r: 900, p: 0.35 },
  { isp: "Biznet", c: [107.682, -6.945], r: 800, p: 0.3 },
  { isp: "First Media", c: [107.709, -6.965], r: 700, p: 0.25 },
  { isp: "CBN", c: [107.676, -6.966], r: 600, p: 0.2 },
];
const metres = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);

const buildings = [];
for (const w of load("bld.json")) {
  if (!w.geometry || w.geometry.length < 4) continue;
  const ring = w.geometry.map((g) => rc([g.lon, g.lat]));
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
  const poly = turf.polygon([ring]);
  const area = turf.area(poly);
  if (area < 18 || area > 40000) continue;
  const tag = w.tags?.building || "yes";
  let t = NONRES[tag] || (area > 1500 ? "com" : "res");
  if (t === "x") continue;
  const c = turf.centroid(poly).geometry.coordinates.map(r6);
  const { road, dist } = nearestRoad(c);
  if (t === "res" && road && (road.properties.cls === "primary" || road.properties.cls === "secondary") && dist < 25 && rnd() < 0.45) t = "com"; // ruko along main roads
  const cls = area < 60 ? "D" : area < 120 ? "C" : area < 250 ? "B" : "A";
  const priceBase = { D: 350, C: 750, B: 1600, A: 3800 }[cls];
  let isp = rnd() < 0.27 ? "IndiHome" : "";
  for (const pk of ISP_POCKETS) if (metres(c, pk.c) < pk.r && rnd() < pk.p) isp = pk.isp;
  buildings.push({
    type: "Feature",
    properties: {
      id: w.id,
      t,
      cls: t === "res" ? cls : "-",
      cx: c[0],
      cy: c[1],
      ar: Math.round(area),
      pr: t === "res" ? Math.round(priceBase * (0.7 + rnd() * 0.6)) : 0, // juta rupiah
      cp: t === "res" ? (rnd() < { D: 0.1, C: 0.35, B: 0.75, A: 0.95 }[cls] ? 1 : 0) : 0,
      va: t === "res" ? pick([900, 1300, 2200, 3500, 5500], { D: [6, 3, 1, 0, 0], C: [2, 5, 3, 1, 0], B: [0, 2, 5, 3, 1], A: [0, 0, 2, 4, 4] }[cls]) : 0,
      rd: road ? road.properties.cls : "residential",
      isp,
      kel: kelOf(c),
    },
    geometry: { type: "Polygon", coordinates: [ring] },
  });
}
console.log("buildings", buildings.length, "res", buildings.filter((b) => b.properties.t === "res").length);

// ---------------- POI ----------------
const POICAT = (t) => {
  const a = t.amenity, s = t.shop;
  if (["school", "kindergarten", "college", "university"].includes(a)) return ["Sekolah", a === "kindergarten" ? "PAUD/TK" : a === "school" ? pick(["SD", "SMP", "SMA", "SMK"], [5, 3, 2, 1.5]) : "Perguruan Tinggi"];
  if (["hospital", "clinic", "doctors", "pharmacy", "dentist"].includes(a) || t.healthcare) return ["Kesehatan", a === "hospital" ? "Rumah Sakit" : a === "pharmacy" ? "Apotek" : "Klinik"];
  if (a === "place_of_worship") return ["Ibadah", t.religion === "christian" ? "Gereja" : "Masjid"];
  if (["restaurant", "cafe", "fast_food", "food_court"].includes(a)) return ["Kuliner", "Restoran/Cafe"];
  if (["bank", "atm"].includes(a)) return ["Keuangan", a === "bank" ? "Bank" : "ATM"];
  if (s) return ["Komersial", ["convenience", "supermarket"].includes(s) ? "Minimarket" : "Toko/Ruko"];
  if (t.office || ["townhall", "police", "post_office"].includes(a)) return ["Perkantoran", t.office ? "Kantor" : "Kantor Pemerintah"];
  if (["fuel", "parking"].includes(a)) return ["Publik", a === "fuel" ? "SPBU" : "Parkir"];
  return null;
};
const poi = [];
for (const e of load("poi.json")) {
  const c = e.center ? [e.center.lon, e.center.lat] : [e.lon, e.lat];
  if (!c[0]) continue;
  const cat = POICAT(e.tags || {});
  if (!cat) continue;
  poi.push({ type: "Feature", properties: { name: e.tags.name || cat[1], cat: cat[0], sub: cat[1] }, geometry: { type: "Point", coordinates: rc(c) } });
}
console.log("poi", poi.length);

// ---------------- hex potential grid ----------------
const hex = turf.hexGrid(BBOX, 0.16, { units: "kilometers" });
const hb = new Map();
const HC = 0.004;
buildings.forEach((b) => {
  const k = Math.floor(b.properties.cx / HC) + ":" + Math.floor(b.properties.cy / HC);
  if (!hb.has(k)) hb.set(k, []);
  hb.get(k).push(b);
});
const hexFeatures = [];
for (const h of hex.features) {
  const bb = turf.bbox(h);
  const cand = [];
  for (let gx = Math.floor(bb[0] / HC); gx <= Math.floor(bb[2] / HC); gx++)
    for (let gy = Math.floor(bb[1] / HC); gy <= Math.floor(bb[3] / HC); gy++) cand.push(...(hb.get(gx + ":" + gy) || []));
  const inside = cand.filter((b) => turf.booleanPointInPolygon([b.properties.cx, b.properties.cy], h));
  if (!inside.length) continue;
  const res = inside.filter((b) => b.properties.t === "res");
  const comp = res.filter((b) => b.properties.isp).length;
  const avgPrice = res.reduce((a, b) => a + b.properties.pr, 0) / (res.length || 1);
  const score = res.length * (1 - (comp / (res.length || 1)) * 0.6) * (0.6 + Math.min(avgPrice, 3000) / 3000);
  hexFeatures.push({
    type: "Feature",
    properties: { homes: res.length, nonres: inside.length - res.length, comp, compPct: res.length ? Math.round((comp / res.length) * 100) : 0, avgPrice: Math.round(avgPrice), score: Math.round(score) },
    geometry: { type: "Polygon", coordinates: [h.geometry.coordinates[0].map(rc)] },
  });
}
const scores = hexFeatures.map((f) => f.properties.score).sort((a, b) => a - b);
const q = (p) => scores[Math.floor(p * (scores.length - 1))];
const qs = [q(0.2), q(0.45), q(0.7), q(0.88)];
const LEVELS = ["Very Low", "Low", "Mid", "High", "Very High"];
hexFeatures.forEach((f) => {
  const s = f.properties.score;
  f.properties.level = LEVELS[qs.filter((x) => s > x).length];
});
console.log("hex", hexFeatures.length);

// ---------------- sample AOIs (cluster perumahan / RW) ----------------
const resPts = turf.featureCollection(buildings.filter((b) => b.properties.t === "res").map((b) => turf.point([b.properties.cx, b.properties.cy])));
const db = turf.clustersDbscan(resPts, 0.035, { minPoints: 12, units: "kilometers" });
const groups = {};
db.features.forEach((f) => f.properties.dbscan !== "noise" && (groups[f.properties.cluster] ||= []).push(f));
const aois = [];
Object.values(groups)
  .filter((g) => g.length >= 120 && g.length <= 900)
  .sort((a, b) => b.length - a.length)
  .slice(0, 14)
  .forEach((g, i) => {
    let hull = turf.concave(turf.featureCollection(g), { maxEdge: 0.12, units: "kilometers" }) || turf.convex(turf.featureCollection(g));
    if (!hull) return;
    hull = turf.buffer(hull, 12, { units: "meters" });
    if (hull.geometry.type !== "Polygon") return;
    hull = turf.simplify(hull, { tolerance: 0.00003 });
    const c = turf.centroid(hull).geometry.coordinates;
    const kel = kelOf(c) || "Gedebage";
    const rw = String(1 + ((i * 7) % 15)).padStart(2, "0");
    aois.push({
      type: "Feature",
      properties: { id: `aoi-${i + 1}`, name: i % 2 === 0 ? `Cluster Perumahan ${String.fromCharCode(65 + i)} – ${kel}` : `RW ${rw} ${kel}`, kel, homes: g.length },
      geometry: { type: "Polygon", coordinates: [hull.geometry.coordinates[0].map(rc)] },
    });
  });
console.log("aois", aois.length, aois.map((a) => a.properties.homes).join(","));

// ---------------- write ----------------
const write = (f, feats) => {
  fs.writeFileSync(path.join(OUT, f), JSON.stringify({ type: "FeatureCollection", features: feats }));
  console.log(f, (fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(2), "MB");
};
write("roads.geojson", roads);
// compact encoding: [t, cls, area, price, carport, va, roadIdx, ispIdx, kelIdx, x0, y0, dx, dy, ...] (coords in 1e-6 deg from bbox min)
{
  const T = ["res", "com", "off", "edu", "ibd", "kes", "ind", "con"], C = ["A", "B", "C", "D", "-"], RD = ["primary", "secondary", "tertiary", "residential", "service"];
  const ISP = ["", "IndiHome", "MyRepublic", "Biznet", "First Media", "CBN"], KN = KEL.map((k) => k[0]).concat([""]);
  const ox = BBOX[0], oy = BBOX[1];
  const rows = buildings.map((b) => {
    const p = b.properties;
    const row = [T.indexOf(p.t), C.indexOf(p.cls), p.ar, p.pr, p.cp, p.va, RD.indexOf(p.rd), ISP.indexOf(p.isp), KN.indexOf(p.kel)];
    const ring = b.geometry.coordinates[0].slice(0, -1);
    let px = 0, py = 0;
    ring.forEach((c, i) => {
      const x = Math.round((c[0] - ox) * 1e6), y = Math.round((c[1] - oy) * 1e6);
      row.push(x - px, y - py);
      px = x; py = y;
    });
    return row;
  });
  fs.writeFileSync(path.join(OUT, "buildings.json"), JSON.stringify({ origin: [ox, oy], T, C, RD, ISP, KEL: KN, rows }));
  console.log("buildings.json", (fs.statSync(path.join(OUT, "buildings.json")).size / 1e6).toFixed(2), "MB");
}
write("poi.geojson", poi);
write("hex.geojson", hexFeatures);
write("kelurahan.geojson", kelurahan);
write("sample-aoi.geojson", aois);

// sample KML files for the upload demo
const kml = (f) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${f.properties.name}</name>
<Placemark><name>${f.properties.name}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${f.geometry.coordinates[0].map((c) => c.join(",") + ",0").join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
aois.slice(0, 4).forEach((a, i) => fs.writeFileSync(path.join(SAMPLES, `AOI_${a.properties.name.replace(/[^A-Za-z0-9]+/g, "_")}.kml`), kml(a)));
console.log("done");
