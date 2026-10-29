// Existing JLM POP / OLT sites (dummy) used as default FTTH start points.
export const JLM_POPS = [
  { code: "POP-BDG-GDB-01", name: "POP Gedebage", coord: [107.6912, -6.9488] as [number, number], olt: "OLT-BDG-GDB-01" },
  { code: "POP-BDG-RCS-01", name: "POP Rancasari", coord: [107.6798, -6.9622] as [number, number], olt: "OLT-BDG-RCS-01" },
  { code: "POP-BDG-CMC-01", name: "POP Cimincrang", coord: [107.7085, -6.9555] as [number, number], olt: "OLT-BDG-CMC-01" },
];

export function nearestPop(c: [number, number]) {
  const d = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * 110000, (a[1] - b[1]) * 110000);
  return [...JLM_POPS].sort((a, b) => d(a.coord, c) - d(b.coord, c))[0];
}

export const ASSET_TYPES = {
  Pasif: ["OTB", "ODC", "ODP", "Pole", "Kabel", "SS (Splitter)", "JC", "ONT"],
  Aktif: ["OLT", "Mikrotik", "Switch", "Juniper", "Inverter", "Rack Server"],
} as const;

export const SITE_TYPES = ["POP", "ODC", "ODP", "Pole", "JC", "Customer", "Tower"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const SITE_COLORS: Record<string, string> = { POP: "#C0353E", ODC: "#7C3AED", ODP: "#3672F9", Pole: "#949495", JC: "#F59E0B", Customer: "#00D075", Tower: "#011641" };
export const CABLE_COLORS: Record<string, string> = { Backbone: "#C0353E", Feeder: "#F97316", "Sub Feeder": "#F59E0B", Distribusi: "#00D075", Drop: "#06B6D4" };
