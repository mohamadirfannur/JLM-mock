<script setup lang="ts">
import { SITE_COLORS, CABLE_COLORS, SITE_TYPES } from "~/utils/jlmSites";

const props = defineProps<{ siteId: string | null; cableId: string | null }>();
const emit = defineEmits<{ (e: "close"): void; (e: "addAsset", siteId: string): void; (e: "editAsset", siteId: string, assetId: string): void; (e: "move", siteId: string): void; (e: "deleted"): void; (e: "zoom", c: [number, number]): void; (e: "poles", cableId: string): void }>();
const store = useAssetStore();
const toast = useToast();
const site = computed(() => (props.siteId ? store.siteById(props.siteId) : null));
const cable = computed(() => (props.cableId ? store.cables.find((c) => c.id === props.cableId) : null));
const assets = computed(() => (site.value ? store.assetsOf(site.value.id) : []));
const openAsset = ref<string | null>(null);
const editing = ref(false);
const form = reactive<any>({});
const confirmDel = ref<null | { kind: "site" | "asset" | "cable"; id: string; label: string }>(null);
watch(
  () => [props.siteId, props.cableId],
  () => {
    editing.value = false;
    openAsset.value = assets.value[0]?.id || null;
  },
  { immediate: true },
);
function startEdit() {
  if (site.value) Object.assign(form, { name: site.value.name, code: site.value.code, type: site.value.type, status: site.value.status, owner: site.value.owner, address: site.value.address || "", poleType: site.value.poleType || "" });
  if (cable.value) Object.assign(form, { label: cable.value.label, type: cable.value.type, cores: cable.value.cores, install: cable.value.install, status: cable.value.status });
  editing.value = true;
}
function saveEdit() {
  if (site.value) store.updateSite(site.value.id, { ...form });
  if (cable.value) store.updateCable(cable.value.id, { ...form, tubes: Math.max(1, Math.ceil(form.cores / 12)) });
  editing.value = false;
  toast.add({ title: "Data saved", icon: "i-heroicons-check-circle", color: "green" });
}
function doDelete() {
  const c = confirmDel.value;
  if (!c) return;
  if (c.kind === "site") {
    store.deleteSite(c.id);
    emit("deleted");
  } else if (c.kind === "asset") store.deleteAsset(c.id);
  else {
    store.deleteCable(c.id);
    emit("deleted");
  }
  toast.add({ title: "Deleted", description: c.label, icon: "i-heroicons-trash", color: "red" });
  confirmDel.value = null;
}
const util = (a: any) => (a.ports?.length ? Math.round((a.ports.filter((p: any) => p.status === "Used").length / a.ports.length) * 100) : null);
function togglePort(a: any, i: number) {
  const ports = a.ports.map((p: any) => ({ ...p }));
  ports[i].status = ports[i].status === "Used" ? "Idle" : ports[i].status === "Idle" ? "Reserved" : "Used";
  store.updateAsset(a.id, { ports });
}
// core config (TIA-598 colors)
const TIA = ["#2563EB", "#F97316", "#16A34A", "#92400E", "#64748B", "#FFFFFF", "#DC2626", "#111827", "#FACC15", "#7C3AED", "#EC4899", "#06B6D4"];
const odpOptions = computed(() => store.sites.filter((s) => s.type === "ODP" || s.type === "ODC").map((s) => s.code));
function setCore(i: number, v: string) {
  if (!cable.value) return;
  const cu = { ...(cable.value.coreUsage || {}) };
  if (v) cu[i] = v;
  else delete cu[i];
  store.updateCable(cable.value.id, { coreUsage: cu });
}
const statusColor: Record<string, string> = { Installed: "bg-green-100 text-green-700", Planned: "bg-yellow-100 text-yellow-700", Maintenance: "bg-red-100 text-red-700" };
</script>

