<script setup lang="ts">
import heroImage from "~/assets/images/hero-image.png";
const auth = useAuthStore();
const email = ref("planning@jlm.co.id");
const password = ref("demo1234");
const show = ref(false);
const loading = ref(false);
const err = ref("");
function submit() {
  err.value = "";
  if (!email.value || !password.value) return (err.value = "Email dan password wajib diisi.");
  loading.value = true;
  setTimeout(() => {
    auth.login(email.value);
    navigateTo("/home");
  }, 700);
}
</script>

<template>
  <div class="flex p-6 h-screen gap-6">
    <div class="w-full h-full rounded-l-[50px] relative px-24 py-10 overflow-hidden bg-cover bg-center hidden lg:block" :style="{ backgroundImage: `url(${heroImage})` }">
      <div class="absolute inset-0 bg-blue-900/60" />
      <div class="relative z-10 flex flex-col h-full">
        <AppLogo light />
        <div class="flex-1 flex flex-col justify-center">
          <h1 class="text-6xl text-white leading-tight font-semibold">Geospatial Intelligence<br />for Network Planning.</h1>
          <p class="text-white/80 mt-6 max-w-xl">Market Potential · FTTH Auto-Design · Asset Management — satu peta untuk tim Planning & Asset JLM.</p>
        </div>
        <p class="text-white/60 text-xs">Prototype · powered by Cartogram (ID-Teknologi)</p>
      </div>
    </div>
    <div class="w-full p-8 lg:px-24 xl:px-36 py-6">
      <div class="flex flex-col h-full justify-center max-w-md mx-auto">
        <div class="space-y-4 mb-6">
          <AppLogo />
          <h2 class="text-4xl leading-tight">Geospatial Intelligence for Network Planning</h2>
          <p class="text-sm text-grey-500">Sign In to continue your mapping journey with us!</p>
        </div>
        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <UInput v-model="email" type="email" size="xl" icon="i-heroicons-envelope" placeholder="Email Address" :ui="{ rounded: '!rounded-[999px]' }" :disabled="loading" />
          <UInput v-model="password" :type="show ? 'text' : 'password'" size="xl" icon="i-heroicons-lock-closed" placeholder="Password" :ui="{ rounded: '!rounded-[999px]', icon: { trailing: { pointer: '' } } }" :disabled="loading">
            <template #trailing>
              <button type="button" class="text-grey-400" @click="show = !show"><UIcon :name="show ? 'i-heroicons-eye' : 'i-heroicons-eye-slash'" class="w-5 h-5" /></button>
            </template>
          </UInput>
          <p v-if="err" class="text-xs text-red-500">{{ err }}</p>
          <UButton type="submit" block size="xl" :loading="loading" class="bg-gradient-to-r from-brand-400 to-brand-500 text-white justify-center" :ui="{ rounded: 'rounded-[999px]' }">Sign In</UButton>
          <p class="text-[11px] text-grey-500 text-center">Akun demo sudah terisi — langsung klik <b>Sign In</b>.</p>
        </form>
      </div>
    </div>
  </div>
</template>
