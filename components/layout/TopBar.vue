<script setup lang="ts">
import IcLink from "~/assets/icons/ic-link.svg";

export interface TopToggle {
  key: string;
  label: string;
  icon?: any;
  uicon?: string;
  active: boolean;
}

const props = defineProps<{
  title: string;
  toggles?: TopToggle[];
  actions?: { key: string; label: string; icon?: string }[];
}>();
const emit = defineEmits<{ (e: "toggle", key: string): void; (e: "action", key: string): void; (e: "search", c: [number, number]): void }>();

const auth = useAuthStore();
const route = useRoute();
const toast = useToast();
const menuOpen = ref(false);
const query = ref("");
const showSug = ref(false);

const PLACES = [
  { name: "Summarecon Bandung, Gedebage", c: [107.6968, -6.9555] },
  { name: "Stadion Gelora Bandung Lautan Api", c: [107.7121, -6.9573] },
  { name: "Cisaranten Kidul, Gedebage", c: [107.688, -6.952] },
  { name: "Rancabolang, Gedebage", c: [107.699, -6.958] },
  { name: "Cipamokolan, Rancasari", c: [107.678, -6.962] },
  { name: "Derwati, Rancasari", c: [107.705, -6.968] },
  { name: "Mekarmulya, Panyileukan", c: [107.683, -6.97] },
  { name: "Cimincrang, Gedebage", c: [107.709, -6.952] },
];
const suggestions = computed(() => (query.value.length < 2 ? [] : PLACES.filter((p) => p.name.toLowerCase().includes(query.value.toLowerCase()))));
function hideSug() {
  setTimeout(() => (showSug.value = false), 200);
}
function choose(p: any) {
  query.value = p.name;
  showSug.value = false;
  emit("search", p.c);
}

const modules = [
  { to: "/map/market-potential", label: "Market Potential Analysis", icon: "i-heroicons-chart-bar" },
  { to: "/map/ftth", label: "FTTH Auto-Design", icon: "i-heroicons-signal" },
  { to: "/map/asset-management", label: "Asset Management", icon: "i-heroicons-server-stack" },
];

function share() {
  try {
    navigator.clipboard?.writeText(window.location.href);
  } catch {}
  toast.add({ title: "Link copied", description: "View-mode link disalin ke clipboard.", icon: "i-heroicons-link" });
}
function resetDemo() {
  if (!confirm("Reset semua data demo (AOI, project FTTH, perubahan aset)?")) return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("jlm-") && k !== "jlm-auth")
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
}
function logout() {
  auth.logout();
  navigateTo("/");
}
</script>

<template>
  <div class="absolute top-6 left-6 right-6 z-30 flex items-start justify-between gap-3 pointer-events-none">
    <!-- left -->
    <div class="flex items-center gap-2 pointer-events-auto">
      <div class="bg-white rounded-xs h-12 flex items-center gap-3 px-3 shadow-sm">
        <UPopover v-model:open="menuOpen" :popper="{ placement: 'bottom-start', offsetDistance: 14 }">
          <button class="p-1 text-grey-800 hover:text-blue-600"><UIcon name="i-heroicons-bars-3" class="w-5 h-5" /></button>
          <template #panel>
            <div class="p-3 w-72 space-y-1">
              <p class="text-xs text-grey-900">Menu</p>
              <p class="text-2xs text-grey-600 mb-2">Pindah modul atau kembali ke dashboard.</p>
              <UDivider class="mb-2" />
              <NuxtLink to="/home" class="flex items-center gap-3 p-2 rounded-xxs text-xs hover:bg-grey-100" @click="menuOpen = false">
                <UIcon name="i-heroicons-home" class="w-4 h-4" /> Dashboard
              </NuxtLink>
              <NuxtLink
                v-for="m in modules"
                :key="m.to"
                :to="m.to"
                class="flex items-center gap-3 p-2 rounded-xxs text-xs"
                :class="route.path === m.to ? 'bg-gradient-to-r from-blue-200/80 to-blue-600 text-white' : 'hover:bg-grey-100'"
                @click="menuOpen = false"
              >
                <UIcon :name="m.icon" class="w-4 h-4" /> {{ m.label }}
              </NuxtLink>
              <UDivider class="my-2" />
              <button class="flex w-full items-center gap-3 p-2 rounded-xxs text-xs text-grey-700 hover:bg-grey-100" @click="resetDemo">
                <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" /> Reset Demo Data
              </button>
              <button class="flex w-full items-center gap-3 p-2 rounded-xxs text-xs text-red-500 hover:bg-red-50" @click="logout">
                <UIcon name="i-heroicons-arrow-left-on-rectangle" class="w-4 h-4" /> Sign Out
              </button>
            </div>
          </template>
        </UPopover>
        <AppLogo class="h-8" />
      </div>
      <div class="bg-white rounded-xs h-12 flex items-center px-3 shadow-sm">
        <p class="whitespace-nowrap font-medium text-black">{{ title }}</p>
      </div>
      <div class="flex gap-2">
        <button
          v-for="t in toggles"
          :key="t.key"
          class="p-2 rounded-xs shadow-md flex items-center gap-2 h-9"
          :class="t.active ? 'text-white bg-gradient-to-r from-blue-100 to-blue-600' : 'bg-white text-grey-900'"
          @click="emit('toggle', t.key)"
        >
          <component :is="t.icon" v-if="t.icon" class="w-5 h-5" :font-controlled="false" />
          <UIcon v-else-if="t.uicon" :name="t.uicon" class="w-5 h-5" />
          <span class="text-[10px] font-medium leading-none">{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- right -->
    <div class="bg-white rounded-xs h-12 p-[6px] flex items-center gap-2 pointer-events-auto shadow-sm">
      <div class="relative">
        <UInput v-model="query" placeholder="Search Location" class="w-48" @focus="showSug = true" @blur="hideSug">
          <template #trailing><UIcon name="i-heroicons-magnifying-glass-20-solid" class="w-4 h-4 text-grey-700" /></template>
        </UInput>
        <div v-if="showSug && suggestions.length" class="absolute mt-1 w-64 bg-white rounded-xxs shadow-lg text-xs z-50 py-1">
          <button v-for="s in suggestions" :key="s.name" class="w-full text-left px-3 py-2 hover:bg-grey-100" @mousedown.prevent="choose(s)">{{ s.name }}</button>
        </div>
      </div>
      <UButton v-for="a in actions" :key="a.key" :ui="{ rounded: 'rounded-xs' }" class="h-9" @click="emit('action', a.key)">
        <UIcon v-if="a.icon" :name="a.icon" class="w-4 h-4" />
        {{ a.label }}
      </UButton>
      <UButton :ui="{ rounded: 'rounded-xs' }" class="h-9 whitespace-nowrap" @click="share">
        Share Map <IcLink class="text-base" />
      </UButton>
      <UPopover :popper="{ placement: 'bottom-end', offsetDistance: 12 }">
        <button class="h-9 w-9 rounded-full bg-brand-500 text-white flex items-center justify-center"><UIcon name="i-heroicons-user" class="w-4 h-4" /></button>
        <template #panel>
          <div class="p-3 w-60 text-xs space-y-2">
            <p class="font-semibold text-grey-900">{{ auth.user?.name }}</p>
            <p class="text-grey-600">{{ auth.user?.email }}</p>
            <p class="text-grey-600">{{ auth.user?.role }}</p>
            <UDivider />
            <button class="text-red-500 flex items-center gap-2" @click="logout"><UIcon name="i-heroicons-arrow-left-on-rectangle" /> Sign Out</button>
          </div>
        </template>
      </UPopover>
    </div>
  </div>
</template>
