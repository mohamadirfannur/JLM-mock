<script setup lang="ts">
import { Doughnut } from "vue-chartjs";
const props = defineProps<{ labels: string[]; values: number[]; colors: string[]; height?: number }>();
const total = computed(() => props.values.reduce((a, b) => a + b, 0));
const data = computed(() => ({ labels: props.labels, datasets: [{ data: props.values, backgroundColor: props.colors, borderColor: "#FFFFFF", borderWidth: 2 }] }));
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: "62%",
  plugins: {
    legend: { display: false },
    datalabels: {
      display: (ctx: any) => total.value > 0 && ctx.dataset.data[ctx.dataIndex] / total.value > 0.035,
      formatter: (v: number) => ((v / total.value) * 100).toFixed(1) + "%",
      backgroundColor: "#10201D",
      color: "#fff",
      borderRadius: 2,
      padding: { top: 3, bottom: 3, left: 5, right: 5 },
      font: { weight: "bold", size: 9 },
    },
  },
}));
</script>
<template>
  <div>
    <div :style="{ height: (height || 220) + 'px' }"><Doughnut :data="data" :options="options as any" /></div>
    <div class="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3">
      <span v-for="(l, i) in labels" :key="l" class="flex items-center gap-1 text-[11px] text-j-sub">
        <span class="w-2.5 h-2.5 rounded-[2px]" :style="{ background: colors[i] }" />{{ l }}
      </span>
    </div>
  </div>
</template>
