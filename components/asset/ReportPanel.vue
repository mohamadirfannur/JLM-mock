<script setup lang="ts">
import { SITE_COLORS, CABLE_COLORS } from "~/utils/jlmSites";
defineEmits<{ (e: "close"): void; (e: "select", id: string): void }>();
const store = useAssetStore();
const toast = useToast();
const tab = ref<"ringkasan" | "kapasitas" | "material">("ringkasan");

const byType = computed(() => {
  const m: Record<string, number> = {};
  store.sites.forEach((s) => (m[s.type] = (m[s.type] || 0) + 1));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
});
const assetByType = computed(() => {
  const m: Record<string, { n: number; cat: string }> = {};
  store.assets.forEach((a) => (m[a.type] ||= { n: 0, cat: a.category }).n++);
  return Object.entries(m).sort((a, b) => b[1].n - a[1].n);
});
const status = computed(() => ["Installed", "Planned", "Maintenance"].map((s) => store.sites.filter((x) => x.status === s).length));
const capacity = computed(() =>
  store.assets
    .filter((a) => (a.type === "ODP" || a.type === "ODC") && a.ports?.length)
    .map((a) => ({ a, used: a.ports!.filter((p) => p.status === "Used").length, total: a.ports!.length }))
    .map((x) => ({ ...x, pct: Math.round((x.used / x.total) * 100) }))
    .sort((a, b) => b.pct - a.pct),
);
const capSummary = computed(() => {
  const c = capacity.value.filter((x) => x.a.type === "ODP");
  const used = c.reduce((a, x) => a + x.used, 0), total = c.reduce((a, x) => a + x.total, 0);
  return { used, total, pct: total ? Math.round((used / total) * 100) : 0, full: c.filter((x) => x.pct >= 80).length, empty: c.filter((x) => x.used === 0).length };
});
const material = computed(() => {
  const m: Record<string, { inst: number; plan: number; n: number }> = {};
  store.cables.forEach((c) => {
    const k = `${c.type} ${c.cores}C`;
    m[k] ||= { inst: 0, plan: 0, n: 0 };
    m[k].n++;
    if (c.status === "Planned") m[k].plan += c.length;
    else m[k].inst += c.length;
  });
  return Object.entries(m).sort((a, b) => b[1].inst + b[1].plan - (a[1].inst + a[1].plan));
});
const poleTypes = computed(() => {
  const m: Record<string, number> = {};
  store.sites.filter((s) => s.type === "Pole").forEach((s) => (m[s.poleType || "T7 1-Stage"] = (m[s.poleType || "T7 1-Stage"] || 0) + 1));
  return m;
});
const plannedProjects = computed(() => [...new Set(store.sites.filter((s) => s.status === "Planned" && s.project).map((s) => s.project!))]);
function asBuilt(p: string) {
  store.markInstalled(p);
  toast.add({ title: "As-built tersimpan", description: `${p} → Installed`, icon: "i-heroicons-check-badge", color: "green" });
}
function exportReport() {
  exportXLSX("Laporan_Aset_JLM.xlsx", {
    "Kapasitas ODP-ODC": capacity.value.map((x) => ({ Kode: x.a.code, Tipe: x.a.type, Terpakai: x.used, Kapasitas: x.total, "Utilisasi %": x.pct, Site: store.siteById(x.a.siteId)?.code })),
    "Material Kabel": material.value.map(([k, v]) => ({ Kabel: k, Segmen: v.n, "Terpasang (m)": Math.round(v.inst), "Planned (m)": Math.round(v.plan) })),
    "Segmen Kabel": store.cables.map((c) => ({ Label: c.label, Tipe: c.type, Core: c.cores, "Panjang (m)": c.length, Status: c.status, Instalasi: c.install })),
    Histori: store.activity.map((a) => ({ Waktu: a.at, User: a.user, Aksi: a.action, Target: a.target, Detail: a.detail })),
  });
}
</script>

