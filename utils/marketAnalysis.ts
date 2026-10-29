import * as turf from "@turf/turf";

export const CLASS_COLORS: Record<string, string> = { A: "#7C3AED", B: "#3672F9", C: "#00D075", D: "#F59E0B", "-": "#949495" };
export const CLASS_LABEL: Record<string, string> = { A: "Kelas A (>250 m²)", B: "Kelas B (120–250 m²)", C: "Kelas C (60–120 m²)", D: "Kelas D (<60 m²)" };
export const TYPE_LABEL: Record<string, string> = { res: "Rumah Tinggal", com: "Ruko / Komersial", off: "Perkantoran", edu: "Pendidikan", ibd: "Tempat Ibadah", kes: "Kesehatan", ind: "Industri / Gudang", con: "Konstruksi" };
export const ISP_COLORS: Record<string, string> = { "": "#00D075", IndiHome: "#C0353E", MyRepublic: "#7C3AED", Biznet: "#3672F9", "First Media": "#F59E0B", CBN: "#06B6D4" };
export const LEVEL_COLORS: Record<string, string> = { "Very Low": "#E4E3E4", Low: "#FDE68A", Mid: "#FBBF24", High: "#F97316", "Very High": "#C0353E" };
export const POI_COLORS: Record<string, string> = { Sekolah: "#3672F9", Kesehatan: "#C0353E", Ibadah: "#00A05B", Komersial: "#F59E0B", Kuliner: "#F97316", Keuangan: "#7C3AED", Perkantoran: "#011641", Publik: "#79797B" };

export const ANALYSIS_LAYERS = ["House Class", "House Price", "Carport", "Energy", "Road Type", "Competitor ISP"] as const;

export interface MarketParams {
  penetration: number; // %
  arpu: number; // IDR / month
}

const count = <T,>(arr: T[], key: (t: T) => string) => {
  const m: Record<string, number> = {};
  arr.forEach((a) => {
    const k = key(a);
    m[k] = (m[k] || 0) + 1;
  });
  return m;
};

export function analyzeAoi(aoi: any, buildings: any[], pois: any[], hex: any[], params: MarketParams) {
  const props = buildings.map((b) => b.properties);
  const res = props.filter((p) => p.t === "res");
  const com = props.filter((p) => p.t === "com");
  const areaM2 = turf.area(aoi);
  const homepass = res.length + com.length;
  const covered = res.filter((p) => p.isp);
  const uncovered = homepass - covered.length;
  // only uncovered + switchers count toward realistic take-up
  const subs = Math.round(uncovered * (params.penetration / 100) + covered.length * (params.penetration / 100) * 0.35);
  const priceBin = (p: number) => (p < 500 ? "< 500 jt" : p < 1000 ? "500 jt – 1 M" : p < 2000 ? "1 – 2 M" : p < 3500 ? "2 – 3,5 M" : "> 3,5 M");
  const hexIn = hex.filter((h) => turf.booleanIntersects(h, aoi));
  const levelCount = count(hexIn, (h) => h.properties.level);
  const LEVELS = ["Very Low", "Low", "Mid", "High", "Very High"];
  const avgLevelIdx = hexIn.length ? hexIn.reduce((a, h) => a + LEVELS.indexOf(h.properties.level), 0) / hexIn.length : 0;
  const score = Math.round(
    Math.min(100, (homepass / Math.max(areaM2 / 1e4, 1)) * 1.4) * 0.35 + (uncovered / Math.max(homepass, 1)) * 100 * 0.35 + (avgLevelIdx / 4) * 100 * 0.3,
  );
  return {
    area: areaM2,
    totalBuildings: props.length,
    homes: res.length,
    commercial: com.length,
    nonResidential: props.length - res.length,
    homepass,
    density: homepass / Math.max(areaM2 / 1e4, 0.01), // per ha
    byType: count(props, (p) => p.t),
    byClass: count(res, (p) => p.cls),
    byPrice: count(res, (p) => priceBin(p.pr)),
    carport: count(res, (p) => (p.cp ? "Ada Carport" : "Tanpa Carport")),
    energy: count(res, (p) => `${p.va} VA`),
    roadType: count(res, (p) => p.rd),
    isp: count(res, (p) => p.isp || "Belum ada ISP"),
    byKelurahan: count(props, (p) => p.kel || "-"),
    poi: count(pois, (p) => p.properties.cat),
    poiTotal: pois.length,
    competitorPct: res.length ? Math.round((covered.length / res.length) * 100) : 0,
    uncovered,
    estSubscribers: subs,
    estRevenueMonth: subs * params.arpu,
    estRevenueYear: subs * params.arpu * 12,
    avgPrice: res.length ? Math.round(res.reduce((a, p) => a + p.pr, 0) / res.length) : 0,
    hexLevels: levelCount,
    score,
    grade: score >= 70 ? "High" : score >= 50 ? "Mid" : score >= 30 ? "Low" : "Very Low",
    params,
  };
}

export type MarketResult = ReturnType<typeof analyzeAoi>;
