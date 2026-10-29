<script setup lang="ts">
import { CLASS_COLORS, CLASS_LABEL, ISP_COLORS, POI_COLORS, LEVEL_COLORS } from "~/utils/marketAnalysis";
defineEmits<{ (e: "close"): void; (e: "zoom", f: any): void; (e: "ftth", id: string): void; (e: "remove", id: string): void; (e: "export", id: string, kind: string): void }>();
const store = useMarketStore();
const a = computed(() => store.active);
const r = computed(() => a.value?.result);
const has = (l: string) => a.value?.layers.includes(l);

const pen = ref(30);
const arpu = ref(275000);
watch(
  () => a.value?.id,
  () => {
    pen.value = r.value?.params.penetration ?? 30;
    arpu.value = r.value?.params.arpu ?? 275000;
  },
  { immediate: true },
);
const subs = computed(() => (r.value ? Math.round(r.value.uncovered * (pen.value / 100) + (r.value.homepass - r.value.uncovered) * (pen.value / 100) * 0.35) : 0));
const sorted = (o: Record<string, number>, order?: string[]) => (order ? order.filter((k) => o[k] !== undefined).map((k) => [k, o[k]] as [string, number]) : Object.entries(o).sort((x, y) => y[1] - x[1]));
const PRICE_ORDER = ["< 500 jt", "500 jt – 1 M", "1 – 2 M", "2 – 3,5 M", "> 3,5 M"];
const VA_ORDER = ["900 VA", "1300 VA", "2200 VA", "3500 VA", "5500 VA"];
const gradeColor = computed(() => ({ High: "#7B2FFF", Mid: "#00AACC", Low: "#F59E0B", "Very Low": "#61718B" } as Record<string, string>)[r.value?.grade || "Mid"]);
</script>

