<script setup lang="ts">
import bgP from "~/assets/images/bg-planning.png";
import bgO from "~/assets/images/bg-operation.png";
definePageMeta({ layout: false });
const route = useRoute();
const isOp = computed(() => route.params.group === "operation");
const conf = computed(() =>
  isOp.value
    ? { title: "Business Operation", desc: "Kelola dan visualisasikan infrastruktur jaringan fiber untuk operasional yang efisien.", bg: bgO, mods: [MODULES.ftth] }
    : { title: "Business Planning", desc: "Analisis potensi pasar dan optimalkan pengelolaan aset jaringan JLM.", bg: bgP, mods: [MODULES.market, MODULES.asset] },
);
useHead({ title: () => `${conf.value.title} · JLM` });
const hover = ref<string | null>(null);
const act = computed(() => conf.value.mods.find((m) => m.id === hover.value));
</script>
<template>
  <div class="h-screen p-6 flex gap-12 bg-white">
    <div class="w-1/2 rounded-[20px] relative overflow-hidden bg-cover bg-center" :style="{ backgroundImage: `url(${conf.bg})` }">
      <div class="absolute inset-0" style="background: linear-gradient(160deg, rgba(0, 24, 73, 0.95) 15%, rgba(0, 24, 73, 0.55) 65%, rgba(0, 212, 255, 0.35))" />
      <div class="relative h-full flex flex-col justify-between p-10 text-white">
        <div class="bg-white/95 rounded-[10px] px-3 py-2 self-start"><JLogo :h="30" /></div>
        <div>
          <h1 class="font-display font-bold text-[54px] leading-[1.1]">{{ act?.name || conf.title }}</h1>
          <p class="text-[18px] text-white/85 mt-4 max-w-[560px]">{{ act?.desc || conf.desc }}</p>
        </div>
      </div>
    </div>
    <div class="flex-1 flex flex-col py-8 pr-6">
      <h2 class="font-display font-bold text-[44px] text-j-ink leading-tight">{{ conf.title }}</h2>
      <p class="text-[16px] text-j-sub mt-2">{{ conf.desc }}</p>
      <div class="space-y-4 mt-10">
        <NuxtLink v-for="m in conf.mods" :key="m.id" :to="m.home" class="flex items-center gap-5 p-7 rounded-[14px] border border-j-line hover:border-j-cyan hover:shadow-[0_10px_30px_rgba(0,212,255,0.12)] transition-all group" @mouseenter="hover = m.id" @mouseleave="hover = null">
          <span class="w-14 h-14 rounded-[14px] bg-gradient-to-br from-[#00D4FF] to-[#0E66C4] text-white flex items-center justify-center shrink-0 shadow-lg"><UIcon :name="m.icon" class="w-6 h-6" /></span>
          <span class="flex-1"><p class="font-display font-bold text-[20px] text-j-ink">{{ m.name }}</p><p class="text-[14px] text-j-sub mt-1">{{ m.desc }}</p></span>
          <UIcon name="i-lucide-arrow-right" class="w-5 h-5 text-j-mute group-hover:text-j-cyan" />
        </NuxtLink>
      </div>
      <div class="flex-1" />
      <div class="flex items-center justify-between text-[14px]">
        <NuxtLink to="/home" class="flex items-center gap-2 text-j-ink hover:text-j-cyan"><UIcon name="i-lucide-chevron-left" class="w-4 h-4" />Kembali</NuxtLink>
        <span class="flex items-center gap-2 text-j-sub"><UIcon name="i-lucide-map-pin" class="w-4 h-4" />Kota Bandung · Jawa Barat</span>
      </div>
    </div>
  </div>
</template>
