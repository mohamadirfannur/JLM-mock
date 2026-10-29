export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (to.path !== "/" && !auth.isSignedIn) return navigateTo("/");
  if (to.path === "/" && auth.isSignedIn) return navigateTo("/dashboard");
  // legacy routes
  const legacy: Record<string, string> = { "/home": "/dashboard", "/map/asset-management": "/peta/asset", "/map/ftth": "/peta/ftth", "/map/market-potential": "/peta/market", "/peta": "/peta/asset" };
  if (legacy[to.path]) return navigateTo({ path: legacy[to.path], query: to.query });
});
