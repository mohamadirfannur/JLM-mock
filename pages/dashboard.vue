<script setup lang="ts">
definePageMeta({ layout: "app" });
useHead({ title: "Dashboard · JLM Network Planner" });
const { boot, booted } = useBoot();
const asset = useAssetStore();
const ftth = useFtthStore();
onMounted(boot);

const countSite = (t: string) => asset.sites.filter((s) => s.type === t).length;
const countAsset = (...t: string[]) => asset.assets.filter((a) => t.includes(a.type)).length;
const pasif = computed(() => ({ ODP: countSite("ODP"), POLE: countSite("Pole"), OTB: countAsset("OTB", "SS (Splitter)", "JC"), Kabel: asset.cables.length }));
const aktif = computed(() => ({ OLT: countAsset("OLT"), Switch: countAsset("Switch"), Mikrotik: countAsset("Mikrotik"), Lainnya: countAsset("Juniper", "Inverter", "Rack Server", "ONT") }));
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
const homepass = computed(() => {
  const inst = asset.assets.filter((a) => a.type === "ODP").reduce((s, a) => s + Number(a.extra?.Homepass || 0), 0);
  const plan = ftth.projects.filter((p) => p.status !== "Sent to Asset").reduce((s, p) => s + (p.homes || 0), 0);
  return inst + plan;
});
const clusters = computed(() => new Set(asset.sites.filter((s) => s.project).map((s) => s.project)).size);
const quality = computed(() => {
  const n = asset.assets.length || 1;
  const ok = asset.assets.filter((a) => a.installDate && (a.serial || a.type === "ODP" || a.type === "SS (Splitter)" || a.type === "JC")).length;
  return pct(ok, n);
});

// table
const tab = ref("Semua");
const page = ref(1);
const PER = 5;
const statusLabel = (s: string) => (s === "Installed" ? "Aktif" : s === "Planned" ? "Rencana" : "Perhatian");
const statusTag = (s: string) => (s === "Installed" ? "j-tag-cyan" : s === "Planned" ? "j-tag-purple" : "j-tag-amber");
const typeTag = (t: string) => (["OLT", "POP", "Switch", "Customer"].includes(t) ? "j-tag-purple" : t === "JC" ? "j-tag-amber" : "j-tag-cyan");
const rows = computed(() => {
  const sites = asset.sites.filter((s) => s.type !== "Customer");
  const f = sites.filter((s) => {
    if (tab.value === "Semua") return true;
    if (tab.value === "Pasif") return ["ODP", "ODC", "Pole", "JC"].includes(s.type);
    if (tab.value === "Aktif") return s.type === "POP";
    if (tab.value === "OLT") return s.type === "POP";
    return false;
  });
  const cab = tab.value === "Kabel" || tab.value === "Semua" ? asset.cables.map((c) => ({ id: c.id, kind: "cable", code: c.code, type: "Kabel", loc: c.project || "-", status: c.status, cond: "Baik", upd: relTime(c.id) })) : [];
  const ss = f.map((s) => ({ id: s.id, kind: "site", code: s.code, type: s.type === "POP" ? "OLT" : s.type === "Pole" ? "Pole" : s.type, loc: [s.kelurahan, s.project].filter(Boolean).join(" · ") || s.address || "Kota Bandung", status: s.status, cond: s.status === "Maintenance" ? "Cukup" : "Baik", upd: relTime(s.id) }));
  const order = (r: any) => (r.type === "OLT" ? 0 : r.type === "ODC" ? 1 : r.type === "ODP" ? 2 : r.type === "Kabel" ? 3 : 4);
  return [...ss, ...cab].sort((a, b) => order(a) - order(b));
});
watch(tab, () => (page.value = 1));

// distribution
const dist = computed(() => [
  { label: "ODP", value: pasif.value.ODP, color: "#00D4FF" },
  { label: "POLE", value: pasif.value.POLE, color: "#7B2FFF" },
  { label: "Kabel", value: pasif.value.Kabel, color: "#3ECFD2" },
  { label: "OLT + Switch", value: aktif.value.OLT + aktif.value.Switch + aktif.value.Mikrotik, color: "#F59E0B" },
  { label: "OTB / SS / JC", value: pasif.value.OTB, color: "#0E66C4" },
  { label: "Lainnya", value: aktif.value.Lainnya + countSite("ODC"), color: "#E1E8E6" },
]);

