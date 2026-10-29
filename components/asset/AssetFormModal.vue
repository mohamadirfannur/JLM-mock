<script setup lang="ts">
import { ASSET_TYPES } from "~/utils/jlmSites";
import type { Asset } from "~/stores/asset";

const props = defineProps<{ open: boolean; siteId: string | null; asset?: Asset | null }>();
const emit = defineEmits<{ (e: "close"): void; (e: "saved", a: Asset): void }>();
const store = useAssetStore();
const toast = useToast();
const site = computed(() => (props.siteId ? store.siteById(props.siteId) : null));

const blank = () => ({
  category: "Pasif" as "Pasif" | "Aktif",
  type: "ODP",
  name: "",
  code: "",
  serial: "",
  rfid: "",
  tagId: "",
  brand: "",
  description: "",
  location: "",
  installDate: new Date().toISOString().slice(0, 10),
  purchaseDate: "",
  serviceDate: "",
  maintenanceBy: "",
  inspectedBy: "",
  portCount: 16,
  portUsed: 0,
  attLabel: "",
  attachments: [] as { label: string; file: string }[],
});
const f = reactive(blank());
watch(
  () => [props.open, props.asset],
  () => {
    if (!props.open) return;
    Object.assign(f, blank());
    if (props.asset) {
      const a = props.asset;
      Object.assign(f, { ...a, location: a.extra?.Lokasi || "", portCount: a.ports?.length || 0, portUsed: a.ports?.filter((p) => p.status === "Used").length || 0, attachments: [...(a.attachments || [])] });
    } else if (site.value) {
      f.type = site.value.type === "POP" ? "OLT" : site.value.type === "Customer" ? "ONT" : ["ODC", "ODP", "Pole", "JC"].includes(site.value.type) ? site.value.type : "ODP";
      f.category = (ASSET_TYPES.Aktif as readonly string[]).includes(f.type) ? "Aktif" : "Pasif";
      f.code = `${site.value.code}-${f.type.replace(/[^A-Z]/gi, "").toUpperCase().slice(0, 3)}${String(store.assetsOf(site.value.id).length + 1).padStart(2, "0")}`;
    }
  },
  { immediate: true },
);
watch(
  () => f.category,
  (c) => {
    if (!(ASSET_TYPES[c] as readonly string[]).includes(f.type)) f.type = ASSET_TYPES[c][0];
  },
);
function addAttachment(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  f.attachments.push({ label: f.attLabel || file.name.replace(/\.[^.]+$/, ""), file: file.name });
  f.attLabel = "";
}
function save() {
  if (!props.siteId) return;
  if (!f.name || !f.code) return toast.add({ title: "Nama & kode wajib diisi", color: "red" });
  const prevPorts = props.asset?.ports || [];
  const ports = f.portCount > 0 ? Array.from({ length: f.portCount }, (_, i) => prevPorts[i] || { no: i + 1, status: (i < f.portUsed ? "Used" : "Idle") as "Used" | "Idle" }) : undefined;
  if (ports) ports.forEach((p, i) => (p.status = i < f.portUsed ? (p.status === "Reserved" ? "Reserved" : "Used") : p.status === "Used" ? "Idle" : p.status));
  const data: any = {
    siteId: props.siteId,
    category: f.category,
    type: f.type,
    name: f.name,
    code: f.code,
    serial: f.serial,
    rfid: f.rfid,
    tagId: f.tagId,
    brand: f.brand,
    description: f.description,
    installDate: f.installDate,
    purchaseDate: f.purchaseDate,
    serviceDate: f.serviceDate,
    maintenanceBy: f.maintenanceBy,
    inspectedBy: f.inspectedBy,
    ports,
    attachments: f.attachments,
    extra: { ...(props.asset?.extra || {}), ...(f.location ? { Lokasi: f.location } : {}) },
  };
  let a: Asset;
  if (props.asset) {
    store.updateAsset(props.asset.id, data);
    a = store.assets.find((x) => x.id === props.asset!.id)!;
  } else a = store.addAsset(data);
  toast.add({ title: props.asset ? "Asset updated" : "Asset saved", description: `${a.type} · ${a.code}`, icon: "i-heroicons-check-circle", color: "green" });
  emit("saved", a);
  emit("close");
}
</script>

