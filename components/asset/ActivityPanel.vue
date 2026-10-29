<script setup lang="ts">
defineProps<{ embedded?: boolean }>();
defineEmits<{ (e: "close"): void }>();
const store = useAssetStore();
const tab = ref("Semua");
const TAG: Record<string, [string, string]> = { Create: ["Tambah Aset", "j-tag-cyan"], Update: ["Edit Aset", "j-tag-purple"], Move: ["Edit Lokasi", "j-tag-purple"], Delete: ["Hapus", "j-tag-red"], Import: ["Import", "j-tag-amber"], Sync: ["FTTH Sync", "j-tag-blue"] };
const list = computed(() => store.activity.filter((a) => tab.value === "Semua" || (tab.value === "Import" && a.action === "Import") || (tab.value === "Edit Aset" && ["Update", "Move", "Create", "Delete"].includes(a.action)) || (tab.value === "Kabel" && /CBL|kabel|Kabel/.test(a.target + a.detail))));
</script>
<template>
  <div>
    <div class="flex gap-1.5 mb-3"><button v-for="t in ['Semua', 'Import', 'Edit Aset', 'Kabel']" :key="t" class="j-chip !h-6 !px-2.5 !text-[11px]" :class="tab === t && 'j-chip-on'" @click="tab = t">{{ t }}</button></div>
    <div class="space-y-2">
      <div v-if="!list.length" class="text-[12px] text-j-sub text-center py-8">Belum ada aktivitas.</div>
      <div v-for="a in list" :key="a.id" class="border border-j-line rounded-[10px] p-3">
        <div class="flex items-center gap-2"><span :class="TAG[a.action][1]">{{ TAG[a.action][0] }}</span><span class="j-tag-teal">{{ a.action === "Delete" ? "Dihapus" : a.action === "Import" ? "Selesai" : "Updated" }}</span></div>
        <p class="font-display font-bold text-[13px] mt-2 break-all">{{ a.target }}</p>
        <p class="text-[12px] text-j-sub mt-0.5">{{ a.detail }}</p>
        <p class="text-[11px] text-j-mute mt-1.5">{{ a.user }} · {{ a.at }}</p>
      </div>
    </div>
  </div>
</template>
