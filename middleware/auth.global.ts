export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (to.path !== "/" && !auth.isSignedIn) return navigateTo("/");
  if (to.path === "/" && auth.isSignedIn) return navigateTo("/home");
  const legacy: Record<string, string> = { "/dashboard": "/asset", "/proyek": "/asset/inventaris", "/boq-bom": "/asset/boq-bom", "/peta": "/home", "/peta/asset": "/asset/peta", "/peta/ftth": "/ftth", "/peta/market": "/market", "/map/asset-management": "/asset/peta", "/map/ftth": "/ftth", "/map/market-potential": "/market" };
  if (legacy[to.path]) return navigateTo({ path: legacy[to.path], query: to.query });
});
