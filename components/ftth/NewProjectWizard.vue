<script setup lang="ts">
import * as turf from "@turf/turf";
import { DEFAULT_PARAMS, type FtthParams } from "~/utils/ftthEngine";
import { JLM_POPS, nearestPop } from "~/utils/jlmSites";

const props = defineProps<{ visible: boolean; drawnAoi: any | null; pickedOlt: [number, number] | null; preset?: { name: string; feature: any; homes: number } | null }>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "requestDraw"): void;
  (e: "requestOlt"): void;
  (e: "preview", f: any): void;
  (e: "generate", payload: any): void;
}>();

const geo = useGeoData();
const steps = [
  { n: 1, label: "Project Info" },
  { n: 2, label: "Select Area" },
  { n: 3, label: "Analysis" },
  { n: 4, label: "Start Point" },
  { n: 5, label: "Generate" },
];
const step = ref(1);
const name = ref("");
const description = ref("");
const kecamatan = ref("Gedebage");
const areaCode = ref("GDB");
const aoi = ref<any>(null);
const aoiSource = ref("");
const uploadName = ref("");
const uploadErr = ref("");
const params = reactive<FtthParams>({ ...DEFAULT_PARAMS });
const oltMode = ref<"site" | "input" | "auto">("site");
const sitePop = ref(JLM_POPS[0].code);
const analyzing = ref(false);
const showParams = ref(true);

watch(
  () => props.preset,
  (p) => {
    if (!p) return;
    name.value = p.name;
    aoi.value = p.feature;
    aoiSource.value = "Market Potential";
    description.value = "Dikirim dari Market Potential Analysis";
  },
  { immediate: true },
);
watch(
  () => props.drawnAoi,
  (f) => {
    if (f) {
      aoi.value = f;
      aoiSource.value = "Digambar di peta";
      uploadName.value = "";
    }
  },
);
watch(aoi, (f) => {
  if (!f) return;
  emit("preview", f);
  const c = turf.centroid(f).geometry.coordinates as [number, number];
  sitePop.value = nearestPop(c).code;
  const kel = (geo.data.kelurahan?.features || []).find((k: any) => turf.booleanPointInPolygon(c, k));
  if (kel) {
    kecamatan.value = kel.properties.kecamatan;
    const n = kel.properties.name.toUpperCase().replace(/[^A-Z]/g, "");
    areaCode.value = (n[0] + n.slice(1).replace(/[AEIOU]/g, "")).slice(0, 3);
  }
});

const samples = computed(() => geo.data.aoi?.features || []);
function useSample(f: any) {
  aoi.value = { type: "Feature", properties: {}, geometry: f.geometry };
  aoiSource.value = "Sample AOI";
  if (!name.value) name.value = f.properties.name;
}
async function onFile(e: Event) {
  uploadErr.value = "";
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const poly = firstPolygon(await parseGeoFile(file));
    if (!poly) throw new Error("Tidak ada polygon di file");
    aoi.value = { type: "Feature", properties: {}, geometry: poly.geometry };
    aoiSource.value = "Upload " + file.name.split(".").pop()!.toUpperCase();
    uploadName.value = file.name;
    if (!name.value) name.value = poly.properties?.name || file.name.replace(/\.[^.]+$/, "");
  } catch (err: any) {
    uploadErr.value = err.message;
  }
}

// step 3 quick analysis (bottom-up estimate before full generate)
const quick = computed(() => {
  if (!aoi.value || !geo.loaded.value) return null;
  const b = geo.buildingsIn(aoi.value).filter((x) => x.properties.t === "res" || (params.includeCommercial && x.properties.t === "com"));
  const homes = b.length;
  const odp = Math.ceil((homes / params.odpCapacity) * 1.06);
  const odc48 = Math.floor(odp / 36);
  const rest = odp - odc48 * 36;
  const odc = odc48 + (rest > 0 ? 1 : 0);
  const lines = Array.from({ length: odc }, (_, i) => {
    const n = i < odc48 ? 36 : rest;
    const type = params.odcType === "auto" ? (n <= 16 ? "24C" : "48C") : params.odcType;
    return { line: i + 1, odp: n, odc: type, cable: type === "24C" ? "Sub Feeder 24C" : "Feeder 48C" };
  });
  return { homes, odp, odc, lines, area: turf.area(aoi.value), build: Math.ceil((homes * params.penetration) / 100) };
});
watch(step, async (s) => {
  if (s === 3) {
    analyzing.value = true;
    await new Promise((r) => setTimeout(r, 900));
    analyzing.value = false;
  }
});

