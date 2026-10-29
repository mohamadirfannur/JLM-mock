// Parse uploaded AOI / asset files into GeoJSON (KML, KMZ, GeoJSON, zipped Shapefile).
import JSZip from "jszip";

function kmlToGeoJSON(text: string) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const features: any[] = [];
  const coords = (s: string) =>
    s
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((c) => c.length >= 2 && !isNaN(c[0]))
      .map((c) => [c[0], c[1]]);
  doc.querySelectorAll("Placemark").forEach((pm) => {
    const name = pm.querySelector("name")?.textContent || "";
    const props: any = { name };
    pm.querySelectorAll("ExtendedData Data, ExtendedData SimpleData").forEach((d) => {
      const k = d.getAttribute("name");
      if (k) props[k] = d.querySelector("value")?.textContent ?? d.textContent;
    });
    pm.querySelectorAll("Polygon").forEach((pg) => {
      const outer = pg.querySelector("outerBoundaryIs coordinates")?.textContent;
      if (outer) features.push({ type: "Feature", properties: props, geometry: { type: "Polygon", coordinates: [coords(outer)] } });
    });
    pm.querySelectorAll("LineString").forEach((l) => {
      const c = l.querySelector("coordinates")?.textContent;
      if (c) features.push({ type: "Feature", properties: props, geometry: { type: "LineString", coordinates: coords(c) } });
    });
    pm.querySelectorAll("Point").forEach((p) => {
      const c = p.querySelector("coordinates")?.textContent;
      if (c) features.push({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: coords(c)[0] } });
    });
  });
  return { type: "FeatureCollection", features };
}

export async function parseGeoFile(file: File): Promise<any> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".geojson") || name.endsWith(".json")) {
    const j = JSON.parse(await file.text());
    return j.type === "FeatureCollection" ? j : j.type === "Feature" ? { type: "FeatureCollection", features: [j] } : { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: j }] };
  }
  if (name.endsWith(".kml")) return kmlToGeoJSON(await file.text());
  if (name.endsWith(".kmz")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kml = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith(".kml"));
    if (!kml) throw new Error("KMZ tidak berisi file KML");
    return kmlToGeoJSON(await kml.async("text"));
  }
  if (name.endsWith(".zip") || name.endsWith(".shp")) {
    const shp = (await import("shpjs")).default as any;
    const r = await shp(await file.arrayBuffer());
    return Array.isArray(r) ? { type: "FeatureCollection", features: r.flatMap((x: any) => x.features) } : r;
  }
  throw new Error("Format tidak didukung. Gunakan KML, KMZ, GeoJSON, atau SHP (.zip)");
}

/** First polygon in a FeatureCollection (MultiPolygon -> largest part). */
export function firstPolygon(fc: any) {
  for (const f of fc.features || []) {
    if (f.geometry?.type === "Polygon") return f;
    if (f.geometry?.type === "MultiPolygon") return { ...f, geometry: { type: "Polygon", coordinates: f.geometry.coordinates[0] } };
  }
  return null;
}
