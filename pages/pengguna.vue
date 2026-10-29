<script setup lang="ts">
definePageMeta({ layout: "app" });
useHead({ title: "Manajemen Pengguna · JLM" });
const toast = useToast();
const users = ref([
  { n: "Adit Pradana", e: "adit.pradana@jlm.co.id", r: "Admin", t: "Network Planning", s: "Aktif", l: "Hari ini" },
  { n: "Rudi Hartono", e: "asset@jlm.co.id", r: "Editor", t: "Team Asset", s: "Aktif", l: "Hari ini" },
  { n: "Wade Warren", e: "wade.warren@jlm.co.id", r: "Editor", t: "Network Planning", s: "Aktif", l: "Kemarin" },
  { n: "Sari Wulandari", e: "sari.w@jlm.co.id", r: "Editor", t: "Team Asset", s: "Aktif", l: "2 hari lalu" },
  { n: "Budi Santoso", e: "budi.s@jlm.co.id", r: "Viewer", t: "Procurement", s: "Aktif", l: "3 hari lalu" },
  { n: "Andi Prasetyo", e: "andi.p@jlm.co.id", r: "Viewer", t: "Sales & Marketing", s: "Aktif", l: "1 minggu lalu" },
  { n: "Hendra Kurnia", e: "hendra.k@mitrateknik.id", r: "Kontraktor", t: "PT Mitra Teknik", s: "Undangan", l: "-" },
]);
const q = ref("");
const list = computed(() => users.value.filter((u) => (u.n + u.e + u.t).toLowerCase().includes(q.value.toLowerCase())));
const roleTag: Record<string, string> = { Admin: "j-tag-purple", Editor: "j-tag-cyan", Viewer: "j-tag-grey", Kontraktor: "j-tag-amber" };
const inviteOpen = ref(false);
const inv = reactive({ e: "", r: "Viewer", t: "Team Asset" });
function invite() {
  if (!inv.e.includes("@")) return;
  users.value.push({ n: inv.e.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), e: inv.e, r: inv.r, t: inv.t, s: "Undangan", l: "-" });
  toast.add({ title: "Undangan terkirim", description: inv.e, icon: "i-lucide-mail-check" });
  inviteOpen.value = false;
  inv.e = "";
}
</script>
<template>
  <div class="h-full overflow-y-auto thin-scrollbar">
    <div class="max-w-[1100px] mx-auto px-6 py-6 space-y-5">
      <div class="flex items-end justify-between">
        <div><h1 class="j-title text-[24px]">Manajemen Pengguna</h1><p class="text-[14px] text-j-sub mt-1">Akses tim Planning, Asset, Procurement, dan mitra kontraktor</p></div>
        <button class="j-btn-primary" @click="inviteOpen = true"><UIcon name="i-lucide-user-plus" class="w-4 h-4" />Undang Pengguna</button>
      </div>
      <div class="grid grid-cols-4 gap-4">
        <div v-for="c in [['Total pengguna', users.length], ['Admin', users.filter((u) => u.r === 'Admin').length], ['Editor', users.filter((u) => u.r === 'Editor').length], ['Undangan tertunda', users.filter((u) => u.s === 'Undangan').length]]" :key="c[0]" class="j-card p-4"><p class="j-label text-j-sub">{{ c[0] }}</p><p class="font-display font-bold text-[26px] mt-2">{{ c[1] }}</p></div>
      </div>
      <div class="j-card p-4">
        <div class="flex items-center justify-between"><h3 class="j-title text-[16px]">Daftar Pengguna</h3><div class="relative"><UIcon name="i-lucide-search" class="w-4 h-4 text-j-sub absolute left-3 top-1/2 -translate-y-1/2" /><input v-model="q" class="j-input w-[240px] !pl-9" placeholder="Cari nama, email, tim..." /></div></div>
        <table class="w-full mt-3">
          <thead><tr><th class="j-th">Nama</th><th class="j-th">Tim</th><th class="j-th">Peran</th><th class="j-th">Status</th><th class="j-th">Aktivitas terakhir</th><th class="j-th" /></tr></thead>
          <tbody>
            <tr v-for="u in list" :key="u.e">
              <td class="j-td"><div class="flex items-center gap-3"><span class="w-8 h-8 rounded-full bg-gradient-to-br from-[#00D4FF] to-[#7B2FFF] text-white text-[11px] font-bold flex items-center justify-center">{{ u.n.split(" ").map((w) => w[0]).join("").slice(0, 2) }}</span><div><p class="font-medium">{{ u.n }}</p><p class="text-[11px] text-j-sub">{{ u.e }}</p></div></div></td>
              <td class="j-td">{{ u.t }}</td>
              <td class="j-td"><select v-model="u.r" class="j-select h-7 w-[120px] text-[12px]"><option v-for="r in ['Admin', 'Editor', 'Viewer', 'Kontraktor']" :key="r">{{ r }}</option></select></td>
              <td class="j-td"><span :class="u.s === 'Aktif' ? 'j-tag-teal' : 'j-tag-amber'">{{ u.s }}</span></td>
              <td class="j-td text-j-sub text-[12px]">{{ u.l }}</td>
              <td class="j-td text-right"><span :class="roleTag[u.r]">{{ u.r }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <UModal v-model="inviteOpen">
      <div class="p-6 space-y-4">
        <h3 class="j-title text-[18px]">Undang Pengguna</h3>
        <div><label class="j-field-label">Email</label><input v-model="inv.e" class="j-input" placeholder="nama@jlm.co.id" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="j-field-label">Peran</label><select v-model="inv.r" class="j-select"><option>Admin</option><option>Editor</option><option>Viewer</option><option>Kontraktor</option></select></div>
          <div><label class="j-field-label">Tim</label><select v-model="inv.t" class="j-select"><option>Team Asset</option><option>Network Planning</option><option>Procurement</option><option>Sales & Marketing</option></select></div>
        </div>
        <div class="flex justify-end gap-2"><button class="j-btn-outline" @click="inviteOpen = false">Batal</button><button class="j-btn-primary" @click="invite">Kirim Undangan</button></div>
      </div>
    </UModal>
  </div>
</template>
