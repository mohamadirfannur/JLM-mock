<script setup lang="ts">
const route = useRoute();
const mod = computed(() => moduleOfPath(route.path));
const top = computed(() => [{ to: "/home", icon: "i-lucide-layout-grid", tip: "Semua Modul" }, ...(mod.value ? mod.value.tabs.map((t) => ({ to: t.to, icon: t.icon, tip: t.label })) : [])]);
const bottom = [
  { to: "/pengguna", icon: "i-lucide-users", tip: "Manajemen Pengguna" },
  { to: "/pengaturan", icon: "i-lucide-settings", tip: "Pengaturan" },
];
const isOn = (to: string) => route.path === to || (to === "/home" && route.path.startsWith("/landing"));
</script>
<template>
  <aside class="w-16 bg-white border-r border-j-line flex flex-col items-center py-3 shrink-0 z-30">
    <div class="flex flex-col gap-2 pb-3">
      <template v-for="(i, n) in top" :key="i.to">
        <UTooltip :text="i.tip" :popper="{ placement: 'right' }">
          <NuxtLink :to="i.to" class="w-10 h-10 rounded-[10px] flex items-center justify-center border transition-colors" :class="isOn(i.to) ? 'bg-j-cyan border-j-cyan text-white' : 'bg-white border-j-line text-j-ink hover:border-j-cyan hover:text-j-cyan'">
            <UIcon :name="i.icon" class="w-5 h-5" />
          </NuxtLink>
        </UTooltip>
        <div v-if="n === 0 && top.length > 1" class="border-t border-j-line mx-1" />
      </template>
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
