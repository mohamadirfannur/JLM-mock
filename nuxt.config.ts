// JLM Network Planner — Jala Lintas Media (prototype, runs fully in the browser)
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2024-10-01",
  devtools: { enabled: false },
  modules: ["@nuxt/ui", "@pinia/nuxt"],
  colorMode: { preference: "light", fallback: "light" },
  tailwindcss: { exposeConfig: false, viewer: false, cssPath: "~/assets/css/main.css" },
  icon: { serverBundle: "local", clientBundle: { scan: true, sizeLimitKb: 512, icons: ["lucide:arrow-left-to-line", "lucide:arrow-right", "lucide:badge-check", "lucide:calculator", "lucide:chart-bar-big", "lucide:chart-column", "lucide:chart-pie", "lucide:check-circle-2", "lucide:circle-check", "lucide:circle-check-big", "lucide:circle-dashed", "lucide:cloud-upload", "lucide:cpu", "lucide:download", "lucide:eye", "lucide:eye-off", "lucide:file-spreadsheet", "lucide:file-text", "lucide:filter", "lucide:folder-kanban", "lucide:git-commit-vertical", "lucide:git-fork", "lucide:history", "lucide:house", "lucide:info", "lucide:layers", "lucide:layout-grid", "lucide:list-checks", "lucide:loader", "lucide:loader-circle", "lucide:locate-fixed", "lucide:map", "lucide:map-pin", "lucide:map-pin-plus", "lucide:map-pinned", "lucide:monitor", "lucide:more-vertical", "lucide:mouse-pointer-click", "lucide:move", "lucide:pen-line", "lucide:pentagon", "lucide:plus", "lucide:route", "lucide:ruler", "lucide:scissors", "lucide:server", "lucide:settings", "lucide:sliders-horizontal", "lucide:spline", "lucide:square-pen", "lucide:table-properties", "lucide:trash-2", "lucide:triangle-alert", "lucide:trophy", "lucide:upload", "lucide:users", "lucide:x"] } },
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
