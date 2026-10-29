<script setup lang="ts">
import * as XLSX from "xlsx";
import { runFtthDesign, DEFAULT_PARAMS, PRICE, type FtthResult } from "~/utils/ftthEngine";
import { nearestPop } from "~/utils/jlmSites";
import * as turf from "@turf/turf";

const props = defineProps<{ mode: "asset" | "ftth" }>();
const route = useRoute();
const { boot, booted, geo } = useBoot();
const asset = useAssetStore();
const ftth = useFtthStore();
const toast = useToast();
onMounted(boot);

// scope = installed/planned clusters in inventory + FTTH designs
const scopes = computed(() => {
  if (!booted.value) return [];
  const names = [...new Set(asset.sites.filter((s) => s.project).map((s) => s.project!))];
  if (props.mode === "asset") return names.map((n) => ({ id: "c:" + n, name: n, kind: asset.sites.filter((s) => s.project === n).every((s) => s.status === "Planned") ? "Rencana" : "Terpasang" }));
  return ftth.projects.filter((p) => p.status !== "Draft").map((p) => ({ id: "f:" + p.id, name: p.name, kind: p.status === "As-built" ? "As-built" : "Desain" }));
});
const scope = ref("");
watch(
  scopes,
  (s) => {
    if (scope.value || !s.length) return;
    const q = String(route.query.project || "");
    scope.value = s.find((x) => x.id === "c:" + q || x.id === "f:" + q || x.id === q)?.id || s[0].id;
  },
  { immediate: true },
);
const scen = ref(props.mode === "asset" ? 100 : 30);
const cur = computed(() => scopes.value.find((s) => s.id === scope.value));

const cache = new Map<string, FtthResult>();
const plan = computed<FtthResult | null>(() => {
  if (!cur.value || !booted.value) return null;
  const key = cur.value.id + ":" + scen.value;
  if (cache.has(key)) return cache.get(key)!;
  let aoi: any = null, olt: [number, number] | null = null, params = { ...DEFAULT_PARAMS };
  if (cur.value.id.startsWith("f:")) {
    const p = ftth.byId(cur.value.id.slice(2))!;
    aoi = p.aoi;
    olt = p.olt;
    params = { ...p.params };
  } else {
    const f = (geo.data.aoi?.features || []).find((a: any) => a.properties.name === cur.value!.name);
    const pts = asset.sites.filter((s) => s.project === cur.value!.name).map((s) => turf.point(s.coord));
    aoi = f || turf.buffer(turf.convex(turf.featureCollection(pts))!, 30, { units: "meters" });
    olt = nearestPop(turf.centroid(aoi).geometry.coordinates as any).coord;
  }
  params.penetration = scen.value;
  const r = runFtthDesign({ name: cur.value.name, aoi, homes: geo.buildingsIn(aoi), roads: geo.roadsNear(aoi, 400, olt), olt, params });
  cache.set(key, r);
  return r;
});

