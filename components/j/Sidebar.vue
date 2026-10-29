<script setup lang="ts">
const route = useRoute();
const top = [
  { to: "/dashboard", icon: "i-lucide-house", tip: "Dashboard" },
  { to: "/proyek", icon: "i-lucide-monitor", tip: "Proyek Jaringan" },
  { to: "/peta", icon: "i-lucide-map", tip: "Peta Jaringan" },
  { to: "/boq-bom", icon: "i-lucide-file-spreadsheet", tip: "BOQ & BOM" },
];
const bottom = [
  { to: "/pengguna", icon: "i-lucide-users", tip: "Manajemen Pengguna" },
  { to: "/pengaturan", icon: "i-lucide-settings", tip: "Pengaturan" },
];
const isOn = (to: string) => route.path === to || route.path.startsWith(to + "/");
</script>
<template>
  <aside class="w-16 bg-white border-r border-j-line flex flex-col items-center py-3 shrink-0 z-30">
    <div class="flex flex-col gap-2 pb-3 border-b border-j-line">
      <UTooltip v-for="i in top" :key="i.to" :text="i.tip" :popper="{ placement: 'right' }">
        <NuxtLink :to="i.to" class="w-10 h-10 rounded-[10px] flex items-center justify-center border transition-colors" :class="isOn(i.to) ? 'bg-j-cyan border-j-cyan text-white' : 'bg-white border-j-line text-j-ink hover:border-j-cyan hover:text-j-cyan'">
          <UIcon :name="i.icon" class="w-5 h-5" />
        </NuxtLink>
      </UTooltip>
    </div>
    <div class="flex-1" />
    <div class="flex flex-col gap-2">
      <UTooltip v-for="i in bottom" :key="i.to" :text="i.tip" :popper="{ placement: 'right' }">
        <NuxtLink :to="i.to" class="w-10 h-10 rounded-[10px] flex items-center justify-center border transition-colors" :class="isOn(i.to) ? 'bg-j-cyan border-j-cyan text-white' : 'bg-white border-j-line text-j-ink hover:border-j-cyan hover:text-j-cyan'">
          <UIcon :name="i.icon" class="w-5 h-5" />
        </NuxtLink>
      </UTooltip>
    </div>
  </aside>
</template>
