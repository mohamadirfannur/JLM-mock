<script setup lang="ts">
import bp0 from "~/assets/images/business-planning-0.png";
import bp1 from "~/assets/images/business-planning-1.png";
import bp2 from "~/assets/images/business-planning-2.png";
import bp3 from "~/assets/images/business-planning-3.png";
import bo0 from "~/assets/images/business-operation-0.png";

const route = useRoute();
const kind = computed(() => (route.params.kind === "business-operation" ? "operation" : "planning"));
const CONF = {
  planning: {
    title: "Business Planning",
    desc: "Analyze market potential and design FTTH networks with JLM standards.",
    bg: bp0,
    options: [
      { slug: "market", label: "Market Potential Analysis", desc: "Hitung jumlah rumah dari AOI yang digambar atau di-upload, lengkap dengan kelas rumah, POI, dan kompetitor ISP.", to: "/map/market-potential", bg: bp1, icon: "i-heroicons-chart-bar" },
      { slug: "ftth", label: "FTTH Auto-Design", desc: "Dari batas RW / cluster menjadi desain jaringan: ODP, ODC, OLT, tiang, kabel, dan BOQ/BOM dalam hitungan menit.", to: "/map/ftth", bg: bp3, icon: "i-heroicons-signal" },
    ],
  },
  operation: {
    title: "Business Operation",
    desc: "Manage JLM outside-plant assets on one living map.",
    bg: bo0,
    options: [{ slug: "asset", label: "Assets Management", desc: "Inventaris aset pasif & aktif (OTB, OLT, ODC, ODP, tiang, kabel, JC, ONT, Mikrotik, Switch, dll) dengan kapasitas port dan histori.", to: "/map/asset-management", bg: bp2, icon: "i-heroicons-server-stack" }],
  },
} as const;
const conf = computed(() => CONF[kind.value]);
const hover = ref<string | null>(null);
const active = computed(() => conf.value.options.find((o) => o.slug === hover.value));
</script>

<template>
  <div class="p-6 h-screen gap-6 flex">
    <div class="w-1/2 h-full rounded-sm relative p-10 overflow-hidden bg-cover bg-center transition-all duration-300" :style="{ backgroundImage: `url(${active?.bg || conf.bg})` }">
      <div class="absolute w-[1200px] h-[1200px] bg-white/15 -bottom-[600px] -left-[400px] rounded-full blur-2xl" />
      <div class="relative flex flex-col justify-between h-full">
        <AppLogo light />
        <div class="space-y-4 py-10">
          <h1 class="text-6xl font-medium text-white leading-tight">{{ active?.label || conf.title }}</h1>
          <p class="text-white font-medium text-[20px] leading-normal max-w-xl">{{ active?.desc || conf.desc }}</p>
        </div>
      </div>
    </div>
    <div class="w-1/2 flex flex-col justify-center px-16 gap-4">
      <NuxtLink to="/home" class="text-sm text-grey-600 flex items-center gap-2 mb-4 hover:text-blue-600"><UIcon name="i-heroicons-arrow-left" /> Back to Dashboard</NuxtLink>
      <p class="text-3xl font-medium text-grey-900 mb-2">Choose a module</p>
      <NuxtLink
        v-for="o in conf.options"
        :key="o.slug"
        :to="o.to"
        class="flex items-center gap-5 p-6 rounded-sm border border-grey-200 hover:border-blue-500 hover:shadow-lg transition-all group"
        @mouseenter="hover = o.slug"
        @mouseleave="hover = null"
      >
        <div class="w-14 h-14 rounded-xs bg-gradient-to-br from-blue-100 to-blue-600 text-white flex items-center justify-center shrink-0"><UIcon :name="o.icon" class="w-7 h-7" /></div>
        <div class="flex-1">
          <p class="text-xl font-semibold text-grey-900 group-hover:text-blue-600">{{ o.label }}</p>
          <p class="text-sm text-grey-500 mt-1">{{ o.desc }}</p>
        </div>
        <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 text-grey-400 group-hover:text-blue-600" />
      </NuxtLink>
    </div>
  </div>
</template>
