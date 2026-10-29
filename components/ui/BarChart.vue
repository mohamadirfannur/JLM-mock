<script setup lang="ts">
import { Bar } from "vue-chartjs";
const props = defineProps<{ labels: string[]; values: number[]; colors: string[] | string; height?: number; horizontal?: boolean }>();
const data = computed(() => ({ labels: props.labels, datasets: [{ data: props.values, backgroundColor: props.colors, borderRadius: 6, maxBarThickness: 26 }] }));
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: props.horizontal ? "y" : "x",
  plugins: { legend: { display: false }, datalabels: { display: false } },
  scales: {
    x: { grid: { display: !!props.horizontal, color: "#E4E3E4" }, ticks: { color: "#4C4B4C" } },
    y: { grid: { display: !props.horizontal, color: "#1E1D1E" }, ticks: { color: "#4C4B4C" } },
  },
}));
</script>
<template>
  <div :style="{ height: (height || 200) + 'px' }"><Bar :data="data" :options="options as any" /></div>
</template>
