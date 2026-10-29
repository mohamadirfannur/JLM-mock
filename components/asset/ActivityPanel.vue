<script setup lang="ts">
defineEmits<{ (e: "close"): void }>();
const store = useAssetStore();
const ICON: Record<string, string> = { Create: "i-heroicons-plus-circle", Update: "i-heroicons-pencil-square", Move: "i-heroicons-arrows-pointing-out", Delete: "i-heroicons-trash", Import: "i-heroicons-arrow-down-tray", Sync: "i-heroicons-arrow-path" };
const COL: Record<string, string> = { Create: "text-green-600", Update: "text-blue-600", Move: "text-purple-600", Delete: "text-red-600", Import: "text-grey-700", Sync: "text-orange-600" };
</script>
<template>
  <div class="flex flex-col h-full">
    <div class="p-3 flex items-start justify-between">
      <div><h2 class="text-md text-black">Activity Log</h2><p class="text-[10px] text-grey-700">Histori perubahan data aset</p></div>
      <button class="text-grey-400 hover:text-grey-700" @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-4 h-4" /></button>
    </div>
    <div class="flex-1 overflow-y-auto thin-scrollbar px-3 pb-3 space-y-2">
      <div v-if="!store.activity.length" class="text-xs text-grey-500 text-center py-8">No activities found</div>
      <div v-for="a in store.activity" :key="a.id" class="flex gap-2 border-b border-grey-100 pb-2">
        <UIcon :name="ICON[a.action]" class="w-4 h-4 mt-0.5 shrink-0" :class="COL[a.action]" />
        <div class="min-w-0">
          <p class="text-xs"><b>{{ a.action }}</b> · {{ a.target }}</p>
          <p class="text-[11px] text-grey-600">{{ a.detail }}</p>
          <p class="text-[10px] text-grey-400">{{ a.user }} · {{ a.at }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
