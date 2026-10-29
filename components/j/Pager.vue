<script setup lang="ts">
const props = defineProps<{ total: number; per: number; modelValue: number; label?: string }>();
const emit = defineEmits<{ (e: "update:modelValue", v: number): void }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.per)));
const list = computed(() => {
  const p = props.modelValue, n = pages.value;
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
  const s = new Set([1, 2, n - 1, n, p - 1, p, p + 1].filter((x) => x >= 1 && x <= n));
  const arr = [...s].sort((a, b) => a - b);
  const out: (number | string)[] = [];
  arr.forEach((x, i) => {
    if (i && x - (arr[i - 1] as number) > 1) out.push("…");
    out.push(x);
  });
  return out;
});
</script>
<template>
  <div class="flex items-center justify-between gap-3">
    <p class="text-[13px] text-j-sub">{{ label || `Menampilkan ${Math.min(per, total - (modelValue - 1) * per)} dari ${fmt(total)} data` }}</p>
    <div class="flex items-center gap-1.5">
      <button class="j-btn-outline j-btn-sm font-sans font-normal" :disabled="modelValue <= 1" @click="emit('update:modelValue', modelValue - 1)"><UIcon name="i-lucide-chevron-left" class="w-3.5 h-3.5" /> Sebelumnya</button>
      <template v-for="(x, i) in list" :key="i">
        <span v-if="x === '…'" class="px-1 text-j-sub">…</span>
        <button v-else class="w-8 h-7 rounded-[6px] text-[13px] border" :class="x === modelValue ? 'bg-j-cyan border-j-cyan text-white font-bold' : 'border-j-line bg-white text-j-ink hover:border-j-cyan'" @click="emit('update:modelValue', x as number)">{{ x }}</button>
      </template>
      <button class="j-btn-teal j-btn-sm font-sans font-normal" :disabled="modelValue >= pages" @click="emit('update:modelValue', modelValue + 1)">Selanjutnya <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5" /></button>
    </div>
  </div>
</template>
