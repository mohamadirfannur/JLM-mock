<script setup lang="ts">
import heroImage from "~/assets/images/hero-image.png";
useHead({ title: "Masuk · JLM Network Planner" });
const auth = useAuthStore();
const email = ref("asset@jlm.co.id");
const password = ref("jlm-2026");
const show = ref(false);
const loading = ref(false);
const remember = ref(true);
const err = ref("");
function submit() {
  err.value = "";
  if (!email.value || !password.value) return (err.value = "Email dan password wajib diisi.");
  loading.value = true;
  setTimeout(() => {
    auth.login(email.value);
    navigateTo("/home");
  }, 650);
}
</script>

<template>
  <div class="h-screen flex bg-white">
    <div class="w-full lg:w-[46%] flex flex-col px-10 lg:px-20 py-10">
      <JLogo :h="40" />
      <div class="flex-1 flex flex-col justify-center max-w-[420px]">
        <p class="j-label text-j-cyan mb-3">JLM Network Planner</p>
        <h1 class="j-title text-[34px] leading-tight">Selamat datang kembali</h1>
        <p class="text-[14px] text-j-sub mt-2 mb-8">Masuk untuk mengelola aset jaringan, desain FTTH, dan analisis area ekspansi JLM.</p>
        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label class="j-field-label">Email</label>
            <div class="relative">
              <UIcon name="i-lucide-mail" class="w-4 h-4 text-j-mute absolute left-3 top-1/2 -translate-y-1/2" />
              <input v-model="email" type="email" class="j-input h-11 !pl-9" placeholder="nama@jlm.co.id" :disabled="loading" />
            </div>
          </div>
          <div>
            <label class="j-field-label">Password</label>
            <div class="relative">
              <UIcon name="i-lucide-lock" class="w-4 h-4 text-j-mute absolute left-3 top-1/2 -translate-y-1/2" />
              <input v-model="password" :type="show ? 'text' : 'password'" class="j-input h-11 !pl-9 !pr-10" placeholder="Masukkan password" :disabled="loading" />
              <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-j-mute" @click="show = !show"><UIcon :name="show ? 'i-lucide-eye' : 'i-lucide-eye-off'" class="w-4 h-4" /></button>
            </div>
          </div>
          <div class="flex items-center justify-between text-[13px]">
            <label class="flex items-center gap-2 text-j-sub cursor-pointer"><input v-model="remember" type="checkbox" class="accent-[#00D4FF]" /> Ingat saya</label>
            <a class="text-j-blue hover:underline cursor-pointer">Lupa password?</a>
          </div>
          <p v-if="err" class="text-[12px] text-j-red">{{ err }}</p>
          <button type="submit" class="j-btn-grad w-full h-11 text-[14px]" :disabled="loading">
            <UIcon v-if="loading" name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
            {{ loading ? "Memproses..." : "Masuk" }}
          </button>
        </form>
      </div>
      <p class="text-[12px] text-j-mute">© 2026 PT Jala Lintas Media · Connecting the Trust</p>
    </div>
    <div class="hidden lg:block flex-1 p-4">
      <div class="h-full rounded-[20px] relative overflow-hidden bg-cover bg-center" :style="{ backgroundImage: `url(${heroImage})` }">
        <div class="absolute inset-0" style="background: linear-gradient(160deg, rgba(0, 24, 73, 0.92) 10%, rgba(0, 24, 73, 0.55) 60%, rgba(123, 47, 255, 0.45))" />
        <div class="relative h-full flex flex-col justify-end p-14 text-white">
          <p class="j-label text-j-cyan mb-4">Integrated ICT · FTTH · MPLS</p>
          <h2 class="font-display font-bold text-[44px] leading-[1.15] max-w-[560px]">Satu peta untuk seluruh <span class="bg-gradient-to-r from-[#00D4FF] to-[#7B2FFF] bg-clip-text text-transparent">jaringan JLM.</span></h2>
          <div class="grid grid-cols-3 gap-6 mt-10 max-w-[560px]">
            <div v-for="s in [['Asset Management', 'OSP pasif & aktif'], ['FTTH Auto-Design', 'Masterplan per RW'], ['Planning Market', 'Potensi homepass']]" :key="s[0]" class="border-t border-white/25 pt-3">
              <p class="font-display font-bold text-[14px]">{{ s[0] }}</p>
              <p class="text-[12px] text-white/70">{{ s[1] }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
