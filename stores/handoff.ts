import { defineStore } from "pinia";

/** Passes an AOI from Market Potential into the FTTH wizard. */
export const useHandoffStore = defineStore("handoff", () => {
  const ftthAoi = ref<{ name: string; feature: any; homes: number } | null>(null);
  return { ftthAoi };
});
