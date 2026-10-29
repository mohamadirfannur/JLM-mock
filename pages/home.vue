<script setup lang="ts">
import bgP from "~/assets/images/bg-planning.png";
import bgO from "~/assets/images/bg-operation.png";
definePageMeta({ layout: "app" });
useHead({ title: "Beranda · JLM Network Planner" });
const auth = useAuthStore();
const groups = [
  { to: "/landing/planning", title: "Business Planning", desc: "Analisis pasar dan pengelolaan aset jaringan untuk perencanaan ekspansi.", bg: bgP, mods: [MODULES.market, MODULES.asset] },
  { to: "/landing/operation", title: "Business Operation", desc: "Desain dan pengelolaan infrastruktur jaringan Fiber-to-the-Home.", bg: bgO, mods: [MODULES.ftth] },
];
</script>
<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1240px] mx-auto px-6 py-8">
      <p class="j-label text-j-cyan">JLM Network Planner</p>
      <h1 class="j-title text-[30px] mt-1">Halo, {{ auth.user?.name }}</h1>
      <p class="text-[14px] text-j-sub mt-1 max-w-3xl">Pilih modul kerja. Setiap modul memiliki fungsi, data area, dan alur kerjanya sendiri.</p>
      <div class="grid grid-cols-2 gap-6 mt-8">
        <div v-for="g in groups" :key="g.to" class="j-card overflow-hidden flex flex-col">
          <NuxtLink :to="g.to" class="h-[180px] bg-cover bg-center relative block group" :style="{ backgroundImage: `url(${g.bg})` }">
            <div class="absolute inset-0" style="background: linear-gradient(135deg, rgba(0, 24, 73, 0.88), rgba(0, 24, 73, 0.45))" />
            <div class="relative h-full p-6 flex flex-col justify-end text-white">
              <h2 class="font-display font-bold text-[28px] leading-tight">{{ g.title }}</h2>
              <p class="text-[13px] text-white/80 mt-1">{{ g.desc }}</p>
            </div>
          </NuxtLink>
          <div class="p-4 space-y-2 flex-1">
            <NuxtLink v-for="m in g.mods" :key="m.id" :to="m.home" class="flex items-center gap-4 p-4 rounded-[10px] border border-j-line hover:border-j-cyan hover:shadow-[0_6px_20px_rgba(0,212,255,0.12)] transition-all group">
              <span class="w-11 h-11 rounded-[10px] bg-gradient-to-br from-[#00D4FF] to-[#0E66C4] text-white flex items-center justify-center shrink-0"><UIcon :name="m.icon" class="w-5 h-5" /></span>
              <span class="flex-1 min-w-0"><p class="font-display font-bold text-[16px]">{{ m.name }}</p><p class="text-[12px] text-j-sub line-clamp-2">{{ m.desc }}</p></span>
              <UIcon name="i-lucide-arrow-right" class="w-5 h-5 text-j-mute group-hover:text-j-cyan" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
