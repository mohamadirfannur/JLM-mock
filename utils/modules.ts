// Module registry — each module is a separate workspace with its own navigation.
export type ModuleId = "market" | "asset" | "ftth";
export interface ModuleTab {
  label: string;
  to: string;
  icon: string;
}
export interface ModuleDef {
  id: ModuleId;
  group: "Business Planning" | "Business Operation";
  name: string;
  short: string;
  desc: string;
  icon: string;
  home: string;
  tabs: ModuleTab[];
}
export const MODULES: Record<ModuleId, ModuleDef> = {
  market: {
    id: "market",
    group: "Business Planning",
    name: "Market Potential Analysis",
    short: "MARKET POTENTIAL",
    desc: "Hitung jumlah rumah dari AOI (gambar / upload), analisis POI, kompetitor, dan identifikasi area berpotensi tinggi untuk ekspansi.",
    icon: "i-lucide-chart-column",
    home: "/market",
    tabs: [
      { label: "Peta Analisis", to: "/market", icon: "i-lucide-map" },
      { label: "Laporan Analisis", to: "/market/laporan", icon: "i-lucide-file-text" },
    ],
  },
  asset: {
    id: "asset",
    group: "Business Planning",
    name: "Assets Management",
    short: "ASSET MANAGEMENT",
    desc: "Inventaris aset jaringan OSP — sitepoint, perangkat pasif & aktif, kabel & rute, core config, dan BOQ/BOM aktual material.",
    icon: "i-lucide-server",
    home: "/asset",
    tabs: [
      { label: "Dashboard", to: "/asset", icon: "i-lucide-house" },
      { label: "Inventaris", to: "/asset/inventaris", icon: "i-lucide-monitor" },
      { label: "Peta Jaringan", to: "/asset/peta", icon: "i-lucide-map" },
      { label: "BOQ & BOM", to: "/asset/boq-bom", icon: "i-lucide-file-spreadsheet" },
    ],
  },
  ftth: {
    id: "ftth",
    group: "Business Operation",
    name: "FTTH Mapping",
    short: "FTTH MAPPING",
    desc: "Desain jaringan Fiber-to-the-Home per RW / cluster — auto-design, processing queue, edit manual, dan BOQ/BOM desain.",
    icon: "i-lucide-layers",
    home: "/ftth",
    tabs: [
      { label: "Peta FTTH", to: "/ftth", icon: "i-lucide-map" },
      { label: "Daftar Proyek", to: "/ftth/proyek", icon: "i-lucide-folder-kanban" },
      { label: "BOQ & BOM Desain", to: "/ftth/boq-bom", icon: "i-lucide-file-spreadsheet" },
    ],
  },
};
export function moduleOfPath(path: string): ModuleDef | null {
  const seg = path.split("/")[1] as ModuleId;
  return MODULES[seg] || null;
}
