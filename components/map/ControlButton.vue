<script setup lang="ts">
defineProps<{ active?: boolean; tip?: string; badge?: number | string }>();
defineEmits<{ (e: "click"): void }>();
</script>
<template>
  <div class="p-2 rounded-xs bg-white/30 backdrop-blur-[2px] relative">
    <UTooltip :text="tip" :popper="{ placement: 'left', offsetDistance: 16 }" :prevent="!tip">
      <button
        class="p-2 rounded-xs transition-colors hover:text-white hover:bg-gradient-to-r hover:from-blue-100 hover:to-blue-600"
        :class="active ? 'text-white bg-gradient-to-r from-blue-100 to-blue-600 ring-2 ring-white/70' : 'bg-white text-black'"
        @click="$emit('click')"
      >
        <slot />
      </button>
    </UTooltip>
    <span v-if="badge" class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">{{ badge }}</span>
  </div>
</template>
