import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<{ name: string; email: string; role: string } | null>(null);
  try {
    const raw = localStorage.getItem("jlm-auth");
    if (raw) user.value = JSON.parse(raw);
  } catch {}
  function login(email: string) {
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Tim Planning";
    user.value = { name, email, role: "Planning & Asset Management · JLM" };
    try {
      localStorage.setItem("jlm-auth", JSON.stringify(user.value));
    } catch {}
  }
  function logout() {
    user.value = null;
    try {
      localStorage.removeItem("jlm-auth");
    } catch {}
  }
  return { user, login, logout, isSignedIn: computed(() => !!user.value) };
});
