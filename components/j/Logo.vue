<script setup lang="ts">
import logo from "~/assets/images/jlm-logo.png";
defineProps<{ h?: number }>();
</script>
<template>
  <img :src="logo" alt="Jala Lintas Media" :style="{ height: (h || 35) + 'px' }" class="w-auto max-w-none shrink-0 self-start object-contain select-none" draggable="false" />
</template>
