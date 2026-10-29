<script setup lang="ts">
import IcCross from "~/assets/icons/ic-cross.svg";
defineProps<{ label: string; icon?: any; width?: string }>();
defineEmits<{ (e: "close"): void }>();
</script>
<template>
  <div :class="[width || 'w-[24rem]', 'absolute bottom-24 left-1/2 -translate-x-1/2 z-30 rounded-xs bg-white shadow-xl ring-1 ring-grey-200 divide-y divide-grey-200 fade-up max-h-[calc(100vh-14rem)] flex flex-col']">
    <div class="flex items-center gap-[6px] p-2 shrink-0">
      <component :is="icon" v-if="icon" class="w-3 h-3 text-grey-400" :font-controlled="false" />
      <p class="flex-1 text-grey-800 text-2xs font-medium">{{ label }}</p>
      <button @click="$emit('close')"><IcCross class="w-2 h-2 text-grey-400 m-2" :font-controlled="false" /></button>
    </div>
    <div class="overflow-y-auto thin-scrollbar"><slot /></div>
  </div>
</template>
