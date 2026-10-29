<script setup lang="ts">
import bg from "~/assets/images/business-planning-0.png";
const auth = useAuthStore();
const planning = [
  { to: "/map/market-potential", title: "Market Potential Analysis", desc: "Hitung jumlah rumah & potensi pasar dari AOI (digitize / upload)", bg: "bg-blue-100", fg: "text-blue-600", icon: "i-heroicons-chart-bar" },
  { to: "/map/ftth", title: "FTTH Auto-Design", desc: "Desain jaringan otomatis per RW / cluster + BOQ/BOM", bg: "bg-cyan-100", fg: "text-cyan-600", icon: "i-heroicons-signal" },
];
const operation = [{ to: "/map/asset-management", title: "Asset Management (OSP)", desc: "Inventaris OLT, ODC, ODP, tiang, kabel dalam satu peta", bg: "bg-green-100", fg: "text-green-600", icon: "i-heroicons-server-stack" }];
function logout() {
  auth.logout();
  navigateTo("/");
}
</script>

<template>
  <div class="min-h-screen bg-white p-10">
    <div :style="{ backgroundImage: `url(${bg})` }" class="bg-cover bg-center rounded-lg p-14 shadow-xl min-h-[calc(100vh-5rem)] flex flex-col">
      <div class="flex items-center justify-between mb-12">
        <AppLogo light />
        <button class="px-10 py-2.5 text-sm font-medium text-brand-500 bg-white hover:bg-grey-100 rounded-sm shadow-md" @click="logout">Log Out</button>
      </div>
      <div class="mb-8">
        <h2 class="text-5xl font-bold text-white mb-6">Hello, {{ auth.user?.name }}!</h2>
        <p class="text-lg text-white/90 max-w-4xl leading-relaxed">
          Welcome to JLM Map Planner — Geospatial Intelligence for Network Planning. Temukan area dengan potensi pasar tertinggi, desain jaringan FTTH secara otomatis sesuai standar JLM, dan kelola seluruh aset OSP dalam satu peta.
        </p>
      </div>
      <div class="grid md:grid-cols-2 gap-6 flex-1">
        <div class="bg-white rounded-xl shadow-lg p-8 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-4 mb-6">
              <div class="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg"><UIcon name="i-heroicons-presentation-chart-line" class="w-7 h-7 text-white" /></div>
              <div>
                <h2 class="text-2xl font-bold text-grey-900">Business Planning</h2>
                <span class="bg-gradient-to-r from-green-500 to-green-600 text-xs text-white px-2 py-1 rounded-full inline-block mt-1 font-medium">Active</span>
              </div>
            </div>
            <p class="text-grey-600 mb-6">Analisis pasar, penentuan area ekspansi, dan desain jaringan FTTH lengkap dengan estimasi BOQ/BOM.</p>
            <div class="space-y-3">
              <NuxtLink v-for="f in planning" :key="f.to" :to="f.to" class="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-all hover:translate-x-2 group">
                <div :class="[f.bg, 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0']"><UIcon :name="f.icon" :class="[f.fg, 'w-5 h-5']" /></div>
                <div class="flex-1">
                  <h3 class="font-semibold text-grey-900 group-hover:text-blue-600">{{ f.title }}</h3>
                  <p class="text-sm text-grey-500">{{ f.desc }}</p>
                </div>
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 text-grey-400 group-hover:text-blue-600" />
              </NuxtLink>
            </div>
          </div>
          <NuxtLink to="/landing/business-planning" class="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-6 rounded-lg text-center shadow-lg hover:shadow-xl">Explore Planning Tools</NuxtLink>
        </div>
        <div class="bg-white rounded-xl shadow-lg p-8 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-4 mb-6">
              <div class="w-14 h-14 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-center shadow-lg"><UIcon name="i-heroicons-wrench-screwdriver" class="w-7 h-7 text-white" /></div>
              <div>
                <h2 class="text-2xl font-bold text-grey-900">Business Operation</h2>
                <span class="bg-gradient-to-r from-green-500 to-green-600 text-xs text-white px-2 py-1 rounded-full inline-block mt-1 font-medium">Active</span>
              </div>
            </div>
            <p class="text-grey-600 mb-6">Pencatatan dan pengelolaan aset jaringan existing maupun hasil desain, termasuk kapasitas port dan histori perubahan.</p>
            <div class="space-y-3">
              <NuxtLink v-for="f in operation" :key="f.to" :to="f.to" class="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 transition-all hover:translate-x-2 group">
                <div :class="[f.bg, 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0']"><UIcon :name="f.icon" :class="[f.fg, 'w-5 h-5']" /></div>
                <div class="flex-1">
                  <h3 class="font-semibold text-grey-900 group-hover:text-blue-600">{{ f.title }}</h3>
                  <p class="text-sm text-grey-500">{{ f.desc }}</p>
                </div>
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 text-grey-400 group-hover:text-blue-600" />
              </NuxtLink>
            </div>
          </div>
          <NuxtLink to="/landing/business-operation" class="w-full mt-6 bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-semibold py-3 px-6 rounded-lg text-center shadow-lg hover:shadow-xl">Explore Operation Tools</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