// projects per cluster
const projects = computed(() => {
  const m = new Map<string, { name: string; hp: number; used: number; status: string; planned: number; total: number }>();
  asset.sites.forEach((s) => {
    if (!s.project) return;
    if (!m.has(s.project)) m.set(s.project, { name: s.project, hp: 0, used: 0, status: s.status, planned: 0, total: 0 });
    const p = m.get(s.project)!;
    p.total++;
    if (s.status === "Planned") p.planned++;
  });
  asset.assets.forEach((a) => {
    if (a.type !== "ODP") return;
    const s = asset.siteById(a.siteId);
    const p = s?.project && m.get(s.project);
    if (!p) return;
    p.hp += Number(a.extra?.Homepass || 0);
    p.used += a.ports?.filter((x) => x.status === "Used").length || 0;
  });
  const out = [...m.values()].map((p) => {
    const prog = p.planned === p.total ? 0 : Math.min(100, Math.round((p.used / Math.max(p.hp, 1)) * 100 * 2.4));
    const status = p.planned === p.total ? "Belum" : prog >= 80 ? "Selesai" : prog >= 40 ? "On-going" : "Awal";
    return { ...p, prog, statusLabel: status };
  });
  ftth.projects.filter((p) => p.status !== "Sent to Asset").forEach((p) => out.push({ name: p.name, hp: p.homes, used: 0, status: "Design", planned: 0, total: 0, prog: 0, statusLabel: "Desain" }));
  return out;
});
const ppage = ref(1);
const projTag = (s: string) => (s === "Selesai" ? "j-tag-cyan" : s === "On-going" ? "j-tag-blue" : s === "Awal" ? "j-tag-amber" : s === "Desain" ? "j-tag-purple" : "j-tag-grey");

// cable segments
const segs = computed(() =>
  [...asset.cables]
    .filter((c) => c.type !== "Drop")
    .sort((a, b) => b.length - a.length)
    .map((c) => ({ id: c.id, from: c.from || c.code, label: c.label.split(" (")[0], km: c.length / 1000, inst: c.status === "Installed" ? 1 : 0.15 + ((c.length % 7) / 10) })),
);
const spage = ref(1);
const segTotal = computed(() => asset.cables.reduce((a, c) => a + c.length, 0) / 1000);
const segInst = computed(() => asset.cables.filter((c) => c.status === "Installed").reduce((a, c) => a + c.length, 0) / 1000);
const kmFmt = (v: number) => (v >= 1 ? `${fmt(v, 1)} km` : `${fmt(v * 1000)} m`);
</script>

