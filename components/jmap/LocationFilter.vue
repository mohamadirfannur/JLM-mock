<script setup lang="ts">
import * as turf from "@turf/turf";
import type { AreaSel } from "~/stores/area";
const props = defineProps<{ open: boolean; context?: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "apply", a: AreaSel[], all: boolean): void; (e: "preview", a: AreaSel[]): void; (e: "draw"): void; (e: "coord"): void }>();
const geo = useGeoData();
const area = useAreaStore();
const prov = ref("Jawa Barat");
const kota = ref("Kota Bandung");
const kec = ref("");
const rw = ref("");
const picked = ref<AreaSel[]>([]);
const all = ref(false);
const err = ref("");
watch(
  () => props.open,
  (o) => {
    if (o) {
      picked.value = [...area.areas];
      all.value = area.showAll;
    }
  },
  { immediate: true },
);
const kelOf = (f: any) => {
  const c = turf.centroid(f).geometry.coordinates;
  return (geo.data.kelurahan?.features || []).find((k: any) => turf.booleanPointInPolygon(c, k))?.properties;
};
const rwOptions = computed(() =>
  (geo.loaded.value ? geo.data.aoi?.features || [] : [])
    .map((f: any) => ({ f, kel: kelOf(f) }))
    .filter((x: any) => !kec.value || x.kel?.kecamatan === kec.value)
    .map((x: any) => ({ id: x.f.properties.id, name: x.f.properties.name.replace(" – ", " · "), feature: x.f, sub: x.kel?.name })),
);
const kelOptions = computed(() => (geo.loaded.value ? geo.data.kelurahan?.features || [] : []).filter((k: any) => !kec.value || k.properties.kecamatan === kec.value));
function add(id: string) {
  const o = rwOptions.value.find((x: any) => x.id === id);
  if (o && !picked.value.some((p) => p.id === o.id)) picked.value.push({ id: o.id, name: o.name, level: "RW / Cluster", feature: { type: "Feature", properties: {}, geometry: o.feature.geometry } });
  rw.value = "";
}
function addKel(name: string) {
  const k = (geo.data.kelurahan?.features || []).find((x: any) => x.properties.name === name);
  if (k && !picked.value.some((p) => p.id === "kel-" + name)) picked.value.push({ id: "kel-" + name, name: `Kel. ${name}`, level: "Kelurahan", feature: { type: "Feature", properties: {}, geometry: k.geometry } });
}
const kelPick = ref("");
watch(kelPick, (v) => v && (addKel(v), (kelPick.value = "")));
watch(rw, (v) => v && add(v));
async function onFile(e: Event) {
  err.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const poly = firstPolygon(await parseGeoFile(file));
    if (!poly) throw new Error("File tidak berisi polygon batas area");
    picked.value.push({ id: uid("imp"), name: poly.properties?.name || file.name.replace(/\.[^.]+$/, ""), level: "Custom", feature: { type: "Feature", properties: {}, geometry: poly.geometry } });
  } catch (x: any) {
    err.value = x.message;
  }
}
function addCustom(f: any, name: string) {
  picked.value.push({ id: uid("cus"), name, level: "Custom", feature: f });
}
defineExpose({ addCustom });
function reset() {
  kec.value = "";
  rw.value = "";
  picked.value = [];
  all.value = false;
}
</script>