// installed quantities from the inventory
const installed = computed(() => {
  const c = cur.value;
  const z: Record<string, number> = {};
  if (!c || !c.id.startsWith("c:")) return z;
  const sites = asset.sites.filter((s) => s.project === c.name && s.status !== "Planned");
  const ids = new Set(sites.map((s) => s.id));
  const as = asset.assets.filter((a) => ids.has(a.siteId));
  const cab = asset.cables.filter((x) => x.project === c.name && x.status !== "Planned");
  const coreLen = (n: number) => cab.filter((x) => x.cores === n).reduce((t, x) => t + x.length, 0) * 1.05;
  z.OLT = 1;
  z.ODC24 = as.filter((a) => a.type === "ODC" && a.name.includes("24")).length;
  z.ODC48 = as.filter((a) => a.type === "ODC" && a.name.includes("48")).length;
  z.ODP = sites.filter((s) => s.type === "ODP").length;
  z.ONT = as.filter((a) => a.type === "ODP").reduce((t, a) => t + (a.ports?.filter((p) => p.status === "Used").length || 0), 0);
  [288, 144, 96, 48, 24, 12].forEach((n) => (z["C" + n] = coreLen(n)));
  const pole = (t: string) => sites.filter((s) => s.type === "Pole" && (s.poleType || "T7 1-Stage") === t).length;
  z.T71 = pole("T7 1-Stage");
  z.T72 = pole("T7 2-Stage");
  z.T92 = pole("T9 2-Stage");
  z.JC = sites.filter((s) => s.type === "JC").length;
  return z;
});
const isInstalledScope = computed(() => cur.value?.id.startsWith("c:") && cur.value.kind === "Terpasang");
const rows = computed(() => {
  if (!plan.value) return [];
  return plan.value.boq
    .filter((g) => g.category === "Material (BOM)")
    .flatMap((g) => g.items)
    .filter((i) => i.qtyPlan > 0)
    .map((i) => {
      const q = scen.value === 100 ? i.qtyPlan : i.qty;
      const has = isInstalledScope.value && installed.value[i.code] !== undefined;
      const inst = has ? Math.round(installed.value[i.code]) : 0;
      const diff = inst - q;
      const status = !has ? (isInstalledScope.value ? "Belum dicatat" : "Rencana") : Math.abs(diff) <= Math.max(1, q * 0.03) ? "Sesuai" : diff < 0 ? `Kurang ${fmt(-diff)}` : `Lebih ${fmt(diff)}`;
      if (props.mode === "ftth") return { ...i, q: i.qtyPlan, inst: i.qty, diff: i.qty - i.qtyPlan, has: true, status: i.qty === i.qtyPlan ? "Full build" : `Build ${scen.value}%`, total: i.qtyPlan * i.price };
      return { ...i, q, inst, diff, has, status, total: q * i.price };
    });
});
const totals = computed(() => {
  const r = rows.value;
  const planSum = r.reduce((t, x) => t + x.total, 0);
  const real = r.reduce((t, x) => t + Math.min(x.inst, x.q) * x.price, 0);
  const jasa = (plan.value?.boq || []).filter((g) => g.category === "Jasa (BOQ)").reduce((t, g) => t + g.items.reduce((a, i) => a + (scen.value === 100 ? i.qtyPlan : i.qty) * i.price, 0), 0);
  return { plan: planSum, real, jasa, pct: planSum ? Math.round((real / planSum) * 100) : 0 };
});
const stTag = (s: string) => (s === "Sesuai" ? "j-tag-teal" : s.startsWith("Kurang") ? "j-tag-amber" : s.startsWith("Lebih") ? "j-tag-purple" : "j-tag-grey");
const note = (code: string) => ({ ODP: "ODP 250 m · 16 HP/unit", ODC24: "Wajib untuk FTTH · 16 ODP", ODC48: "36 ODP / kabinet", OLT: "Aktif & pasif · konfigurasi PON", C12: "Pull ≤ 1.000 m · distribusi", C24: "Sub-feeder / distribusi", C48: "Coil 350 m · JC 3.500 m", C96: "Feeder utama", T71: "Jarak ≤ 60 m antar tiang", T72: "Jalan utama backbone/feeder", T92: "Crossing jalan", DROP: "Precon ke ONT", JC: "Percabangan & interval 3.500 m" } as Record<string, string>)[code] || "";