<template>
  <UModal :model-value="open" :ui="{ width: 'sm:max-w-2xl' }" @update:model-value="!$event && $emit('close')">
    <div class="flex flex-col max-h-[90vh]">
      <div class="flex items-center justify-between p-4 border-b">
        <div>
          <h2 class="text-lg font-semibold">{{ asset ? "Edit Asset" : "Add Asset" }}</h2>
          <p class="text-xs text-grey-500">Site point: <b>{{ site?.code }}</b> · {{ site?.type }}</p>
        </div>
        <button @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-5 h-5" /></button>
      </div>
      <div class="p-5 overflow-y-auto thin-scrollbar space-y-5">
        <section>
          <p class="text-sm font-semibold mb-2 flex items-center gap-2"><UIcon name="i-heroicons-identification" class="text-brand-500" />Basic Information</p>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup label="Kategori" size="sm"><USelect v-model="f.category" :options="['Pasif', 'Aktif']" /></UFormGroup>
            <UFormGroup label="Asset Type" size="sm" required><USelect v-model="f.type" :options="[...ASSET_TYPES[f.category]]" placeholder="Select asset type" /></UFormGroup>
            <UFormGroup label="Name" size="sm" required><UInput v-model="f.name" placeholder="Enter name" /></UFormGroup>
            <UFormGroup label="Code" size="sm" required><UInput v-model="f.code" placeholder="Enter code" /></UFormGroup>
            <UFormGroup label="Serial Number" size="sm"><UInput v-model="f.serial" placeholder="Enter serial number" /></UFormGroup>
            <UFormGroup label="Brand / Model" size="sm"><UInput v-model="f.brand" placeholder="mis. ZTE, Huawei, FiberHome" /></UFormGroup>
            <UFormGroup label="RFID" size="sm"><UInput v-model="f.rfid" placeholder="Enter RFID" /></UFormGroup>
            <UFormGroup label="Tag ID" size="sm"><UInput v-model="f.tagId" placeholder="Enter tag ID" /></UFormGroup>
            <UFormGroup label="Description" size="sm" class="col-span-2"><UTextarea v-model="f.description" :rows="2" placeholder="Enter description" /></UFormGroup>
          </div>
        </section>
        <section>
          <p class="text-sm font-semibold mb-2 flex items-center gap-2"><UIcon name="i-heroicons-map-pin" class="text-brand-500" />Location & Capacity</p>
          <div class="grid grid-cols-3 gap-3">
            <UFormGroup label="Location Detail" size="sm" class="col-span-3"><UInput v-model="f.location" placeholder="mis. Tiang depan Blok C2 No. 10" /></UFormGroup>
            <UFormGroup label="Jumlah Port / Core" size="sm"><UInput v-model.number="f.portCount" type="number" min="0" /></UFormGroup>
            <UFormGroup label="Port Terpakai" size="sm"><UInput v-model.number="f.portUsed" type="number" min="0" :max="f.portCount" /></UFormGroup>
            <div class="flex items-end pb-2 text-xs text-grey-600">Utilisasi {{ f.portCount ? Math.round((f.portUsed / f.portCount) * 100) : 0 }}%</div>
          </div>
        </section>
        <section>
          <p class="text-sm font-semibold mb-2 flex items-center gap-2"><UIcon name="i-heroicons-calendar-days" class="text-brand-500" />Dates & Maintenance</p>
          <div class="grid grid-cols-3 gap-3">
            <UFormGroup label="Date of Install" size="sm"><UInput v-model="f.installDate" type="date" /></UFormGroup>
            <UFormGroup label="Date of Purchase" size="sm"><UInput v-model="f.purchaseDate" type="date" /></UFormGroup>
            <UFormGroup label="Date of Service" size="sm"><UInput v-model="f.serviceDate" type="date" /></UFormGroup>
            <UFormGroup label="Maintenance By" size="sm" class="col-span-2"><UInput v-model="f.maintenanceBy" placeholder="Enter maintenance provider" /></UFormGroup>
            <UFormGroup label="Last Inspected By" size="sm"><UInput v-model="f.inspectedBy" placeholder="Enter inspector name" /></UFormGroup>
          </div>
        </section>
        <section>
          <p class="text-sm font-semibold mb-2 flex items-center gap-2"><UIcon name="i-heroicons-paper-clip" class="text-brand-500" />Attachments</p>
          <div class="flex gap-2 items-center">
            <UInput v-model="f.attLabel" size="sm" placeholder="e.g., Photo, User Manual" class="flex-1" />
            <label class="cursor-pointer"><span class="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-xs bg-brand-500 text-white"><UIcon name="i-heroicons-plus" />Add Attachment</span><input type="file" class="hidden" @change="addAttachment" /></label>
          </div>
          <div v-if="f.attachments.length" class="mt-2 space-y-1">
            <div v-for="(a, i) in f.attachments" :key="i" class="flex items-center justify-between text-xs bg-grey-100 rounded-xxs p-2">
              <span><UIcon name="i-heroicons-document" class="mr-1" />{{ a.label }} · <span class="text-grey-500">{{ a.file }}</span></span>
              <button class="text-red-500" @click="f.attachments.splice(i, 1)"><UIcon name="i-heroicons-trash" /></button>
            </div>
          </div>
        </section>
      </div>
      <div class="flex justify-end gap-2 p-4 border-t">
        <UButton color="gray" variant="ghost" @click="$emit('close')">Cancel</UButton>
        <UButton icon="i-heroicons-check" @click="save">Save Asset</UButton>
      </div>
    </div>
  </UModal>
</template>
