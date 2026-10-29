<script setup lang="ts">
definePageMeta({ layout: "app" });
useHead({ title: "Daftar Proyek · FTTH Mapping · JLM" });
const { boot, booted } = useBoot();
const ftth = useFtthStore();
const toast = useToast();
onMounted(boot);
const q = ref("");
const chip = ref("Semua");
const LBL: Record<string, string> = { Draft: "Diproses", Designed: "Desain", "Sent to Asset": "Desain", "As-built": "As-built" };
const TAG: Record<string, string> = { Diproses: "j-tag-amber", Desain: "j-tag-purple", "As-built": "j-tag-teal", Siap: "j-tag-cyan" };
const rows = computed(() =>
  ftth.projects
    .map((p) => {
      const j = ftth.jobs.find((x) => x.projectId === p.id);
      const st = j?.status === "completed" && p.status === "Draft" ? "Siap" : LBL[p.status];
      const r = ftth.results[p.id];
      return { p, st, job: j, odp: r?.summary.odp ?? Math.ceil(p.homes / 16), odc: r?.summary.odc ?? Math.max(1, Math.ceil(p.homes / 16 / 36)), km: r ? r.summary.cableTotal / 1000 : null, cost: r?.totalCost ?? null };
    })
    .filter((r) => (chip.value === "Semua" || r.st === chip.value) && (r.p.name + r.p.kecamatan).toLowerCase().includes(q.value.toLowerCase())),
);
function del(id: string) {
  if (!confirm("Hapus proyek desain ini?")) return;
  ftth.remove(id);
  toast.add({ title: "Proyek dihapus", icon: "i-lucide-trash-2" });
}
</script>
<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1340px] mx-auto px-6 py-6 space-y-5">
      <div class="flex items-end justify-between">
        <div>
          <div class="flex items-center gap-3"><h1 class="j-title text-[24px]">Daftar Proyek FTTH</h1><span class="j-tag-cyan font-display font-bold">FTTH Mapping</span></div>
          <p class="text-[14px] text-j-sub mt-1">Masterplan desain jaringan per RW / cluster</p>
        </div>
        <NuxtLink to="/ftth?new=1" class="j-btn-grad"><UIcon name="i-lucide-plus" class="w-4 h-4" />Desain Baru</NuxtLink>
      </div>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="c in [['Total proyek', ftth.projects.length], ['Homepass masterplan', fmt(ftth.projects.reduce((a, p) => a + p.homes, 0))], ['Job diproses', ftth.jobs.filter((j) => j.status === 'processing').length], ['As-built', ftth.projects.filter((p) => p.status === 'As-built').length]]" :key="c[0]" class="j-card p-4"><p class="j-label text-j-sub">{{ c[0] }}</p><p class="font-display font-bold text-[26px] mt-2">{{ c[1] }}</p></div>
      </div>
      <div class="j-card p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="j-title text-[16px]">Proyek Desain</h3>
          <div class="flex items-center gap-2">
            <div class="relative"><UIcon name="i-lucide-search" class="w-4 h-4 text-j-sub absolute left-3 top-1/2 -translate-y-1/2" /><input v-model="q" class="j-input w-[220px] !pl-9" placeholder="Cari proyek / kecamatan..." /></div>
            <button v-for="c in ['Semua', 'Diproses', 'Siap', 'Desain', 'As-built']" :key="c" class="j-chip" :class="chip === c && 'j-chip-on'" @click="chip = c">{{ c }}</button>
          </div>
        </div>
        <div v-if="!booted" class="py-12 text-center"><UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-j-cyan" /></div>
        <table v-else class="w-full mt-3">
          <thead><tr><th class="j-th">Proyek</th><th class="j-th">Sumber</th><th class="j-th">OLT</th><th class="j-th text-right">Homepass</th><th class="j-th text-right">ODP</th><th class="j-th text-right">ODC</th><th class="j-th text-right">Kabel</th><th class="j-th text-right">Estimasi biaya</th><th class="j-th">Status</th><th class="j-th text-right">Aksi</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.p.id" class="hover:bg-j-bg">
              <td class="j-td"><p class="font-semibold">{{ r.p.name }}</p><p class="text-[11px] text-j-sub">Kec. {{ r.p.kecamatan }} · kode {{ r.p.params.areaCode }} · {{ r.p.updatedAt }}</p></td>
              <td class="j-td text-[12px] text-j-sub">{{ r.p.source }}</td>
              <td class="j-td text-[12px]">{{ r.p.oltLabel }}</td>
              <td class="j-td text-right font-medium">{{ fmt(r.p.homes) }}</td>
              <td class="j-td text-right">{{ r.job?.status === "processing" ? "±" : "" }}{{ fmt(r.odp) }}</td>
              <td class="j-td text-right">{{ r.odc }}</td>
              <td class="j-td text-right">{{ r.km !== null ? `${fmt(r.km, 2)} km` : "–" }}</td>
              <td class="j-td text-right">{{ r.cost !== null ? idrShort(r.cost) : "–" }}</td>
              <td class="j-td"><span :class="TAG[r.st]">{{ r.st }}</span><span v-if="r.job?.status === 'processing'" class="text-[11px] text-j-sub ml-1">{{ Math.round(r.job.progress) }}%</span></td>
              <td class="j-td">
                <div class="flex justify-end gap-1.5">
                  <NuxtLink :to="{ path: '/ftth', query: { project: r.p.id } }" class="j-btn-outline j-btn-sm font-sans font-normal">Peta</NuxtLink>
                  <NuxtLink v-if="r.p.status !== 'Draft'" :to="{ path: '/ftth/boq-bom', query: { project: r.p.id } }" class="j-btn-teal j-btn-sm font-sans font-normal">BOQ</NuxtLink>
                  <button class="j-btn-danger j-btn-sm !px-2" title="Hapus" @click="del(r.p.id)"><UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
