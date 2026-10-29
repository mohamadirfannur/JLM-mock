<script setup lang="ts">
import { POI_COLORS, CLASS_COLORS, CLASS_LABEL, LEVEL_COLORS, TYPE_LABEL } from "~/utils/marketAnalysis";
defineEmits<{ (e: "close"): void; (e: "zoom", f: any): void }>();

const { data, loaded } = useGeoData();
const tab = ref<"poi" | "aoi" | "footprint">("poi");
const province = ref("Jawa Barat");
const city = ref("Kota Bandung");
const kecamatan = ref("Semua Kecamatan");
const poiCat = ref("Sekolah");

const kelInScope = computed(() => (data.kelurahan?.features || []).filter((k: any) => kecamatan.value === "Semua Kecamatan" || k.properties.kecamatan === kecamatan.value).map((k: any) => k.properties.name));
const inScope = (kel: string) => kelInScope.value.includes(kel);

// POI
const poiList = computed(() => {
  if (!loaded.value) return [];
  return (data.poi?.features || []).filter((f: any) => f.properties.cat === poiCat.value);
});
const poiSub = computed(() => {
  const m: Record<string, number> = {};
  poiList.value.forEach((f: any) => (m[f.properties.sub] = (m[f.properties.sub] || 0) + 1));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
});
const SUBCOL = ["#2ED88E", "#FBBF24", "#C0353E", "#F97316", "#3672F9", "#7C3AED", "#79797B", "#06B6D4"];
const poiCats = Object.keys(POI_COLORS);
const poiTotals = computed(() => poiCats.map((c) => (data.poi?.features || []).filter((f: any) => f.properties.cat === c).length));

// footprint
const fp = computed(() => {
  if (!loaded.value) return null;
  const feats = (data.buildings?.features || []).filter((f: any) => inScope(f.properties.kel));
  const byType: Record<string, number> = {};
  const byClass: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const byKel: Record<string, number> = {};
  feats.forEach((f: any) => {
    const p = f.properties;
    byType[p.t] = (byType[p.t] || 0) + 1;
    if (p.t === "res") byClass[p.cls]++;
    byKel[p.kel] = (byKel[p.kel] || 0) + 1;
  });
  return { total: feats.length, res: byType.res || 0, byType, byClass, byKel: Object.entries(byKel).sort((a, b) => b[1] - a[1]) };
});

// AOI (potential grid)
const LEVELS = ["Very Low", "Low", "Mid", "High", "Very High"];
const hexStats = computed(() => {
  const hs = data.hex?.features || [];
  const m: Record<string, { n: number; homes: number }> = {};
  LEVELS.forEach((l) => (m[l] = { n: 0, homes: 0 }));
  hs.forEach((h: any) => {
    m[h.properties.level].n++;
    m[h.properties.level].homes += h.properties.homes;
  });
  return m;
});
const topAoi = computed(() => [...(data.aoi?.features || [])].sort((a: any, b: any) => b.properties.homes - a.properties.homes).slice(0, 8));
</script>

