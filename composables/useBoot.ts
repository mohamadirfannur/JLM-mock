/** Loads reference data and seeds the local stores (first visit only). */
const booted = ref(false);
export function useBoot() {
  const geo = useGeoData();
  const asset = useAssetStore();
  const ftth = useFtthStore();
  async function boot() {
    if (booted.value) return;
    await geo.load();
    asset.ensureSeed(geo);
    ftth.ensureSeed(geo);
    booted.value = true;
  }
  return { boot, booted, geo };
}
