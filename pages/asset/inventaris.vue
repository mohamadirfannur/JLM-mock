<script setup lang="ts">
definePageMeta({ layout: "app" });
useHead({ title: "Inventaris · Assets Management · JLM" });
const view = ref<"proyek" | "aset">("proyek");
const { boot, booted } = useBoot();
const asset = useAssetStore();
const toast = useToast();
onMounted(boot);
const { rows } = useProjectList();
const q = ref("");
const chip = ref("Semua");
const per = ref(15);
const page = ref(1);
const sel = ref<Set<string>>(new Set());
const filtered = computed(() =>
  rows.value.filter((r) => {
    if (chip.value === "P0" && r.priority !== "P0") return false;
    if (["FTTH", "MPLS", "MW"].includes(chip.value) && r.kind !== chip.value) return false;
    const s = q.value.toLowerCase();
    return !s || (r.name + r.sub + r.origin + r.originName + r.dest).toLowerCase().includes(s);
  }),
);
watch([q, chip, per], () => (page.value = 1));
const prioTag = (p: string) => (p === "P0" ? "j-tag-red" : p === "P1" ? "j-tag-purple" : "j-tag-amber");
const statTag = (s: string) => (s === "Aktif" ? "j-tag-cyan" : s === "On-going" ? "j-tag-amber" : s === "Desain" ? "j-tag-purple" : "j-tag-grey");

const detail = ref<ProjectRow | null>(null);
const geom = computed(() => {
  const d = detail.value;
  if (!d) return null;
  if (d.cluster) {
    const sites = asset.sites.filter((s) => s.project === d.cluster);
    const cab = asset.cables.filter((c) => c.project === d.cluster && c.type !== "Distribusi");
    const pop = sites.find((s) => s.type === "POP") || asset.sites.find((s) => s.type === "POP" && cab[0] && Math.hypot(s.coord[0] - cab[0].coords[0][0], s.coord[1] - cab[0].coords[0][1]) < 0.002);
    const odc = sites.find((s) => s.type === "ODC");
    return { points: sites.filter((s) => s.type === "ODP").map((s) => s.coord), lines: cab.map((c) => c.coords), origin: (cab[0]?.coords[0] as [number, number]) || pop?.coord || null, dest: odc?.coord || null };
  }
  if (d.kind !== "FTTH") {
    const a = asset.sites.find((s) => s.code === d.origin), b = asset.sites.find((s) => s.code === d.dest);
    return a && b ? { points: [], lines: [[a.coord, b.coord]], origin: a.coord, dest: b.coord } : null;
  }
  const f = useFtthStore().byId(d.id.slice(2));
  return f ? { points: f.aoi.geometry.coordinates[0], lines: [f.aoi.geometry.coordinates[0]], origin: f.olt, dest: null } : null;
});
function exportRows() {
  exportXLSX("Proyek_Jaringan_JLM.xlsx", { Proyek: filtered.value.map((r) => ({ Proyek: r.name, Keterangan: r.sub, Kode: r.code, "Origin Site": r.origin, "Nama Origin": r.originName, Prioritas: r.priority, "Jenis Site": r.siteType, Destinasi: r.dest, Status: r.status, Homepass: r.homepass })) });
  toast.add({ title: "Daftar proyek diekspor", icon: "i-lucide-check-circle-2" });
}
</script>

