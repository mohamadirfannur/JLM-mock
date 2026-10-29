// JLM Network Planner — Jala Lintas Media (prototype, runs fully in the browser)
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-10-01",
  devtools: { enabled: false },
  modules: ["@nuxt/ui", "@pinia/nuxt"],
  colorMode: { preference: "light", fallback: "light" },
  tailwindcss: { exposeConfig: false, viewer: false, cssPath: "~/assets/css/main.css" },
  icon: { serverBundle: "local", clientBundle: { scan: true, sizeLimitKb: 512 } },
  pinia: { storesDirs: ["./stores/**"] },
  runtimeConfig: {
    public: {
      maptilerKey: process.env.NUXT_PUBLIC_MAPTILER_KEY || "",
    },
  },
  app: {
    head: {
      title: "JLM Network Planner",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Exo+2:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },
});
