import * as turf from "@turf/turf";

export interface BuildingProps {
  id: number;
  t: string; // res | com | off | edu | ibd | kes | ind | con
  cls: string; // A..D or "-"
  ar: number; // m2
  pr: number; // juta rupiah
  cp: number; // carport 0/1
  va: number; // PLN power
  rd: string; // nearest road class
  isp: string; // competitor ISP or ""
  kel: string;
  cx: number;
  cy: number;
}

type FC = { type: "FeatureCollection"; features: any[] };

const cache: {
  roads?: FC;
  buildings?: FC;
  poi?: FC;
  hex?: FC;
  kelurahan?: FC;
  aoi?: FC;
  grid?: Map<string, any[]>;
} = {};
let loading: Promise<void> | null = null;
const loaded = ref(false);

const CELL = 0.002;
const key = (x: number, y: number) => Math.floor(x / CELL) + ":" + Math.floor(y / CELL);

function decodeBuildings(raw: any): FC {
  const [ox, oy] = raw.origin;
  const features = raw.rows.map((r: number[], idx: number) => {
    let x = 0, y = 0;
    const ring: [number, number][] = [];
    for (let i = 9; i < r.length; i += 2) {
      x += r[i];
      y += r[i + 1];
      ring.push([ox + x / 1e6, oy + y / 1e6]);
    }
    ring.push(ring[0]);
    let cx = 0, cy = 0;
    ring.slice(0, -1).forEach((c) => ((cx += c[0]), (cy += c[1])));
    cx /= ring.length - 1;
    cy /= ring.length - 1;
    const props: BuildingProps = {
      id: idx + 1,
      t: raw.T[r[0]],
      cls: raw.C[r[1]],
      ar: r[2],
      pr: r[3],
      cp: r[4],
      va: r[5],
      rd: raw.RD[r[6]],
      isp: raw.ISP[r[7]],
      kel: raw.KEL[r[8]],
      cx,
      cy,
    };
    return { type: "Feature", id: idx + 1, properties: props, geometry: { type: "Polygon", coordinates: [ring] } };
  });
  return { type: "FeatureCollection", features };
}

export function useGeoData() {
  async function load() {
    if (loaded.value) return;
    if (!loading) {
      loading = (async () => {
        const get = (f: string) => $fetch<any>(`/data/${f}`, { responseType: "json" });
        const [roads, b, poi, hex, kel, aoi] = await Promise.all([
          get("roads.geojson"),
          get("buildings.json"),
          get("poi.geojson"),
          get("hex.geojson"),
          get("kelurahan.geojson"),
          get("sample-aoi.geojson"),
        ]);
        cache.roads = roads;
        cache.buildings = decodeBuildings(typeof b === "string" ? JSON.parse(b) : b);
        cache.poi = poi;
        cache.hex = hex;
        cache.kelurahan = kel;
        cache.aoi = aoi;
        const grid = new Map<string, any[]>();
        cache.buildings.features.forEach((f) => {
          const k = key(f.properties.cx, f.properties.cy);
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k)!.push(f);
        });
        cache.grid = grid;
        loaded.value = true;
      })();
    }
    await loading;
  }

  /** Buildings whose centroid falls inside the polygon feature. */
  function buildingsIn(poly: any): any[] {
    if (!cache.grid) return [];
    const bb = turf.bbox(poly);
    const out: any[] = [];
    for (let gx = Math.floor(bb[0] / CELL); gx <= Math.floor(bb[2] / CELL); gx++)
      for (let gy = Math.floor(bb[1] / CELL); gy <= Math.floor(bb[3] / CELL); gy++) {
        const list = cache.grid.get(gx + ":" + gy);
        if (!list) continue;
        for (const f of list) {
          const p = f.properties;
          if (p.cx < bb[0] || p.cx > bb[2] || p.cy < bb[1] || p.cy > bb[3]) continue;
          if (turf.booleanPointInPolygon([p.cx, p.cy], poly)) out.push(f);
        }
      }
    return out;
  }

  function poiIn(poly: any): any[] {
    return (cache.poi?.features || []).filter((f) => turf.booleanPointInPolygon(f, poly));
  }

  function roadsNear(poly: any, bufferM = 400, extra?: [number, number] | null): any[] {
    const bb = turf.bbox(turf.buffer(poly, bufferM, { units: "meters" })!);
    if (extra) {
      const pad = 0.004;
      bb[0] = Math.min(bb[0], extra[0] - pad);
      bb[1] = Math.min(bb[1], extra[1] - pad);
      bb[2] = Math.max(bb[2], extra[0] + pad);
      bb[3] = Math.max(bb[3], extra[1] + pad);
    }
    return (cache.roads?.features || []).filter((f) => {
      const c = f.geometry.coordinates;
      return c.some((p: number[]) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3]);
    });
  }

  return {
    load,
    loaded,
    data: cache,
    buildingsIn,
    poiIn,
    roadsNear,
  };
}