<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1340px] mx-auto px-6 py-6 space-y-5">
      <div class="flex items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="j-title text-[24px]">Dashboard</h1>
            <span class="j-tag-cyan font-display font-bold">JLM Network Planner</span>
          </div>
          <p class="text-[14px] text-j-sub mt-1">Kelola aset jaringan FTTH/MPLS</p>
        </div>
        <div class="flex gap-2">
          <NuxtLink to="/peta/asset?tool=import" class="j-btn-outline font-sans font-medium"><UIcon name="i-lucide-upload" class="w-4 h-4" />Import KML/Excel/GIS</NuxtLink>
          <NuxtLink to="/peta/asset?tool=add_site" class="j-btn-primary"><UIcon name="i-lucide-plus" class="w-4 h-4" />Tambah Aset</NuxtLink>
        </div>
      </div>

      <div v-if="!booted" class="j-card p-16 text-center text-j-sub text-sm"><UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-j-cyan mb-2" /><br />Memuat data jaringan...</div>
      <template v-else>
        <!-- KPI -->
        <div class="grid grid-cols-4 gap-4">
          <div class="j-card p-4">
            <div class="flex items-center gap-2 mb-3"><span class="w-8 h-8 rounded-[8px] bg-j-cyan/[0.08] text-j-cyan flex items-center justify-center"><UIcon name="i-lucide-box" class="w-4 h-4" /></span><p class="j-label">Aset Pasif</p></div>
            <p class="font-display font-bold text-[28px] leading-none">{{ fmt(sum(pasif)) }}</p>
            <p class="text-[12px] text-j-sub mt-1">unit terdaftar di jaringan</p>
            <div class="grid grid-cols-4 gap-2 mt-4"><div v-for="(v, k) in pasif" :key="k"><p class="text-[10px] text-j-sub uppercase">{{ k }}</p><p class="text-[14px] font-semibold mt-1">{{ fmt(v) }}</p></div></div>
          </div>
          <div class="j-card p-4">
            <div class="flex items-center gap-2 mb-3"><span class="w-8 h-8 rounded-[8px] bg-j-purple/[0.08] text-j-purple flex items-center justify-center"><UIcon name="i-lucide-server" class="w-4 h-4" /></span><p class="j-label">Aset Aktif</p></div>
            <p class="font-display font-bold text-[28px] leading-none">{{ fmt(sum(aktif)) }}</p>
            <p class="text-[12px] text-j-sub mt-1">perangkat aktif di jaringan</p>
            <div class="grid grid-cols-4 gap-2 mt-4"><div v-for="(v, k) in aktif" :key="k"><p class="text-[10px] text-j-sub">{{ k }}</p><p class="text-[14px] font-semibold mt-1">{{ fmt(v) }}</p></div></div>
          </div>
          <div class="j-card p-4">
            <div class="flex items-center gap-2 mb-3"><span class="w-8 h-8 rounded-[8px] bg-j-cyan/[0.08] text-j-cyan flex items-center justify-center"><UIcon name="i-lucide-map-pin" class="w-4 h-4" /></span><p class="j-label">Coverage FTTH</p></div>
            <p class="font-display font-bold text-[28px] leading-none">{{ fmt(homepass) }}</p>
            <p class="text-[12px] text-j-sub mt-1">homepass dalam masterplan 100%</p>
            <div class="grid grid-cols-3 gap-2 mt-4">
              <div><p class="text-[10px] text-j-sub">Tahap 1 (30%)</p><p class="text-[14px] font-semibold mt-1">{{ fmt(Math.round(homepass * 0.3)) }} HP</p></div>
              <div><p class="text-[10px] text-j-sub">Tahap 2 (50%)</p><p class="text-[14px] font-semibold mt-1">{{ fmt(Math.round(homepass * 0.5)) }} HP</p></div>
              <div><p class="text-[10px] text-j-sub">Cluster Aktif</p><p class="text-[14px] font-semibold mt-1">{{ clusters }} RW</p></div>
            </div>
          </div>
          <div class="j-card p-4">
            <div class="flex items-center gap-2 mb-3"><span class="w-8 h-8 rounded-[8px] bg-j-amber/[0.08] text-j-amber flex items-center justify-center"><UIcon name="i-lucide-shield-check" class="w-4 h-4" /></span><p class="j-label">Kualitas Data</p></div>
            <p class="font-display font-bold text-[28px] leading-none">{{ fmt(quality, 1) }}%</p>
            <p class="text-[12px] text-j-sub mt-1">kelengkapan data aset</p>
            <div class="mt-4 space-y-2 text-[12px]">
              <div class="flex justify-between"><span class="text-j-sub">Data lengkap</span><b class="text-j-blue">{{ fmt(quality, 1) }}%</b></div>
              <div class="h-1.5 rounded-full bg-j-soft overflow-hidden"><div class="h-full bg-j-cyan rounded-full" :style="{ width: quality + '%' }" /></div>
              <div class="flex justify-between"><span class="text-j-sub">Perlu validasi</span><b class="text-j-teal">{{ fmt(100 - quality, 1) }}%</b></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_312px] gap-4">
          <div class="space-y-4 min-w-0">
            <!-- asset table -->
            <div class="j-card p-4">
              <div class="flex items-start justify-between">
                <div><h3 class="j-title text-[16px]">Aset Jaringan</h3><p class="text-[13px] text-j-sub">Aset pasif & aktif</p></div>
                <div class="flex gap-2"><NuxtLink to="/proyek" class="j-btn-outline j-btn-sm font-sans font-normal">Filter</NuxtLink><NuxtLink to="/peta/asset?tool=add_site" class="j-btn-teal j-btn-sm font-sans font-normal">+ Tambah</NuxtLink></div>
              </div>
              <div class="flex gap-2 mt-3"><button v-for="t in ['Semua', 'Pasif', 'Aktif', 'OLT', 'Kabel']" :key="t" class="j-chip" :class="tab === t && 'j-chip-on'" @click="tab = t">{{ t }}</button></div>
              <table class="w-full mt-2">
                <thead><tr><th class="j-th">Kode Aset</th><th class="j-th">Kategori</th><th class="j-th">Lokasi / Cluster</th><th class="j-th">Status</th><th class="j-th">Kondisi</th><th class="j-th">Update</th></tr></thead>
                <tbody>
                  <tr v-for="r in rows.slice((page - 1) * PER, page * PER)" :key="r.id" class="hover:bg-j-bg cursor-pointer" @click="navigateTo({ path: '/peta/asset', query: r.kind === 'site' ? { site: r.id } : { cable: r.id } })">
                    <td class="j-td font-medium">{{ r.code }}</td>
                    <td class="j-td"><span :class="typeTag(r.type)" class="min-w-[90px]">{{ r.type }}</span></td>
                    <td class="j-td text-j-sub max-w-[220px] truncate">{{ r.loc }}</td>
                    <td class="j-td"><span :class="statusTag(r.status)" class="min-w-[70px]">{{ statusLabel(r.status) }}</span></td>
                    <td class="j-td">{{ r.cond }}</td>
                    <td class="j-td text-[12px] text-j-sub">{{ r.upd }}</td>
                  </tr>
                </tbody>
              </table>
              <div class="border-t border-j-line pt-3 mt-1"><JPager v-model="page" :total="rows.length" :per="PER" :label="`Menampilkan ${PER} dari ${fmt(rows.length)} aset`" /></div>
            </div>
            <!-- projects -->
            <div class="j-card p-4">
              <div class="flex items-start justify-between">
                <div><h3 class="j-title text-[16px]">Proyek per RW / Cluster</h3><p class="text-[13px] text-j-sub">Status pembangunan FTTH per area</p></div>
                <NuxtLink to="/proyek" class="j-btn-teal j-btn-sm font-sans font-normal">Lihat Semua <UIcon name="i-lucide-arrow-right" class="w-3.5 h-3.5" /></NuxtLink>
              </div>
              <table class="w-full mt-2">
                <thead><tr><th class="j-th">Proyek / Cluster</th><th class="j-th">Homepass</th><th class="j-th">Terpasang</th><th class="j-th">Progres</th><th class="j-th">Status</th></tr></thead>
                <tbody>
                  <tr v-for="p in projects.slice((ppage - 1) * 4, ppage * 4)" :key="p.name">
                    <td class="j-td">{{ p.name }}</td>
                    <td class="j-td">{{ fmt(p.hp) }} HP</td>
                    <td class="j-td">{{ fmt(p.used) }} unit</td>
                    <td class="j-td w-[160px]"><div class="h-1.5 rounded-full bg-j-soft overflow-hidden w-[100px]"><div class="h-full rounded-full" :class="p.prog < 30 ? 'bg-j-amber' : 'bg-j-cyan'" :style="{ width: Math.max(p.prog, 3) + '%' }" /></div></td>
                    <td class="j-td"><span :class="projTag(p.statusLabel)">{{ p.statusLabel }}</span></td>
                  </tr>
                </tbody>
              </table>
              <div class="border-t border-j-line pt-3 mt-1"><JPager v-model="ppage" :total="projects.length" :per="4" :label="`Menampilkan ${Math.min(4, projects.length)} dari ${projects.length} proyek`" /></div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="j-card p-4">
              <div class="flex items-center justify-between"><h3 class="j-title text-[16px]">Distribusi Aset</h3><span class="text-[11px] px-2 py-0.5 rounded-full border border-j-line text-j-sub">{{ dist.length }} kategori</span></div>
              <div class="flex justify-center py-4"><JDonut :items="dist" :size="150" :stroke="26" :center="fmt(dist.reduce((a, b) => a + b.value, 0))" caption="total aset" /></div>
              <div class="divide-y divide-j-line">
                <div v-for="d in dist.slice(0, 5)" :key="d.label" class="flex items-center justify-between py-2.5 text-[13px]">
                  <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-[2px]" :style="{ background: d.color }" />{{ d.label }}</span><b>{{ fmt(d.value) }}</b>
                </div>
              </div>
            </div>
            <div class="j-card p-4">
              <div class="flex items-center justify-between mb-3"><h3 class="j-title text-[16px]">Laporan Segmen Kabel</h3><span class="text-[11px] px-2 py-0.5 rounded-full border border-j-line text-j-blue">Terbaru</span></div>
              <div class="space-y-2">
                <NuxtLink v-for="s in segs.slice((spage - 1) * 5, spage * 5)" :key="s.id" :to="{ path: '/peta/asset', query: { cable: s.id } }" class="block border border-j-line rounded-[8px] px-3 py-2.5 hover:border-j-cyan">
                  <div class="flex items-center justify-between gap-2"><span class="text-[12px] text-j-sub truncate">{{ s.label }}</span><b class="text-[12px] text-j-teal shrink-0">{{ kmFmt(s.km) }}</b></div>
                  <div class="h-1 rounded-full bg-j-soft mt-2 w-[120px] overflow-hidden"><div class="h-full bg-j-cyan rounded-full" :style="{ width: Math.min(100, s.inst * 100) + '%' }" /></div>
                </NuxtLink>
              </div>
              <p class="text-[12px] text-j-sub mt-3">Total terpasang: <b class="text-j-teal">{{ fmt(segInst, 1) }} km</b> dari {{ fmt(segTotal, 1) }} km</p>
              <div class="flex justify-between mt-3">
                <button class="j-btn-outline j-btn-sm font-sans font-normal" :disabled="spage <= 1" @click="spage--">Sebelumnya</button>
                <button class="j-btn-teal j-btn-sm font-sans font-normal" :disabled="spage * 5 >= segs.length" @click="spage++">Selanjutnya</button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