<template>
  <UiSidePanel title="Analisis Area" subtitle="Jumlah rumah & potensi pasar dalam AOI" @close="$emit('close')">
    <div v-if="!a || !r" class="py-16 text-center">
      <div class="w-16 h-16 mx-auto bg-j-bg rounded-full flex items-center justify-center mb-3"><UIcon name="i-heroicons-chart-pie" class="w-8 h-8 text-j-sub" /></div>
      <p class="text-sm text-j-ink">Belum ada area dianalisis</p>
      <p class="text-xs text-j-sub mt-1">Pilih RW / Cluster di <b>Filter Lokasi</b>, atau gambar / upload AOI dari toolbar peta.</p>
    </div>
    <div v-else class="space-y-4">
      <div class="border border-j-line rounded-xs p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-j-ink truncate">{{ a.name }}</p>
            <p class="text-[11px] text-j-sub">{{ a.source }} · {{ a.createdAt }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <UButton size="2xs" color="gray" variant="ghost" icon="i-heroicons-magnifying-glass-plus" title="Zoom" @click="$emit('zoom', a.feature)" />
            <UDropdown
              :items="[
                [
                  { label: 'CSV (statistik)', icon: 'i-heroicons-table-cells', click: () => $emit('export', a!.id, 'csv') },
                  { label: 'Excel (rumah dalam AOI)', icon: 'i-heroicons-document-chart-bar', click: () => $emit('export', a!.id, 'xlsx') },
                  { label: 'KML (AOI + rumah)', icon: 'i-heroicons-globe-asia-australia', click: () => $emit('export', a!.id, 'kml') },
                ],
              ]"
            >
              <UButton size="2xs" color="gray" variant="ghost" icon="i-heroicons-arrow-down-tray" title="Download" />
            </UDropdown>
            <UButton size="2xs" color="red" variant="ghost" icon="i-heroicons-trash" title="Hapus" @click="$emit('remove', a.id)" />
          </div>
        </div>
        <div class="mt-3 flex items-center gap-3 rounded-[8px] p-3" :style="{ background: gradeColor + '14' }">
          <div class="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0" :style="{ background: gradeColor }">{{ r.score }}</div>
          <div>
            <p class="text-[11px] uppercase text-j-sub font-semibold">Market Potential Score</p>
            <p class="text-base font-bold text-j-ink">{{ r.grade }} Potential</p>
            <p class="text-[11px] text-j-sub">Kepadatan {{ fmt(r.density, 1) }} bangunan/ha · {{ 100 - r.competitorPct }}% rumah belum terlayani ISP</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <UiStat label="Total Rumah" :value="fmt(r.homes)" />
        <UiStat label="Homepass Potensial" :value="fmt(r.homepass)" />
        <UiStat label="Total Footprint" :value="fmt(r.totalBuildings)" />
        <UiStat label="Luas Area" :value="area(r.area)" />
        <UiStat label="Ruko / Komersial" :value="fmt(r.commercial)" />
        <UiStat label="POI di AOI" :value="fmt(r.poiTotal)" />
      </div>

      <div class="border border-j-line rounded-xs p-3 space-y-3">
        <p class="text-sm font-semibold">Estimasi Pelanggan & Revenue</p>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup label="Take-up rate" size="xs">
            <USelect v-model.number="pen" size="xs" :options="[10, 20, 30, 40, 50].map((v) => ({ label: v + '%', value: v }))" />
          </UFormGroup>
          <UFormGroup label="ARPU / bulan (IDR)" size="xs"><UInput v-model.number="arpu" type="number" size="xs" /></UFormGroup>
        </div>
        <div class="grid grid-cols-3 gap-2">
          <UiStat label="Est. Pelanggan" :value="fmt(subs)" tone="green" />
          <UiStat label="Revenue / bln" :value="idrShort(subs * arpu)" tone="green" />
          <UiStat label="Revenue / thn" :value="idrShort(subs * arpu * 12)" tone="green" />
        </div>
      </div>

      <div>
        <p class="text-sm font-semibold mb-2">Kompetitor ISP (rumah tinggal)</p>
        <UiDonut :labels="sorted(r.isp).map((x) => x[0])" :values="sorted(r.isp).map((x) => x[1])" :colors="sorted(r.isp).map((x) => ISP_COLORS[x[0] === 'Belum ada ISP' ? '' : x[0]] || '#949495')" :height="180" />
      </div>

      <div v-if="has('House Class')">
        <p class="text-sm font-semibold mb-2">House Class</p>
        <UiDonut :labels="sorted(r.byClass, ['A', 'B', 'C', 'D']).map((x) => CLASS_LABEL[x[0]])" :values="sorted(r.byClass, ['A', 'B', 'C', 'D']).map((x) => x[1])" :colors="sorted(r.byClass, ['A', 'B', 'C', 'D']).map((x) => CLASS_COLORS[x[0]])" :height="180" />
      </div>
      <div v-if="has('House Price')">
        <p class="text-sm font-semibold mb-1">House Price <span class="text-j-sub font-normal text-xs">(rata-rata {{ fmt(r.avgPrice) }} jt)</span></p>
        <UiBarChart :labels="sorted(r.byPrice, PRICE_ORDER).map((x) => x[0])" :values="sorted(r.byPrice, PRICE_ORDER).map((x) => x[1])" colors="#7C3AED" :height="170" />
      </div>
      <div v-if="has('Carport')">
        <p class="text-sm font-semibold mb-2">Carport</p>
        <UiDonut :labels="sorted(r.carport).map((x) => x[0])" :values="sorted(r.carport).map((x) => x[1])" :colors="['#3672F9', '#E4E3E4']" :height="160" />
      </div>
      <div v-if="has('Energy')">
        <p class="text-sm font-semibold mb-1">Energy (daya listrik PLN)</p>
        <UiBarChart :labels="sorted(r.energy, VA_ORDER).map((x) => x[0])" :values="sorted(r.energy, VA_ORDER).map((x) => x[1])" colors="#F59E0B" :height="170" />
      </div>
      <div v-if="has('Road Type')">
        <p class="text-sm font-semibold mb-1">Road Type (jalan terdekat)</p>
        <UiBarChart :labels="sorted(r.roadType).map((x) => x[0])" :values="sorted(r.roadType).map((x) => x[1])" colors="#06B6D4" :height="160" />
      </div>

      <div v-if="r.poiTotal">
        <p class="text-sm font-semibold mb-1">POI dalam AOI</p>
        <UiBarChart :labels="sorted(r.poi).map((x) => x[0])" :values="sorted(r.poi).map((x) => x[1])" :colors="sorted(r.poi).map((x) => POI_COLORS[x[0]])" :height="150" />
      </div>

      <div>
        <p class="text-sm font-semibold mb-2">Area Statistics per Kelurahan</p>
        <div class="border rounded-xxs divide-y text-xs">
          <div v-for="[k, v] in sorted(r.byKelurahan)" :key="k" class="flex justify-between p-2">
            <span>{{ k }}</span><span class="font-medium">{{ fmt(v) }}</span>
          </div>
          <div class="flex justify-between p-2 bg-j-bg font-semibold"><span>Total</span><span>{{ fmt(r.totalBuildings) }}</span></div>
        </div>
      </div>
    </div>
    <template v-if="a" #footer>
      <button class="j-btn-grad w-full h-10" @click="$emit('ftth', a.id)"><UIcon name="i-lucide-zap" class="w-4 h-4" />Buat Desain FTTH untuk area ini</button>
    </template>
  </UiSidePanel>
</template>