function exportExcel() {
  if (!plan.value || !cur.value) return;
  exportXLSX(`BOQ_BOM_${cur.value.name.replace(/[^A-Za-z0-9]+/g, "_")}_${scen.value}.xlsx`, {
    "BOM Rencana vs Terpasang": rows.value.map((r) => ({ Material: r.item, Satuan: r.unit, "Qty Rencana": r.q, "Qty Pasang": r.inst, Selisih: r.diff, "Harga Satuan": r.price, "Total Rencana": r.total, Status: r.status })),
    "BOQ Jasa": plan.value.boq.filter((g) => g.category === "Jasa (BOQ)").flatMap((g) => g.items.map((i) => ({ Item: i.item, Satuan: i.unit, Qty: scen.value === 100 ? i.qtyPlan : i.qty, Harga: i.price, Total: (scen.value === 100 ? i.qtyPlan : i.qty) * i.price }))),
    "Harga Satuan": Object.values(PRICE).map((x) => ({ Item: x.item, Satuan: x.unit, Harga: x.price })),
  });
}
async function exportPdf() {
  if (!cur.value) return;
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text(`BOQ & BOM — ${cur.value.name}`, 14, 16);
  doc.setFontSize(9);
  doc.text(`Skenario ${scen.value === 100 ? "Masterplan 100%" : scen.value + "%"} · ${nowStr()} · PT Jala Lintas Media`, 14, 22);
  autoTable(doc, { startY: 28, head: [["Material", "Satuan", "Qty Rencana", "Qty Pasang", "Selisih", "Harga Satuan", "Total Rencana", "Status"]], body: rows.value.map((r) => [r.item, r.unit, fmt(r.q), fmt(r.inst), fmt(r.diff), fmt(r.price), fmt(r.total), r.status]), headStyles: { fillColor: [0, 24, 73] }, styles: { fontSize: 8 } });
  doc.save(`BOQ_BOM_${cur.value.name.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`);
}
function exportKml() {
  if (!plan.value || !cur.value) return;
  const L = plan.value.layers;
  download(`${cur.value.name.replace(/[^A-Za-z0-9]+/g, "_")}.kml`, toKML(cur.value.name, [{ name: "ODP", color: "blue", features: L.odp.features }, { name: "ODC", color: "purple", features: L.odc.features }, { name: "Kabel", color: "orange", features: L.cables.features, label: (x) => x.label }, { name: "Tiang", color: "grey", features: L.poles.features }]), "application/vnd.google-earth.kml+xml");
}
function exportDxf() {
  if (!plan.value || !cur.value) return;
  const L = plan.value.layers;
  download(`${cur.value.name.replace(/[^A-Za-z0-9]+/g, "_")}.dxf`, toDXF([{ name: "KABEL", color: 30, features: L.cables.features }, { name: "ODP", color: 5, features: L.odp.features }, { name: "ODC", color: 6, features: L.odc.features }, { name: "TIANG", color: 8, features: L.poles.features }]), "application/dxf");
}
const tplName = ref("");
async function onTemplate(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  const wb = XLSX.read(await f.arrayBuffer());
  const n = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]).length;
  tplName.value = f.name;
  asset.log("Import", f.name, `Template BOQ procurement diunggah (${n} baris)`);
  toast.add({ title: "Template BOQ diterapkan", description: `${f.name} · ${n} baris kolom dipetakan`, icon: "i-lucide-file-check-2" });
}
const history = computed(() =>
  props.mode === "asset"
    ? asset.activity.slice(0, 5)
    : ftth.jobs.slice(0, 5).map((j) => ({ id: j.id, action: j.status === "inserted" ? "Create" : "Sync", target: j.file, detail: `${j.source} · ${j.phase}`, user: j.user, at: j.createdAt })),
);
const HIST_ICON: Record<string, string> = { Create: "i-lucide-check", Update: "i-lucide-check", Move: "i-lucide-move", Delete: "i-lucide-triangle-alert", Import: "i-lucide-upload", Sync: "i-lucide-refresh-cw" };
</script>