const oltCoord = computed<[number, number] | null>(() => {
  if (oltMode.value === "site") return JLM_POPS.find((p) => p.code === sitePop.value)!.coord;
  if (oltMode.value === "input") return props.pickedOlt;
  return null;
});
const oltLabel = computed(() => (oltMode.value === "site" ? JLM_POPS.find((p) => p.code === sitePop.value)!.name : oltMode.value === "input" ? "Titik dipilih di peta" : "Auto (bottom-up)"));
const canNext = computed(() => {
  if (step.value === 1) return name.value.trim().length > 2;
  if (step.value === 2) return !!aoi.value;
  if (step.value === 3) return !!quick.value && quick.value.homes > 0 && !analyzing.value;
  if (step.value === 4) return oltMode.value !== "input" || !!props.pickedOlt;
  return true;
});

function reset() {
  step.value = 1;
  name.value = "";
  description.value = "";
  aoi.value = null;
  aoiSource.value = "";
  uploadName.value = "";
  Object.assign(params, DEFAULT_PARAMS);
  oltMode.value = "site";
}
function generate() {
  params.areaCode = areaCode.value.toUpperCase();
  emit("generate", {
    name: name.value.trim(),
    description: description.value,
    kecamatan: kecamatan.value,
    kelurahan: "",
    aoi: aoi.value,
    params: { ...params },
    oltMode: oltMode.value,
    olt: oltCoord.value,
    oltLabel: oltLabel.value,
    homes: quick.value?.homes || 0,
    source: aoiSource.value,
  });
  reset();
}
defineExpose({ reset });
const title = computed(() => ["Create New Project", "Select Area of Interest", "Network Analysis", "Select Start Point (OLT)", "Generate FTTH Network"][step.value - 1]);
</script>

