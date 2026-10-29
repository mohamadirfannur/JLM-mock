<script setup lang="ts">
const props = defineProps<{ coord: [number, number] }>();
defineEmits<{ (e: "close"): void }>();
const { map } = useMap();
const pos = ref<{ x: number; y: number } | null>(null);
function update() {
  const m = map.value;
  if (!m) return;
  const p = m.project(props.coord as any);
  pos.value = { x: p.x, y: p.y };
}
watch(() => props.coord, update, { immediate: true });
onMounted(() => map.value?.on("move", update));
onBeforeUnmount(() => map.value?.off("move", update));
</script>
<template>
  <div v-if="pos" class="absolute z-30 pointer-events-none" :style="{ left: pos.x + 'px', top: pos.y + 'px' }">
    <div class="pointer-events-auto j-panel w-[288px] p-4 -translate-x-1/2 translate-y-4 fade-up"><slot /></div>
  </div>
</template>