<template>
  <UiSidePanel title="Asset Summary" subtitle="Laporan inventaris aset OSP JLM" @close="$emit('close')">
    <template #actions><UButton size="2xs" color="gray" variant="ghost" icon="i-heroicons-arrow-down-tray" title="Export laporan Excel" @click="exportReport" /></template>
    <div class="flex bg-j-bg rounded-xxs p-1 mb-3">
      <button v-for="t in [{ k: 'ringkasan', l: 'Ringkasan' }, { k: 'kapasitas', l: 'Kapasitas ODP/ODC' }, { k: 'material', l: 'Material Terpasang' }]" :key="t.k" class="flex-1 py-1.5 text-xs rounded-xxs" :class="tab === t.k ? 'bg-white shadow-sm' : 'text-j-sub'" @click="tab = t.k as any">{{ t.l }}</button>
    </div>
    <template v-if="tab === 'ringkasan'">
      <div class="grid grid-cols-3 gap-2 mb-3">
        <UiStat label="Site Point" :value="fmt(store.sites.length)" />
        <UiStat label="Aset" :value="fmt(store.assets.length)" />
        <UiStat label="Kabel" :value="fmt(store.cables.reduce((a, c) => a + c.length, 0) / 1000, 1)" unit="km" />
      </div>
      <p class="text-sm font-semibold mb-2">Status Site Point</p>
      <UiDonut :labels="['Installed', 'Planned', 'Maintenance']" :values="status" :colors="['#00D075', '#FBBF24', '#C0353E']" :height="170" />
      <p class="text-sm font-semibold mt-5 mb-2">Site Point per Tipe</p>
      <UiBarChart :labels="byType.map((x) => x[0])" :values="byType.map((x) => x[1])" :colors="byType.map((x) => SITE_COLORS[x[0]] || '#999')" :height="170" />
      <p class="text-sm font-semibold mt-5 mb-2">Aset per Jenis</p>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="[k, v] in assetByType" :key="k" class="flex justify-between border rounded-xxs p-2 text-xs">
          <span>{{ k }} <span class="text-[10px] text-j-sub">{{ v.cat }}</span></span><b>{{ fmt(v.n) }}</b>
        </div>
      </div>
      <div v-if="plannedProjects.length" class="mt-5">
        <p class="text-sm font-semibold mb-2">Planned dari FTTH Auto-Design</p>
        <div v-for="p in plannedProjects" :key="p" class="flex items-center justify-between border border-yellow-300 bg-yellow-50 rounded-xxs p-2 text-xs mb-1">
          <span class="truncate">{{ p }}</span>
          <UButton size="2xs" color="green" variant="soft" icon="i-heroicons-check-badge" @click="asBuilt(p)">Set As-built</UButton>
        </div>
      </div>
    </template>
    <template v-if="tab === 'kapasitas'">
      <div class="grid grid-cols-2 gap-2 mb-3">
        <UiStat label="Utilisasi port ODP" :value="capSummary.pct + '%'" />
        <UiStat label="Port terpakai" :value="`${fmt(capSummary.used)}/${fmt(capSummary.total)}`" />
        <UiStat label="ODP ≥ 80% (hampir penuh)" :value="capSummary.full" tone="white" />
        <UiStat label="ODP kosong" :value="capSummary.empty" tone="white" />
      </div>
      <div class="space-y-1">
        <button v-for="x in capacity.slice(0, 60)" :key="x.a.id" class="w-full p-2 border rounded-xxs hover:border-blue-500 text-left" @click="$emit('select', x.a.siteId)">
          <div class="flex justify-between text-xs"><span class="font-medium">{{ x.a.code }}</span><span>{{ x.used }}/{{ x.total }} · {{ x.pct }}%</span></div>
          <div class="h-1.5 bg-j-bg rounded-full mt-1 overflow-hidden"><div class="h-full rounded-full" :style="{ width: x.pct + '%', background: x.pct >= 80 ? '#C0353E' : x.pct >= 50 ? '#F59E0B' : '#3672F9' }" /></div>
        </button>
      </div>
    </template>
    <template v-if="tab === 'material'">
      <p class="text-xs text-j-sub mb-2">Actual material & segmen kabel terpasang di lapangan (kebutuhan laporan JLM).</p>
      <div class="border rounded-xxs overflow-hidden text-xs">
        <div class="grid grid-cols-[1.4fr_0.6fr_1fr_1fr] bg-j-soft font-semibold p-2"><span>Kabel</span><span class="text-center">Segmen</span><span class="text-right">Terpasang</span><span class="text-right">Planned</span></div>
        <div v-for="[k, v] in material" :key="k" class="grid grid-cols-[1.4fr_0.6fr_1fr_1fr] p-2 border-t">
          <span class="flex items-center gap-1.5"><span class="w-3 h-1 rounded-full" :style="{ background: CABLE_COLORS[k.replace(/ \d+C$/, '')] }" />{{ k }}</span>
          <span class="text-center">{{ v.n }}</span><span class="text-right">{{ meters(v.inst) }}</span><span class="text-right text-yellow-700">{{ v.plan ? meters(v.plan) : "-" }}</span>
        </div>
      </div>
      <p class="text-sm font-semibold mt-4 mb-2">Tiang per tipe</p>
      <div class="grid grid-cols-3 gap-2">
        <div v-for="t in ['T7 1-Stage', 'T7 2-Stage', 'T9 2-Stage']" :key="t" class="border rounded-xxs p-2 text-center"><p class="text-sm font-bold text-j-cyan">{{ fmt(poleTypes[t] || 0) }}</p><p class="text-[10px] text-j-sub">{{ t }}</p></div>
      </div>
    </template>
  </UiSidePanel>
</template>
