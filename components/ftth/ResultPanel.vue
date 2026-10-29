<script setup lang="ts">
import { CABLE_COLORS } from "~/utils/jlmSites";
import type { FtthResult } from "~/utils/ftthEngine";

const props = defineProps<{ projectId: string | null; layerVis: Record<string, boolean> }>();
const emit = defineEmits<{ (e: "close"): void; (e: "toggleLayer", k: string): void; (e: "export", kind: string): void; (e: "send"): void; (e: "penetration", v: number): void; (e: "zoom"): void }>();
const ftth = useFtthStore();
const p = computed(() => (props.projectId ? ftth.byId(props.projectId) : null));
const r = computed<FtthResult | null>(() => (props.projectId ? ftth.results[props.projectId] || null : null));
const s = computed(() => r.value?.summary);
const tab = ref<"summary" | "boq" | "export">("summary");
const boqCat = ref<"all" | "Material (BOM)" | "Jasa (BOQ)">("all");

const LAYERS = [
  { k: "boundary", l: "Batas AOI", c: "#22D3EE" },
  { k: "homes", l: "Homepass", c: "#00D075" },
  { k: "drops", l: "Kabel Drop", c: "#06B6D4" },
  { k: "cables", l: "Kabel Feeder & Distribusi", c: "#F97316" },
  { k: "poles", l: "Tiang", c: "#949495" },
  { k: "odp", l: "ODP", c: "#3672F9" },
  { k: "odc", l: "ODC", c: "#7C3AED" },
  { k: "olt", l: "OLT / POP", c: "#C0353E" },
  { k: "jc", l: "Joint Closure", c: "#F59E0B" },
  { k: "coils", l: "Coil / Slack", c: "#FDE68A" },
];
const count = (k: string) => r.value?.layers[k]?.features.length ?? 0;
const checks = computed(() => {
  if (!s.value || !r.value) return [];
  const pr = r.value.params;
  const maxUsed = Math.max(...r.value.layers.odp.features.map((f: any) => f.properties.used));
  const odcOk = r.value.layers.odc.features.every((f: any) => f.properties.odpCount <= f.properties.capacity);
  return [
    { ok: s.value.maxDrop <= pr.odpMaxDist, l: `Jarak ODP → rumah ≤ ${pr.odpMaxDist} m`, v: `max ${s.value.maxDrop} m` },
    { ok: maxUsed <= pr.odpCapacity, l: `Kapasitas ODP ≤ ${pr.odpCapacity} rumah`, v: `max ${maxUsed}` },
    { ok: true, l: `Jarak antar tiang ≤ ${pr.poleSpacing} m`, v: `${s.value.poles} tiang` },
    { ok: odcOk, l: "ODC 24C ≤ 16 ODP · 48C ≤ 36 ODP", v: `${s.value.odc24}×24C, ${s.value.odc48}×48C` },
    { ok: true, l: `Coil ${pr.coilFeeder}/${pr.coilBackbone} m, JC ${fmt(pr.jcInterval)} m`, v: `${s.value.coils} coil · ${s.value.jc} JC` },
  ];
});
const groups = computed(() => (r.value?.boq || []).filter((g) => boqCat.value === "all" || g.category === boqCat.value));
const total = computed(() => groups.value.reduce((a, g) => a + g.total, 0));
const capexPlan = computed(() => (r.value?.boq || []).reduce((a, g) => a + g.items.reduce((b, i) => b + i.qtyPlan * i.price, 0), 0));
const statusColor: Record<string, string> = { Draft: "bg-j-soft text-j-ink", Designed: "bg-j-cyan/10 text-j-blue", "Sent to Asset": "bg-green-100 text-green-700", "As-built": "bg-purple-100 text-purple-700" };
</script>

