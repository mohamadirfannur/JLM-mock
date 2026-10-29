import { defineStore } from "pinia";

export interface User {
  name: string;
  email: string;
  role: string;
  team: string;
}

const KNOWN: Record<string, Omit<User, "email">> = {
  "asset@jlm.co.id": { name: "Rudi Hartono", role: "Asset Management", team: "Team Asset" },
  "planning@jlm.co.id": { name: "Adit Pradana", role: "Network Planning", team: "Team Planning" },
};

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  try {
    const raw = localStorage.getItem("jlm-auth");
    if (raw) {
      const u = JSON.parse(raw);
      user.value = { team: "Team Asset", role: "Asset Management", ...u };
    }
  } catch {}
  function login(email: string) {
    const k = KNOWN[email.toLowerCase()];
    const name = k?.name || email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    user.value = { email, name, role: k?.role || "Network Planning", team: k?.team || "Team Asset" };
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
  const initials = computed(() => (user.value?.team || "Team Asset").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase());
  return { user, login, logout, initials, isSignedIn: computed(() => !!user.value) };
});
