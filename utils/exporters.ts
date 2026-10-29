import * as XLSX from "xlsx";

export function download(name: string, content: BlobPart, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export function exportXLSX(name: string, sheets: Record<string, Record<string, any>[]>) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([s, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ info: "kosong" }]), s.slice(0, 31)));
  XLSX.writeFile(wb, name);
}

const KML_COLORS: Record<string, string> = { red: "ff1414e3", blue: "fff98c36", green: "ff75d000", orange: "ff1673f9", purple: "fff755a8", grey: "ff7b7979", cyan: "ffd4b606", yellow: "ff0b9ef5" };
export function toKML(name: string, folders: { name: string; color?: string; features: any[]; label?: (p: any) => string }[]) {
  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const c = (a: number[]) => `${a[0]},${a[1]},0`;
  const geom = (g: any) => {
    if (g.type === "Point") return `<Point><coordinates>${c(g.coordinates)}</coordinates></Point>`;
    if (g.type === "LineString") return `<LineString><tessellate>1</tessellate><coordinates>${g.coordinates.map(c).join(" ")}</coordinates></LineString>`;
    if (g.type === "Polygon") return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${g.coordinates[0].map(c).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
    return "";
  };
  const body = folders
    .map((f, i) => {
      const col = KML_COLORS[f.color || "blue"] || KML_COLORS.blue;
      const style = `<Style id="s${i}"><LineStyle><color>${col}</color><width>3</width></LineStyle><PolyStyle><color>40${col.slice(2)}</color></PolyStyle><IconStyle><color>${col}</color><scale>0.8</scale></IconStyle></Style>`;
      const pms = f.features
        .map((ft) => {
          const p = ft.properties || {};
          const data = Object.entries(p)
            .filter(([, v]) => typeof v !== "object")
            .map(([k, v]) => `<Data name="${esc(k)}"><value>${esc(v)}</value></Data>`)
            .join("");
          return `<Placemark><name>${esc(f.label ? f.label(p) : p.code || p.label || p.name || "")}</name><styleUrl>#s${i}</styleUrl><ExtendedData>${data}</ExtendedData>${geom(ft.geometry)}</Placemark>`;
        })
        .join("");
      return `<Folder><name>${esc(f.name)}</name>${style}${pms}</Folder>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>${body}</Document></kml>`;
}

/** Minimal ASCII DXF (opens in AutoCAD; save-as DWG there). Coordinates in local metres. */
export function toDXF(layers: { name: string; color: number; features: any[] }[]) {
  const all = layers.flatMap((l) => l.features);
  let ox = 0, oy = 0, n = 0;
  all.forEach((f) => {
    const g = f.geometry;
    const p = g.type === "Point" ? g.coordinates : g.type === "LineString" ? g.coordinates[0] : g.coordinates[0][0];
    ox += p[0];
    oy += p[1];
    n++;
  });
  ox /= n || 1;
  oy /= n || 1;
  const KX = 110574 * Math.cos((oy * Math.PI) / 180), KY = 110574;
  const xy = (c: number[]) => [((c[0] - ox) * KX).toFixed(3), ((c[1] - oy) * KY).toFixed(3)];
  const out: string[] = ["0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER"];
  layers.forEach((l) => out.push("0", "LAYER", "2", l.name.replace(/\s+/g, "_"), "70", "0", "62", String(l.color), "6", "CONTINUOUS"));
  out.push("0", "ENDTAB", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
  layers.forEach((l) => {
    const ln = l.name.replace(/\s+/g, "_");
    l.features.forEach((f) => {
      const g = f.geometry;
      if (g.type === "Point") {
        const [x, y] = xy(g.coordinates);
        out.push("0", "CIRCLE", "8", ln, "10", x, "20", y, "30", "0", "40", "1.5");
        const label = f.properties?.code || "";
        if (label) out.push("0", "TEXT", "8", ln, "10", x, "20", String(Number(y) + 2), "30", "0", "40", "1.2", "1", label);
      } else {
        const pts = g.type === "LineString" ? g.coordinates : g.coordinates[0];
        out.push("0", "LWPOLYLINE", "8", ln, "90", String(pts.length), "70", g.type === "Polygon" ? "1" : "0");
        pts.forEach((c: number[]) => {
          const [x, y] = xy(c);
          out.push("10", x, "20", y);
        });
      }
    });
  });
  out.push("0", "ENDSEC", "0", "EOF");
  return out.join("\n");
}