<template>
  <div v-show="visible" class="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
    <div class="bg-white rounded-lg w-full max-w-xl shadow-2xl max-h-[92vh] flex flex-col fade-up">
      <div class="flex items-center justify-between p-4 border-b">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5 text-brand-500" />
          <h2 class="text-lg font-semibold text-grey-900">{{ title }}</h2>
        </div>
        <button class="text-grey-400 hover:text-grey-600" @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-5 h-5" /></button>
      </div>
      <div class="px-6 py-4">
        <div class="flex items-center justify-center">
          <template v-for="(s, i) in steps" :key="s.n">
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" :class="step === s.n ? 'bg-brand-500 text-white' : step > s.n ? 'bg-green-500 text-white' : 'bg-grey-200 text-grey-500'">
                <UIcon v-if="step > s.n" name="i-heroicons-check" class="w-4 h-4" /><template v-else>{{ s.n }}</template>
              </div>
              <span v-if="step === s.n" class="ml-2 text-sm text-brand-500 font-medium whitespace-nowrap">{{ s.label }}</span>
            </div>
            <div v-if="i < steps.length - 1" class="w-8 h-0.5 mx-2" :class="step > s.n ? 'bg-green-500' : 'bg-grey-200'" />
          </template>
        </div>
      </div>

      <div class="px-6 pb-6 overflow-y-auto thin-scrollbar flex-1">
        <!-- 1 -->
        <div v-if="step === 1" class="space-y-4">
          <UFormGroup label="Project Name" required><UInput v-model="name" placeholder="mis. Cluster Genova Summarecon / RW 05 Cisaranten Kidul" /></UFormGroup>
          <UFormGroup label="Description (Optional)"><UTextarea v-model="description" :rows="3" placeholder="Enter description..." /></UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Kecamatan"><USelect v-model="kecamatan" :options="['Gedebage', 'Rancasari', 'Panyileukan']" /></UFormGroup>
            <UFormGroup label="Kode Area (penomoran aset)" help="Dipakai untuk kode ODP/ODC/Tiang"><UInput v-model="areaCode" maxlength="4" class="uppercase" /></UFormGroup>
          </div>
          <div class="bg-blue-50 border border-blue-100 rounded-xxs p-3 text-xs text-blue-700">
            Contoh kode otomatis: <b>ODP-{{ areaCode.toUpperCase() }}-A01</b>, <b>ODC-{{ areaCode.toUpperCase() }}-A</b>, <b>TP-{{ areaCode.toUpperCase() }}-0001</b>, kabel <b>BDG-F4590.48 (Feed {{ (name || "NAMA PROJECT").toUpperCase() }}_350M)</b>
          </div>
        </div>

        <!-- 2 -->
        <div v-if="step === 2" class="space-y-4">
          <div v-if="aoi" class="bg-green-50 border border-green-200 rounded-xs p-3 flex items-center justify-between">
            <div class="flex items-center gap-2 text-sm text-green-700">
              <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
              <span>Geometry ready — {{ aoiSource }} · {{ area(turf.area(aoi)) }}</span>
            </div>
            <button class="text-xs text-red-600" @click="aoi = null">Clear</button>
          </div>
          <label class="block border-2 border-dashed border-grey-300 hover:border-grey-400 rounded-lg p-6 text-center cursor-pointer">
            <UIcon name="i-heroicons-cloud-arrow-up" class="w-10 h-10 text-brand-500 mx-auto mb-2" />
            <p class="text-sm font-medium text-grey-900">{{ uploadName || "Upload AOI File" }}</p>
            <p class="text-xs text-grey-500 mt-1">Drag & drop or click to upload</p>
            <p class="text-xs text-grey-400">KML, KMZ, GeoJSON, SHP (.zip) — batas RW / cluster</p>
            <input type="file" class="hidden" accept=".kml,.kmz,.geojson,.json,.zip" @change="onFile" />
          </label>
          <p v-if="uploadErr" class="text-xs text-red-500">{{ uploadErr }}</p>
          <div class="flex items-center gap-4"><div class="flex-1 border-t" /><span class="text-sm text-grey-400">OR</span><div class="flex-1 border-t" /></div>
          <UButton block variant="soft" icon="i-heroicons-pencil-square" @click="$emit('requestDraw')">{{ aoiSource === "Digambar di peta" ? "Edit Drawing on Map" : "Draw on Map" }}</UButton>
          <div>
            <p class="text-xs font-medium text-grey-700 mb-2">Atau pilih batas RW / cluster contoh:</p>
            <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto thin-scrollbar">
              <button v-for="s in samples" :key="s.properties.id" class="text-left text-[11px] p-2 border rounded-xxs hover:border-blue-500" @click="useSample(s)">
                <p class="font-medium truncate">{{ s.properties.name }}</p>
                <p class="text-grey-500">± {{ fmt(s.properties.homes) }} rumah</p>
              </button>
            </div>
          </div>
        </div>

        <!-- 3 -->
        <div v-if="step === 3" class="space-y-4">
          <div v-if="analyzing" class="text-center py-8">
            <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-brand-500 mx-auto mb-3 animate-spin" />
            <p class="text-sm font-medium text-grey-700">Analyzing area...</p>
            <p class="text-xs text-grey-500 mt-1">Menghitung footprint rumah di dalam AOI</p>
          </div>
          <template v-else-if="quick">
            <div class="bg-green-50 border border-green-200 rounded-xxs p-4">
              <div class="flex items-center gap-2 mb-3"><UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-600" /><span class="text-sm font-medium text-green-700">Area Analysis Complete</span></div>
              <div class="grid grid-cols-4 gap-3 text-center">
                <div><p class="text-2xl font-bold text-green-600">{{ fmt(quick.homes) }}</p><p class="text-[11px] text-grey-600">Total Footprint</p></div>
                <div><p class="text-2xl font-bold text-green-600">± {{ quick.odp }}</p><p class="text-[11px] text-grey-600">ODP Needed</p></div>
                <div><p class="text-2xl font-bold text-green-600">{{ quick.odc }}</p><p class="text-[11px] text-grey-600">ODC Needed</p></div>
                <div><p class="text-2xl font-bold text-green-600">{{ quick.lines.length }}</p><p class="text-[11px] text-grey-600">Total Lines</p></div>
              </div>
            </div>
            <div v-if="quick.lines.length" class="space-y-2">
              <p class="text-sm font-medium text-grey-700">Cable Requirements</p>
              <div class="border rounded-xxs divide-y">
                <div v-for="l in quick.lines" :key="l.line" class="p-2.5 flex justify-between items-center text-sm">
                  <span class="text-grey-600">Line {{ l.line }}</span>
                  <div class="flex items-center gap-3">
                    <span class="text-grey-500 text-xs">{{ l.odp }} ODP → ODC {{ l.odc }}</span>
                    <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{{ l.cable }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="border rounded-xs">
              <button class="w-full flex items-center justify-between p-3 text-sm font-medium" @click="showParams = !showParams">
                <span class="flex items-center gap-2"><UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4 text-brand-500" /> Design Parameters (standar JLM)</span>
                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" :class="showParams ? 'rotate-180' : ''" />
              </button>
              <div v-show="showParams" class="p-3 pt-0 grid grid-cols-2 gap-3">
                <UFormGroup label="Max jarak ODP → rumah (m)" size="xs" help="JLM: 250 m"><UInput v-model.number="params.odpMaxDist" type="number" size="xs" /></UFormGroup>
                <UFormGroup label="Kapasitas ODP (rumah)" size="xs" help="JLM: 16 rumah"><UInput v-model.number="params.odpCapacity" type="number" size="xs" /></UFormGroup>
                <UFormGroup label="Jarak antar tiang (m)" size="xs" help="JLM: max 60 m"><UInput v-model.number="params.poleSpacing" type="number" size="xs" /></UFormGroup>
                <UFormGroup label="Radius ODP → ODC (m)" size="xs" help="JLM: max 1000 m"><UInput v-model.number="params.odcMaxDist" type="number" size="xs" /></UFormGroup>
                <UFormGroup label="Tipe ODC" size="xs" help="24C=16 ODP · 48C=36 ODP">
                  <USelect v-model="params.odcType" size="xs" :options="[{ label: 'Auto (24C / 48C)', value: 'auto' }, { label: 'ODC 24C', value: '24C' }, { label: 'ODC 48C', value: '48C' }]" />
                </UFormGroup>
                <UFormGroup label="Penetrasi build awal" size="xs" help="Plan selalu 100%">
                  <USelect v-model.number="params.penetration" size="xs" :options="[30, 50, 100].map((v) => ({ label: v + '%', value: v }))" />
                </UFormGroup>
                <UFormGroup label="Metode instalasi" size="xs">
                  <USelect v-model="params.installation" size="xs" :options="[{ label: 'Kombinasi (feeder jalan utama underground)', value: 'mixed' }, { label: 'Aerial (tiang)', value: 'aerial' }]" />
                </UFormGroup>
                <UFormGroup label="Coil feeder / backbone (m)" size="xs" help="JLM: 350 / 500 m · JC 3.500 m">
                  <div class="flex gap-1"><UInput v-model.number="params.coilFeeder" type="number" size="xs" /><UInput v-model.number="params.coilBackbone" type="number" size="xs" /></div>
                </UFormGroup>
                <UCheckbox v-model="params.includeCommercial" label="Hitung ruko/komersial sebagai homepass" class="col-span-2 text-xs" />
              </div>
            </div>
          </template>
        </div>

        <!-- 4 -->
        <div v-if="step === 4" class="space-y-3">
          <p class="text-sm text-grey-500">Choose where the network starts. Leave the default to use the nearest JLM POP.</p>
          <div class="rounded-xxs border" :class="oltMode === 'site' ? 'bg-brand-50 border-brand-500' : 'border-grey-200'">
            <button class="w-full text-left px-3 py-2.5" @click="oltMode = 'site'">
              <div class="flex items-center gap-2"><UIcon name="i-heroicons-sparkles" class="w-4 h-4" :class="oltMode === 'site' ? 'text-brand-600' : 'text-grey-400'" /><span class="text-sm font-medium">Use Site (Default)</span></div>
              <p class="text-xs text-grey-500 mt-0.5 ml-6">Gunakan POP / OLT existing JLM terdekat.</p>
            </button>
            <div v-if="oltMode === 'site'" class="px-3 pb-3"><USelect v-model="sitePop" size="sm" :options="JLM_POPS.map((p) => ({ label: `${p.name} (${p.olt})`, value: p.code }))" /></div>
          </div>
          <div class="rounded-xxs border" :class="oltMode === 'input' ? 'bg-brand-50 border-brand-500' : 'border-grey-200'">
            <button class="w-full text-left px-3 py-2.5" @click="oltMode = 'input'">
              <div class="flex items-center gap-2"><UIcon name="i-heroicons-map-pin" class="w-4 h-4" :class="oltMode === 'input' ? 'text-brand-600' : 'text-grey-400'" /><span class="text-sm font-medium">Select on Map</span></div>
              <p class="text-xs text-grey-500 mt-0.5 ml-6">Tentukan titik OLT baru di peta.</p>
            </button>
            <div v-if="oltMode === 'input'" class="px-3 pb-3 space-y-2">
              <UButton block size="sm" variant="soft" icon="i-heroicons-pencil-square" @click="$emit('requestOlt')">{{ pickedOlt ? "Edit Point on Map" : "Pick Point on Map" }}</UButton>
              <div v-if="pickedOlt" class="bg-green-50 border border-green-200 rounded-xxs p-2 text-xs text-green-700">Point 1: {{ pickedOlt[1].toFixed(5) }}, {{ pickedOlt[0].toFixed(5) }}</div>
            </div>
          </div>
          <div class="rounded-xxs border" :class="oltMode === 'auto' ? 'bg-brand-50 border-brand-500' : 'border-grey-200'">
            <button class="w-full text-left px-3 py-2.5" @click="oltMode = 'auto'">
              <div class="flex items-center gap-2"><UIcon name="i-heroicons-cpu-chip" class="w-4 h-4" :class="oltMode === 'auto' ? 'text-brand-600' : 'text-grey-400'" /><span class="text-sm font-medium">Auto (Bottom-up)</span></div>
              <p class="text-xs text-grey-500 mt-0.5 ml-6">Sistem menentukan lokasi OLT berdasarkan sebaran rumah & ODC.</p>
            </button>
          </div>
        </div>

        <!-- 5 -->
        <div v-if="step === 5" class="space-y-4">
          <div class="bg-grey-100 border border-grey-200 rounded-xxs p-4">
            <div class="flex items-center gap-2"><UIcon name="i-heroicons-cpu-chip" class="w-5 h-5 text-brand-500" /><span class="text-sm font-medium">Ready to Generate</span></div>
            <p class="text-xs text-grey-600">Review the summary and start network generation.</p>
          </div>
          <div class="border rounded-xxs divide-y text-sm">
            <div v-for="row in [
              ['Project', name],
              ['Area', `${aoiSource} · ${quick ? area(quick.area) : '-'}`],
              ['Homepass (plan 100%)', fmt(quick?.homes)],
              [`Build awal (${params.penetration}%)`, fmt(quick?.build) + ' rumah'],
              ['ODC Needed', quick?.odc],
              ['Standar', `ODP ${params.odpCapacity} rmh / ${params.odpMaxDist} m · tiang ${params.poleSpacing} m`],
              ['Start Point', oltLabel],
            ]" :key="row[0]" class="p-3 flex justify-between gap-4"><span class="text-grey-500">{{ row[0] }}</span><span class="text-grey-800 font-medium text-right">{{ row[1] }}</span></div>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 p-4 border-t">
        <UButton v-if="step === 1" color="gray" variant="ghost" @click="$emit('close')">Cancel</UButton>
        <UButton v-else color="gray" variant="ghost" :disabled="analyzing" @click="step--">Back</UButton>
        <UButton v-if="step < 5" :disabled="!canNext" trailing-icon="i-heroicons-arrow-right" @click="step++">Next</UButton>
        <UButton v-else color="green" icon="i-heroicons-cpu-chip" @click="generate">Generate Network</UButton>
      </div>
    </div>
  </div>
</template>
