import { JLM_POPS } from "~/utils/jlmSites";

export interface ProjectRow {
  id: string;
  name: string;
  sub: string;
  kind: "FTTH" | "MPLS" | "MW";
  code: string;
  origin: string;
  originName: string;
  priority: "P0" | "P1" | "Access";
  siteType: string;
  dest: string;
  status: "Aktif" | "On-going" | "Belum" | "Desain";
  homepass: number;
  segment: string;
  odcRef: string;
  scenario: string;
  link: { path: string; query: Record<string, string> };
  cluster?: string;
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

/** Project register (FTTH clusters, FTTH designs, MPLS/MW backhaul between POPs). */
export function useProjectList() {
  const asset = useAssetStore();
  const ftth = useFtthStore();

  const rows = computed<ProjectRow[]>(() => {
    const out: ProjectRow[] = [];
    const clusters = new Map<string, { sites: any[]; planned: number }>();
    asset.sites.forEach((s) => {
      if (!s.project) return;
      if (!clusters.has(s.project)) clusters.set(s.project, { sites: [], planned: 0 });
      const c = clusters.get(s.project)!;
      c.sites.push(s);
      if (s.status === "Planned") c.planned++;
    });
    let n = 40;
    clusters.forEach((c, name) => {
      const odc = c.sites.find((s) => s.type === "ODC");
      const odps = c.sites.filter((s) => s.type === "ODP");
      const cab = asset.cables.find((x) => x.project === name && x.type !== "Distribusi") || asset.cables.find((x) => x.project === name);
      const hp = asset.assets.filter((a) => a.type === "ODP" && odps.some((o) => o.id === a.siteId)).reduce((t, a) => t + Number(a.extra?.Homepass || 0), 0);
      const area = (odc?.code || "ODC-GDB-A").split("-")[1];
      const h = hash(name);
      const planned = c.planned === c.sites.length;
      out.push({
        id: "c:" + name,
        name: `JLM-BDG-FTTH-${area}-2026-${String(n++).padStart(3, "0")}`,
        sub: `FTTH · ${name}`,
        kind: "FTTH",
        code: "JLM",
        origin: cab ? cab.label.split(" (")[0] : "BDG-F4599.48",
        originName: name.toUpperCase().replace(/[–-]/g, "").replace(/\s+/g, " ").slice(0, 34),
        priority: h % 4 === 0 ? "P0" : "Access",
        siteType: h % 4 === 0 ? "FO HUB" : "Existing Site",
        dest: odc?.code || "-",
        status: planned ? "Belum" : h % 3 === 0 ? "On-going" : "Aktif",
        homepass: hp,
        segment: cab ? `${cab.type} ${cab.cores}C · ${fmt(cab.length)} m` : "-",
        odcRef: `${odps.length} ODP · 16 HP/ODP`,
        scenario: planned ? "Rencana · Masterplan 100%" : "Skenario awal 30%",
        link: { path: "/peta/asset", query: { project: name } },
        cluster: name,
      });
    });
    ftth.projects
      .filter((p) => p.status !== "Sent to Asset")
      .forEach((p) => {
        out.push({
          id: "f:" + p.id,
          name: `JLM-BDG-FTTH-${p.params.areaCode}-2026-${String(n++).padStart(3, "0")}`,
          sub: `FTTH · Desain · ${p.name}`,
          kind: "FTTH",
          code: "JLM",
          origin: p.oltLabel,
          originName: p.name.toUpperCase().slice(0, 34),
          priority: "P1",
          siteType: p.oltMode === "site" ? "Existing Site" : "New Site",
          dest: `ODC-${p.params.areaCode}-A`,
          status: "Desain",
          homepass: p.homes,
          segment: "Menunggu generate",
          odcRef: `${p.params.odpMaxDist} m · ${p.params.odpCapacity} HP/ODP`,
          scenario: `Build awal ${p.params.penetration}%`,
          link: { path: "/peta/ftth", query: { project: p.id } },
        });
      });
    // backhaul links between POPs
    const pairs: [number, number, "MPLS" | "MW"][] = [
      [0, 1, "MPLS"],
      [0, 2, "MPLS"],
      [1, 2, "MW"],
      [2, 0, "MW"],
    ];
    pairs.forEach(([a, b, k], i) => {
      const A = JLM_POPS[a], B = JLM_POPS[b];
      out.push({
        id: `b:${i}`,
        name: `JLM-BDG-${k}-${A.code.split("-")[2]}${B.code.split("-")[2]}-2026-${String(10 + i).padStart(3, "0")}`,
        sub: `${k} · ${k === "MPLS" ? "Backhaul aktif" : "Link microwave"}`,
        kind: k,
        code: "JLM",
        origin: A.code,
        originName: A.name.toUpperCase(),
        priority: i === 0 ? "P0" : "Access",
        siteType: i === 0 ? "FO HUB" : "Existing Site",
        dest: B.code,
        status: i === 3 ? "On-going" : "Aktif",
        homepass: 0,
        segment: k === "MPLS" ? "Backbone 96C · G.652D" : "MW 23 GHz · 1 Gbps",
        odcRef: "-",
        scenario: "Operasional",
        link: { path: "/peta/asset", query: { site: asset.sites.find((s) => s.code === A.code)?.id || "" } },
      });
    });
    return out;
  });
  return { rows };
}