<template>
  <UiSidePanel title="Summary Data" subtitle="Summary data for market potential analysis" @close="$emit('close')">
    <div class="flex bg-j-bg rounded-xxs p-1 mb-3">
      <button
        v-for="t in [
          { k: 'poi', l: 'POI', i: 'i-heroicons-map-pin' },
          { k: 'aoi', l: 'AOI', i: 'i-heroicons-viewfinder-circle' },
          { k: 'footprint', l: 'Footprint', i: 'i-heroicons-home' },
        ]"
        :key="t.k"
        class="flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-xxs"
        :class="tab === t.k ? 'bg-white shadow-sm text-j-ink' : 'text-j-sub'"
        @click="tab = t.k as any"
      >
        <UIcon :name="t.i" class="w-4 h-4" />{{ t.l }}
      </button>
    </div>

    <USelect v-if="tab === 'poi'" v-model="poiCat" :options="poiCats" class="mb-3" />
    <p class="text-sm text-j-ink mb-1">Filters</p>
    <div class="grid grid-cols-3 gap-2 mb-3">
      <USelect v-model="province" size="xs" :options="['Jawa Barat']" />
      <USelect v-model="city" size="xs" :options="['Kota Bandung']" />
      <USelect v-model="kecamatan" size="xs" :options="['Semua Kecamatan', 'Gedebage', 'Rancasari']" />
    </div>

    <div v-if="!loaded" class="py-10 text-center text-xs text-j-sub"><UIcon name="i-heroicons-arrow-path" class="animate-spin w-6 h-6 mb-2" /><br />Loading data...</div>

    <!-- POI -->
    <template v-else-if="tab === 'poi'">
      <div class="border border-j-line rounded-xxs p-3 mb-4">
        <p class="text-xs text-j-ink">Total {{ poiCat }}</p>
        <p class="text-2xl font-bold text-j-ink">{{ fmt(poiList.length) }}</p>
      </div>
      <p class="text-sm font-semibold mb-2">Distribution Chart</p>
      <UiDonut :labels="poiSub.map((x) => x[0])" :values="poiSub.map((x) => x[1])" :colors="SUBCOL" :height="210" />
      <p class="text-sm font-semibold mt-6 mb-2">Comparison Chart</p>
      <UiBarChart :labels="poiCats" :values="poiTotals" :colors="poiCats.map((c) => POI_COLORS[c])" :height="200" />
      <div class="mt-4 space-y-1">
        <button v-for="f in poiList.slice(0, 12)" :key="f.properties.name + f.geometry.coordinates[0]" class="w-full flex items-center justify-between text-xs p-2 rounded-xxs hover:bg-j-bg" @click="$emit('zoom', f)">
          <span class="truncate">{{ f.properties.name }}</span><span class="text-j-sub shrink-0 ml-2">{{ f.properties.sub }}</span>
        </button>
      </div>
    </template>

    <!-- AOI -->
    <template v-else-if="tab === 'aoi'">
      <div class="grid grid-cols-2 gap-2 mb-4">
        <UiStat label="Grid Potensi" :value="fmt(data.hex?.features.length)" unit="hex" />
        <UiStat label="High + Very High" :value="fmt(hexStats.High.homes + hexStats['Very High'].homes)" unit="rumah" />
      </div>
      <p class="text-sm font-semibold mb-2">Potential Level Distribution</p>
      <UiDonut :labels="LEVELS" :values="LEVELS.map((l) => hexStats[l].homes)" :colors="LEVELS.map((l) => LEVEL_COLORS[l])" :height="200" />
      <p class="text-sm font-semibold mt-6 mb-2">Sample AOI (Cluster / RW) — siap dianalisis</p>
      <div class="space-y-1">
        <button v-for="a in topAoi" :key="a.properties.id" class="w-full flex items-center justify-between text-xs p-2 rounded-xxs border border-j-line hover:border-blue-500" @click="$emit('zoom', a)">
          <span class="truncate text-left">{{ a.properties.name }}</span>
          <span class="shrink-0 ml-2 px-2 py-0.5 rounded-xxs bg-j-cyan/10 text-j-blue text-[10px]">± {{ fmt(a.properties.homes) }} rumah</span>
        </button>
      </div>
    </template>

    <!-- Footprint -->
    <template v-else-if="fp">
      <div class="grid grid-cols-2 gap-2 mb-4">
        <UiStat label="Total Footprint" :value="fmt(fp.total)" />
        <UiStat label="Rumah Tinggal" :value="fmt(fp.res)" />
      </div>
      <p class="text-sm font-semibold mb-2">House Class</p>
      <UiDonut :labels="['A', 'B', 'C', 'D'].map((c) => CLASS_LABEL[c])" :values="['A', 'B', 'C', 'D'].map((c) => fp!.byClass[c])" :colors="['A', 'B', 'C', 'D'].map((c) => CLASS_COLORS[c])" :height="200" />
      <p class="text-sm font-semibold mt-6 mb-2">Footprint per Kelurahan</p>
      <UiBarChart :labels="fp.byKel.map((x) => x[0])" :values="fp.byKel.map((x) => x[1])" colors="#3672F9" :height="240" horizontal />
      <p class="text-sm font-semibold mt-6 mb-2">Jenis Bangunan</p>
      <div class="border rounded-xxs divide-y text-xs">
        <div v-for="(v, k) in fp.byType" :key="k" class="flex justify-between p-2">
          <span>{{ TYPE_LABEL[k] || k }}</span><span class="font-medium">{{ fmt(v) }}</span>
        </div>
      </div>
    </template>
  </UiSidePanel>
</template>
