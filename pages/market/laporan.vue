<script setup lang="ts">
definePageMeta({ layout: "app" });
useHead({ title: "Laporan Analisis · Market Potential · JLM" });
const store = useMarketStore();
const toast = useToast();
const q = ref("");
const rows = computed(() => store.aois.filter((a) => a.name.toLowerCase().includes(q.value.toLowerCase())));
const tot = computed(() => ({ homes: store.aois.reduce((a, x) => a + x.result.homes, 0), hp: store.aois.reduce((a, x) => a + x.result.homepass, 0), subs: store.aois.reduce((a, x) => a + x.result.estSubscribers, 0), rev: store.aois.reduce((a, x) => a + x.result.estRevenueYear, 0) }));
const GRADE: Record<string, string> = { High: "j-tag-purple", Mid: "j-tag-cyan", Low: "j-tag-amber", "Very Low": "j-tag-grey" };
function exportAll() {
  exportXLSX("Laporan_Market_Potential_JLM.xlsx", {
    Ringkasan: store.aois.map((a) => ({ AOI: a.name, Sumber: a.source, Dibuat: a.createdAt, "Luas (m2)": Math.round(a.result.area), Bangunan: a.result.totalBuildings, Rumah: a.result.homes, Homepass: a.result.homepass, "Kompetitor %": a.result.competitorPct, POI: a.result.poiTotal, Skor: a.result.score, Grade: a.result.grade, "Est. pelanggan": a.result.estSubscribers, "Revenue / thn (IDR)": a.result.estRevenueYear })),
    "Kelas Rumah": store.aois.flatMap((a) => Object.entries(a.result.byClass).map(([k, v]) => ({ AOI: a.name, Kelas: k, Rumah: v }))),
    "Kompetitor ISP": store.aois.flatMap((a) => Object.entries(a.result.isp).map(([k, v]) => ({ AOI: a.name, ISP: k, Rumah: v }))),
  });
  toast.add({ title: "Laporan diekspor", icon: "i-lucide-check-circle-2" });
}
function open(id: string) {
  store.activeId = id;
  navigateTo("/market");
}
</script>
<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1340px] mx-auto px-6 py-6 space-y-5">
      <div class="flex items-end justify-between">
        <div>
          <div class="flex items-center gap-3"><h1 class="j-title text-[24px]">Laporan Analisis Pasar</h1><span class="j-tag-cyan font-display font-bold">Market Potential</span></div>
          <p class="text-[14px] text-j-sub mt-1">Rekap jumlah rumah & potensi pasar setiap AOI yang dianalisis</p>
        </div>
        <div class="flex gap-2"><button class="j-btn-outline font-sans font-medium" :disabled="!store.aois.length" @click="exportAll"><UIcon name="i-lucide-download" class="w-4 h-4" />Export Excel</button><NuxtLink to="/market" class="j-btn-primary"><UIcon name="i-lucide-pentagon" class="w-4 h-4" />Analisis AOI baru</NuxtLink></div>
      </div>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="c in [['AOI dianalisis', store.aois.length], ['Total rumah', fmt(tot.homes)], ['Homepass potensial', fmt(tot.hp)], ['Est. revenue / tahun', idrShort(tot.rev)]]" :key="c[0]" class="j-card p-4"><p class="j-label text-j-sub">{{ c[0] }}</p><p class="font-display font-bold text-[26px] mt-2">{{ c[1] }}</p></div>
      </div>
      <div class="j-card p-4">
        <div class="flex items-center justify-between"><h3 class="j-title text-[16px]">Daftar AOI</h3><div class="relative"><UIcon name="i-lucide-search" class="w-4 h-4 text-j-sub absolute left-3 top-1/2 -translate-y-1/2" /><input v-model="q" class="j-input w-[220px] !pl-9" placeholder="Cari AOI..." /></div></div>
        <div v-if="!store.aois.length" class="py-14 text-center"><p class="j-title text-[15px]">Belum ada analisis</p><p class="text-[13px] text-j-sub mt-1">Gambar atau upload AOI di Peta Analisis untuk menghitung jumlah rumah.</p></div>
        <table v-else class="w-full mt-3">
          <thead><tr><th class="j-th">AOI</th><th class="j-th">Sumber</th><th class="j-th text-right">Luas</th><th class="j-th text-right">Rumah</th><th class="j-th text-right">Homepass</th><th class="j-th text-right">Kompetitor</th><th class="j-th text-right">POI</th><th class="j-th text-right">Est. pelanggan</th><th class="j-th">Potensi</th><th class="j-th" /></tr></thead>
          <tbody>
            <tr v-for="a in rows" :key="a.id" class="hover:bg-j-bg cursor-pointer" @click="open(a.id)">
              <td class="j-td"><p class="font-semibold">{{ a.name }}</p><p class="text-[11px] text-j-sub">{{ a.createdAt }}</p></td>
              <td class="j-td text-[12px] text-j-sub">{{ a.source }}</td>
              <td class="j-td text-right">{{ m2(a.result.area) }}</td>
              <td class="j-td text-right font-bold">{{ fmt(a.result.homes) }}</td>
              <td class="j-td text-right">{{ fmt(a.result.homepass) }}</td>
              <td class="j-td text-right text-j-red">{{ a.result.competitorPct }}%</td>
              <td class="j-td text-right">{{ a.result.poiTotal }}</td>
              <td class="j-td text-right text-j-teal font-medium">{{ fmt(a.result.estSubscribers) }}</td>
              <td class="j-td"><span :class="GRADE[a.result.grade]">{{ a.result.grade }} · {{ a.result.score }}</span></td>
              <td class="j-td text-right" @click.stop><button class="j-btn-danger j-btn-sm !px-2" @click="store.remove(a.id)"><UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