<template>
  <UiSidePanel title="Hasil Desain FTTH" :subtitle="p ? p.name : 'FTTH network design'" @close="$emit('close')">
    <template #actions>
      <UButton v-if="p" size="2xs" color="gray" variant="ghost" icon="i-heroicons-magnifying-glass-plus" title="Zoom ke project" @click="$emit('zoom')" />
    </template>
    <div v-if="!p || !r || !s" class="py-16 text-center">
      <div class="w-16 h-16 mx-auto bg-j-bg rounded-full flex items-center justify-center mb-3"><UIcon name="i-heroicons-signal" class="w-8 h-8 text-j-sub" /></div>
      <p class="text-sm text-j-ink">Belum ada project aktif</p>
      <p class="text-xs text-j-sub mt-1">Buka <b>Project</b> → <b>Add To Map</b>, atau buat <b>New Project</b>.</p>
    </div>
    <div v-else class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[11px] px-2 py-1 rounded-xxs font-medium" :class="statusColor[p.status]">{{ ({ Draft: "Diproses", Designed: "Desain", "Sent to Asset": "Di inventaris", "As-built": "As-built" } as Record<string, string>)[p.status] }}</span>
        <span class="text-[11px] text-j-sub">{{ p.source }} · OLT: {{ p.oltLabel }}</span>
      </div>
      <div class="flex gap-2 border-b border-j-line">
        <button v-for="t in [{ k: 'summary', l: 'Network Summary' }, { k: 'boq', l: 'BOQ / BOM' }, { k: 'export', l: 'Export' }]" :key="t.k" class="px-3 py-2 text-xs font-medium relative" :class="tab === t.k ? 'text-j-cyan' : 'text-j-sub hover:text-j-ink'" @click="tab = t.k as any">
          {{ t.l }}<div v-if="tab === t.k" class="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
        </button>
      </div>

      <!-- SUMMARY -->
      <template v-if="tab === 'summary'">
        <div class="flex items-center gap-2 bg-j-bg rounded-xxs p-2">
          <span class="text-[11px] text-j-sub flex-1">Skenario build (plan 100%)</span>
          <button v-for="v in [30, 50, 100]" :key="v" class="px-2.5 py-1 rounded-xxs text-[11px] font-medium" :class="r.params.penetration === v ? 'bg-j-bg0 text-white' : 'bg-white text-j-ink'" @click="$emit('penetration', v)">{{ v }}%</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <UiStat label="Total Homes (Homepass)" :value="fmt(s.homes)" />
          <UiStat :label="`Build ${s.penetration}% (ONT)`" :value="fmt(s.buildHomes)" />
          <UiStat label="Total ODC" :value="fmt(s.odc)" />
          <UiStat label="Total ODP" :value="fmt(s.odp)" />
          <UiStat label="OLT · PON Port" :value="`${s.olt} · ${s.ponPorts}`" />
          <UiStat label="Total Pole" :value="fmt(s.poles)" />
        </div>
        <UiStat label="Total Cable Length (feeder + distribusi)" :value="fmt(s.cableTotal / 1000, 2)" unit="km" />
        <div class="grid grid-cols-2 gap-2">
          <UiStat label="Kabel Drop (plan)" :value="fmt(s.dropLen / 1000, 2)" unit="km" tone="white" />
          <UiStat label="Utilisasi ODP" :value="s.avgOdpUtil + '%'" tone="white" />
        </div>
        <div class="space-y-1">
          <p class="text-[11px] uppercase text-j-sub font-semibold pt-1">Cable Detail</p>
          <div v-for="(len, k) in s.cableByCore" :key="k" class="bg-j-bg rounded-xxs px-3 py-2 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-3 h-1 rounded-full" :style="{ background: CABLE_COLORS[String(k).replace(/ \d+C$/, '')] }" />
              <p class="text-[11px] font-semibold text-j-ink">{{ k }}</p>
            </div>
            <p class="text-xs font-bold text-j-ink">{{ fmt((len as number) / 1000, 2) }} <span class="text-[10px] text-j-sub font-normal">km</span></p>
          </div>
          <div v-if="s.undergroundLen" class="text-[11px] text-j-sub px-1">Termasuk underground (HDPE) {{ fmt(s.undergroundLen) }} m di jalan utama</div>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] uppercase text-j-sub font-semibold pt-1">Tiang per tipe</p>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="t in ['T7 1-Stage', 'T7 2-Stage', 'T9 2-Stage']" :key="t" class="border rounded-xxs p-2 text-center">
              <p class="text-sm font-bold text-j-cyan">{{ fmt(s.poleBy[t] || 0) }}</p>
              <p class="text-[10px] text-j-sub">{{ t }}</p>
            </div>
          </div>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] uppercase text-j-sub font-semibold pt-1">Validasi Standar JLM</p>
          <div v-for="c in checks" :key="c.l" class="flex items-center gap-2 text-xs p-1.5">
            <UIcon :name="c.ok ? 'i-heroicons-check-circle-solid' : 'i-heroicons-exclamation-triangle-solid'" class="w-4 h-4 shrink-0" :class="c.ok ? 'text-green-600' : 'text-orange-500'" />
            <span class="flex-1">{{ c.l }}</span><span class="text-j-sub">{{ c.v }}</span>
          </div>
        </div>
        <div>
          <p class="text-sm font-semibold text-j-ink py-1">Layers</p>
          <div v-for="L in LAYERS" :key="L.k" class="flex items-center justify-between p-1.5 rounded-xxs hover:bg-j-bg">
            <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-sm" :style="{ background: L.c }" /><span class="text-xs text-j-ink">{{ L.l }}</span><span class="text-[10px] text-j-sub">{{ fmt(count(L.k)) }}</span></div>
            <UToggle :model-value="layerVis[L.k] !== false" size="xs" @update:model-value="$emit('toggleLayer', L.k)" />
          </div>
        </div>
      </template>

      <!-- BOQ -->
      <template v-if="tab === 'boq'">
        <div class="bg-j-bg rounded-xs p-3">
          <p class="text-xs text-j-sub">Total Estimated Project Cost (build {{ r.params.penetration }}%)</p>
          <p class="text-lg font-semibold text-j-ink">{{ idr(r.totalCost) }}</p>
          <div class="grid grid-cols-2 gap-2 mt-2 text-[11px] text-j-sub">
            <span>Cost / homepass: <b class="text-j-ink">{{ idr(r.totalCost / Math.max(s.homes, 1)) }}</b></span>
            <span>Capex plan 100%: <b class="text-j-ink">{{ idrShort(capexPlan) }}</b></span>
          </div>
        </div>
        <div class="flex gap-1">
          <button v-for="c in ['all', 'Material (BOM)', 'Jasa (BOQ)']" :key="c" class="px-2.5 py-1 rounded-xxs text-[11px]" :class="boqCat === c ? 'bg-j-bg0 text-white' : 'bg-j-bg text-j-ink'" @click="boqCat = c as any">{{ c === "all" ? "Semua" : c }}</button>
        </div>
        <p class="text-sm font-semibold text-j-ink">Estimated BOQ / BOM <span class="text-xs font-normal text-j-sub">· {{ idr(total) }}</span></p>
        <div v-for="g in groups" :key="g.group" class="border border-j-line rounded-xs overflow-hidden">
          <div class="px-3 py-2 bg-j-bg flex items-center justify-between">
            <p class="text-xs font-semibold text-j-ink">{{ g.group }} <span class="text-[10px] text-j-sub font-normal">· {{ g.category }}</span></p>
            <p class="text-[11px] text-j-ink">{{ idr(g.total) }}</p>
          </div>
          <div class="grid grid-cols-[1.7fr_0.7fr_0.7fr_1fr_1.1fr] bg-j-soft text-[10px] font-semibold text-j-ink">
            <div class="px-2 py-1.5">Item</div><div class="px-1 py-1.5 text-center">Qty Plan</div><div class="px-1 py-1.5 text-center">Qty Build</div><div class="px-1 py-1.5 text-right">Unit Cost</div><div class="px-2 py-1.5 text-right">Total</div>
          </div>
          <div v-for="it in g.items" :key="it.code" class="grid grid-cols-[1.7fr_0.7fr_0.7fr_1fr_1.1fr] text-[10px] border-t border-j-line">
            <div class="px-2 py-1.5 text-j-ink">{{ it.item }}</div>
            <div class="px-1 py-1.5 text-center text-j-sub">{{ fmt(it.qtyPlan) }}</div>
            <div class="px-1 py-1.5 text-center">{{ fmt(it.qty) }} {{ it.unit }}</div>
            <div class="px-1 py-1.5 text-right text-j-sub">{{ fmt(it.price) }}</div>
            <div class="px-2 py-1.5 text-right font-medium">{{ fmt(it.total) }}</div>
          </div>
        </div>
        <p class="text-[10px] text-j-sub">Harga satuan dummy — akan diganti dengan price list & format BOQ procurement JLM.</p>
      </template>

      <!-- EXPORT -->
      <template v-if="tab === 'export'">
        <p class="text-xs text-j-sub">Format sesuai kebutuhan JLM (kuesioner 3.9): KML, DWG, PDF & Excel.</p>
        <div class="grid grid-cols-2 gap-2">
          <button v-for="e in [
            { k: 'kml', l: 'KML', d: 'Google Earth / tim survei', i: 'i-heroicons-globe-asia-australia' },
            { k: 'dxf', l: 'DWG / DXF', d: 'AutoCAD (layer per aset)', i: 'i-heroicons-cube' },
            { k: 'pdf', l: 'PDF Report', d: 'Ringkasan + BOQ', i: 'i-heroicons-document-text' },
            { k: 'xlsx', l: 'Excel BOQ / BOM', d: 'BOQ, BOM, daftar aset', i: 'i-heroicons-table-cells' },
            { k: 'geojson', l: 'GeoJSON', d: 'GIS / integrasi', i: 'i-heroicons-code-bracket' },
            { k: 'csv', l: 'CSV Homepass', d: 'Daftar rumah per ODP', i: 'i-heroicons-home' },
          ]" :key="e.k" class="border rounded-xs p-3 text-left hover:border-blue-500 hover:bg-blue-50" @click="$emit('export', e.k)">
            <UIcon :name="e.i" class="w-5 h-5 text-j-cyan" />
            <p class="text-sm font-semibold mt-1">{{ e.l }}</p>
            <p class="text-[10px] text-j-sub">{{ e.d }}</p>
          </button>
        </div>
      </template>
    </div>
    <template v-if="p && r" #footer>
      <UButton block :color="p.status === 'Sent to Asset' ? 'gray' : 'green'" icon="i-heroicons-server-stack" class="justify-center" @click="$emit('send')">
        {{ p.status === "Sent to Asset" ? "Kirim ulang ke inventaris aset" : "Kirim ke inventaris aset" }}
      </UButton>
    </template>
  </UiSidePanel>
</template>
