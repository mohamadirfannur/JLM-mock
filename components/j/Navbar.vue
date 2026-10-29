<script setup lang="ts">
const auth = useAuthStore();
const route = useRoute();
const mod = computed(() => moduleOfPath(route.path));
const tabOn = (to: string) => route.path === to;
const asset = useAssetStore();
const q = ref("");
const open = ref(false);
const results = computed(() => {
  const s = q.value.trim().toLowerCase();
  if (s.length < 2) return [];
  return asset.sites.filter((x) => x.code.toLowerCase().includes(s) || x.name.toLowerCase().includes(s)).slice(0, 8);
});
function closeLater() {
  setTimeout(() => (open.value = false), 180);
}
function go(id: string) {
  open.value = false;
  q.value = "";
  navigateTo({ path: "/asset/peta", query: { site: id } });
}
const notif = computed(() => asset.activity.slice(0, 6));
function logout() {
  auth.logout();
  navigateTo("/");
}
</script>

<template>
  <header class="h-[60px] bg-white border-b border-j-line flex items-center justify-between px-6 shrink-0 relative z-40">
    <div class="flex items-center gap-6 min-w-0">
      <NuxtLink to="/home" class="flex items-center shrink-0"><JLogo :h="35" /></NuxtLink>
      <template v-if="mod">
        <span class="j-tag-cyan font-display font-bold !h-6 shrink-0">{{ mod.short }}</span>
        <nav class="flex items-center gap-1 overflow-x-auto hide-scrollbar">
          <NuxtLink v-for="t in mod.tabs" :key="t.to" :to="t.to" class="h-8 px-3 rounded-[6px] flex items-center text-[13px] whitespace-nowrap transition-colors" :class="tabOn(t.to) ? 'bg-j-cyan/[0.1] text-j-ink font-display font-bold' : 'text-j-sub hover:text-j-ink'">{{ t.label }}</NuxtLink>
        </nav>
      </template>
    </div>
    <div class="flex items-center gap-3">
      <div class="relative">
        <UIcon name="i-lucide-search" class="w-4 h-4 text-j-sub absolute left-3 top-1/2 -translate-y-1/2" />
        <input v-model="q" class="j-input w-[200px] !pl-9" :placeholder="mod?.id === 'asset' || !mod ? 'Cari aset, lokasi, kode...' : 'Cari aset jaringan...'" @focus="open = true" @blur="closeLater" />
        <div v-if="open && results.length" class="absolute right-0 mt-1 w-[320px] j-panel py-1 z-50">
          <button v-for="r in results" :key="r.id" class="w-full text-left px-3 py-2 hover:bg-j-bg flex items-center justify-between gap-3" @mousedown.prevent="go(r.id)">
            <span class="text-[13px] font-medium truncate">{{ r.code }}</span>
            <span class="j-tag-cyan">{{ r.type }}</span>
          </button>
        </div>
      </div>
      <UPopover :popper="{ placement: 'bottom-end', offsetDistance: 10 }">
        <button class="w-9 h-9 rounded-[8px] border border-j-line flex items-center justify-center text-j-ink hover:border-j-cyan relative">
          <UIcon name="i-lucide-bell" class="w-[18px] h-[18px]" />
          <span v-if="notif.length" class="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-j-red" />
        </button>
        <template #panel>
          <div class="w-[340px] p-3">
            <p class="j-title text-sm mb-2">Notifikasi</p>
            <div v-for="n in notif" :key="n.id" class="py-2 border-t border-j-line first:border-0">
              <p class="text-[12px] font-medium">{{ n.action }} · {{ n.target }}</p>
              <p class="text-[11px] text-j-sub line-clamp-2">{{ n.detail }}</p>
              <p class="text-[10px] text-j-mute mt-0.5">{{ n.user }} · {{ n.at }}</p>
            </div>
            <p v-if="!notif.length" class="text-[12px] text-j-sub py-3">Belum ada notifikasi.</p>
          </div>
        </template>
      </UPopover>
      <NuxtLink to="/pengaturan" class="w-9 h-9 rounded-[8px] border border-j-line flex items-center justify-center text-j-ink hover:border-j-cyan"><UIcon name="i-lucide-settings" class="w-[18px] h-[18px]" /></NuxtLink>
      <UPopover :popper="{ placement: 'bottom-end', offsetDistance: 10 }">
        <button class="h-9 pl-1 pr-4 rounded-full border border-j-line flex items-center gap-2 hover:border-j-cyan">
          <span class="w-7 h-7 rounded-full bg-j-cyan text-white text-[11px] font-display font-bold flex items-center justify-center">{{ auth.initials }}</span>
          <span class="text-[13px] font-medium">{{ auth.user?.team || "Team Asset" }}</span>
        </button>
        <template #panel>
          <div class="w-[240px] p-3 space-y-1">
            <p class="text-[13px] font-semibold">{{ auth.user?.name }}</p>
            <p class="text-[12px] text-j-sub">{{ auth.user?.email }}</p>
            <p class="text-[12px] text-j-sub">{{ auth.user?.role }}</p>
            <div class="border-t border-j-line my-2" />
            <NuxtLink to="/pengaturan" class="flex items-center gap-2 text-[13px] py-1.5 hover:text-j-cyan"><UIcon name="i-lucide-settings" class="w-4 h-4" /> Pengaturan</NuxtLink>
            <button class="flex items-center gap-2 text-[13px] py-1.5 text-j-red" @click="logout"><UIcon name="i-lucide-log-out" class="w-4 h-4" /> Keluar</button>
          </div>
        </template>
      </UPopover>
    </div>
  </header>
</template>