<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1340px] mx-auto px-6 py-6 space-y-5">
      <div class="flex items-end justify-between">
        <div>
          <div class="flex items-center gap-3"><h1 class="j-title text-[24px]">Proyek Jaringan JLM</h1><span class="j-tag-cyan font-display font-bold">Asset Management</span></div>
          <p class="text-[14px] text-j-sub mt-1">Kelola aset per proyek dan cluster</p>
        </div>
        <div class="flex gap-2">
          <NuxtLink to="/asset/peta?tool=import" class="j-btn-outline font-sans font-medium"><UIcon name="i-lucide-upload" class="w-4 h-4" />Import KML/Excel/GIS</NuxtLink>
          <NuxtLink to="/asset/peta?tool=add_site" class="j-btn-teal"><UIcon name="i-lucide-circle-plus" class="w-4 h-4" />Tambah Asset</NuxtLink>
        </div>
      </div>
      <div class="flex gap-2"><button v-for="v in [['proyek', 'Proyek Jaringan'], ['aset', 'Sitepoint, Aset & Kabel']]" :key="v[0]" class="j-chip" :class="view === v[0] && 'j-chip-on'" @click="view = v[0] as any">{{ v[1] }}</button></div>
      <div v-if="view === 'aset'" class="j-card h-[calc(100vh-260px)] overflow-hidden">
        <AssetTable :full="true" @close="view = 'proyek'" @fullscreen="() => {}" @select="(k, id) => navigateTo({ path: '/asset/peta', query: k === 'site' ? { site: id } : { cable: id } })" />
      </div>
      <div v-else class="j-card p-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div><h3 class="j-title text-[16px]">Daftar Proyek Jaringan</h3><p class="text-[13px] text-j-sub">Data Aset FTTH / MPLS</p></div>
          <div class="flex items-center gap-2">
            <div class="relative"><UIcon name="i-lucide-search" class="w-4 h-4 text-j-sub absolute left-3 top-1/2 -translate-y-1/2" /><input v-model="q" class="j-input w-[220px] !pl-9" placeholder="Cari proyek, kode, lokasi..." /></div>
            <button v-for="c in ['Semua', 'FTTH', 'MPLS', 'MW', 'P0']" :key="c" class="j-chip" :class="chip === c && 'j-chip-on'" @click="chip = c">{{ c }}</button>
            <button class="j-btn-outline j-btn-sm font-sans font-normal" title="Export Excel" @click="exportRows"><UIcon name="i-lucide-download" class="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div v-if="!booted" class="py-16 text-center text-j-sub text-sm"><UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-j-cyan" /></div>
        <div v-else class="overflow-x-auto thin-scrollbar mt-3">
          <table class="w-full min-w-[1100px]">
            <thead>
              <tr>
                <th class="j-th w-8"><input type="checkbox" class="accent-[#00D4FF]" :checked="sel.size > 0 && sel.size === filtered.length" @change="sel = ($event.target as HTMLInputElement).checked ? new Set(filtered.map((r) => r.id)) : new Set()" /></th>
                <th class="j-th">Proyek / Nama</th><th class="j-th">Kode</th><th class="j-th">Origin Site</th><th class="j-th">Nama Origin</th><th class="j-th">Prioritas</th><th class="j-th">Jenis Site</th><th class="j-th">Destinasi</th><th class="j-th">Status</th><th class="j-th text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in filtered.slice((page - 1) * per, page * per)" :key="r.id" class="hover:bg-j-bg cursor-pointer" @click="detail = r">
                <td class="j-td" @click.stop><input type="checkbox" class="accent-[#00D4FF]" :checked="sel.has(r.id)" @change="sel.has(r.id) ? sel.delete(r.id) : sel.add(r.id)" /></td>
                <td class="j-td max-w-[260px]"><p class="font-semibold truncate">{{ r.name }}</p><p class="text-[11px] text-j-sub truncate">{{ r.sub }}</p></td>
                <td class="j-td"><span class="j-tag-cyan min-w-[70px]">{{ r.code }}</span></td>
                <td class="j-td whitespace-nowrap">{{ r.origin }}</td>
                <td class="j-td max-w-[200px] truncate">{{ r.originName }}</td>
                <td class="j-td"><span :class="prioTag(r.priority)" class="min-w-[70px]">{{ r.priority }}</span></td>
                <td class="j-td whitespace-nowrap">{{ r.siteType }}</td>
                <td class="j-td whitespace-nowrap">{{ r.dest }}</td>
                <td class="j-td"><span :class="statTag(r.status)" class="min-w-[80px]">{{ r.status }}</span></td>
                <td class="j-td" @click.stop>
                  <div class="flex justify-end gap-1.5">
                    <button class="w-7 h-7 rounded-[6px] border border-j-cyan/40 bg-j-cyan/[0.08] text-j-cyan flex items-center justify-center" title="Detail" @click="detail = r"><UIcon name="i-lucide-square-pen" class="w-3.5 h-3.5" /></button>
                    <UDropdown :items="[[{ label: 'Buka di peta', icon: 'i-lucide-map', click: () => navigateTo(r.link) }, { label: 'BOQ & BOM', icon: 'i-lucide-file-spreadsheet', click: () => navigateTo({ path: '/asset/boq-bom', query: { project: r.cluster || r.id } }) }]]">
                      <button class="w-7 h-7 rounded-[6px] border border-j-line flex items-center justify-center text-j-sub"><UIcon name="i-lucide-more-vertical" class="w-3.5 h-3.5" /></button>
                    </UDropdown>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between mt-4 gap-4">
          <div class="flex items-center gap-3 text-[13px] text-j-sub">Tampilkan <select v-model.number="per" class="j-select w-[72px] h-8"><option v-for="n in [10, 15, 25]" :key="n" :value="n">{{ n }}</option></select> {{ filtered.length }} Data ditemukan</div>
          <JPager v-model="page" :total="filtered.length" :per="per" label=" " />
        </div>
      </div>
    </div>

    <UModal :model-value="!!detail" :ui="{ width: 'sm:max-w-[500px]', rounded: 'rounded-[16px]' }" @update:model-value="!$event && (detail = null)">
      <div v-if="detail" class="p-6">
        <div class="flex items-start justify-between pb-4 border-b border-j-line">
          <div><h3 class="j-title text-[18px] leading-tight break-all">{{ detail.name }}</h3><p class="text-[13px] text-j-sub">Project Detail</p></div>
          <button class="w-8 h-8 rounded-[8px] border border-j-line flex items-center justify-center shrink-0" @click="detail = null"><UIcon name="i-lucide-x" class="w-4 h-4" /></button>
        </div>
        <div class="h-[160px] rounded-[10px] border border-j-line overflow-hidden mt-4 relative bg-j-bg">
          <JMiniMap v-if="geom" :key="detail.id" v-bind="geom" />
          <div class="absolute left-2 bottom-2 bg-white rounded-[6px] px-2 py-1 text-[10px] text-j-sub flex items-center gap-2 shadow-sm">Network Route Map · {{ detail.sub.split(" · ").pop() }} <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-j-cyan" />Origin</span><span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-j-purple" />{{ detail.siteType }}</span></div>
        </div>
        <div class="mt-4"><p class="text-[12px] text-j-sub">Project Name</p><p class="font-display font-bold text-[14px] break-all">{{ detail.name }}</p></div>
        <div class="grid grid-cols-3 gap-4 mt-4">
          <div><p class="text-[12px] text-j-sub mb-1">Code</p><p class="font-display font-bold text-[14px]">{{ detail.code }}</p></div>
          <div><p class="text-[12px] text-j-sub mb-1">Origin Site</p><span class="j-tag-cyan font-display font-bold">{{ detail.origin }}</span></div>
          <div><p class="text-[12px] text-j-sub mb-1">Origin Name</p><p class="font-display font-bold text-[13px] leading-tight">{{ detail.originName }}</p></div>
          <div><p class="text-[12px] text-j-sub mb-1">Priority</p><span :class="prioTag(detail.priority)" class="font-display font-bold">{{ detail.priority }}</span></div>
          <div><p class="text-[12px] text-j-sub mb-1">Jenis Site</p><p class="font-display font-bold text-[14px]">{{ detail.siteType }}</p></div>
          <div><p class="text-[12px] text-j-sub mb-1">Destination</p><span class="j-tag-purple font-display font-bold">{{ detail.dest }}</span></div>
        </div>
        <div class="grid grid-cols-3 gap-4 mt-4 bg-j-bg rounded-[10px] p-3 text-[12px]">
          <div><p class="text-j-sub mb-2">Cable Segment</p><p class="text-j-ink">{{ detail.segment }}</p></div>
          <div><p class="text-j-sub mb-2">ODC Reference</p><p class="text-j-ink">{{ detail.odcRef }}</p></div>
          <div><p class="text-j-sub mb-1">Status</p><span :class="statTag(detail.status)">{{ detail.status }}</span><p class="text-j-sub mt-1">{{ detail.scenario }}</p></div>
        </div>
        <div class="flex gap-2 mt-5">
          <button class="w-11 h-11 rounded-[10px] border border-j-line flex items-center justify-center" title="BOQ & BOM" @click="navigateTo({ path: '/asset/boq-bom', query: { project: detail.cluster || detail.id } })"><UIcon name="i-lucide-file-spreadsheet" class="w-4 h-4" /></button>
          <button class="w-11 h-11 rounded-[10px] border border-j-line flex items-center justify-center" title="Export" @click="exportRows"><UIcon name="i-lucide-upload" class="w-4 h-4" /></button>
          <button class="j-btn-primary flex-1 h-11 text-[14px]" @click="navigateTo(detail.link)">Add to Map</button>
        </div>
      </div>
    </UModal>
  </div>
</template>