<template>
  <div v-show="open" class="fixed inset-0 z-[60] bg-[#10201D]/30 backdrop-blur-[1px] flex items-center justify-center">
    <div class="bg-white rounded-[16px] w-[600px] max-h-[92vh] flex flex-col shadow-[0_20px_60px_rgba(16,32,29,0.2)] fade-up">
      <div class="flex items-start justify-between px-6 pt-6 pb-4 border-b border-j-line">
        <div><h3 class="j-title text-[22px]">Filter Lokasi</h3><p class="text-[13px] text-j-sub">{{ context || "Pilih area RW/Cluster untuk menjalankan peta jaringan" }}</p></div>
        <button class="w-8 h-8 rounded-[8px] border border-j-line bg-j-bg flex items-center justify-center" @click="$emit('close')"><UIcon name="i-lucide-x" class="w-4 h-4" /></button>
      </div>
      <div class="px-6 py-5 overflow-y-auto thin-scrollbar space-y-5">
        <div>
          <p class="j-label text-j-sub mb-3">Area / Wilayah</p>
          <div class="grid grid-cols-2 gap-x-3 gap-y-3">
            <div><label class="j-field-label !text-[13px] !text-j-ink">Provinsi</label><select v-model="prov" class="j-select h-10 bg-j-soft border-transparent"><option>Jawa Barat</option></select></div>
            <div><label class="j-field-label !text-[13px] !text-j-ink">Kota / Kabupaten</label><select v-model="kota" class="j-select h-10 bg-j-soft border-transparent"><option>Kota Bandung</option></select></div>
            <div><label class="j-field-label !text-[13px] !text-j-ink">Kecamatan</label><select v-model="kec" class="j-select h-10 bg-j-soft border-transparent"><option value="">Semua Kecamatan</option><option>Gedebage</option><option>Rancasari</option></select></div>
            <div>
              <label class="j-field-label !text-[13px] !text-j-ink">RW / Cluster <span class="j-tag-blue !h-4 !text-[10px] ml-1">Utama</span></label>
              <select v-model="rw" class="j-select h-10 bg-j-soft border-transparent"><option value="">Pilih RW/Cluster</option><option v-for="o in rwOptions" :key="o.id" :value="o.id">{{ o.name }}</option></select>
            </div>
            <div class="col-span-2"><label class="j-field-label !text-[13px] !text-j-ink">atau Kelurahan</label><select v-model="kelPick" class="j-select h-10 bg-j-soft border-transparent"><option value="">Pilih Kelurahan</option><option v-for="k in kelOptions" :key="k.properties.name" :value="k.properties.name">{{ k.properties.name }} · Kec. {{ k.properties.kecamatan }}</option></select></div>
          </div>
        </div>
        <div>
          <p class="j-label text-j-sub mb-2">Area Terpilih</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="(p, i) in picked" :key="p.id" class="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-j-blue/50 bg-j-blue/[0.05] text-[12px] text-j-blue">
              <span class="w-1.5 h-1.5 rounded-full bg-j-blue" />{{ p.name }}<button @click="picked.splice(i, 1)"><UIcon name="i-lucide-x" class="w-3 h-3" /></button>
            </span>
            <span class="inline-flex items-center h-7 px-3 rounded-full bg-j-bg text-[12px] text-j-sub">+ Pilih dari daftar di atas</span>
          </div>
          <p class="text-[12px] text-j-sub mt-2">{{ picked.length }} area dipilih</p>
        </div>
        <div class="border-t border-j-line pt-4">
          <p class="j-label text-j-sub mb-3">Definisi Area Alternatif</p>
          <div class="grid grid-cols-3 gap-2">
            <label class="flex items-center gap-3 p-3 rounded-[10px] bg-j-soft cursor-pointer hover:ring-1 hover:ring-j-cyan">
              <span class="w-8 h-8 rounded-[8px] bg-j-blue/10 text-j-blue flex items-center justify-center"><UIcon name="i-lucide-arrow-up" class="w-4 h-4" /></span>
              <span><p class="font-display font-bold text-[13px]">Import KML/KMZ</p><p class="text-[11px] text-j-sub">Unggah batas area</p></span>
              <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip" @change="onFile" />
            </label>
            <button class="flex items-center gap-3 p-3 rounded-[10px] bg-j-soft text-left hover:ring-1 hover:ring-j-cyan" @click="$emit('draw')">
              <span class="w-8 h-8 rounded-[8px] bg-j-blue/10 text-j-blue flex items-center justify-center"><UIcon name="i-lucide-hexagon" class="w-4 h-4" /></span>
              <span><p class="font-display font-bold text-[13px]">Gambar Poligon</p><p class="text-[11px] text-j-sub">Tandai batas manual</p></span>
            </button>
            <button class="flex items-center gap-3 p-3 rounded-[10px] bg-j-soft text-left hover:ring-1 hover:ring-j-cyan" @click="$emit('coord')">
              <span class="w-8 h-8 rounded-[8px] bg-j-blue/10 text-j-blue flex items-center justify-center"><UIcon name="i-lucide-circle-dot" class="w-4 h-4" /></span>
              <span><p class="font-display font-bold text-[13px]">Cari Koordinat</p><p class="text-[11px] text-j-sub">Lat / Long input</p></span>
            </button>
          </div>
          <p v-if="err" class="text-[12px] text-j-red mt-2">{{ err }}</p>
          <label class="flex items-center gap-2 mt-4 text-[13px] text-j-ink cursor-pointer"><input v-model="all" type="checkbox" class="accent-[#00D4FF] w-4 h-4" /> Tampilkan semua data (tanpa filter)</label>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 px-6 py-5 border-t border-j-line">
        <button class="j-btn h-11 bg-j-soft text-j-ink" @click="reset">Reset Filter</button>
        <button class="j-btn h-11 border border-j-cyan text-j-cyan bg-white" :disabled="!picked.length" @click="$emit('preview', picked)">Pratinjau Area</button>
        <button class="j-btn-primary h-11" :disabled="!picked.length && !all" @click="$emit('apply', picked, all)">Terapkan Data</button>
      </div>
    </div>
  </div>
</template>
