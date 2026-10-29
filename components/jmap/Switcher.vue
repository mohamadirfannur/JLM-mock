<script setup lang="ts">
defineEmits<{ (e: "close"): void }>();
const route = useRoute();
const items = [
  { to: "/peta/asset", icon: "i-lucide-network", t: "Asset Management", d: "Inventaris aset OSP pasif & aktif", c: "from-[#00D4FF] to-[#0E66C4]" },
  { to: "/peta/ftth", icon: "i-lucide-zap", t: "FTTH Auto-Design", d: "Desain jaringan otomatis berbasis masterplan", c: "from-[#00D4FF] to-[#7B2FFF]" },
  { to: "/peta/market", icon: "i-lucide-map", t: "Planning Market", d: "Identifikasi area potensial & peluang pasar", c: "from-[#3ECFD2] to-[#005952]" },
  { to: "/boq-bom", icon: "i-lucide-file-text", t: "Laporan Aktual Material", d: "Update material terpasang per segmen", c: "from-[#F59E0B] to-[#EF4444]" },
];
</script>
<template>
  <div class="j-panel w-[330px] p-4 fade-up">
    <div class="flex items-start justify-between mb-3">
      <div><p class="j-title text-[16px]">Map Dashboard</p><p class="text-[12px] text-j-sub">Akses fitur terintegrasi JLM</p></div>
      <button class="w-7 h-7 rounded-full border border-j-line flex items-center justify-center text-j-sub" @click="$emit('close')"><UIcon name="i-lucide-x" class="w-3.5 h-3.5" /></button>
    </div>
    <div class="space-y-2">
      <NuxtLink v-for="i in items" :key="i.to" :to="i.to" class="flex items-center gap-3 p-3 rounded-[10px] border transition-colors" :class="route.path === i.to ? 'border-j-cyan bg-j-cyan/[0.06]' : 'border-j-line hover:border-j-cyan'" @click="$emit('close')">
        <span class="w-10 h-10 rounded-[10px] bg-gradient-to-br text-white flex items-center justify-center shrink-0" :class="i.c"><UIcon :name="i.icon" class="w-5 h-5" /></span>
        <span class="min-w-0"><p class="font-display font-bold text-[14px]">{{ i.t }}</p><p class="text-[12px] text-j-sub truncate">{{ i.d }}</p></span>
      </NuxtLink>
    </div>
  </div>
</template>
