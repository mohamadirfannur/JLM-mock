// JLM Map Planner — clickable mock (all data is dummy, runs fully in the browser)
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-10-01",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  modules: ["@nuxt/ui", "@pinia/nuxt", "nuxt-svgo"],
  colorMode: { preference: "light", fallback: "light" },
  svgo: { autoImportPath: false, defaultImport: "component" },
  pinia: { storesDirs: ["./stores/**"] },
  runtimeConfig: {
    public: {
      maptilerKey: process.env.NUXT_PUBLIC_MAPTILER_KEY || "LXay2B4qogCZHW7GkRMl",
    },
  },
  app: {
    head: {
      title: "JLM Map Planner",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap",
        },
      ],
    },
  },
});
