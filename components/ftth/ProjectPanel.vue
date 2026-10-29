<script setup lang="ts">
const emit = defineEmits<{ (e: "close"): void; (e: "new"): void; (e: "toggle", id: string): void; (e: "focus", id: string): void; (e: "edit", id: string): void; (e: "delete", id: string): void; (e: "rerun", id: string): void }>();
defineProps<{ editingId: string | null; loadingId: string | null }>();
const ftth = useFtthStore();
const tab = ref(0);
const q = ref("");
const open = ref<Record<string, boolean>>({ Gedebage: true, Rancasari: true, Panyileukan: true });
const groups = computed(() => {
  const g: Record<string, any[]> = {};
  ftth.projects
    .filter((p) => (p.name + p.kecamatan).toLowerCase().includes(q.value.toLowerCase()))
    .forEach((p) => (g[p.kecamatan] ||= []).push(p));
  return g;
});
const activeProjects = computed(() => ftth.active.map((id) => ftth.byId(id)).filter(Boolean) as any[]);
const statusColor: Record<string, string> = { Draft: "bg-grey-200 text-grey-700", Designed: "bg-blue-100 text-blue-700", "Sent to Asset": "bg-green-100 text-green-700", "As-built": "bg-purple-100 text-purple-700" };
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-3 space-y-1 flex items-start justify-between">
      <div>
        <h2 class="text-md text-black">Project Management</h2>
        <p class="text-[10px] text-grey-700">Manage your FTTH design projects</p>
      </div>
      <button class="text-grey-400 hover:text-grey-700" @click="$emit('close')"><UIcon name="i-heroicons-x-mark" class="w-4 h-4" /></button>
    </div>
    <div class="px-3">
      <div class="flex bg-grey-100 rounded-xxs p-1">
        <button v-for="(t, i) in ['Projects', `Active (${ftth.active.length})`]" :key="t" class="flex-1 py-1.5 text-xs rounded-xxs" :class="tab === i ? 'bg-white shadow-sm' : 'text-grey-600'" @click="tab = i">{{ t }}</button>
      </div>
    </div>
    <template v-if="tab === 0">
      <div class="px-3 pt-3"><UInput v-model="q" size="sm" placeholder="Search projects or kecamatan..." /></div>
      <div class="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
        <div v-for="(ps, kec) in groups" :key="kec" class="border rounded-xxs">
          <div class="p-2 cursor-pointer flex justify-between items-center" @click="open[kec] = !open[kec]">
            <div class="flex items-center gap-2"><UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-blue-500" /><span class="text-xs">Kec. {{ kec }}</span></div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-2 py-1 rounded-xxs bg-blue-100 text-blue-700">{{ ps.length }} project{{ ps.length > 1 ? "s" : "" }}</span>
              <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 transition-transform" :class="open[kec] ? 'rotate-180' : ''" />
            </div>
          </div>
          <div v-show="open[kec]" class="p-2 border-t space-y-2">
            <div v-for="p in ps" :key="p.id" class="p-2 bg-grey-50 rounded-xxs hover:bg-grey-100">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <UIcon name="i-heroicons-folder" class="w-4 h-4 text-orange-500 shrink-0" />
                  <span class="text-xs font-medium truncate">{{ p.name }}</span>
                </div>
                <UButton size="xs" :color="ftth.active.includes(p.id) ? 'red' : 'primary'" variant="soft" :loading="loadingId === p.id" @click="$emit('toggle', p.id)">{{ ftth.active.includes(p.id) ? "Remove" : "Add To Map" }}</UButton>
              </div>
              <div class="flex items-center gap-2 mt-1.5 ml-6 text-[10px] text-grey-500">
                <span class="px-1.5 py-0.5 rounded-xxs" :class="statusColor[p.status]">{{ p.status }}</span>
                <span>{{ fmt(p.homes) }} HP</span><span>·</span><span>{{ p.updatedAt }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!Object.keys(groups).length" class="text-center py-8"><UIcon name="i-heroicons-folder-open" class="w-12 h-12 text-grey-300 mx-auto mb-2" /><p class="text-sm text-grey-500">No projects found</p></div>
      </div>
      <div class="border-t p-3"><UButton block size="sm" icon="i-heroicons-plus" class="justify-center" @click="$emit('new')">New Project</UButton></div>
    </template>
    <template v-else>
      <div class="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
        <div v-if="!activeProjects.length" class="text-center py-8">
          <UIcon name="i-heroicons-map" class="w-12 h-12 text-grey-300 mx-auto mb-2" />
          <p class="text-sm text-grey-500">No active projects</p>
          <p class="text-xs text-grey-400 mt-1">Add projects from the Project tab</p>
        </div>
        <div v-for="p in activeProjects" :key="p.id" class="border rounded-xxs p-2" :class="ftth.focusId === p.id ? 'border-blue-500 bg-blue-50/50' : ''">
          <div class="flex justify-between items-center gap-2">
            <p class="text-xs font-medium text-black truncate cursor-pointer flex-1" @click="$emit('focus', p.id)">{{ p.name }}</p>
            <div class="flex items-center gap-1.5 shrink-0">
              <button class="text-grey-700 hover:text-brand-500" title="FTTH Analysis" @click="$emit('focus', p.id)"><UIcon name="i-heroicons-chart-bar" class="w-3.5 h-3.5" /></button>
              <button :class="editingId === p.id ? 'text-blue-600' : 'text-grey-700 hover:text-brand-500'" title="Edit Site Points" @click="$emit('edit', p.id)"><UIcon name="i-heroicons-pencil-square" class="w-3.5 h-3.5" /></button>
              <button class="text-grey-700 hover:text-brand-500" title="Re-generate" @click="$emit('rerun', p.id)"><UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5" /></button>
              <button class="text-grey-700 hover:text-red-500" title="Remove from map" @click="$emit('toggle', p.id)"><UIcon name="i-heroicons-eye-slash" class="w-3.5 h-3.5" /></button>
              <button class="text-grey-700 hover:text-red-500" title="Delete project" @click="$emit('delete', p.id)"><UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <p class="text-[10px] text-grey-500 mt-1">{{ p.source }} · OLT {{ p.oltLabel }} · {{ p.edits.length }} edit manual</p>
        </div>
      </div>
    </template>
  </div>
</template>