<template>
  <UiSidePanel :title="cable ? 'Cable Detail' : 'Detail Info'" :subtitle="site ? site.code : cable?.label" @close="$emit('close')">
    <template #actions>
      <UButton v-if="site" size="2xs" color="gray" variant="ghost" icon="i-heroicons-magnifying-glass-plus" @click="$emit('zoom', site.coord)" />
    </template>
    <div v-if="!site && !cable" class="py-16 text-center text-xs text-j-sub">
      <UIcon name="i-heroicons-cursor-arrow-rays" class="w-10 h-10 text-j-mute mb-2" /><br />Klik site point atau kabel di peta untuk melihat detail.
    </div>

    <!-- SITE -->
    <div v-if="site" class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full" :style="{ background: SITE_COLORS[site.type] }" />
        <span class="text-sm font-semibold">{{ site.type }}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-xxs" :class="statusColor[site.status]">{{ site.status }}</span>
        <span v-if="site.project" class="text-[10px] text-j-sub truncate">· {{ site.project }}</span>
      </div>
      <div class="flex gap-2">
        <UButton size="xs" variant="soft" icon="i-heroicons-pencil-square" @click="startEdit">Edit</UButton>
        <UButton size="xs" variant="soft" icon="i-heroicons-arrows-pointing-out" @click="$emit('move', site.id)">Move</UButton>
        <UButton size="xs" variant="soft" icon="i-heroicons-plus" @click="$emit('addAsset', site.id)">Add Asset</UButton>
        <UButton size="xs" color="red" variant="soft" icon="i-heroicons-trash" @click="confirmDel = { kind: 'site', id: site.id, label: site.code }">Delete</UButton>
      </div>
      <div v-if="editing" class="border rounded-xs p-3 grid grid-cols-2 gap-2 bg-j-bg">
        <UFormGroup label="Name" size="xs"><UInput v-model="form.name" size="xs" /></UFormGroup>
        <UFormGroup label="Code" size="xs"><UInput v-model="form.code" size="xs" /></UFormGroup>
        <UFormGroup label="Site Type" size="xs"><USelect v-model="form.type" :options="[...SITE_TYPES]" size="xs" /></UFormGroup>
        <UFormGroup label="Status" size="xs"><USelect v-model="form.status" :options="['Installed', 'Planned', 'Maintenance']" size="xs" /></UFormGroup>
        <UFormGroup label="Owner" size="xs"><UInput v-model="form.owner" size="xs" /></UFormGroup>
        <UFormGroup v-if="form.type === 'Pole'" label="Tipe Tiang" size="xs"><USelect v-model="form.poleType" :options="['T7 1-Stage', 'T7 2-Stage', 'T9 2-Stage']" size="xs" /></UFormGroup>
        <UFormGroup label="Alamat" size="xs" class="col-span-2"><UInput v-model="form.address" size="xs" /></UFormGroup>
        <div class="col-span-2 flex justify-end gap-2"><UButton size="xs" color="gray" variant="ghost" @click="editing = false">Cancel</UButton><UButton size="xs" @click="saveEdit">Save Data</UButton></div>
      </div>
      <div class="border rounded-xxs divide-y text-xs">
        <div v-for="row in [
          ['Name', site.name],
          ['Code', site.code],
          ['Owner', site.owner],
          ['Koordinat', `${site.coord[1].toFixed(6)}, ${site.coord[0].toFixed(6)}`],
          ['Tipe Tiang', site.poleType],
          ['Alamat', site.address],
          ['Project', site.project],
          ['Date Created', site.createdAt],
          ['Date Updated', site.updatedAt],
        ].filter((r) => r[1])" :key="row[0]" class="flex justify-between gap-3 p-2"><span class="text-j-sub">{{ row[0] }}</span><span class="font-medium text-right">{{ row[1] }}</span></div>
      </div>
      <div>
        <p class="text-sm font-semibold mb-2">Assets ({{ assets.length }})</p>
        <div v-if="!assets.length" class="text-xs text-j-sub border rounded-xxs p-4 text-center">Belum ada aset di site point ini.</div>
        <div v-for="a in assets" :key="a.id" class="border rounded-xxs mb-2">
          <button class="w-full flex items-center justify-between p-2 text-left" @click="openAsset = openAsset === a.id ? null : a.id">
            <div class="min-w-0">
              <p class="text-xs font-semibold truncate">{{ a.type }} · {{ a.name }}</p>
              <p class="text-[10px] text-j-sub">{{ a.code }} · {{ a.category }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="util(a) !== null" class="text-[10px] px-1.5 py-0.5 rounded-xxs" :class="util(a)! >= 80 ? 'bg-red-100 text-red-700' : 'bg-j-cyan/10 text-j-blue'">{{ util(a) }}% used</span>
              <UIcon name="i-heroicons-chevron-down" class="w-4 h-4" :class="openAsset === a.id ? 'rotate-180' : ''" />
            </div>
          </button>
          <div v-if="openAsset === a.id" class="border-t p-2 space-y-2">
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <template v-for="row in [
                ['Serial Number', a.serial],
                ['Brand', a.brand],
                ['RFID', a.rfid],
                ['Tag ID', a.tagId],
                ['Install Date', a.installDate],
                ['Purchase Date', a.purchaseDate],
                ['Service Date', a.serviceDate],
                ['Maintained By', a.maintenanceBy],
                ['Inspected By', a.inspectedBy],
                ...Object.entries(a.extra || {}),
              ].filter((r) => r[1])" :key="row[0]">
                <span class="text-j-sub">{{ row[0] }}</span><span class="font-medium">{{ row[1] }}</span>
              </template>
            </div>
            <p v-if="a.description" class="text-[11px] text-j-sub">{{ a.description }}</p>
            <div v-if="a.ports?.length">
              <p class="text-[11px] font-semibold mb-1">Port ({{ a.ports.filter((p) => p.status === 'Used').length }}/{{ a.ports.length }} used) <span class="font-normal text-j-sub">· klik untuk ubah status</span></p>
              <div class="grid gap-1" :class="a.ports.length > 24 ? 'grid-cols-12' : 'grid-cols-8'">
                <button v-for="(p, i) in a.ports" :key="p.no" class="h-6 rounded-[3px] text-[9px] font-medium" :class="p.status === 'Used' ? 'bg-blue-500 text-white' : p.status === 'Reserved' ? 'bg-yellow-300' : 'bg-j-bg text-j-sub'" :title="`Port ${p.no} · ${p.status}${p.to ? ' · ' + p.to : ''}`" @click="togglePort(a, i)">{{ p.no }}</button>
              </div>
            </div>
            <div v-if="a.attachments?.length" class="text-[11px]"><span class="text-j-sub">Attachments:</span> {{ a.attachments.map((x) => x.label).join(", ") }}</div>
            <div class="flex gap-2 pt-1">
              <UButton size="2xs" variant="soft" icon="i-heroicons-pencil" @click="$emit('editAsset', site.id, a.id)">Edit</UButton>
              <UButton size="2xs" color="red" variant="soft" icon="i-heroicons-trash" @click="confirmDel = { kind: 'asset', id: a.id, label: a.code }">Delete Asset</UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CABLE -->
    <div v-if="cable" class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="w-4 h-1.5 rounded-full" :style="{ background: CABLE_COLORS[cable.type] }" />
        <span class="text-sm font-semibold">{{ cable.type }} {{ cable.cores }}C</span>
        <span class="text-[11px] px-2 py-0.5 rounded-xxs" :class="statusColor[cable.status]">{{ cable.status }}</span>
      </div>
      <div class="flex gap-2 flex-wrap">
        <UButton size="xs" variant="soft" icon="i-heroicons-pencil-square" @click="startEdit">Edit</UButton>
        <UButton size="xs" variant="soft" icon="i-heroicons-bars-3-bottom-left" @click="$emit('poles', cable.id)">Generate Pole</UButton>
        <UButton size="xs" color="red" variant="soft" icon="i-heroicons-trash" @click="confirmDel = { kind: 'cable', id: cable.id, label: cable.label }">Delete</UButton>
      </div>
      <div v-if="editing" class="border rounded-xs p-3 grid grid-cols-2 gap-2 bg-j-bg">
        <UFormGroup label="Label (format JLM)" size="xs" class="col-span-2"><UInput v-model="form.label" size="xs" /></UFormGroup>
        <UFormGroup label="Tipe" size="xs"><USelect v-model="form.type" :options="['Backbone', 'Feeder', 'Sub Feeder', 'Distribusi', 'Drop']" size="xs" /></UFormGroup>
        <UFormGroup label="Core" size="xs"><USelect v-model.number="form.cores" :options="[12, 24, 48, 96, 144, 288]" size="xs" /></UFormGroup>
        <UFormGroup label="Instalasi" size="xs"><USelect v-model="form.install" :options="['Aerial', 'Underground']" size="xs" /></UFormGroup>
        <UFormGroup label="Status" size="xs"><USelect v-model="form.status" :options="['Installed', 'Planned', 'Maintenance']" size="xs" /></UFormGroup>
        <div class="col-span-2 flex justify-end gap-2"><UButton size="xs" color="gray" variant="ghost" @click="editing = false">Cancel</UButton><UButton size="xs" @click="saveEdit">Save Data</UButton></div>
      </div>
      <div class="border rounded-xxs divide-y text-xs">
        <div v-for="row in [
          ['Label', cable.label],
          ['Code', cable.code],
          ['Cable Core / Tube', `${cable.cores} core · ${cable.tubes} tube`],
          ['Cable Net Length (m)', fmt(cable.length)],
          ['Cable Gross Length (m)', fmt(cable.length * 1.05 + 20)],
          ['Instalasi', cable.install],
          ['Dari', cable.from],
          ['Ke', cable.to],
          ['Project', cable.project],
        ].filter((r) => r[1])" :key="row[0]" class="flex justify-between gap-3 p-2"><span class="text-j-sub shrink-0">{{ row[0] }}</span><span class="font-medium text-right break-all">{{ row[1] }}</span></div>
      </div>
      <div>
        <p class="text-sm font-semibold mb-1">Core Config</p>
        <p class="text-[11px] text-j-sub mb-2">Warna core standar TIA-598. Pilih tujuan untuk menandai core terpakai.</p>
        <div class="space-y-2">
          <div v-for="t in Math.min(cable.tubes, 4)" :key="t" class="border rounded-xxs p-2">
            <p class="text-[11px] font-semibold mb-1 flex items-center gap-2"><span class="w-3 h-3 rounded-full border" :style="{ background: TIA[(t - 1) % 12] }" />Tube {{ t }}</p>
            <div class="grid grid-cols-2 gap-1">
              <div v-for="c in 12" :key="c" class="flex items-center gap-1 text-[10px]">
                <span class="w-3 h-3 rounded-full border border-grey-400 shrink-0" :style="{ background: TIA[c - 1] }" />
                <span class="w-6">#{{ (t - 1) * 12 + c }}</span>
                <select class="flex-1 border rounded-[3px] px-1 py-0.5 text-[10px]" :value="cable.coreUsage?.[(t - 1) * 12 + c] || ''" @change="setCore((t - 1) * 12 + c, ($event.target as HTMLSelectElement).value)">
                  <option value="">idle</option>
                  <option v-for="o in odpOptions.slice(0, 80)" :key="o" :value="o">{{ o }}</option>
                </select>
              </div>
            </div>
          </div>
          <p v-if="cable.tubes > 4" class="text-[10px] text-j-sub">+ {{ cable.tubes - 4 }} tube lainnya</p>
        </div>
      </div>
    </div>

    <UModal :model-value="!!confirmDel" @update:model-value="!$event && (confirmDel = null)">
      <div class="p-5 space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><UIcon name="i-heroicons-trash" class="w-5 h-5 text-red-600" /></div>
          <div>
            <p class="font-semibold">Hapus {{ confirmDel?.kind === "site" ? "site point" : confirmDel?.kind === "asset" ? "aset" : "kabel" }}?</p>
            <p class="text-xs text-j-sub">{{ confirmDel?.label }}</p>
          </div>
        </div>
        <p v-if="confirmDel?.kind === 'site'" class="text-xs text-j-sub">Semua aset di site point ini ikut terhapus. Tercatat di Activity Log.</p>
        <div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="confirmDel = null">Cancel</UButton><UButton color="red" @click="doDelete">Delete</UButton></div>
      </div>
    </UModal>
  </UiSidePanel>
</template>
