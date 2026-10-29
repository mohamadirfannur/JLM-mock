<script setup lang="ts">
import { DEFAULT_PARAMS, PRICE } from "~/utils/ftthEngine";
definePageMeta({ layout: "app" });
useHead({ title: "Pengaturan · JLM" });
const toast = useToast();
const tab = ref("standar");
const p = reactive({ ...DEFAULT_PARAMS });
try {
  const raw = localStorage.getItem("jlm-standards");
  if (raw) Object.assign(p, JSON.parse(raw));
} catch {}
function save() {
  try {
    localStorage.setItem("jlm-standards", JSON.stringify(p));
  } catch {}
  toast.add({ title: "Standar desain disimpan", description: "Dipakai sebagai default untuk desain FTTH baru.", icon: "i-lucide-check-circle-2" });
}
function resetAll() {
  if (!confirm("Kembalikan seluruh data (aset, desain FTTH, analisis, filter) ke kondisi awal?")) return;
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("jlm-") && k !== "jlm-auth").forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.href = "/dashboard";
}
const integrations = [
  { n: "Sistem Billing", d: "Sinkronisasi pelanggan aktif per ODP", s: "Belum terhubung" },
  { n: "NOC / Monitoring", d: "Status perangkat aktif (OLT, switch)", s: "Belum terhubung" },
  { n: "Spreadsheet aset", d: "Link spreadsheet inventaris tim Asset", s: "Terhubung" },
  { n: "Google Earth (KML)", d: "Ekspor untuk tim survei & instalasi", s: "Aktif" },
];
</script>
<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1100px] mx-auto px-6 py-6 space-y-5">
      <div><h1 class="j-title text-[24px]">Pengaturan</h1><p class="text-[14px] text-j-sub mt-1">Standar desain, harga satuan, integrasi, dan data</p></div>
      <div class="flex gap-2"><button v-for="t in [['standar', 'Standar Desain FTTH'], ['harga', 'Harga Satuan'], ['integrasi', 'Integrasi'], ['data', 'Data']]" :key="t[0]" class="j-chip" :class="tab === t[0] && 'j-chip-on'" @click="tab = t[0]">{{ t[1] }}</button></div>

      <div v-if="tab === 'standar'" class="j-card p-5">
        <h3 class="j-title text-[16px]">Standar Desain FTTH JLM</h3>
        <p class="text-[13px] text-j-sub">Sesuai hasil kuesioner onboarding · menjadi nilai default pada wizard desain.</p>
        <div class="grid grid-cols-3 gap-4 mt-4">
          <div><label class="j-field-label">Maks jarak ODP → rumah (m)</label><input v-model.number="p.odpMaxDist" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Kapasitas ODP (rumah)</label><input v-model.number="p.odpCapacity" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Jarak antar tiang (m)</label><input v-model.number="p.poleSpacing" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Radius ODP → ODC (m)</label><input v-model.number="p.odcMaxDist" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Coil feeder (m)</label><input v-model.number="p.coilFeeder" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Coil backbone (m)</label><input v-model.number="p.coilBackbone" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Interval Joint Closure (m)</label><input v-model.number="p.jcInterval" type="number" class="j-input" /></div>
          <div><label class="j-field-label">Penetrasi build awal</label><select v-model.number="p.penetration" class="j-select"><option :value="30">30%</option><option :value="50">50%</option><option :value="100">100%</option></select></div>
          <div><label class="j-field-label">Kode kota</label><input v-model="p.cityCode" class="j-input" /></div>
        </div>
        <div class="mt-4 rounded-[8px] bg-j-bg p-3 text-[12px] text-j-sub">ODC 24C → 16 ODP · ODC 48C → 36 ODP · Kabel: Backbone 96–288C, Feeder 48–96C, Sub Feeder 24–48C, Distribusi 12–24C · Tiang: T7 1-Stage (lingkungan), T7 2-Stage (jalan utama), T9 2-Stage (crossing)</div>
        <div class="flex justify-end mt-4"><button class="j-btn-primary" @click="save">Simpan Standar</button></div>
      </div>

      <div v-else-if="tab === 'harga'" class="j-card p-5">
        <h3 class="j-title text-[16px] mb-3">Harga Satuan Material & Jasa</h3>
        <table class="w-full"><thead class="bg-j-bg"><tr><th class="j-th">Item</th><th class="j-th">Satuan</th><th class="j-th text-right">Harga (IDR)</th></tr></thead>
          <tbody><tr v-for="(v, k) in PRICE" :key="k"><td class="j-td">{{ v.item }}</td><td class="j-td text-j-sub">{{ v.unit }}</td><td class="j-td text-right font-medium">{{ fmt(v.price) }}</td></tr></tbody>
        </table>
      </div>

      <div v-else-if="tab === 'integrasi'" class="grid grid-cols-2 gap-4">
        <div v-for="i in integrations" :key="i.n" class="j-card p-4 flex items-start justify-between gap-3">
          <div><p class="font-display font-bold text-[14px]">{{ i.n }}</p><p class="text-[12px] text-j-sub mt-1">{{ i.d }}</p></div>
          <span :class="i.s === 'Belum terhubung' ? 'j-tag-grey' : 'j-tag-teal'">{{ i.s }}</span>
        </div>
      </div>

      <div v-else class="j-card p-5 space-y-3">
        <h3 class="j-title text-[16px]">Data Lokal</h3>
        <p class="text-[13px] text-j-sub">Data inventaris, desain FTTH, analisis pasar, dan filter lokasi tersimpan di browser ini. Kembalikan ke kondisi awal sebelum sesi presentasi baru.</p>
        <button class="j-btn-danger" @click="resetAll"><UIcon name="i-lucide-rotate-ccw" class="w-4 h-4" />Reset ke kondisi awal</button>
      </div>
    </div>
  </div>
</template>
