import { Chart, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

export default defineNuxtPlugin(() => {
  Chart.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);
  Chart.defaults.font.family = "Raleway, sans-serif";
  Chart.defaults.font.size = 10;
  Chart.defaults.plugins.datalabels = { display: false } as any;
});
