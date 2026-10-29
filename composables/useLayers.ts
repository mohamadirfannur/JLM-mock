export interface LayerDef {
  id: string;
  label: string;
  group: string;
  color: string;
  kind: "fill" | "line" | "circle" | "symbol" | "heat";
  mapLayers: string[];
  visible: boolean;
  count?: number;
  dashed?: boolean;
  legend?: { label: string; color: string }[];
}

const layers = ref<LayerDef[]>([]);

export function useLayers() {
  const { setVisible } = useMap();

  function register(def: LayerDef) {
    const i = layers.value.findIndex((l) => l.id === def.id);
    if (i >= 0) layers.value[i] = { ...layers.value[i], ...def, visible: layers.value[i].visible };
    else layers.value.push(def);
    setVisible(def.mapLayers, (layers.value.find((l) => l.id === def.id) as LayerDef).visible);
  }
  function unregister(id: string) {
    layers.value = layers.value.filter((l) => l.id !== id);
  }
  function unregisterGroup(group: string) {
    layers.value = layers.value.filter((l) => l.group !== group);
  }
  function toggle(id: string, v?: boolean) {
    const l = layers.value.find((x) => x.id === id);
    if (!l) return;
    l.visible = v ?? !l.visible;
    setVisible(l.mapLayers, l.visible);
  }
  function setCount(id: string, count: number) {
    const l = layers.value.find((x) => x.id === id);
    if (l) l.count = count;
  }
  function reset() {
    layers.value = [];
  }
  const groups = computed(() => {
    const g: Record<string, LayerDef[]> = {};
    layers.value.forEach((l) => (g[l.group] ||= []).push(l));
    return g;
  });
  return { layers, groups, register, unregister, unregisterGroup, toggle, setCount, reset };
}