<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1340px] mx-auto px-6 py-6 space-y-4">
      <div class="flex items-end justify-between">
        <div>
          <div class="flex items-center gap-3"><h1 class="j-title text-[24px]">BOQ & BOM</h1><span class="j-tag-cyan font-display font-bold">{{ mode === "asset" ? "Laporan Aktual Material" : "Desain FTTH" }}</span></div>
          <p class="text-[14px] text-j-sub mt-1">{{ mode === "asset" ? "Bill of Quantity & Bill of Material · Rencana vs Terpasang · Scope per RW/Cluster" : "Estimasi material & jasa dari hasil desain FTTH · Masterplan vs build awal" }}</p>
        </div>
        <div class="flex gap-2">
          <label class="j-btn-outline font-sans font-medium cursor-pointer"><UIcon name="i-lucide-file-up" class="w-4 h-4" />Import Template<input type="file" class="hidden" accept=".xlsx,.xls,.csv" @change="onTemplate" /></label>
          <UDropdown :items="[[{ label: 'Excel BOQ/BOM', icon: 'i-lucide-file-spreadsheet', click: exportExcel }, { label: 'PDF Laporan', icon: 'i-lucide-file-text', click: exportPdf }, { label: 'KML / KMZ', icon: 'i-lucide-map', click: exportKml }, { label: 'DWG / CAD (DXF)', icon: 'i-lucide-layers-3', click: exportDxf }]]">
            <button class="j-btn-primary"><UIcon name="i-lucide-download" class="w-4 h-4" />Export</button>
          </UDropdown>
        </div>
      </div>

      <div v-if="!booted" class="j-card p-16 text-center"><UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-j-cyan" /></div>
      <div v-else-if="!scopes.length" class="j-card p-16 text-center"><p class="j-title text-[16px]">Belum ada desain</p><p class="text-[13px] text-j-sub mt-1">Buat desain dan klik <b>Generate &amp; Insert to Cable</b> di Peta FTTH.</p><NuxtLink to="/ftth?new=1" class="j-btn-primary mt-4">Desain Baru</NuxtLink></div>
      <template v-else>
        <div class="grid grid-cols-[1.4fr_0.8fr_1fr] gap-4">
          <div class="j-card p-4">
            <p class="j-label text-j-sub mb-2">Scope Proyek</p>
            <div class="flex flex-wrap gap-1.5 max-h-[64px] overflow-y-auto thin-scrollbar">
              <button v-for="s in scopes" :key="s.id" class="h-7 px-3 rounded-[6px] text-[12px] border whitespace-nowrap" :class="scope === s.id ? 'bg-j-cyan/[0.1] border-j-cyan text-j-ink font-display font-bold' : 'border-j-line text-j-sub'" @click="scope = s.id">{{ s.name.replace(" – ", " · ") }} <span class="text-[10px] opacity-70">· {{ s.kind }}</span></button>
            </div>
          </div>
          <div class="j-card p-4">
            <p class="j-label text-j-sub mb-2">Skenario</p>
            <div class="flex flex-wrap gap-1.5"><button v-for="v in (mode === 'asset' ? [100, 30, 50] : [30, 50, 100])" :key="v" class="h-7 px-3 rounded-[6px] text-[12px] border" :class="scen === v ? 'bg-j-cyan/[0.1] border-j-cyan font-display font-bold' : 'border-j-line text-j-sub'" @click="scen = v">{{ v === 100 ? "Masterplan 100%" : `Skenario ${v}%` }}</button></div>
          </div>
          <div class="j-card p-4">
            <p class="j-label text-j-sub mb-2">Template BOQ</p>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="h-7 px-3 rounded-[6px] border border-j-line text-[12px] flex items-center gap-1.5"><UIcon name="i-lucide-file-spreadsheet" class="w-3.5 h-3.5" />{{ tplName || "Format standar procurement JLM" }}</span>
              <span class="j-tag-amber">Harga satuan: price list 2026</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_300px] gap-4">
          <div class="j-card p-4 min-w-0">
            <div class="flex items-start justify-between">
              <div><h3 class="j-title text-[16px]">{{ mode === "asset" ? "BOQ — Rencana vs Terpasang" : "BOQ / BOM Desain" }}</h3><p class="text-[12px] text-j-sub">Scope: {{ cur?.name }} · {{ scen === 100 ? "Masterplan 100%" : `Skenario ${scen}%` }} · {{ fmt(plan?.summary.homes) }} homepass</p></div>
              <div class="flex gap-2"><button class="j-btn-teal j-btn-sm font-sans font-normal" @click="exportExcel">Export Excel</button><button class="j-btn-outline j-btn-sm font-sans font-normal" @click="exportPdf">Export PDF</button></div>
            </div>
            <div class="overflow-x-auto thin-scrollbar mt-3">
              <table class="w-full min-w-[820px]">
                <thead class="bg-j-bg"><tr><th class="j-th">Material</th><th class="j-th">Satuan</th><th class="j-th text-right">{{ mode === "asset" ? "Qty Rencana" : "Qty Plan 100%" }}</th><th class="j-th text-right">{{ mode === "asset" ? "Qty Pasang" : `Qty Build ${scen}%` }}</th><th class="j-th text-right">{{ mode === "asset" ? "Selisih" : "Tahap berikut" }}</th><th class="j-th text-right">Harga Satuan (IDR)</th><th class="j-th text-right">Total Rencana</th><th class="j-th">Status</th></tr></thead>
                <tbody>
                  <tr v-for="r in rows" :key="r.code">
                    <td class="j-td"><p class="font-medium">{{ r.item }}</p><p class="text-[11px] text-j-sub">{{ note(r.code) }}</p></td>
                    <td class="j-td text-j-sub">{{ r.unit }}</td>
                    <td class="j-td text-right font-bold">{{ fmt(r.q) }}</td>
                    <td class="j-td text-right font-bold text-j-cyan">{{ r.has ? fmt(r.inst) : "–" }}</td>
                    <td class="j-td text-right font-bold" :class="r.diff < 0 ? 'text-j-amber' : 'text-j-teal'">{{ r.has ? fmt(mode === "asset" ? r.diff : -r.diff) : "–" }}</td>
                    <td class="j-td text-right text-j-sub">{{ fmt(r.price) }}</td>
                    <td class="j-td text-right font-bold text-j-blue">{{ fmt(r.total) }}</td>
                    <td class="j-td"><span :class="stTag(r.status)">{{ r.status }}</span></td>
                  </tr>
                  <tr class="bg-j-cyan/[0.05]"><td class="j-td font-display font-bold" colspan="6">TOTAL ESTIMASI MATERIAL</td><td class="j-td text-right font-display font-bold text-j-blue">{{ fmt(totals.plan) }}</td><td class="j-td"><span class="j-tag-cyan">IDR</span></td></tr>
                  <tr><td class="j-td text-j-sub" colspan="6">Jasa instalasi, survey & commissioning (BOQ)</td><td class="j-td text-right font-medium">{{ fmt(totals.jasa) }}</td><td class="j-td" /></tr>
                </tbody>
              </table>
            </div>
            <p class="text-[12px] text-j-sub mt-3">Menampilkan {{ rows.length }} material · total proyek {{ idr(totals.plan + totals.jasa) }} · {{ idr((totals.plan + totals.jasa) / Math.max(plan?.summary.homes || 1, 1)) }} / homepass</p>
          </div>

          <div class="space-y-4">
            <div class="j-card p-4">
              <div class="flex items-center justify-between"><h3 class="j-title text-[15px]">BOM Ringkasan</h3><span class="j-tag-teal">{{ cur?.kind }}</span></div>
              <div class="mt-3 space-y-2 text-[12px]">
                <div class="flex justify-between"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-[2px] bg-j-cyan" />{{ mode === "asset" ? "Terpasang" : "Build awal" }}</span><b class="text-j-cyan">{{ totals.pct }}%</b></div>
                <div class="h-1.5 bg-j-soft rounded-full overflow-hidden"><div class="h-full bg-j-cyan" :style="{ width: totals.pct + '%' }" /></div>
                <div class="flex justify-between"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-[2px] bg-j-amber" />{{ mode === "asset" ? "Sisa Rencana" : "Tahap berikutnya" }}</span><b class="text-j-amber">{{ 100 - totals.pct }}%</b></div>
                <div class="h-1.5 bg-j-soft rounded-full overflow-hidden"><div class="h-full bg-j-amber" :style="{ width: 100 - totals.pct + '%' }" /></div>
              </div>
              <div class="mt-4 space-y-1.5 text-[12px] border-t border-j-line pt-3">
                <div class="flex justify-between"><span class="text-j-sub">Total Rencana (IDR)</span><b>{{ idrShort(totals.plan) }}</b></div>
                <div class="flex justify-between"><span class="text-j-sub">{{ mode === "asset" ? "Realisasi (IDR)" : "Build awal (IDR)" }}</span><b>{{ idrShort(totals.real) }}</b></div>
                <div class="flex justify-between"><span class="text-j-sub">Selisih (IDR)</span><b class="text-j-amber">{{ idrShort(totals.plan - totals.real) }}</b></div>
              </div>
            </div>
            <div class="j-card p-4">
              <h3 class="j-title text-[15px] mb-3">Export Format</h3>
              <div class="space-y-2">
                <button v-for="e in [{ t: 'Excel BOQ/BOM', d: 'Kolom rencana vs terpasang', i: 'i-lucide-file-spreadsheet', c: 'text-j-cyan', f: exportExcel }, { t: 'KML / KMZ', d: 'Rute kabel & titik aset GIS', i: 'i-lucide-map', c: 'text-j-blue', f: exportKml }, { t: 'PDF Laporan', d: 'Laporan BOQ siap cetak', i: 'i-lucide-file-text', c: 'text-j-purple', f: exportPdf }, { t: 'DWG / CAD', d: 'Layout jalur kabel teknis', i: 'i-lucide-layers-3', c: 'text-j-amber', f: exportDxf }]" :key="e.t" class="w-full flex items-center gap-3 p-2.5 rounded-[8px] border border-j-line hover:border-j-cyan text-left" @click="e.f()">
                  <UIcon :name="e.i" class="w-5 h-5" :class="e.c" />
                  <span class="flex-1"><p class="font-display font-bold text-[13px]">{{ e.t }}</p><p class="text-[11px] text-j-sub">{{ e.d }}</p></span>
                  <UIcon name="i-lucide-download" class="w-4 h-4 text-j-sub" />
                </button>
              </div>
            </div>
            <div class="j-card p-4">
              <h3 class="j-title text-[15px] mb-3">Riwayat Perubahan</h3>
              <div class="space-y-2.5">
                <div v-for="h in history" :key="h.id" class="flex gap-2.5">
                  <span class="w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0" :class="h.action === 'Delete' ? 'bg-j-amber/10 text-j-amber' : 'bg-j-cyan/10 text-j-cyan'"><UIcon :name="HIST_ICON[h.action]" class="w-3.5 h-3.5" /></span>
                  <div class="min-w-0"><p class="text-[12px] font-medium truncate">{{ h.target }}</p><p class="text-[11px] text-j-sub truncate">{{ h.detail }}</p><p class="text-[10px] text-j-mute">{{ h.user }} · {{ h.at }}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
