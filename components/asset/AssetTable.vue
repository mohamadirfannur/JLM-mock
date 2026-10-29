<script setup lang="ts">
defineEmits<{ (e: "close"): void; (e: "fullscreen"): void; (e: "select", kind: "site" | "cable", id: string): void }>();
defineProps<{ full: boolean }>();
const store = useAssetStore();
const tab = ref<"sites" | "assets" | "cables">("sites");
const q = ref("");
const typeF = ref("Semua");
const statusF = ref("Semua");
const page = ref(1);
const PER = 50;
const rows = computed(() => {
  const qq = q.value.toLowerCase();
  let r: any[] = [];
  if (tab.value === "sites") r = store.sites.map((s) => ({ _id: s.id, _k: "site", Kode: s.code, Nama: s.name, Tipe: s.type, Status: s.status, Owner: s.owner, Aset: store.assetsOf(s.id).length, Project: s.project || "-", Lat: s.coord[1].toFixed(6), Lng: s.coord[0].toFixed(6), Updated: s.updatedAt }));
  if (tab.value === "assets")
    r = store.assets.map((a) => {
      const s = store.siteById(a.siteId);
      return { _id: a.siteId, _k: "site", Kode: a.code, Nama: a.name, Tipe: a.type, Kategori: a.category, Status: s?.status || "-", Site: s?.code || "-", Port: a.ports ? `${a.ports.filter((p) => p.status === "Used").length}/${a.ports.length}` : "-", Serial: a.serial || "-", Install: a.installDate || "-" };
    });
  if (tab.value === "cables") r = store.cables.map((c) => ({ _id: c.id, _k: "cable", Kode: c.code, Label: c.label, Tipe: c.type, Core: c.cores, "Panjang (m)": c.length, Instalasi: c.install, Status: c.status, Project: c.project || "-" }));
  return r.filter((x) => (typeF.value === "Semua" || x.Tipe === typeF.value) && (statusF.value === "Semua" || x.Status === statusF.value) && (!qq || JSON.stringify(x).toLowerCase().includes(qq)));
});
const types = computed(() => ["Semua", ...new Set((tab.value === "sites" ? store.sites.map((s) => s.type) : tab.value === "assets" ? store.assets.map((a) => a.type) : store.cables.map((c) => c.type)) as string[])]);
const cols = computed(() => (rows.value[0] ? Object.keys(rows.value[0]).filter((k) => !k.startsWith("_")) : []));
watch([tab, q, typeF, statusF], () => (page.value = 1));
watch(tab, () => (typeF.value = "Semua"));
function exportX() {
  exportXLSX(`Aset_JLM_${tab.value}.xlsx`, { [tab.value]: rows.value.map(({ _id, _k, ...r }) => r) });
}
</script>
<template>
  <div class="flex flex-col h-full">
    <div class="p-3 flex items-center justify-between gap-2 border-b">
      <div class="flex items-center gap-3">
        <h2 class="text-md text-black">Asset Table</h2>
        <div class="flex bg-grey-100 rounded-xxs p-1">
          <button v-for="t in [{ k: 'sites', l: `Site Points (${store.sites.length})` }, { k: 'assets', l: `Assets (${store.assets.length})` }, { k: 'cables', l: `Cables (${store.cables.length})` }]" :key="t.k" class="px-3 py-1 text-xs rounded-xxs" :class="tab === t.k ? 'bg-white shadow-sm' : 'text-grey-600'" @click="tab = t.k as any">{{ t.l }}</button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UInput v-model="q" size="xs" placeholder="Search..." icon="i-heroicons-magnifying-glass" class="w-44" />
        <USelect v-model="typeF" size="xs" :options="types" />
        <USelect v-model="statusF" size="xs" :options="['Semua', 'Installed', 'Planned', 'Maintenance']" />
        <UButton size="xs" icon="i-heroicons-arrow-down-tray" @click="exportX">Excel</UButton>
        <UButton size="xs" color="gray" variant="ghost" :icon="full ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'" @click="$emit('fullscreen')" />
        <UButton size="xs" color="gray" variant="ghost" icon="i-heroicons-x-mark" @click="$emit('close')" />
      </div>
    </div>
    <div class="flex-1 overflow-auto thin-scrollbar">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-grey-200"><tr><th v-for="c in cols" :key="c" class="text-left px-3 py-2 font-semibold whitespace-nowrap">{{ c }}</th></tr></thead>
        <tbody>
          <tr v-for="r in rows.slice((page - 1) * PER, page * PER)" :key="r.Kode + r._id" class="border-t hover:bg-blue-50 cursor-pointer" @click="$emit('select', r._k, r._id)">
            <td v-for="c in cols" :key="c" class="px-3 py-1.5 whitespace-nowrap max-w-[22rem] truncate">
              <span v-if="c === 'Status'" class="px-1.5 py-0.5 rounded-xxs text-[10px]" :class="r[c] === 'Installed' ? 'bg-green-100 text-green-700' : r[c] === 'Planned' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'">{{ r[c] }}</span>
              <template v-else>{{ r[c] }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="p-2 border-t flex items-center justify-between text-xs text-grey-600">
      <span>{{ fmt(rows.length) }} rows</span>
      <UPagination v-model="page" :total="rows.length" :page-count="PER" size="2xs" />
    </div>
  </div>
</template>
