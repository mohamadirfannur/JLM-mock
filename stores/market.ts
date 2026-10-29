import { defineStore } from "pinia";
import type { MarketResult } from "~/utils/marketAnalysis";

export interface AoiEntry {
  id: string;
  name: string;
  source: "Digitize" | "Upload" | "Buffer" | "Kelurahan" | "Sample";
  feature: any;
  layers: string[];
  result: MarketResult;
  createdAt: string;
}

const KEY = "jlm-market-aois";

export const useMarketStore = defineStore("market", () => {
  const aois = ref<AoiEntry[]>([]);
  const activeId = ref<string | null>(null);
  const params = ref({ penetration: 30, arpu: 275000 });
  const insights = ref<any[]>([]);
  try {
    const ri = localStorage.getItem(KEY + "-poi");
    if (ri) insights.value = JSON.parse(ri);
  } catch {}
  watch(insights, (v) => {
    try {
      localStorage.setItem(KEY + "-poi", JSON.stringify(v));
    } catch {}
  }, { deep: true });
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) aois.value = JSON.parse(raw);
  } catch {}
  watch(
    aois,
    (v) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(v));
      } catch {}
    },
    { deep: true },
  );
  const active = computed(() => aois.value.find((a) => a.id === activeId.value) || null);
  function add(e: AoiEntry) {
    aois.value.unshift(e);
    activeId.value = e.id;
  }
  function remove(id: string) {
    aois.value = aois.value.filter((a) => a.id !== id);
    if (activeId.value === id) activeId.value = aois.value[0]?.id || null;
  }
  return { aois, activeId, active, params, insights, add, remove };
});
