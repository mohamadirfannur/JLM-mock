export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();
  if (to.path !== "/" && !auth.isSignedIn) return navigateTo("/");
  if (to.path === "/" && auth.isSignedIn) return navigateTo("/home");
});
